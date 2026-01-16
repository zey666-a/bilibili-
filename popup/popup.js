// B站字幕助手 v2.0 - 弹窗脚本
document.addEventListener('DOMContentLoaded', () => {
  console.log('B站字幕助手 v2.0 弹窗已加载');
  
  // 获取DOM元素
  const enablePlugin = document.getElementById('enablePlugin');
  const defaultLanguage = document.getElementById('defaultLanguage');
  const currentVideoCard = document.getElementById('currentVideoCard');
  const availableLanguages = document.getElementById('availableLanguages');
  const languageControls = document.getElementById('languageControls');
  const refreshSubtitles = document.getElementById('refreshSubtitles');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const toggleLabel = document.getElementById('toggleLabel');
  
  // 加载保存的设置
  loadSettings();
  
  // 检查当前标签页是否为B站
  checkCurrentTab();
  
  // 绑定事件监听器
  enablePlugin.addEventListener('change', handlePluginToggle);
  defaultLanguage.addEventListener('change', handleLanguageChange);
  refreshSubtitles.addEventListener('click', handleRefreshSubtitles);
  
  // 添加界面动画效果
  initializeAnimations();
});

// 初始化动画效果
function initializeAnimations() {
  // 为卡片添加进入动画
  const cards = document.querySelectorAll('.card');
  cards.forEach((card, index) => {
    card.style.animationDelay = `${index * 0.1}s`;
    card.classList.add('card-enter');
  });
}

// 加载保存的设置
async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get({
      enablePlugin: true,
      defaultLanguage: 'ai-zh'
    });
    
    document.getElementById('enablePlugin').checked = settings.enablePlugin;
    document.getElementById('defaultLanguage').value = settings.defaultLanguage;
    
    // 更新切换标签
    updateToggleLabel(settings.enablePlugin);
    
    updateStatus(settings.enablePlugin ? 'active' : 'inactive', 
                settings.enablePlugin ? '插件已启用，正在监控B站页面' : '插件已禁用');
  } catch (error) {
    console.error('加载设置失败:', error);
    updateStatus('error', '加载设置失败');
  }
}

// 检查当前标签页
async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab.url && tab.url.includes('bilibili.com')) {
      updateStatus('active', '已检测到B站页面，字幕助手就绪');
      showVideoCard();
      
      // 请求当前视频的字幕信息
      chrome.tabs.sendMessage(tab.id, { action: 'getAvailableLanguages' }, (response) => {
        if (response && response.languages) {
          displayAvailableLanguages(response.languages);
        }
      });
    } else {
      updateStatus('inactive', '请访问B站视频页面使用字幕助手');
      hideVideoCard();
    }
  } catch (error) {
    console.error('检查标签页失败:', error);
    updateStatus('error', '检查页面失败，请刷新重试');
  }
}

// 显示视频卡片
function showVideoCard() {
  const card = document.getElementById('currentVideoCard');
  card.style.display = 'block';
  setTimeout(() => {
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  }, 100);
}

// 隐藏视频卡片
function hideVideoCard() {
  const card = document.getElementById('currentVideoCard');
  card.style.opacity = '0';
  card.style.transform = 'translateY(10px)';
  setTimeout(() => {
    card.style.display = 'none';
  }, 300);
}

// 处理插件开关
async function handlePluginToggle(event) {
  const enabled = event.target.checked;
  
  try {
    await chrome.storage.sync.set({ enablePlugin: enabled });
    updateToggleLabel(enabled);
    updateStatus(enabled ? 'active' : 'inactive', 
                enabled ? '插件已启用，正在监控B站页面' : '插件已禁用');
    
    // 通知内容脚本插件状态变化
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.url && tab.url.includes('bilibili.com')) {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'pluginToggle', 
        enabled: enabled 
      });
    }
    
    // 添加反馈动画
    addFeedbackAnimation(event.target.closest('.toggle-switch'));
  } catch (error) {
    console.error('保存插件状态失败:', error);
    updateStatus('error', '保存设置失败，请重试');
  }
}

// 更新切换标签
function updateToggleLabel(enabled) {
  const label = document.getElementById('toggleLabel');
  label.textContent = enabled ? '已启用' : '已禁用';
  label.style.color = enabled ? 'white' : 'rgba(255, 255, 255, 0.7)';
}

// 处理默认语言变化
async function handleLanguageChange(event) {
  const language = event.target.value;
  
  try {
    await chrome.storage.sync.set({ defaultLanguage: language });
    
    // 通知内容脚本语言设置变化
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.url && tab.url.includes('bilibili.com')) {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'languageChange', 
        language: language 
      });
    }
    
    // 显示语言切换反馈
    const languageName = language === 'ai-zh' ? '中文' : '英文';
    showToast(`默认语言已切换为${languageName}`);
    
    // 添加反馈动画
    addFeedbackAnimation(event.target);
  } catch (error) {
    console.error('保存语言设置失败:', error);
    showToast('保存语言设置失败', 'error');
  }
}

// 处理刷新字幕列表
function handleRefreshSubtitles() {
  const button = document.getElementById('refreshSubtitles');
  button.classList.add('loading');
  button.disabled = true;
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0].url && tabs[0].url.includes('bilibili.com')) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'refreshSubtitles' }, (response) => {
        button.classList.remove('loading');
        button.disabled = false;
        
        if (response && response.languages) {
          displayAvailableLanguages(response.languages);
          showToast('字幕列表已刷新');
        } else {
          showToast('刷新失败，请重试', 'error');
        }
      });
    } else {
      button.classList.remove('loading');
      button.disabled = false;
      showToast('请在B站页面使用此功能', 'error');
    }
  });
}

// 显示可用语言列表
function displayAvailableLanguages(languages) {
  const container = document.getElementById('availableLanguages');
  
  if (!languages || languages.length === 0) {
    container.innerHTML = '<p class="no-subtitles">暂无可用字幕</p>';
    document.getElementById('languageControls').style.display = 'none';
    return;
  }
  
  let html = '<div class="language-list">';
  languages.forEach((lang, index) => {
    const flag = lang.code.includes('zh') ? '🇨🇳' : 
                 lang.code.includes('en') ? '🇺🇸' : '🌐';
    html += `
      <div class="language-item" data-code="${lang.code}" style="animation-delay: ${index * 0.1}s">
        <span class="language-name">${flag} ${lang.name}</span>
        <button class="select-language" data-code="${lang.code}">选择</button>
      </div>
    `;
  });
  html += '</div>';
  
  container.innerHTML = html;
  document.getElementById('languageControls').style.display = 'block';
  
  // 绑定语言选择按钮事件
  container.querySelectorAll('.select-language').forEach(button => {
    button.addEventListener('click', (e) => {
      const langCode = e.target.dataset.code;
      selectLanguage(langCode, e.target);
    });
  });
}

// 选择特定语言
function selectLanguage(langCode, buttonElement) {
  buttonElement.classList.add('loading');
  buttonElement.disabled = true;
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0].url && tabs[0].url.includes('bilibili.com')) {
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'selectLanguage', 
        langCode: langCode 
      }, (response) => {
        buttonElement.classList.remove('loading');
        buttonElement.disabled = false;
        
        if (response && response.success) {
          updateStatus('active', `已切换到: ${response.languageName}`);
          showToast(`已切换到: ${response.languageName}`);
          addFeedbackAnimation(buttonElement);
        } else {
          showToast('切换失败，请重试', 'error');
        }
      });
    }
  });
}

// 更新状态显示
function updateStatus(type, message) {
  const indicator = document.getElementById('statusIndicator');
  const text = document.getElementById('statusText');
  
  // 移除所有状态类
  indicator.className = 'status-dot';
  
  // 添加对应状态类
  switch (type) {
    case 'active':
      indicator.classList.add('status-active');
      break;
    case 'inactive':
      indicator.classList.add('status-inactive');
      break;
    case 'error':
      indicator.classList.add('status-error');
      break;
  }
  
  text.textContent = message;
  
  // 添加状态更新动画
  text.style.opacity = '0';
  setTimeout(() => {
    text.style.opacity = '1';
  }, 150);
}

// 显示提示消息
function showToast(message, type = 'success') {
  // 移除现有的toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  // 添加toast样式
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 16px;
    background: ${type === 'error' ? '#f56565' : '#48bb78'};
    color: white;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 1000;
    animation: toastSlideIn 0.3s ease-out;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  `;
  
  document.body.appendChild(toast);
  
  // 3秒后自动移除
  setTimeout(() => {
    toast.style.animation = 'toastSlideOut 0.3s ease-in forwards';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }, 3000);
}

// 添加反馈动画
function addFeedbackAnimation(element) {
  element.style.transform = 'scale(0.95)';
  setTimeout(() => {
    element.style.transform = 'scale(1)';
  }, 150);
}

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateStatus') {
    updateStatus(request.type, request.message);
  } else if (request.action === 'updateLanguages') {
    displayAvailableLanguages(request.languages);
  }
});

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
  .card-enter {
    animation: cardSlideIn 0.5s ease-out forwards;
  }
  
  @keyframes cardSlideIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes toastSlideIn {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  @keyframes toastSlideOut {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(100%);
    }
  }
`;
document.head.appendChild(style);