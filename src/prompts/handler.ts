import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { StorageManager } from '../storage/manager.js';

export function registerPrompts(storage: StorageManager, server: McpServer) {
  server.registerPrompt(
    'project_context',
    {
      title: 'Load Project Context',
      description:
        'Auto-loads the most relevant project context including index, high-priority entries, and recent updates. Use this at the start of a new session.',
      argsSchema: {
        query: z.string().optional().describe('Optional query to find specific context'),
        currentFile: z.string().optional().describe('Current file path for context matching')
      }
    },
    async (args) => {
      const initialized = await storage.isInitialized();
      if (!initialized) {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: 'No project context found. This appears to be a new project. You can start saving context using the context_save tool.'
              }
            }
          ]
        };
      }

      const parts: string[] = [];

      // Load index
      const index = await storage.readIndex();
      if (index) {
        parts.push(index);
        parts.push('---\n');
      }

      // Load relevant entries
      const entries = await storage.getAutoLoadContext(args.query, args.currentFile);

      if (entries.length > 0) {
        parts.push(`## Project Context (${entries.length} entries loaded)\n`);
        for (const entry of entries) {
          parts.push(
            `### [${entry.category}] ${entry.frontmatter.title}\n` +
              `Priority: ${entry.frontmatter.priority} | Tags: ${entry.frontmatter.tags.join(', ') || 'none'}${entry.frontmatter.compressed ? ' | Compressed' : ''}\n\n` +
              entry.body
          );
        }
      }

      return {
        description: 'Auto-loaded project context',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text:
                parts.join('\n\n') ||
                'No context entries found. Start by saving context with context_save.'
            }
          }
        ]
      };
    }
  );
}
