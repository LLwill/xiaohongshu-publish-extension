export async function downloadImage(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('无效的图片 URL: 为空或不是字符串');
  }

  url = cleanUrl(url);

  return new Promise((resolve, reject) => {
    const filename = generateFilename();

    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        handleDownload(downloadId, resolve, reject);
      }
    });
  });
}

function cleanUrl(url) {
  url = url.trim();
  if (url.startsWith('"') && url.endsWith('"')) {
    url = url.slice(1, -1);
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    if (url.startsWith('//')) {
      url = 'https:' + url;
    } else {
      url = 'https://' + url;
    }
  }

  if (!url.match(/^https?:\/\/.+\..+/)) {
    throw new Error('无效的图片 URL: 格式不正确');
  }

  return url;
}

function generateFilename() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];
  return `image_${timestamp}.jpg`;
}

function handleDownload(downloadId, resolve, reject) {
  chrome.downloads.onChanged.addListener(function onChanged({id, state}) {
    if (id === downloadId) {
      if (state && state.current === 'complete') {
        chrome.downloads.onChanged.removeListener(onChanged);
        chrome.downloads.search({id: downloadId}, ([downloadItem]) => {
          resolve(downloadItem.filename);
        });
      } else if (state && state.current === 'interrupted') {
        chrome.downloads.onChanged.removeListener(onChanged);
        reject(new Error('下载被中断，可能是由于网络问题或用户操作。'));
      }
    }
  });
}
