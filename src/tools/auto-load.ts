import { z } from 'zod';
import type { StorageManager } from '../storage/manager.js';
import { formatFileSize } from '../utils/markdown.js';

export const autoLoadToolSchema = {
  currentFile: z.string().optional().describe('Current file being edited (for context matching)'),
  query: z.string().optional().describe('Query to find relevant context')
};

export async function autoLoadHandler(
  args: {
    currentFile?: string;
    query?: string;
  },
  storage: StorageManager
) {
  try {
    // Ensure context is initialized
    const initialized = await storage.isInitialized();
    if (!initialized) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No context found for this project. Use context_save to start building project context.'
          }
        ]
      };
    }

    // Load index.md first
    const index = await storage.readIndex();
    const parts: string[] = [];

    if (index) {
      parts.push(index);
      parts.push('---');
    }

    // Load relevant entries
    const entries = await storage.getAutoLoadContext(args.query, args.currentFile);

    if (entries.length === 0 && !index) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No context entries found. Use context_save to create project context.'
          }
        ]
      };
    }

    if (entries.length > 0) {
      parts.push(`## Loaded Context (${entries.length} entries)\n`);
      for (const entry of entries) {
        parts.push(
          `### [${entry.category}] ${entry.frontmatter.title}\n` +
            `Priority: ${entry.frontmatter.priority} | Tags: ${entry.frontmatter.tags.join(', ') || 'none'} | Size: ${formatFileSize(entry.size)}${entry.frontmatter.compressed ? ' (compressed)' : ''}\n\n` +
            entry.body
        );
      }
    }

    const totalSize = entries.reduce((sum, e) => sum + e.size, 0);

    return {
      content: [
        {
          type: 'text' as const,
          text: parts.join('\n\n')
        }
      ]
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text' as const, text: `Error auto-loading context: ${msg}` }],
      isError: true
    };
  }
}
