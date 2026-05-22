/*
 * @Author: zhumanyao zhumanyao@sungrowpower.com
 * @Date: 2026-05-21 15:05:16
 * @LastEditors: zhumanyao zhumanyao@sungrowpower.com
 * @LastEditTime: 2026-05-21 15:42:45
 * @FilePath: \context\src\compress\engine.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { StorageManager } from '../storage/manager.js';
import type { Category, ContextConfig } from '../utils/config.js';
import { formatFileSize } from '../utils/markdown.js';
import { LLMClient } from './llm-client.js';

export interface CompressionResult {
  category: Category;
  name: string;
  originalSize: number;
  compressedSize: number;
  ratio: string;
  success: boolean;
  error?: string;
}

const COMPRESSION_SYSTEM_PROMPT = `You are a context compression assistant for a software development project. Your task is to compress markdown content while preserving ALL critical information.

Compression Rules:
1. Preserve ALL key decisions, architectural choices, and rationale
2. Keep specific technical details: API endpoints, data structures, config values, version numbers
3. Keep code snippets that demonstrate patterns or solutions
4. Keep error messages and their solutions
5. Remove redundancy, verbose explanations, and repetitive descriptions
6. Use concise bullet points instead of paragraphs where possible
7. Merge similar sections
8. Keep markdown formatting with proper headers
9. Preserve any frontmatter metadata
10. Target compression ratio: reduce to 30-50% of original size

Output ONLY the compressed markdown content, no explanations.`;

export class CompressionEngine {
  private storage: StorageManager;
  private llmClient: LLMClient;
  private config: ContextConfig;

  constructor(storage: StorageManager, config: ContextConfig) {
    this.storage = storage;
    this.config = config;
    this.llmClient = new LLMClient(config);
  }

  /** Compress a single context entry */
  async compressEntry(category: Category, name: string): Promise<CompressionResult> {
    const entry = await this.storage.get(category, name);
    if (!entry) {
      return {
        category,
        name,
        originalSize: 0,
        compressedSize: 0,
        ratio: '0%',
        success: false,
        error: `Entry not found: ${category}/${name}`
      };
    }

    if (entry.frontmatter.compressed) {
      return {
        category,
        name,
        originalSize: entry.size,
        compressedSize: entry.size,
        ratio: '0%',
        success: false,
        error: 'Entry is already compressed'
      };
    }

    const thresholdBytes = this.config.compressThreshold * 1024;
    if (entry.size <= thresholdBytes) {
      return {
        category,
        name,
        originalSize: entry.size,
        compressedSize: entry.size,
        ratio: '0%',
        success: false,
        error: `Entry size (${formatFileSize(entry.size)}) is below threshold (${formatFileSize(thresholdBytes)})`
      };
    }

    try {
      const originalContent = await this.storage.readRaw(category, name);
      if (!originalContent) {
        return {
          category,
          name,
          originalSize: entry.size,
          compressedSize: 0,
          ratio: '0%',
          success: false,
          error: 'Could not read file content'
        };
      }

      const response = await this.llmClient.chat([
        { role: 'system', content: COMPRESSION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Compress the following markdown context file. Keep all critical information but make it much more concise:\n\n${originalContent}`
        }
      ]);

      const compressedContent = response.content;
      const compressedSize = Buffer.byteLength(compressedContent, 'utf-8');
      const originalSize = Buffer.byteLength(originalContent, 'utf-8');
      const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1) + '%';

      // Update the file with compressed content
      await this.storage.updateContent(
        category,
        name,
        // Extract body from compressed content (remove frontmatter if LLM preserved it)
        this.extractBody(compressedContent),
        true,
        originalSize
      );

      // Log the compression
      await this.storage.logCompression(category, name, originalSize, compressedSize);

      return {
        category,
        name,
        originalSize,
        compressedSize,
        ratio,
        success: true
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        category,
        name,
        originalSize: entry.size,
        compressedSize: entry.size,
        ratio: '0%',
        success: false,
        error: errorMsg
      };
    }
  }

  /** Compress all oversized entries */
  async compressAll(category?: Category): Promise<CompressionResult[]> {
    const oversized = await this.storage.getOversizedFiles(category);
    const results: CompressionResult[] = [];

    for (const entry of oversized) {
      const result = await this.compressEntry(entry.category, entry.name);
      results.push(result);
    }

    return results;
  }

  /** Extract body from markdown (strip frontmatter if present) */
  private extractBody(content: string): string {
    const trimmed = content.trim();
    if (!trimmed.startsWith('---')) {
      return trimmed;
    }
    const endIndex = trimmed.indexOf('---', 3);
    if (endIndex === -1) {
      return trimmed;
    }
    return trimmed.slice(endIndex + 3).trim();
  }

  /** Check if LLM is configured */
  isLLMConfigured(): boolean {
    return !!this.config.llmApiKey;
  }
}
