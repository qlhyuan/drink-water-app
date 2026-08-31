/**
 * 通用 LLM 客户端
 * 默认走 DeepSeek（OpenAI 兼容协议），也支持 Qwen / OpenAI。
 * 只需在 .env 切换 AI_PROVIDER + AI_API_KEY + AI_BASE_URL + AI_MODEL 即可。
 */
import 'dotenv/config';

const PROVIDERS = {
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
  },
  qwen: {
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
  },
  openai: {
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
};

export function isAIConfigured() {
  return !!process.env.AI_API_KEY && process.env.AI_API_KEY.trim().length > 0;
}

export function getAIProviderInfo() {
  return {
    provider: process.env.AI_PROVIDER || 'deepseek',
    model: process.env.AI_MODEL || PROVIDERS[process.env.AI_PROVIDER || 'deepseek']?.defaultModel,
    configured: isAIConfigured(),
  };
}

/**
 * 同步调用 LLM，返回纯文本。
 * @param {{ system?: string, user: string, temperature?: number, maxTokens?: number }} opts
 */
export async function chat({ system, user, temperature = 0.7, maxTokens = 500 }) {
  if (!isAIConfigured()) {
    const err = new Error('AI 尚未配置：AI_API_KEY 为空');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }

  const provider = process.env.AI_PROVIDER || 'deepseek';
  const cfg = PROVIDERS[provider];
  if (!cfg) {
    const err = new Error(`未知 AI_PROVIDER: ${provider}`);
    err.code = 'AI_BAD_PROVIDER';
    throw err;
  }

  const baseURL = process.env.AI_BASE_URL || cfg.baseURL;
  const model = process.env.AI_MODEL || cfg.defaultModel;
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 15000;

  const r = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user },
      ],
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!r.ok) {
    const body = await r.text().catch(() => '');
    const err = new Error(`AI 调用失败 ${r.status}: ${body.slice(0, 200)}`);
    err.code = 'AI_UPSTREAM_ERROR';
    err.status = r.status;
    throw err;
  }

  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    const err = new Error('AI 返回为空');
    err.code = 'AI_EMPTY_RESPONSE';
    throw err;
  }
  return content.trim();
}