import { generateContent } from './content-generator.js';
import { publish } from './publisher.js';
import { searchDownload } from './utils.js';

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'reopenPopup') {
    chrome.action.openPopup();
  }
  if (request.action === 'generateAndPublish') {
    generateContent(request.config, () => {
      chrome.runtime.sendMessage({ action: 'updateProgress' });
    })
      .then(() => {
        return publish(request.config);
      })
      .then(() => {
        sendResponse({message: '内容生成中，请等待页面完成提示', success: true});
      })
      .catch(error => {
        sendResponse({message: '发生错误: ' + error.message, success: false, error: error.stack});
      });
    return true; // 保持消息通道开放
  }

  if (request.action === "searchDownload") {
    searchDownload(request.filename, sendResponse);
    return true;  // 保持消息通道开放
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, {action: "triggerFileSelection"});
});

chrome.storage.onChanged.addListener(function(changes, namespace) {
  for (let key in changes) {
    if (key === 'tempDownloadFolder' && namespace === 'local') {
      const newValue = changes[key].newValue;
      if (newValue) {
        chrome.storage.sync.set({downloadFolder: newValue}, function() {
          chrome.storage.local.remove('tempDownloadFolder');
          chrome.action.openPopup();
        });
      }
    }
  }
});
