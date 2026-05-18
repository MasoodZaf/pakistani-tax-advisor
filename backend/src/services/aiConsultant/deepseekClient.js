// Thin wrapper around DeepSeek's OpenAI-compatible Chat Completions API.
// Endpoint reference: https://api.deepseek.com/v1/chat/completions
//
// Why a wrapper: gives us one place to add retries, redact headers from logs,
// swap models, or move to a different provider later without touching routes.

const axios = require('axios');
const logger = require('../../utils/logger');

const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const TIMEOUT_MS = parseInt(process.env.DEEPSEEK_TIMEOUT_MS, 10) || 60000;

function isConfigured() {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

async function chat({ messages, model, temperature = 0.2, maxTokens = 1500 }) {
  if (!isConfigured()) {
    const err = new Error('DEEPSEEK_API_KEY is not set on the server');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }
  const url = `${BASE_URL}/chat/completions`;
  const body = {
    model: model || DEFAULT_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: false,
  };
  const started = Date.now();
  try {
    const res = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: TIMEOUT_MS,
    });
    const choice = res.data?.choices?.[0];
    const usage = res.data?.usage || {};
    return {
      content: choice?.message?.content || '',
      finishReason: choice?.finish_reason,
      tokensPrompt: usage.prompt_tokens ?? null,
      tokensOutput: usage.completion_tokens ?? null,
      model: res.data?.model || body.model,
      latencyMs: Date.now() - started,
    };
  } catch (e) {
    const status = e.response?.status;
    const data = e.response?.data;
    logger.error('DeepSeek API call failed', {
      status,
      message: e.message,
      data: typeof data === 'object' ? JSON.stringify(data).slice(0, 500) : data,
    });
    const err = new Error(
      data?.error?.message || e.message || 'DeepSeek request failed'
    );
    err.code = status === 401 ? 'AI_AUTH_FAILED' : 'AI_REQUEST_FAILED';
    err.status = status;
    throw err;
  }
}

module.exports = { chat, isConfigured };
