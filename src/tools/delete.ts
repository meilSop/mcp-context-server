import { z } from 'zod';
import type { StorageManager } from '../storage/manager.js';
import { CategoryEnum } from '../utils/config.js';

export const deleteToolSchema = {
  category: CategoryEnum.describe('Category of the context entry'),
  name: z.string().describe('Name of the context entry to delete (without .md)')
};

export async function deleteHandler(
  args: {
    category: z.infer<typeof CategoryEnum>;
    name: string;
  },
  storage: StorageManager
) {
  try {
    const deleted = await storage.delete(args.category, args.name);
    if (!deleted) {
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
          text: `Context entry deleted: ${args.category}/${args.name}`
        }
      ]
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text' as const, text: `Error deleting context: ${msg}` }],
      isError: true
    };
  }
}
