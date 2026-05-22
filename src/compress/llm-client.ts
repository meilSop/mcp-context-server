import type { ContextConfig } from '../utils/config.js';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export class LLMClient {
  private config: ContextConfig;

  constructor(config: ContextConfig) {
    this.config = config;
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    if (!this.config.llmApiKey) {
      throw new Error('LLM API key not configured. Set CONTEXT_LLM_API_KEY environment variable.');
    }

    const url = `${this.config.llmBaseUrl.replace(/\/$/, '')}/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.llmApiKey}`
      },
      body: JSON.stringify({
        model: this.config.llmModel,
        messages,
        temperature: 0.3,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices[0]?.message?.content || '',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens
          }
        : undefined
    };
  }
}
