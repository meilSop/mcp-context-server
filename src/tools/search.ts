import { z } from 'zod';
import type { StorageManager } from '../storage/manager.js';
import { CategoryEnum } from '../utils/config.js';
import { formatFileSize } from '../utils/markdown.js';

export const searchToolSchema = {
  query: z.string().describe('Search query - matches against title, content, and tags'),
  categories: z.array(CategoryEnum).optional().describe('Limit search to specific categories'),
  limit: z.number().default(20).describe('Maximum number of results')
};

export async function searchHandler(
  args: {
    query: string;
    categories?: z.infer<typeof CategoryEnum>[];
    limit: number;
  },
  storage: StorageManager
) {
  try {
    const results = await storage.search(args.query, args.categories, args.limit);

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `No context entries found matching "${args.query}"`
          }
        ]
      };
    }

    const output = results
      .map(
        (e) =>
          `### ${e.frontmatter.title}\n- **Category**: ${e.category}\n- **Priority**: ${e.frontmatter.priority}\n- **Tags**: ${e.frontmatter.tags.join(', ') || 'none'}\n- **Size**: ${formatFileSize(e.size)}\n- **Updated**: ${e.frontmatter.updatedAt}\n\n${e.body.slice(0, 500)}${e.body.length > 500 ? '...' : ''}`
      )
      .join('\n\n---\n\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: `## Search Results for "${args.query}" (${results.length} found)\n\n${output}`
        }
      ]
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text' as const, text: `Error searching context: ${msg}` }],
      isError: true
    };
  }
}
