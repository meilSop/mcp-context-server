import { z } from 'zod';
import type { StorageManager } from '../storage/manager.js';
import { CategoryEnum, PriorityEnum } from '../utils/config.js';

export const saveToolSchema = {
  title: z.string().describe('Title for the context entry'),
  content: z.string().describe('Markdown content to save'),
  category: CategoryEnum.describe(
    'Category: architecture|decision|progress|knowledge|error|session'
  ),
  priority: PriorityEnum.default('medium').describe('Priority: high|medium|low'),
  tags: z.array(z.string()).default([]).describe('Tags for categorization and search')
};

export async function saveHandler(
  args: {
    title: string;
    content: string;
    category: z.infer<typeof CategoryEnum>;
    priority: z.infer<typeof PriorityEnum>;
    tags: string[];
  },
  storage: StorageManager
) {
  try {
    await storage.initialize();
    const result = await storage.save(
      args.title,
      args.content,
      args.category,
      args.priority,
      args.tags
    );
    return {
      content: [
        {
          type: 'text' as const,
          text: `Context saved successfully!\n\n- **Title**: ${args.title}\n- **Category**: ${args.category}\n- **Priority**: ${args.priority}\n- **Tags**: ${args.tags.join(', ') || 'none'}\n- **Path**: ${result.filePath}`
        }
      ]
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text' as const, text: `Error saving context: ${msg}` }],
      isError: true
    };
  }
}
