import matter from 'gray-matter';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const POSTS_DIR = join(process.cwd(), 'src', 'content', 'blog');

export function slugify(title) {
  return String(title).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function validateSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9-]+$/.test(slug);
}

/** Build the markdown file text from {data, body}. */
export function serializePost({ data, body }) {
  const fm = {
    title: data.title ?? '',
    date: typeof data.date === 'string' ? data.date : new Date(data.date).toISOString().slice(0, 10),
    tags: Array.isArray(data.tags) ? data.tags : [],
    draft: Boolean(data.draft),
  };
  if (data.description) fm.description = data.description;
  return matter.stringify(`\n${(body ?? '').trim()}\n`, fm);
}

/** Parse markdown file text into {data, body} with defaults. */
export function parsePost(raw) {
  const { data, content } = matter(raw);
  return {
    data: {
      title: data.title ?? '',
      date: data.date ? new Date(data.date).toISOString().slice(0, 10) : '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      draft: Boolean(data.draft),
      description: data.description ?? '',
    },
    body: content,
  };
}

/** List all posts (published + drafts) with summary metadata, newest first. */
export function listPosts(dir = POSTS_DIR) {
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
  return files
    .map((f) => {
      const slug = f.replace(/\.md$/, '');
      const { data } = parsePost(readFileSync(join(dir, f), 'utf-8'));
      return { slug, title: data.title, date: data.date, draft: data.draft, tags: data.tags };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
