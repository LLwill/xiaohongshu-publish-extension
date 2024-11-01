export function parseContent(output) {
  let result = {
    title: '',
    content: '',
    coverImageUrl: '',
    tags: []
  };

  try {
    if (typeof output === 'string') {
      output = JSON.parse(output);
    }

    if (output.output && typeof output.output === 'string') {
      const coverImageMatch = output.output.match(/\[封面图\]\((.*?)\)/);
      const titleMatch = output.output.match(/## 标题\n\n(.*)/);
      const contentMatch = output.output.match(/## 正文\n\n([\s\S]*?)(?=\n#|$)/);
      const tagsMatch = output.output.match(/#[\w\u4e00-\u9fa5]+/g);

      result = {
        type: 'image',
        coverImageUrl: coverImageMatch ? coverImageMatch[1].trim() : '',
        title: titleMatch ? titleMatch[1].trim() : '',
        content: contentMatch ? contentMatch[1].trim() : '',
        tags: tagsMatch ? tagsMatch.map(tag => tag.trim()) : []
      };
    }

    if (!result.coverImageUrl) {
      console.warn('封面图 URL 为空');
    } else if (!result.coverImageUrl.startsWith('http://') && !result.coverImageUrl.startsWith('https://')) {
      console.warn('封面图 URL 不是有效的 HTTP 或 HTTPS URL');
    }

  } catch (error) {
    console.error('解析内容时出错:', error);
  }

  return result;
}

export function searchDownload(filename, sendResponse) {
  chrome.downloads.search({filename: filename}, (downloadItems) => {
    if (downloadItems && downloadItems.length > 0) {
      sendResponse({success: true, downloadId: downloadItems[0].id});
    } else {
      sendResponse({success: false, error: "Download item not found"});
    }
  });
}

export async function injectContentScript(tabId) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['./js/content.js']
    }, (injectionResults) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(injectionResults);
      }
    });
  });
}

export function sleep(time) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), time);
  });
}