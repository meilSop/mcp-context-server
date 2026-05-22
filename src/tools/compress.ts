import { z } from 'zod';
import type { CompressionEngine } from '../compress/engine.js';
import type { StorageManager } from '../storage/manager.js';
import { CategoryEnum } from '../utils/config.js';
import { formatFileSize } from '../utils/markdown.js';

export const compressToolSchema = {
  category: CategoryEnum.optional().describe(
    'Category to compress. If omitted, checks all categories.'
  ),
  name: z
    .string()
    .optional()
    .describe('Specific entry name to compress. If omitted, compresses all oversized entries.')
};

export async function compressHandler(
  args: {
    category?: z.infer<typeof CategoryEnum>;
    name?: string;
  },
  storage: StorageManager,
  engine: CompressionEngine
) {
  try {
    // Check LLM configuration
    if (!engine.isLLMConfigured()) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'LLM compression is not configured. Set CONTEXT_LLM_API_KEY environment variable to enable compression.'
          }
        ],
        isError: true
      };
    }

    if (args.category && args.name) {
      // Compress a specific entry
      const result = await engine.compressEntry(args.category, args.name);
      if (result.success) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Compression successful!\n\n- **Entry**: ${result.category}/${result.name}\n- **Original**: ${formatFileSize(result.originalSize)}\n- **Compressed**: ${formatFileSize(result.compressedSize)}\n- **Reduction**: ${result.ratio}`
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Compression skipped: ${result.error}`
            }
          ]
        };
      }
    } else {
      // Compress all oversized entries
      const results = await engine.compressAll(args.category);

      if (results.length === 0) {
        const threshold = await storage.getOversizedFiles(args.category);
        return {
          content: [
            {
              type: 'text' as const,
              text:
                threshold.length === 0
                  ? 'No oversized context entries found. All files are within the compression threshold.'
                  : 'No entries were compressed.'
            }
          ]
        };
      }

      const successItems = results.filter((r) => r.success);
      const skippedItems = results.filter((r) => !r.success);

      const output: string[] = [];
      if (successItems.length > 0) {
        output.push('### Compressed Successfully');
        for (const r of successItems) {
          output.push(
            `- **${r.category}/${r.name}**: ${formatFileSize(r.originalSize)} -> ${formatFileSize(r.compressedSize)} (${r.ratio} reduction)`
          );
        }
      }
      if (skippedItems.length > 0) {
        output.push('\n### Skipped');
        for (const r of skippedItems) {
          output.push(`- **${r.category}/${r.name}**: ${r.error}`);
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `## Compression Results\n\n${output.join('\n')}`
          }
        ]
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text' as const, text: `Error compressing context: ${msg}` }],
      isError: true
    };
  }
}
