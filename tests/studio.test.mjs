import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializePost, parsePost, validateSlug, slugify } from '../studio/lib.js';

test('slugify', () => {
  assert.equal(slugify('Hello, World!'), 'hello-world');
  assert.equal(slugify('  Spaced  Out  '), 'spaced-out');
});

test('validateSlug accepts safe slugs, rejects traversal', () => {
  assert.equal(validateSlug('hello-world'), true);
  assert.equal(validateSlug('post-123'), true);
  assert.equal(validateSlug('../etc/passwd'), false);
  assert.equal(validateSlug('a/b'), false);
  assert.equal(validateSlug('Hello'), false); // uppercase not allowed
  assert.equal(validateSlug(''), false);
});

test('serializePost -> parsePost round-trips', () => {
  const post = {
    data: { title: 'My Post', date: '2026-06-12', tags: ['ml', 'astro'], draft: true, description: 'd' },
    body: '# heading\n\nbody text',
  };
  const raw = serializePost(post);
  assert.match(raw, /title: My Post/);
  assert.match(raw, /draft: true/);
  assert.match(raw, /date: '?2026-06-12'?/);
  const back = parsePost(raw);
  assert.equal(back.data.title, 'My Post');
  assert.equal(back.data.draft, true);
  assert.deepEqual(back.data.tags, ['ml', 'astro']);
  assert.equal(back.body.trim(), '# heading\n\nbody text');
});

test('parsePost defaults missing frontmatter fields', () => {
  const back = parsePost('---\ntitle: X\ndate: 2026-01-01\n---\nhi');
  assert.equal(back.data.draft, false);
  assert.deepEqual(back.data.tags, []);
});
