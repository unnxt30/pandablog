const md = window.markdownit({ html: true });
const ASTRO = 'http://localhost:4321';
const $ = (id) => document.getElementById(id);
let current = null; // current slug (null = new, unsaved)

const slugify = (t) =>
  t.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function readForm() {
  const title = $('title').value.trim();
  return {
    slug: current || slugify(title),
    data: {
      title,
      date: $('date').value || new Date().toISOString().slice(0, 10),
      tags: $('tags').value.split(',').map((s) => s.trim()).filter(Boolean),
    },
    body: $('body').value,
  };
}

function renderPreview() {
  $('preview').innerHTML = md.render($('body').value || '');
}

function setStatus(msg) { $('status').textContent = msg; }

async function loadList() {
  const posts = await (await fetch('/api/posts')).json();
  $('list').innerHTML = '';
  for (const p of posts) {
    const li = document.createElement('li');
    li.textContent = p.title || p.slug;
    if (p.draft) li.className = 'draft';
    li.onclick = () => loadPost(p.slug);
    $('list').appendChild(li);
  }
}

async function loadPost(slug) {
  const p = await (await fetch(`/api/posts/${slug}`)).json();
  current = slug;
  $('title').value = p.data.title;
  $('date').value = p.data.date;
  $('tags').value = (p.data.tags || []).join(', ');
  $('body').value = p.body;
  renderPreview();
  setStatus(`editing: ${slug}`);
}

function newPost() {
  current = null;
  $('title').value = '';
  $('date').value = new Date().toISOString().slice(0, 10);
  $('tags').value = '';
  $('body').value = '';
  renderPreview();
  setStatus('new post');
}

async function save() {
  const post = readForm();
  if (!post.slug) return setStatus('need a title first');
  const r = await fetch('/api/posts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...post, data: { ...post.data, draft: true } }),
  });
  const j = await r.json();
  if (j.ok) { current = j.slug; await loadList(); setStatus(`saved draft: ${j.slug}`); }
  else setStatus(`error: ${j.error}`);
}

function confirmModal(message) {
  return new Promise((resolve) => {
    $('confirm-msg').textContent = message;
    $('confirm').showModal();
    $('confirm-yes').onclick = () => { $('confirm').close(); resolve(true); };
    $('confirm-no').onclick = () => { $('confirm').close(); resolve(false); };
  });
}

async function preview() {
  await save(); // persist draft so astro dev can render it
  if (current) window.open(`${ASTRO}/blog/${current}/`, '_blank');
}

async function publish() {
  const post = readForm();
  if (!post.slug) return setStatus('need a title first');
  if (!(await confirmModal('Are you sure? This will be published.'))) return;
  const r = await fetch('/api/publish', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(post),
  });
  const j = await r.json();
  if (j.ok) { current = j.slug; await loadList(); setStatus(`published: ${j.slug} (deploying)`); }
  else setStatus(`publish failed: ${j.detail || j.error}`);
}

async function del() {
  if (!current) return setStatus('nothing to delete');
  if (!(await confirmModal(`Delete "${current}"? This also removes it from the live site.`))) return;
  const r = await fetch(`/api/posts/${current}?commit=true`, { method: 'DELETE' });
  const j = await r.json();
  if (j.ok) { newPost(); await loadList(); setStatus('deleted'); }
  else setStatus(`delete failed: ${j.detail || j.error}`);
}

$('body').addEventListener('input', renderPreview);
$('new').onclick = newPost;
$('save').onclick = save;
$('preview-btn').onclick = preview;
$('publish').onclick = publish;
$('delete').onclick = del;

newPost();
loadList();
