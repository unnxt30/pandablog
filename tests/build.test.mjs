import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
const has = (p) => existsSync(new URL(p, dist));

test('core routes are built', () => {
  assert.ok(has('index.html'), 'home');
  assert.ok(has('blog/index.html'), 'blog list');
  assert.ok(has('blog/hello-world/index.html'), 'seed post');
  assert.ok(has('shack/index.html'), 'shack');
  assert.ok(has('tags/astro/index.html'), 'tag page');
  assert.ok(has('rss.xml'), 'rss feed');
  assert.ok(has('pagefind/pagefind.js'), 'search index');
});

test('studio is NOT deployed', () => {
  assert.ok(!has('studio'), 'no /studio dir in dist');
  assert.ok(!has('studio/index.html'), 'no /studio route in dist');
});
