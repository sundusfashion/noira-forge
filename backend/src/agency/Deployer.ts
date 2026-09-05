// Self-deployment: the entity commits its own generated demos to GitHub
// and triggers its own Render redeploy. Needs GH_TOKEN + RENDER_KEY + RENDER_SERVICE_ID.
const REPO = 'sundusfashion/noira-forge';
const BRANCH = 'main';

function ghHeaders() {
  const t = process.env.GH_TOKEN;
  if (!t) throw new Error('GH_TOKEN missing');
  return { Authorization: `Bearer ${t}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };
}

export async function commitDemoToGitHub(slug: string, html: string): Promise<void> {
  const filePath = `backend/dist-web/demo/${slug}/index.html`;
  const url = `https://api.github.com/repos/${REPO}/contents/${filePath}`;
  const H = ghHeaders();
  // existing file? need its sha to update
  let sha: string | undefined;
  try {
    const cur: any = await (await fetch(`${url}?ref=${BRANCH}`, { headers: H })).json();
    if (cur.sha) sha = cur.sha;
  } catch {}
  const body: any = {
    message: `feat: autonomous demo ${slug}`,
    content: Buffer.from(html, 'utf8').toString('base64'),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  const r = await fetch(url, { method: 'PUT', headers: H, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`github commit ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

export async function triggerRenderDeploy(): Promise<void> {
  const key = process.env.RENDER_KEY;
  const svc = process.env.RENDER_SERVICE_ID;
  if (!key || !svc) throw new Error('RENDER_KEY/SERVICE_ID missing');
  const r = await fetch(`https://api.render.com/v1/services/${svc}/deploys`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!r.ok) throw new Error(`render deploy ${r.status}`);
}
