import { z } from 'zod';
import type { StorageManager } from '../storage/manager.js';
import { CategoryEnum } from '../utils/config.js';
import { formatFileSize } from '../utils/markdown.js';

export const listToolSchema = {
  category: CategoryEnum.optional().describe(
    'Filter by category. If omitted, lists all categories.'
  )
};

export async function listHandler(
  args: {
    category?: z.infer<typeof CategoryEnum>;
  },
  storage: StorageManager
) {
  try {
    const entries = await storage.list(args.category);

    if (entries.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: args.category
              ? `No context entries in category: ${args.category}`
              : 'No context entries found. Use context_save to create one.'
          }
        ]
      };
    }

    // Group by category
    const grouped = new Map<string, typeof entries>();
    for (const entry of entries) {
      const cat = entry.category;
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(entry);
    }

    const sections: string[] = [];
    for (const [cat, catEntries] of grouped) {
      const lines = catEntries
        .sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          const pa = priorityOrder[a.frontmatter.priority] ?? 1;
          const pb = priorityOrder[b.frontmatter.priority] ?? 1;
          if (pa !== pb) return pa - pb;
          return b.frontmatter.updatedAt.localeCompare(a.frontmatter.updatedAt);
        })
        .map(
          (e) =>
            `  - **${e.frontmatter.title}** (\`${e.name}\`) [${e.frontmatter.priority}] ${formatFileSize(e.size)}${e.frontmatter.compressed ? ' *' : ''} - ${e.frontmatter.updatedAt.slice(0, 10)}`
        )
        .join('\n');
      sections.push(`### ${cat} (${catEntries.length})\n${lines}`);
    }

    const totalSize = entries.reduce((sum, e) => sum + e.size, 0);
    const compressed = entries.filter((e) => e.frontmatter.compressed).length;

    return {
      content: [
        {
          type: 'text' as const,
          text: `## Context Entries (${entries.length} total, ${formatFileSize(totalSize)}${compressed > 0 ? `, ${compressed} compressed` : ''})\n\n${sections.join('\n\n')}\n\n\\* = compressed`
        }
      ]
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text' as const, text: `Error listing context: ${msg}` }],
      isError: true
    };
  }
}
