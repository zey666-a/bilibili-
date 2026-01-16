// B站字幕助手 v2.0 - 内容脚本
console.log('B站字幕助手 v2.0 已加载');

// 插件配置
let pluginSettings = {
  enablePlugin: true,
  defaultLanguage: 'ai-zh'
};

// 状态变量
let isVideoLoaded = false;
let currentVideoUrl = '';
let subtitleCheckInterval = null;
let retryCount = 0;
const MAX_RETRY = 15;

// 初始化插件
async function initPlugin() {
  try {
    // 加载设置
    const settings = await chrome.storage.sync.get({
      enablePlugin: true,
      defaultLanguage: 'ai-zh'
    });
    
    pluginSettings = settings;
    console.log('插件设置已加载:', pluginSettings);
    
    if (pluginSettings.enablePlugin) {
      startMonitoring();
    }
  } catch (error) {
    console.error('初始化插件失败:', error);
  }
}

// 开始监控视频变化
function startMonitoring() {
  // 监听URL变化（B站单页应用）
  let lastUrl = location.href;
  
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      console.log('检测到页面URL变化:', lastUrl);
      handlePageChange();
    }
  });
  
  urlObserver.observe(document, { subtree: true, childList: true });
  
  // 初始检查
  handlePageChange();
  
  // 监听视频元素变化
  const videoObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        const addedNodes = Array.from(mutation.addedNodes);
        addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 检查是否有新的视频元素
            if (node.tagName === 'VIDEO' || node.querySelector('video')) {
              console.log('检测到新的视频元素');
              setTimeout(() => handleVideoLoad(), 1000);
            }
          }
        });
      }
    });
  });
  
  videoObserver.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
}

// 处理页面变化
function handlePageChange() {
  if (isBilibiliVideoPage()) {
    console.log('检测到B站视频页面');
    currentVideoUrl = location.href;
    isVideoLoaded = false;
    retryCount = 0;
    
    // 等待视频加载
    setTimeout(() => {
      handleVideoLoad();
    }, 3000);
  }
}

// 检查是否为B站视频页面
function isBilibiliVideoPage() {
  return location.hostname.includes('bilibili.com') && 
         (location.pathname.includes('/video/') || 
          location.pathname.includes('/bangumi/play/'));
}

// 处理视频加载
function handleVideoLoad() {
  if (!pluginSettings.enablePlugin) {
    console.log('插件已禁用，跳过字幕处理');
    return;
  }
  
  console.log('开始处理视频字幕...');
  
  // 清除之前的检查间隔
  if (subtitleCheckInterval) {
    clearInterval(subtitleCheckInterval);
  }
  
  // 开始检查字幕按钮
  subtitleCheckInterval = setInterval(() => {
    checkAndEnableSubtitles();
  }, 1000);
  
  // 15秒后停止检查
  setTimeout(() => {
    if (subtitleCheckInterval) {
      clearInterval(subtitleCheckInterval);
      subtitleCheckInterval = null;
    }
  }, 15000);
}

// 检查并启用字幕
function checkAndEnableSubtitles() {
  const subtitleButton = document.querySelector('.bpx-player-ctrl-subtitle');
  
  if (!subtitleButton) {
    retryCount++;
    if (retryCount > MAX_RETRY) {
      console.log('未找到字幕按钮，停止尝试');
      if (subtitleCheckInterval) {
        clearInterval(subtitleCheckInterval);
        subtitleCheckInterval = null;
      }
    }
    return;
  }
  
  console.log('找到字幕按钮');
  
  // 检查字幕是否已经开启
  if (isSubtitleEnabled()) {
    console.log('字幕已经开启，无需处理');
    if (subtitleCheckInterval) {
      clearInterval(subtitleCheckInterval);
      subtitleCheckInterval = null;
    }
    return;
  }
  
  // 点击字幕按钮以加载字幕菜单
  console.log('打开字幕菜单');
  subtitleButton.click();
  
  // 等待菜单加载后处理字幕
  setTimeout(() => {
    processSubtitles();
  }, 800);
}

// 检查字幕是否已启用
function isSubtitleEnabled() {
  // 检查字幕按钮是否有激活状态
  const subtitleButton = document.querySelector('.bpx-player-ctrl-subtitle');
  if (subtitleButton) {
    const resultText = subtitleButton.querySelector('.bpx-player-ctrl-subtitle-result');
    if (resultText && resultText.textContent.trim() !== '字幕') {
      return true; // 如果显示的不是"字幕"而是具体语言，说明已启用
    }
  }
  return false;
}

// 检查字幕菜单是否已打开
function isSubtitleMenuOpen() {
  const menu = document.querySelector('.bpx-player-ctrl-subtitle-box');
  return menu && menu.style.display !== 'none' && getComputedStyle(menu).display !== 'none';
}

// 处理字幕设置
function processSubtitles() {
  const availableLanguages = getAvailableLanguages();
  
  if (availableLanguages.length === 0) {
    console.log('当前视频无可用字幕');
    closeSubtitleMenu();
    return;
  }
  
  console.log('可用字幕语言:', availableLanguages);
  
  // 通知弹窗更新语言列表
  chrome.runtime.sendMessage({
    action: 'updateLanguages',
    languages: availableLanguages
  });
  
  // 启用单语字幕
  enableSingleLanguageSubtitle(availableLanguages);
  
  // 不要立即关闭菜单，让字幕设置生效
  setTimeout(() => {
    // 停止检查
    if (subtitleCheckInterval) {
      clearInterval(subtitleCheckInterval);
      subtitleCheckInterval = null;
    }
    isVideoLoaded = true;
    console.log('字幕处理完成');
  }, 1000);
}

// 获取可用字幕语言列表
function getAvailableLanguages() {
  const container = document.querySelector('.bpx-player-ctrl-subtitle-major-content');
  if (!container) return [];
  
  const items = container.querySelectorAll('[data-lan]');
  const languages = Array.from(items).map(el => ({
    code: el.getAttribute('data-lan'),
    name: el.innerText.trim()
  }));
  
  return languages.filter(lang => lang.code && lang.name);
}

// 启用单语字幕
function enableSingleLanguageSubtitle(availableLanguages) {
  console.log('启用单语字幕');
  
  // 查找首选语言
  let targetLanguage = availableLanguages.find(lang => 
    lang.code === pluginSettings.defaultLanguage
  );
  
  // 如果找不到首选语言，使用备选方案
  if (!targetLanguage) {
    if (pluginSettings.defaultLanguage === 'ai-en') {
      // 如果首选英文但没有，尝试中文
      targetLanguage = availableLanguages.find(lang => 
        lang.code.includes('zh') || lang.code === 'ai-zh'
      );
    } else {
      // 如果首选中文但没有，尝试英文
      targetLanguage = availableLanguages.find(lang => 
        lang.code.includes('en') || lang.code === 'ai-en'
      );
    }
  }
  
  // 如果还是没有，使用第一个可用的
  if (!targetLanguage && availableLanguages.length > 0) {
    targetLanguage = availableLanguages[0];
  }
  
  if (targetLanguage) {
    selectLanguage(targetLanguage.code);
    console.log(`已启用字幕: ${targetLanguage.name}`);
  }
}

// 选择特定语言字幕
function selectLanguage(lanCode) {
  console.log(`选择字幕语言: ${lanCode}`);
  
  // 找到主字幕区域
  const majorContainer = document.querySelector('.bpx-player-ctrl-subtitle-major-content');
  if (!majorContainer) {
    console.log('未找到主字幕容器');
    return false;
  }
  
  // 根据 data-lan 属性定位语言
  const targetItem = majorContainer.querySelector(`[data-lan="${lanCode}"]`);
  if (targetItem) {
    targetItem.click();
    console.log(`已自动切换到语言: ${lanCode}`);
    return true;
  } else {
    console.log(`未找到代码为 ${lanCode} 的字幕轨`);
    return false;
  }
}

// 关闭字幕菜单
function closeSubtitleMenu() {
  const closeButton = document.querySelector('.bpx-player-ctrl-subtitle-close-switch');
  if (closeButton) {
    closeButton.click();
    console.log('已关闭字幕菜单');
  } else {
    // 尝试点击其他地方关闭菜单
    const player = document.querySelector('.bpx-player-video-wrap');
    if (player) {
      player.click();
    }
  }
}

// 监听来自弹窗的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('收到消息:', request);
  
  switch (request.action) {
    case 'pluginToggle':
      pluginSettings.enablePlugin = request.enabled;
      if (request.enabled && isBilibiliVideoPage()) {
        handleVideoLoad();
      }
      sendResponse({ success: true });
      break;
      
    case 'languageChange':
      pluginSettings.defaultLanguage = request.language;
      sendResponse({ success: true });
      break;
      
    case 'getAvailableLanguages':
      const languages = getAvailableLanguages();
      sendResponse({ languages: languages });
      break;
      
    case 'refreshSubtitles':
      const refreshedLanguages = getAvailableLanguages();
      sendResponse({ languages: refreshedLanguages });
      break;
      
    case 'selectLanguage':
      const success = selectLanguage(request.langCode);
      const selectedLang = getAvailableLanguages().find(l => l.code === request.langCode);
      sendResponse({ 
        success: success, 
        languageName: selectedLang ? selectedLang.name : request.langCode 
      });
      break;
      
    default:
      console.log('未知操作:', request.action);
      sendResponse({ error: 'Unknown action' });
  }
  
  return true; // 保持消息通道开放
});

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPlugin);
} else {
  initPlugin();
}

// 监听页面可见性变化
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && pluginSettings.enablePlugin && isBilibiliVideoPage()) {
    // 页面重新可见时，检查是否需要重新处理字幕
    setTimeout(() => {
      if (!isVideoLoaded || currentVideoUrl !== location.href) {
        handlePageChange();
      }
    }, 1000);
  }
});

console.log('B站字幕助手 v2.0 初始化完成');