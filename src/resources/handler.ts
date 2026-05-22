import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { StorageManager } from '../storage/manager.js';
import { CATEGORIES, type Category } from '../utils/config.js';

export function registerResources(storage: StorageManager, server: McpServer) {
  // Register a dynamic resource template for context files
  server.registerResource(
    'context-files',
    new ResourceTemplate('context://{category}/{+name}', {
      list: async () => {
        const resources: Array<{
          uri: string;
          name: string;
          mimeType?: string;
        }> = [];

        for (const category of CATEGORIES) {
          const entries = await storage.getByCategory(category);
          for (const entry of entries) {
            resources.push({
              uri: `context://${category}/${entry.name}`,
              name: `${category}/${entry.frontmatter.title}`,
              mimeType: 'text/markdown'
            });
          }
        }

        return { resources };
      }
    }),
    {
      description: 'Project context files stored in .context/ directory'
    },
    async (uri: URL, variables: Record<string, string | string[]>) => {
      const category = String(variables.category) as Category;
      const name = String(variables.name);

      const content = await storage.readRaw(category, name);
      if (!content) {
        throw new Error(`Context not found: ${category}/${name}`);
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: content
          }
        ]
      };
    }
  );

  // Also register index.md as a static resource
  server.registerResource(
    'context-index',
    'context://index',
    {
      description: 'Project context index',
      mimeType: 'text/markdown'
    },
    async (uri: URL) => {
      const content = await storage.readIndex();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: content || '# No context index found'
          }
        ]
      };
    }
  );
}
