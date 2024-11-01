// content.js
function sleep(time) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), time);
  });
}

// 辅助函数：等待元素出现
// 使用 XPath 的版本
async function waitForElementXPath(xpath, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const element = result.singleNodeValue;
      if (element) {
        clearInterval(interval);
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        reject(new Error(`Element ${xpath} not found within ${timeout}ms`));
      }
    }, 100);
  });
}

// 辅助函数：模拟人工输入
async function simulateTyping(element, text, simulate = false) {
  if (simulate) {
    // 模拟逐个字符输入
    for (let char of text) {
      if (element.isContentEditable) {
        element.innerText += char; // 使用 innerText 追加字符
      } else {
        element.value += char; // 使用 value 追加字符
      }
      element.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50)); // 随机延迟
    }
  } else {
    // 直接输入，追加内容
    if (element.isContentEditable) {
      element.innerText += text; // 直接追加内容
    } else {
      element.value += text; // 直接追加内容
    }
    element.dispatchEvent(new Event('input', { bubbles: true })); // 触发输入事件
    await sleep(2000);
  }
}

// 主发布函数
async function publishContent(content, publishDirectly) {
  try {
    // 点击"发布笔记"按钮
    await waitForElementXPath('//*[text()=" 发布笔记 "]')
      .then(element => {
        element.click();
      })
      .catch(error => {
        console.error('发布笔记按钮未找到', error);
      });

    // 根据内容类型选择上传方式
    if (content.type === 'image') {
      await waitForElementXPath('//*[text()="上传图文"]')
      .then(element => {
        element.click();
      })
      .catch(error => {
        console.error('上传图文按钮未找到', error);
      });

      await uploadImageFromUrl(content.coverImageUrl);
    }

    // 填写标题
    const titleInput = await waitForElementXPath('//*[@placeholder="填写标题会有更多赞哦～"]')
    .then(element => {
      element.click();
      return element;
    })
    .catch(error => {
      console.error('标题Input未找到', error);
    });

    await simulateTyping(titleInput, content.title);

    // 填写描述
    const descriptionInput = document.getElementById('post-textarea');
    if (!descriptionInput) {
      throw new Error('描述Input未找到')
    }
    descriptionInput.click();
    await simulateTyping(descriptionInput, content.content + '\n\n\n');
    await sleep(200);
    descriptionInput.scrollTo(0, 1000);
    await sleep(200);
    scrollToPageBottom();

    await addTags(content, descriptionInput);

    // 点击发布按钮
    if (publishDirectly) {
      const finalPublishButton = await waitForElementXPath('//*[text()="发布"]');
      finalPublishButton.click();
    } else {
      alert("内容填充完成，您可以手动发布。");
    }
  } catch (error) {
    console.error("发布过程中出错：", error);
  }
}

let pendingDownloadId = null;

async function uploadImages(imagePaths) {
  try {
    // 等待文件输入元素出现
    const fileInput = await waitForElementXPath('//input[@type="file"]');

    // 遍历所有图片路径
    for (const imagePath of imagePaths) {
      try {
        // 搜索下载项
        const searchResponse = await new Promise((resolve) => {
          chrome.runtime.sendMessage({action: "searchDownload", filename: imagePath}, resolve);
        });

        if (!searchResponse.success) {
          console.error(`未找到下载项: ${imagePath}`);
          continue;
        }

        pendingDownloadId = searchResponse.downloadId;

        // 提示用户点击扩展图标
        alert("请点击扩展图标以选择文件");

        // 等待用户在文件选择对话框中选择文件
        await new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (fileInput.files.length > 0) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });

        // 触发 change 事件
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));

        // 等待一段时间，确保文件上传完成
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error processing image ${imagePath}:`, error);
      }
    }

  } catch (error) {
    console.error('Error in uploadImages:', error);
  }
}

// 添加一个新的监听器来处理来自背景脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "triggerFileSelection" && pendingDownloadId) {
    chrome.downloads.open(pendingDownloadId);
    pendingDownloadId = null;
  }
});

async function addTags(content, descriptionInput) {
  for (let tag of content.tags) {
    // 将光标移动到内容末尾
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(descriptionInput);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);

    // 输入空格和#
    await simulateInput(descriptionInput, ' ');
    await simulateInput(descriptionInput, tag);
    await sleep(1000);
    // 等待备选项出现
    await waitForTopicItems(3000);

    // 查找并点击匹配的标签
    const topicItems = document.querySelectorAll('.publish-topic-item');
    for (let item of topicItems) {
      if (item.textContent.includes(tag)) {

        // 确保元素可见
        item.scrollIntoView();
        await sleep(100);
        item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        item.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        item.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        break;
      }
    }

    // 等待点击后的处理
    await sleep(1000);
  }
}

async function simulateInput(element, char) {
  element.focus();

  // 使用 execCommand 插入文本
  document.execCommand('insertText', false, char);

  // 创建并分发输入事件
  const inputEvent = new InputEvent('input', {
    inputType: 'insertText',
    data: char,
    bubbles: true,
    cancelable: true
  });
  element.dispatchEvent(inputEvent);

  // 创建并分发 keydown 事件
  const keydownEvent = new KeyboardEvent('keydown', {
    key: char,
    keyCode: char.charCodeAt(0),
    which: char.charCodeAt(0),
    bubbles: true,
    cancelable: true
  });
  element.dispatchEvent(keydownEvent);

  // 创建并分发 keyup 事件
  const keyupEvent = new KeyboardEvent('keyup', {
    key: char,
    keyCode: char.charCodeAt(0),
    which: char.charCodeAt(0),
    bubbles: true,
    cancelable: true
  });
  element.dispatchEvent(keyupEvent);

  // 等待一小段时间，模拟真实输入速度
  await new Promise(resolve => setTimeout(resolve, 20));
}

function waitForTopicItems(timeout) {
  return new Promise(resolve => {
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (document.querySelectorAll('.publish-topic-item').length > 0 || Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);
  });
}

// 监听来自背景脚本的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "checkReady") {
    console.debug("checkReady");
    sendResponse({ready: true});
  }

  if (request.action === "publish") {
    console.debug("request", request);
    const content = {
      type: request.content.type,
      coverImageUrl: request.content.coverImageUrl,
      title: request.content.title,
      content: request.content.content,
      tags: request.content.tags,
    };
    publishContent(content, request.publishDirectly);
    sendResponse({success: true});
  }
});


async function uploadImageFromUrl(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });

    const fileInput = await waitForElementXPath('//input[@type="file"]');

    // 创建一个 DataTransfer 对象
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    // 触发 change 事件
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    // 等待一段时间，确保文上传完成
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    console.error(`Error uploading image from URL ${url}:`, error);
  }
}

// 小屏幕滚动内容
function scrollToPageBottom() {
  // 找到目标元素
  const targetElement = document.getElementById('post-textarea');

  if (targetElement) {
    // 创建一个模拟鼠标移动的函数
    function simulateMouseMove() {
      const event = new MouseEvent('mousemove', {
        'view': window,
        'bubbles': true,
        'cancelable': true
      });
      targetElement.dispatchEvent(event);
    }

    // 创建一个模拟滚动的函数
    function simulateScroll() {
      const event = new WheelEvent('wheel', {
        'view': window,
        'bubbles': true,
        'cancelable': true,
        'deltaY': 100 // 向下滚动，如果要向上滚动，可以设置为负值
      });
      targetElement.dispatchEvent(event);
    }

    // 移动鼠标到目标元素
    simulateMouseMove();

    // 触发3次滚动
    for (let i = 0; i < 10; i++) {
      setTimeout(simulateScroll, (i + 1) * 10); // 每次滚动间隔1秒
    }
  } else {
    console.log('未找到目标元素');
  }
}
