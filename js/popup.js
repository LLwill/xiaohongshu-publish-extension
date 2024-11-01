// popup.js

function log(message) {
  const debugLog = document.getElementById('debugLog');
  if (debugLog) {
    debugLog.textContent += message + '\n';
    debugLog.scrollTop = debugLog.scrollHeight;
  }
}

let mockProgress = 0;
let progressInterval;
let startTime;

function showLoading() {
  mockProgress = 0;
  const loadingOverlay = document.getElementById('loading');
  if (loadingOverlay) loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  mockProgress = 0;
  if (progressInterval) {
    clearInterval(progressInterval);
  }
  const loadingOverlay = document.getElementById('loading');
  if (loadingOverlay) loadingOverlay.style.display = 'none';
}

function updateProgress() {
  const loadText = document.getElementById('loading-text');
  
  if (loadText && mockProgress === 0) {
    startTime = Date.now();
    progressInterval = setInterval(() => {
      const elapsedTime = Date.now() - startTime;
      
      if (mockProgress < 95) {
        // 使用 sigmoid 函数使进度增长更自然
        mockProgress = 100 / (1 + Math.exp(-0.0005 * (elapsedTime - 4000)));
        
        // 添加小幅度随机波动
        mockProgress += (Math.random() - 0.5) * 2;
        
        // 确保进度不超过 95%
        mockProgress = Math.min(mockProgress, 95);
        
        loadText.textContent = `内容生成中 ${Math.round(mockProgress)}%`;
        
        // 模拟偶尔的停顿
        if (Math.random() < 0.1) {
          clearInterval(progressInterval);
          setTimeout(() => updateProgress(), Math.random() * 1000 + 500);
        }
      } else {
        clearInterval(progressInterval);
      }
    }, 400);
  }
}

function completeProgress() {
  const loadText = document.getElementById('loading-text');
  
  if (loadText) {
    clearInterval(progressInterval);
    
    // 模拟最后阶段的缓慢增长
    let finalInterval = setInterval(() => {
      mockProgress += (100 - mockProgress) / 10;
      loadText.textContent = `内容生成中 ${Math.round(mockProgress)}%`;
      
      if (mockProgress > 99.9) {
        clearInterval(finalInterval);
        mockProgress = 100;
        loadText.textContent = '内容生成完成 100%';
      }
    }, 200);
  }
}

function resetProgress() {
  clearInterval(progressInterval);
  mockProgress = 0;
}

function tips(msg) {
  const statusDiv = document.getElementById('status');
  if (statusDiv && msg) {
    statusDiv.textContent = msg;
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const configForm = document.getElementById('configForm');
  const statusDiv = document.getElementById('status');
  const difyApiKeyInput = document.getElementById('difyApiKey');
  const publishDirectlyCheckbox = document.getElementById('publishDirectly');
  const basicInstructionTextarea = document.getElementById('basicInstruction');
  const backgroundDetailTextarea = document.getElementById('backgroundDetail');
  const styleInput = document.getElementById('style');
  const generateButton = document.getElementById('generate');
  const clearContent = document.getElementById('clear-content');

  // 加载保存的配置
  chrome.storage.sync.get(['difyApiKey', 'publishDirectly', 'basicInstruction', 'backgroundDetail', 'style'], function(result) {
    if (difyApiKeyInput) difyApiKeyInput.value = result.difyApiKey || '';
    if (publishDirectlyCheckbox) publishDirectlyCheckbox.checked = result.publishDirectly || false;
    if (basicInstructionTextarea) basicInstructionTextarea.value = result.basicInstruction || '';
    if (backgroundDetailTextarea) backgroundDetailTextarea.value = result.backgroundDetail || '';
    if (styleInput) styleInput.value = result.style || '生动的';
    
    // 更新生成按钮文案
    if (generateButton) {
      generateButton.innerHTML = publishDirectlyCheckbox.checked ? '生成并发布' : '生成';
    }
  });

  if (configForm) {
    // checkbox监听，修改按钮文案
    publishDirectlyCheckbox.addEventListener('change', function(e) {
      const checked = publishDirectlyCheckbox.checked;
      generateButton.innerHTML = checked ? '生成并发布' : '生成';
      
      // 保存 publishDirectly 的状态
      chrome.storage.sync.set({publishDirectly: checked});
    });

    // 为所有输入字段添加 'input' 事件监听器
    [difyApiKeyInput, basicInstructionTextarea, backgroundDetailTextarea, styleInput].forEach(element => {
      if (element) {
        element.addEventListener('input', function() {
          // 保存当前输入的值
          chrome.storage.sync.set({[element.id]: element.value});
        });
      }
    });

    configForm.addEventListener('submit', function(e) {
      e.preventDefault();

      const config = {
        difyApiKey: difyApiKeyInput ? difyApiKeyInput.value.trim() : '',
        publishDirectly: publishDirectlyCheckbox ? publishDirectlyCheckbox.checked : false,
        basicInstruction: basicInstructionTextarea ? basicInstructionTextarea.value.trim() : '',
        backgroundDetail: backgroundDetailTextarea ? backgroundDetailTextarea.value.trim() : '',
        style: styleInput ? styleInput.value.trim() : ''
      };
      // 避免空格
      if (!config.difyApiKey) {
        tips('Dify API Key必填')
        return;
      }
      if (!config.basicInstruction) {
        tips('主题要求必填')
        return;
      }

      // 显示加载指示器
      showLoading();

      // 发送消息给background脚本开始生成和发布过程
      chrome.runtime.sendMessage({action: 'generateAndPublish', config: config}, function(response) {
        if (statusDiv) statusDiv.textContent = response.message;

        // 隐藏加载指示器
        hideLoading();
      });
    });
  }

  const togglePasswordButton = document.getElementById('togglePassword');

  if (togglePasswordButton) {
    togglePasswordButton.addEventListener('click', function() {
      const apiKeyInput = document.getElementById('difyApiKey');
      if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        togglePasswordButton.textContent = '👁️'; // 切换为显示图标
      } else {
        apiKeyInput.type = 'password';
        togglePasswordButton.textContent = '🙈'; // 切换为隐藏图标
      }
    });
  }

  // 添加清空内容的功能
  if (clearContent) {
    clearContent.addEventListener('click', function() {
      // 清空指定字段的内容
      if (basicInstructionTextarea) basicInstructionTextarea.value = '';
      if (backgroundDetailTextarea) backgroundDetailTextarea.value = '';
      if (styleInput) styleInput.value = '';

      // 从存储中删除相应的数据
      chrome.storage.sync.remove(['basicInstruction', 'backgroundDetail', 'style'], function() {
        if (statusDiv) statusDiv.textContent = '内容已清空';
      });
    });
  }

  // 监听来自background的进度更新消息
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'updateProgress') {
      updateProgress();
    }
  });
});
