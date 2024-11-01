import { injectContentScript } from './utils.js';

export async function publish(config) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({url: "https://creator.xiaohongshu.com/*"}, async function(tabs) {
      try {
        const tabId = await getOrCreateTab(tabs);
        await injectContentScript(tabId);

        chrome.tabs.sendMessage(tabId, {action: "checkReady"}, function(response) {
          if (response && response.ready) {
            sendContentToTab(tabId, config, resolve, reject);
          } else {
            reject(new Error('内容脚本未准备就绪'));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function getOrCreateTab(tabs) {
  if (tabs.length === 0) {
    const newTab = await chrome.tabs.create({url: "https://creator.xiaohongshu.com/publish/publish"});
    await waitForTabLoad(newTab.id);
    return newTab.id;
  } else {
    return tabs[0].id;
  }
}

function waitForTabLoad(tabId) {
  return new Promise(resolve => {
    chrome.tabs.onUpdated.addListener(function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}

async function sendContentToTab(tabId, config, resolve, reject) {
  try {
    chrome.tabs.sendMessage(tabId, {
      action: 'publish',
      content: config.content,
      publishDirectly: config.publishDirectly
    }, function(response) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (response && response.success) {
        resolve();
      } else {
        reject(new Error('内容脚本未能填充内容'));
      }
    });
  } catch (error) {
    reject(error);
  }
}
