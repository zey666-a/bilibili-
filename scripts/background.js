// B站字幕助手 v2.0 - 后台脚本
console.log('B站字幕助手 v2.0 后台脚本已加载');

// 插件安装事件
chrome.runtime.onInstalled.addListener((details) => {
  console.log('插件安装事件:', details);
  
  if (details.reason === 'install') {
    // 首次安装时初始化设置
    initializeDefaultSettings();
    console.log('B站字幕助手首次安装完成');
  } else if (details.reason === 'update') {
    console.log(`插件已更新，版本: ${details.previousVersion}`);
  }
});

// 浏览器启动事件
chrome.runtime.onStartup.addListener(() => {
  console.log('浏览器启动，B站字幕助手已激活');
});

// 监听来自内容脚本和弹窗的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('后台脚本收到消息:', request, '来自:', sender);

  switch(request.action) {
    case 'updateStatus':
      // 更新插件图标状态
      updateBadgeStatus(request.type, sender.tab?.id);
      sendResponse({ status: 'Badge updated' });
      break;
      
    case 'updateLanguages':
      // 转发语言列表更新到弹窗
      // 这个消息通常由内容脚本发送，需要转发给弹窗
      sendResponse({ status: 'Languages updated' });
      break;
      
    case 'getTabInfo':
      // 获取当前标签页信息
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          sendResponse({
            url: tabs[0].url,
            title: tabs[0].title,
            id: tabs[0].id,
            isBilibili: tabs[0].url?.includes('bilibili.com') || false
          });
        } else {
          sendResponse({ error: 'No active tab found' });
        }
      });
      return true; // 保持消息通道开放
      
    case 'openOptionsPage':
      // 打开选项页面
      chrome.runtime.openOptionsPage();
      sendResponse({ status: 'Options page opened' });
      break;
      
    default:
      console.log('未知的后台操作:', request.action);
      sendResponse({ error: 'Unknown action' });
  }
});

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // 检查是否为B站页面
    if (tab.url.includes('bilibili.com')) {
      console.log('检测到B站页面加载完成:', tab.url);
      
      // 更新图标状态
      updateBadgeStatus('active', tabId);
      
      // 可以在这里发送消息给内容脚本
      chrome.tabs.sendMessage(tabId, {
        action: 'pageLoaded',
        url: tab.url
      }).catch(error => {
        // 忽略消息发送失败（内容脚本可能还未加载）
        console.log('消息发送失败，内容脚本可能未就绪');
      });
    } else {
      // 非B站页面，重置图标状态
      updateBadgeStatus('inactive', tabId);
    }
  }
});

// 监听标签页激活事件
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url && tab.url.includes('bilibili.com')) {
      updateBadgeStatus('active', activeInfo.tabId);
    } else {
      updateBadgeStatus('inactive', activeInfo.tabId);
    }
  });
});

// 初始化默认设置
function initializeDefaultSettings() {
  chrome.storage.sync.set({
    enablePlugin: true,
    defaultLanguage: 'ai-zh',
    autoEnable: true,
    showNotifications: true,
    lastSetupDate: new Date().toISOString()
  }, () => {
    console.log('默认设置已保存');
  });
}

// 更新徽章状态
function updateBadgeStatus(status, tabId) {
  let badgeText = '';
  let badgeColor = '#6c757d';
  
  switch(status) {
    case 'active':
      badgeText = 'ON';
      badgeColor = '#28a745';
      break;
    case 'inactive':
      badgeText = '';
      badgeColor = '#6c757d';
      break;
    case 'error':
      badgeText = '!';
      badgeColor = '#dc3545';
      break;
  }
  
  if (tabId) {
    chrome.action.setBadgeText({
      text: badgeText,
      tabId: tabId
    });
    
    chrome.action.setBadgeBackgroundColor({
      color: badgeColor,
      tabId: tabId
    });
  } else {
    chrome.action.setBadgeText({ text: badgeText });
    chrome.action.setBadgeBackgroundColor({ color: badgeColor });
  }
}

// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  console.log('存储设置发生变化:', changes);
  
  // 如果插件被禁用，清除所有徽章
  if (changes.enablePlugin && !changes.enablePlugin.newValue) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        updateBadgeStatus('inactive', tab.id);
      });
    });
  }
});

// 处理插件图标点击事件（如果需要）
chrome.action.onClicked.addListener((tab) => {
  console.log('插件图标被点击，标签页:', tab.url);
  
  // 如果是B站页面，可以执行特定操作
  if (tab.url && tab.url.includes('bilibili.com')) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'iconClicked'
    }).catch(error => {
      console.log('发送图标点击消息失败:', error);
    });
  }
});

// 定期清理任务
chrome.alarms.create('cleanup-alarm', {
  delayInMinutes: 60, // 1小时后触发
  periodInMinutes: 360 // 每6小时重复一次
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup-alarm') {
    performCleanup();
  }
});

// 执行清理任务
function performCleanup() {
  console.log('执行定期清理任务');
  
  // 清理过期的存储数据
  chrome.storage.local.get(null, (items) => {
    const keysToRemove = [];
    const now = Date.now();
    
    Object.keys(items).forEach(key => {
      // 清理临时数据（如果有的话）
      if (key.startsWith('temp_') && items[key].timestamp) {
        const age = now - items[key].timestamp;
        if (age > 24 * 60 * 60 * 1000) { // 24小时
          keysToRemove.push(key);
        }
      }
    });
    
    if (keysToRemove.length > 0) {
      chrome.storage.local.remove(keysToRemove, () => {
        console.log('已清理过期数据:', keysToRemove);
      });
    }
  });
}

// 错误处理
chrome.runtime.onConnect.addListener((port) => {
  port.onDisconnect.addListener(() => {
    if (chrome.runtime.lastError) {
      console.log('端口断开连接时发生错误:', chrome.runtime.lastError);
    }
  });
});

console.log('B站字幕助手 v2.0 后台脚本初始化完成');