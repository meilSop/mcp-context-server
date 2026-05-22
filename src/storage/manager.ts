import * as fsSync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Category, ContextConfig } from '../utils/config.js';
import { CATEGORIES } from '../utils/config.js';
import {
  buildMarkdownFile,
  nowISO,
  parseFrontmatter,
  slugify,
  type ContextFrontmatter
} from '../utils/markdown.js';

export interface ContextEntry {
  name: string;
  category: Category;
  filePath: string;
  frontmatter: ContextFrontmatter;
  body: string;
  size: number;
}

export class StorageManager {
  private config: ContextConfig;
  private projectRoot: string;

  constructor(config: ContextConfig, projectRoot?: string) {
    this.config = config;
    this.projectRoot = projectRoot || process.cwd();
  }

  private contextDir(): string {
    return path.resolve(this.projectRoot, this.config.contextDir);
  }

  private categoryDir(category: Category): string {
    return path.join(this.contextDir(), category);
  }

  private metaDir(): string {
    return path.join(this.contextDir(), '.meta');
  }

  /** Ensure the .context directory structure exists */
  async ensureStructure(): Promise<void> {
    const dirs = [this.contextDir(), ...CATEGORIES.map((c) => this.categoryDir(c)), this.metaDir()];
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /** Check if context is initialized */
  async isInitialized(): Promise<boolean> {
    try {
      await fs.access(this.contextDir());
      return true;
    } catch {
      return false;
    }
  }

  /** Initialize context directory with index.md */
  async initialize(projectName?: string): Promise<void> {
    await this.ensureStructure();

    const indexPath = path.join(this.contextDir(), 'index.md');
    try {
      await fs.access(indexPath);
    } catch {
      const name = projectName || path.basename(this.projectRoot);
      const content = `# ${name} - Project Context\n\nThis directory stores persistent context for AI coding assistants.\n\n## Categories\n\n| Category | Description |\n|----------|-------------|\n| architecture | Architecture decisions and system design |\n| decision | Technical decisions and rationale |\n| progress | Development progress tracking |\n| knowledge | Project knowledge and patterns |\n| error | Error history and solutions |\n| session | Session summaries |\n\n## Quick Start\n\nUse the MCP tools to save and retrieve context:\n- \`context_save\` - Save context\n- \`context_auto_load\` - Auto-load relevant context\n- \`context_search\` - Search across all context\n`;
      await fs.writeFile(indexPath, content, 'utf-8');
    }

    // Write config.json if not exists
    const configPath = path.join(this.metaDir(), 'config.json');
    try {
      await fs.access(configPath);
    } catch {
      const metaConfig = {
        version: '1.0.0',
        compressThreshold: this.config.compressThreshold,
        llmModel: this.config.llmModel,
        createdAt: nowISO()
      };
      await fs.writeFile(configPath, JSON.stringify(metaConfig, null, 2), 'utf-8');
    }
  }

  /** Save a context entry as a .md file */
  async save(
    title: string,
    content: string,
    category: Category,
    priority: 'high' | 'medium' | 'low',
    tags: string[]
  ): Promise<{ name: string; filePath: string }> {
    await this.ensureStructure();

    const name = slugify(title);
    const now = nowISO();
    const fm: ContextFrontmatter = {
      title,
      category,
      priority,
      tags,
      createdAt: now,
      updatedAt: now
    };

    const markdown = buildMarkdownFile(fm, content);
    const filePath = path.join(this.categoryDir(category), `${name}.md`);

    // Check if file already exists - preserve createdAt
    try {
      const existing = await fs.readFile(filePath, 'utf-8');
      const parsed = parseFrontmatter(existing);
      if (parsed.frontmatter) {
        fm.createdAt = parsed.frontmatter.createdAt;
        fm.updatedAt = now;
      }
    } catch {
      // New file, keep original createdAt
    }

    const updatedMarkdown = buildMarkdownFile(fm, content);
    await fs.writeFile(filePath, updatedMarkdown, 'utf-8');

    return { name, filePath };
  }

  /** Get a specific context entry */
  async get(category: Category, name: string): Promise<ContextEntry | null> {
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    const filePath = path.join(this.categoryDir(category), fileName);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stat = await fs.stat(filePath);
      const { frontmatter, body } = parseFrontmatter(content);

      return {
        name: fileName.replace(/\.md$/, ''),
        category,
        filePath,
        frontmatter: frontmatter || {
          title: fileName,
          category,
          priority: 'medium' as const,
          tags: [],
          createdAt: stat.birthtime.toISOString(),
          updatedAt: stat.mtime.toISOString()
        },
        body,
        size: stat.size
      };
    } catch {
      return null;
    }
  }

  /** Get all entries in a category */
  async getByCategory(category: Category): Promise<ContextEntry[]> {
    const dir = this.categoryDir(category);
    const entries: ContextEntry[] = [];

    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const entry = await this.get(category, file);
        if (entry) entries.push(entry);
      }
    } catch {
      // Directory might not exist yet
    }

    return entries;
  }

  /** List entries across all or specific categories */
  async list(category?: Category): Promise<ContextEntry[]> {
    if (category) {
      return this.getByCategory(category);
    }

    const allEntries: ContextEntry[] = [];
    for (const cat of CATEGORIES) {
      const entries = await this.getByCategory(cat);
      allEntries.push(...entries);
    }
    return allEntries;
  }

  /** Delete a context entry */
  async delete(category: Category, name: string): Promise<boolean> {
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    const filePath = path.join(this.categoryDir(category), fileName);

    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /** Search across context files */
  async search(
    query: string,
    categories?: Category[],
    limit: number = 20
  ): Promise<ContextEntry[]> {
    const searchCategories = categories || CATEGORIES;
    const results: ContextEntry[] = [];
    const lowerQuery = query.toLowerCase();

    for (const cat of searchCategories) {
      const entries = await this.getByCategory(cat);
      for (const entry of entries) {
        const searchText =
          `${entry.frontmatter.title} ${entry.body} ${entry.frontmatter.tags.join(' ')}`.toLowerCase();
        if (searchText.includes(lowerQuery)) {
          results.push(entry);
        }
      }
    }

    // Sort by priority (high first), then by updatedAt (newest first)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    results.sort((a, b) => {
      const pa = priorityOrder[a.frontmatter.priority] ?? 1;
      const pb = priorityOrder[b.frontmatter.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      return b.frontmatter.updatedAt.localeCompare(a.frontmatter.updatedAt);
    });

    return results.slice(0, limit);
  }

  /** Get files that exceed compression threshold */
  async getOversizedFiles(category?: Category, name?: string): Promise<ContextEntry[]> {
    const thresholdBytes = this.config.compressThreshold * 1024;
    const entries = await this.list(category);
    return entries.filter((e) => e.size > thresholdBytes && !e.frontmatter.compressed);
  }

  /** Update file content (used by compression engine) */
  async updateContent(
    category: Category,
    name: string,
    newBody: string,
    markCompressed: boolean = false,
    originalSize?: number
  ): Promise<void> {
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    const filePath = path.join(this.categoryDir(category), fileName);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const { frontmatter } = parseFrontmatter(content);

      const fm: ContextFrontmatter = frontmatter
        ? {
            ...frontmatter,
            updatedAt: nowISO(),
            compressed: markCompressed ? true : frontmatter.compressed,
            originalSize: originalSize ?? frontmatter.originalSize
          }
        : {
            title: name,
            category,
            priority: 'medium' as const,
            tags: [],
            createdAt: nowISO(),
            updatedAt: nowISO(),
            compressed: markCompressed,
            originalSize
          };

      const markdown = buildMarkdownFile(fm, newBody);
      await fs.writeFile(filePath, markdown, 'utf-8');
    } catch {
      // File not found, skip
    }
  }

  /** Read raw file content */
  async readRaw(category: Category, name: string): Promise<string | null> {
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    const filePath = path.join(this.categoryDir(category), fileName);
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  /** Log compression event */
  async logCompression(
    category: Category,
    name: string,
    originalSize: number,
    compressedSize: number
  ): Promise<void> {
    const logPath = path.join(this.metaDir(), 'compression-log.json');
    let logs: unknown[] = [];

    try {
      const data = await fs.readFile(logPath, 'utf-8');
      logs = JSON.parse(data);
    } catch {
      // New log
    }

    logs.push({
      category,
      name,
      originalSize,
      compressedSize,
      ratio: ((1 - compressedSize / originalSize) * 100).toFixed(1) + '%',
      timestamp: nowISO()
    });

    await fs.writeFile(logPath, JSON.stringify(logs, null, 2), 'utf-8');
  }

  /** Get all .md file paths for resource listing */
  async getAllFilePaths(): Promise<string[]> {
    const files: string[] = [];

    for (const cat of CATEGORIES) {
      const dir = this.categoryDir(cat);
      try {
        const entries = await fs.readdir(dir);
        for (const entry of entries) {
          if (entry.endsWith('.md')) {
            files.push(path.join(dir, entry));
          }
        }
      } catch {
        // skip
      }
    }

    return files;
  }

  /** Read index.md */
  async readIndex(): Promise<string | null> {
    const indexPath = path.join(this.contextDir(), 'index.md');
    try {
      return await fs.readFile(indexPath, 'utf-8');
    } catch {
      return null;
    }
  }

  /** Get auto-load context: most relevant entries by priority and recency */
  async getAutoLoadContext(
    query?: string,
    currentFile?: string,
    maxSizeKB?: number
  ): Promise<ContextEntry[]> {
    const maxBytes = (maxSizeKB || this.config.maxAutoLoadSize) * 1024;

    // If query provided, search first
    if (query) {
      const results = await this.search(query, undefined, 50);
      let totalSize = 0;
      const selected: ContextEntry[] = [];
      for (const entry of results) {
        if (totalSize + entry.size > maxBytes) break;
        selected.push(entry);
        totalSize += entry.size;
      }
      return selected;
    }

    // Otherwise, load by priority and recency
    const all = await this.list();
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    all.sort((a, b) => {
      const pa = priorityOrder[a.frontmatter.priority] ?? 1;
      const pb = priorityOrder[b.frontmatter.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      return b.frontmatter.updatedAt.localeCompare(a.frontmatter.updatedAt);
    });

    let totalSize = 0;
    const selected: ContextEntry[] = [];

    // Always include high-priority items
    for (const entry of all) {
      if (entry.frontmatter.priority === 'high' && totalSize + entry.size <= maxBytes) {
        selected.push(entry);
        totalSize += entry.size;
      }
    }

    // Fill remaining with medium then low priority, most recent first
    for (const prio of ['medium', 'low'] as const) {
      for (const entry of all) {
        if (entry.frontmatter.priority === prio && !selected.includes(entry)) {
          if (totalSize + entry.size <= maxBytes) {
            selected.push(entry);
            totalSize += entry.size;
          }
        }
      }
    }

    // If current file is provided, try to find matching entries by tags
    if (currentFile) {
      const fileBasename = path.basename(currentFile).toLowerCase();
      const dirName = path.dirname(currentFile).split(path.sep).pop()?.toLowerCase() || '';
      for (const entry of all) {
        if (selected.includes(entry)) continue;
        const tags = entry.frontmatter.tags.map((t) => t.toLowerCase());
        if (
          tags.some(
            (t) => t.includes(fileBasename) || fileBasename.includes(t) || t.includes(dirName)
          )
        ) {
          if (totalSize + entry.size <= maxBytes) {
            selected.push(entry);
            totalSize += entry.size;
          }
        }
      }
    }

    return selected;
  }

  /** Get the context directory path */
  getContextDir(): string {
    return this.contextDir();
  }

  /** Get file path for a resource URI */
  getFilePathFromUri(uri: string): string | null {
    // URI format: context://{category}/{filename}
    const match = uri.match(/^context:\/\/([^/]+)\/(.+)$/);
    if (!match) return null;
    const [, category, filename] = match;
    if (!CATEGORIES.includes(category as Category)) return null;
    const name = filename.endsWith('.md') ? filename : `${filename}.md`;
    return path.join(this.categoryDir(category as Category), name);
  }

  /** Check if a file exists synchronously (for resource listing) */
  existsSync(filePath: string): boolean {
    return fsSync.existsSync(filePath);
  }
}
