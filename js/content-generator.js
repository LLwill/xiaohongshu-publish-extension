// content-generator.js

import { DifyClient } from './dify-client.js';
import { parseContent } from './utils.js';
import { Config as ConfigData } from './config.js'

export async function generateContent(config, onProgress) {
  if (ConfigData.mock) {
    config.content = ConfigData.mockDta;
  }
  if (config.content) {
    return;
  }

  const client = new DifyClient({
    difyApiKey: config.difyApiKey,
    timeout: 60000,
    retries: 5,
    retryDelay: 2000
  });

  try {
    const finalOutput = await client.run({
      basicInstruction: config.basicInstruction,
      backgroundDetail: config.backgroundDetail,
      style: config.style || '生动的'
    }, (data, totalLength) => {
      onProgress(data, totalLength);
    });

    const parsedContent = parseContent(finalOutput);
    config.content = parsedContent;

  } catch (error) {
    console.error('生成内容时出错:', error);
    throw error;
  }
}
