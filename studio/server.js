import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { POSTS_DIR, listPosts, parsePost, serializePost, validateSlug } from './lib.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = process.cwd();
const PORT = 4322;

const app = new Hono();

const postFile = (slug) => join(POSTS_DIR, `${slug}.md`);

function git(args) {
  return execFileSync('git', args, { cwd: REPO, encoding: 'utf-8' });
}

// --- API ---
app.get('/api/posts', (c) => c.json(listPosts()));

app.get('/api/posts/:slug', (c) => {
  const slug = c.req.param('slug');
  if (!validateSlug(slug) || !existsSync(postFile(slug))) return c.json({ error: 'not found' }, 404);
  return c.json({ slug, ...parsePost(readFileSync(postFile(slug), 'utf-8')) });
});

// create/update (does NOT publish/commit — just writes the file)
app.post('/api/posts', async (c) => {
  const { slug, data, body } = await c.req.json();
  if (!validateSlug(slug)) return c.json({ error: 'invalid slug' }, 400);
  writeFileSync(postFile(slug), serializePost({ data, body }), 'utf-8');
  return c.json({ ok: true, slug });
});

// publish: write with draft:false, then git add/commit/push
app.post('/api/publish', async (c) => {
  const { slug, data, body } = await c.req.json();
  if (!validateSlug(slug)) return c.json({ error: 'invalid slug' }, 400);
  const file = postFile(slug);
  writeFileSync(file, serializePost({ data: { ...data, draft: false }, body }), 'utf-8');
  try {
    git(['add', file]);
    git(['commit', '-m', `Publish: ${data.title || slug}`]);
    git(['push']);
    return c.json({ ok: true, slug });
  } catch (e) {
    return c.json({ error: 'git failed', detail: String(e.stderr || e.message) }, 500);
  }
});

// delete: remove file; if commit=true also commit+push the removal
app.delete('/api/posts/:slug', async (c) => {
  const slug = c.req.param('slug');
  if (!validateSlug(slug) || !existsSync(postFile(slug))) return c.json({ error: 'not found' }, 404);
  const commit = c.req.query('commit') === 'true';
  const file = postFile(slug);
  rmSync(file);
  if (commit) {
    try {
      git(['add', file]);
      git(['commit', '-m', `Delete: ${slug}`]);
      git(['push']);
    } catch (e) {
      return c.json({ error: 'git failed', detail: String(e.stderr || e.message) }, 500);
    }
  }
  return c.json({ ok: true });
});

// --- static: theme CSS + vendored markdown-it + the editor UI ---
app.get('/bearblog.css', serveStatic({ path: './src/styles/bearblog.css' }));
app.get('/vendor/markdown-it.min.js', serveStatic({
  path: './node_modules/markdown-it/dist/markdown-it.min.js',
}));
app.use('/*', serveStatic({ root: './studio/ui' }));

serve({ fetch: app.fetch, port: PORT, hostname: '127.0.0.1' }, (info) => {
  console.log(`\n  studio → http://127.0.0.1:${info.port}  (astro dev → http://localhost:4321)\n`);
});
