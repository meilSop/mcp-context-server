import type { Category, Priority } from './config.js';

export interface ContextFrontmatter {
  title: string;
  category: Category;
  priority: Priority;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  compressed?: boolean;
  originalSize?: number;
}

const FRONTMATTER_DELIMITER = '---';

export function parseFrontmatter(content: string): {
  frontmatter: ContextFrontmatter | null;
  body: string;
} {
  const trimmed = content.trim();
  if (!trimmed.startsWith(FRONTMATTER_DELIMITER)) {
    return { frontmatter: null, body: content };
  }

  const endIndex = trimmed.indexOf(FRONTMATTER_DELIMITER, 3);
  if (endIndex === -1) {
    return { frontmatter: null, body: content };
  }

  const frontmatterStr = trimmed.slice(3, endIndex).trim();
  const body = trimmed.slice(endIndex + 3).trim();

  try {
    const fm: Record<string, unknown> = {};
    for (const line of frontmatterStr.split('\n')) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      if (key === 'tags') {
        // Parse tags: [tag1, tag2]
        const tagsMatch = value.match(/\[(.+)\]/);
        if (tagsMatch) {
          fm[key] = tagsMatch[1].split(',').map((t) => t.trim());
        }
      } else if (key === 'compressed') {
        fm[key] = value === 'true';
      } else if (key === 'originalSize') {
        fm[key] = parseInt(value, 10);
      } else {
        fm[key] = value;
      }
    }
    return { frontmatter: fm as unknown as ContextFrontmatter, body };
  } catch {
    return { frontmatter: null, body: content };
  }
}

export function serializeFrontmatter(fm: ContextFrontmatter): string {
  const lines = [
    FRONTMATTER_DELIMITER,
    `title: ${fm.title}`,
    `category: ${fm.category}`,
    `priority: ${fm.priority}`,
    `tags: [${fm.tags.join(', ')}]`,
    `createdAt: ${fm.createdAt}`,
    `updatedAt: ${fm.updatedAt}`
  ];
  if (fm.compressed) {
    lines.push(`compressed: true`);
  }
  if (fm.originalSize !== undefined) {
    lines.push(`originalSize: ${fm.originalSize}`);
  }
  lines.push(FRONTMATTER_DELIMITER);
  return lines.join('\n');
}

export function buildMarkdownFile(fm: ContextFrontmatter, body: string): string {
  return `${serializeFrontmatter(fm)}\n\n${body}\n`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
