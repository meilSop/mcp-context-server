import { z } from 'zod';
import type { StorageManager } from '../storage/manager.js';
import { CategoryEnum } from '../utils/config.js';
import { formatFileSize } from '../utils/markdown.js';

export const getToolSchema = {
  category: CategoryEnum.describe('Category to get context from'),
  name: z
    .string()
    .optional()
    .describe(
      'Name of the context entry (without .md). If omitted, returns all entries in the category.'
    )
};

export async function getHandler(
  args: {
    category: z.infer<typeof CategoryEnum>;
    name?: string;
  },
  storage: StorageManager
) {
  try {
    if (args.name) {
      const entry = await storage.get(args.category, args.name);
      if (!entry) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Context entry not found: ${args.category}/${args.name}`
            }
          ],
          isError: true
        };
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: `# ${entry.frontmatter.title}\n\n**Category**: ${entry.category}\n**Priority**: ${entry.frontmatter.priority}\n**Tags**: ${entry.frontmatter.tags.join(', ') || 'none'}\n**Size**: ${formatFileSize(entry.size)}${entry.frontmatter.compressed ? ' (compressed)' : ''}\n**Updated**: ${entry.frontmatter.updatedAt}\n\n---\n\n${entry.body}`
          }
        ]
      };
    } else {
      const entries = await storage.getByCategory(args.category);
      if (entries.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No context entries found in category: ${args.category}`
            }
          ]
        };
      }
      const listing = entries
        .map(
          (e) =>
            `- **${e.frontmatter.title}** (${e.name}) [${e.frontmatter.priority}] ${formatFileSize(e.size)}${e.frontmatter.compressed ? ' (compressed)' : ''} - ${e.frontmatter.updatedAt}`
        )
        .join('\n');
      return {
        content: [
          {
            type: 'text' as const,
            text: `## ${args.category} (${entries.length} entries)\n\n${listing}`
          }
        ]
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text' as const, text: `Error getting context: ${msg}` }],
      isError: true
    };
  }
}
