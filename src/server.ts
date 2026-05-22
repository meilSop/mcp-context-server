import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CompressionEngine } from './compress/engine.js';
import { registerPrompts } from './prompts/handler.js';
import { registerResources } from './resources/handler.js';
import { StorageManager } from './storage/manager.js';
import { loadConfig, type ContextConfig } from './utils/config.js';

import { autoLoadHandler, autoLoadToolSchema } from './tools/auto-load.js';
import { compressHandler, compressToolSchema } from './tools/compress.js';
import { deleteHandler, deleteToolSchema } from './tools/delete.js';
import { getHandler, getToolSchema } from './tools/get.js';
import { listHandler, listToolSchema } from './tools/list.js';
import { saveHandler, saveToolSchema } from './tools/save.js';
import { searchHandler, searchToolSchema } from './tools/search.js';

export function createServer(config?: ContextConfig): McpServer {
  const cfg = config || loadConfig();
  const storage = new StorageManager(cfg);
  const engine = new CompressionEngine(storage, cfg);

  const server = new McpServer({
    name: 'mcp-context-server',
    version: '1.0.0'
  });

  // Register tools
  server.registerTool(
    'context_save',
    {
      title: 'Save Context',
      description:
        "Save context as a markdown file in the project's .context/ directory. Organize by category (architecture|decision|progress|knowledge|error|session) with priority and tags.",
      inputSchema: saveToolSchema
    },
    async (args) => saveHandler(args, storage)
  );

  server.registerTool(
    'context_get',
    {
      title: 'Get Context',
      description:
        'Retrieve context by category and name. If name is omitted, returns all entries in the category.',
      inputSchema: getToolSchema
    },
    async (args) => getHandler(args, storage)
  );

  server.registerTool(
    'context_search',
    {
      title: 'Search Context',
      description:
        'Full-text search across all context files. Searches titles, content, and tags. Returns matching entries sorted by priority and recency.',
      inputSchema: searchToolSchema
    },
    async (args) => searchHandler(args, storage)
  );

  server.registerTool(
    'context_list',
    {
      title: 'List Context',
      description:
        'List all context entries grouped by category, or filter by a specific category. Shows title, priority, size, and last update time.',
      inputSchema: listToolSchema
    },
    async (args) => listHandler(args, storage)
  );

  server.registerTool(
    'context_delete',
    {
      title: 'Delete Context',
      description: 'Delete a specific context entry by category and name.',
      inputSchema: deleteToolSchema
    },
    async (args) => deleteHandler(args, storage)
  );

  server.registerTool(
    'context_compress',
    {
      title: 'Compress Context',
      description:
        'Compress oversized context entries using LLM-based intelligent summarization. Requires CONTEXT_LLM_API_KEY to be set. Compresses all oversized files if no specific entry is targeted.',
      inputSchema: compressToolSchema
    },
    async (args) => compressHandler(args, storage, engine)
  );

  server.registerTool(
    'context_auto_load',
    {
      title: 'Auto-Load Context',
      description:
        'Automatically load the most relevant project context. Returns index.md plus high-priority and recent entries. Use at the start of a new session to restore context. Optionally provide a query or current file path for better matching.',
      inputSchema: autoLoadToolSchema
    },
    async (args) => autoLoadHandler(args, storage)
  );

  // Register resources
  registerResources(storage, server);

  // Register prompts
  registerPrompts(storage, server);

  return server;
}
