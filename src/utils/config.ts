import { z } from 'zod';

export const CategoryEnum = z.enum([
  'architecture',
  'decision',
  'progress',
  'knowledge',
  'error',
  'session'
]);

export const PriorityEnum = z.enum(['high', 'medium', 'low']);

export type Category = z.infer<typeof CategoryEnum>;
export type Priority = z.infer<typeof PriorityEnum>;

export const CATEGORIES: Category[] = [
  'architecture',
  'decision',
  'progress',
  'knowledge',
  'error',
  'session'
];

export interface ContextConfig {
  /** LLM API key for compression */
  llmApiKey?: string;
  /** LLM model name */
  llmModel: string;
  /** LLM API base URL */
  llmBaseUrl: string;
  /** Compression threshold in KB */
  compressThreshold: number;
  /** Max auto-load content size in KB */
  maxAutoLoadSize: number;
  /** Context directory name */
  contextDir: string;
}

const DEFAULT_CONFIG: ContextConfig = {
  llmModel: 'gpt-4o-mini',
  llmBaseUrl: 'https://api.openai.com/v1',
  compressThreshold: 10,
  maxAutoLoadSize: 30,
  contextDir: '.context'
};

export function loadConfig(): ContextConfig {
  return {
    ...DEFAULT_CONFIG,
    llmApiKey: process.env.CONTEXT_LLM_API_KEY,
    llmModel: process.env.CONTEXT_LLM_MODEL || DEFAULT_CONFIG.llmModel,
    llmBaseUrl: process.env.CONTEXT_LLM_BASE_URL || DEFAULT_CONFIG.llmBaseUrl,
    compressThreshold: process.env.CONTEXT_COMPRESS_THRESHOLD
      ? parseInt(process.env.CONTEXT_COMPRESS_THRESHOLD, 10)
      : DEFAULT_CONFIG.compressThreshold,
    maxAutoLoadSize: process.env.CONTEXT_MAX_AUTO_LOAD_SIZE
      ? parseInt(process.env.CONTEXT_MAX_AUTO_LOAD_SIZE, 10)
      : DEFAULT_CONFIG.maxAutoLoadSize,
    contextDir: process.env.CONTEXT_DIR || DEFAULT_CONFIG.contextDir
  };
}
