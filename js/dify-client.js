export class DifyClient {
  constructor(config) {
    this.apiKey = config.difyApiKey;
    this.apiUrl = 'https://api.dify.ai/v1/workflows/run';
    this.timeout = config.timeout || 60000;
    this.retries = config.retries || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  async run(inputs, onProgress) {
    const body = JSON.stringify({
      inputs: {
        basic_instruction: inputs.basicInstruction,
        background_detail: inputs.backgroundDetail,
        style: inputs.style || '生动的'
      },
      response_mode: 'streaming',
      user: 'chrome-extension'
    });

    let buffer = '';
    let totalLength = 0;
    let finalOutput = null;

    await this._fetchWithRetry(() => this._fetch(body, chunk => {
      const chunkString = typeof chunk === 'string' ? chunk : chunk.toString();
      buffer += chunkString;
      totalLength += chunkString.length;

      const regex = /data: ({.*})\n\n/g;
      let match;

      while ((match = regex.exec(buffer)) !== null) {
        const jsonString = match[1];
        try {
          const data = JSON.parse(jsonString);
          console.info("Dify API 数据:", data);

          console.info("event: ", data.event);
          if (data.event === 'workflow_finished') {
            finalOutput = data.data.outputs;
          }

          if (onProgress) {
            onProgress(data, totalLength);
          }
        } catch (error) {
          console.warn('解析JSON数据时出错:', error);
        }

        buffer = buffer.slice(match.index + match[0].length);
        regex.lastIndex = 0;
      }
    }));

    if (buffer.trim()) {
      console.warn('存在未处理的数据:', buffer);
    }

    if (!finalOutput) {
      throw new Error('未能获取最终输出');
    }

    console.info('最终输出:', finalOutput);
    return finalOutput;
  }

  async _fetch(body, onProgress) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: body,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 处理流式响应
      const reader = response.body.getReader();
      let receivedLength = 0;
      let chunks = [];

      while(true) {
        const {done, value} = await reader.read();

        if (done) {
          break;
        }

        chunks.push(value);
        receivedLength += value.length;

        // 调用进度回调
        if (onProgress) {
          const chunk = new TextDecoder().decode(value);
          onProgress(chunk, receivedLength);
        }
      }

      // 组合所有接收到的块
      let chunksAll = new Uint8Array(receivedLength);
      let position = 0;
      for(let chunk of chunks) {
        chunksAll.set(chunk, position);
        position += chunk.length;
      }

      // 解码最终结果
      let result = new TextDecoder().decode(chunksAll);

      return { ok: true, body: { getReader: () => ({ read: async () => ({ value: new TextEncoder().encode(result), done: true }) }) } };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async _fetchWithRetry(fetchFunction, retriesLeft = this.retries) {
    try {
      return await fetchFunction();
    } catch (error) {
      if (retriesLeft === 0) {
        throw error;
      }
      console.log(`Request failed, retrying... (${retriesLeft} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      return this._fetchWithRetry(fetchFunction, retriesLeft - 1);
    }
  }
}
