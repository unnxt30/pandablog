import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { POSTS_DIR, listPosts, parsePost, serializePost, validateSlug } from './lib.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = process.cwd();
const PORT = Number(process.env.STUDIO_PORT) || 4322;

const app = new Hono();

const postFile = (slug) => join(POSTS_DIR, `${slug}.md`);
const IMAGES_DIR = join(REPO, 'public', 'images');

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

// upload a pasted/dropped image -> public/images/, returns its public path
app.post('/api/images', async (c) => {
  const ct = c.req.header('content-type') || '';
  if (!ct.startsWith('image/')) return c.json({ error: 'not an image' }, 400);
  const ext = (c.req.query('ext') || ct.split('/')[1] || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const buf = Buffer.from(await c.req.arrayBuffer());
  mkdirSync(IMAGES_DIR, { recursive: true });
  const name = `paste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  writeFileSync(join(IMAGES_DIR, name), buf);
  return c.json({ path: `/images/${name}` });
});

// publish: write with draft:false, then git add/commit/push
app.post('/api/publish', async (c) => {
  const { slug, data, body } = await c.req.json();
  if (!validateSlug(slug)) return c.json({ error: 'invalid slug' }, 400);
  const file = postFile(slug);
  writeFileSync(file, serializePost({ data: { ...data, draft: false }, body }), 'utf-8');
  try {
    // Stage the post + any images it references (pasted into public/images/).
    const toAdd = [file];
    if (existsSync(IMAGES_DIR)) toAdd.push('public/images');
    git(['add', ...toAdd]);
    // If nothing is staged (re-publishing byte-identical content), skip the empty
    // commit — `git commit` exits non-zero with nothing to commit. `git diff
    // --cached --quiet` exits 0 when there are NO staged changes.
    let changed = true;
    try { git(['diff', '--cached', '--quiet']); changed = false; } catch { changed = true; }
    if (changed) {
      git(['commit', '-m', `Publish: ${data.title || slug}`]);
      git(['push']);
    }
    return c.json({ ok: true, slug, deployed: changed });
  } catch (e) {
    return c.json({ error: 'git failed', detail: String(e.stderr || e.message) }, 500);
  }
});

// delete: remove the file. If it was committed (tracked) and commit=true, push the
// removal. Untracked drafts are just removed from disk — no commit (git add would
// fail on a now-deleted untracked path and falsely report failure).
app.delete('/api/posts/:slug', async (c) => {
  const slug = c.req.param('slug');
  if (!validateSlug(slug) || !existsSync(postFile(slug))) return c.json({ error: 'not found' }, 404);
  const commit = c.req.query('commit') === 'true';
  const file = postFile(slug);
  let tracked = false;
  try { tracked = git(['ls-files', '--', file]).trim() !== ''; } catch { tracked = false; }
  rmSync(file);
  if (commit && tracked) {
    try {
      git(['add', file]);
      git(['commit', '-m', `Delete: ${slug}`]);
      git(['push']);
    } catch (e) {
      return c.json({ error: 'git failed', detail: String(e.stderr || e.message) }, 500);
    }
  }
  return c.json({ ok: true, committed: commit && tracked });
});

// --- static: theme CSS + vendored markdown-it + the editor UI ---
app.get('/bearblog.css', serveStatic({ path: './src/styles/bearblog.css' }));
app.get('/vendor/markdown-it.min.js', serveStatic({
  path: './node_modules/markdown-it/dist/markdown-it.min.js',
}));
// serve pasted images so the live preview can show them (/images/* -> public/images/*)
app.use('/images/*', serveStatic({ root: './public' }));
app.use('/*', serveStatic({ root: './studio/ui' }));

serve({ fetch: app.fetch, port: PORT, hostname: '127.0.0.1' }, (info) => {
  console.log(`\n  studio → http://127.0.0.1:${info.port}  (astro dev → http://localhost:4321)\n`);
});
