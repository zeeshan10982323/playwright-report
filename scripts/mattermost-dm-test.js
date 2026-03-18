require('dotenv').config({ quiet: true });

const MM_URL = (process.env.MM_URL || 'https://chat.digitaltolk.net').trim();
const TOKEN = (process.env.MM_BOT_TOKEN || process.env.bottoken || '').trim();
const USERS_RAW = (process.env.MM_DM_USERS || process.env.MM_DM_USER || '').trim();
const MESSAGE = (process.env.MM_DM_MESSAGE || 'TESTING').trim();

function must(value, name) {
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

async function mmFetch(path, init) {
  const res = await fetch(`${MM_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init && init.headers ? init.headers : {})
    }
  });
  const text = await res.text().catch(() => '');
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {}
  if (!res.ok) {
    const msg = typeof body === 'string' ? body : body?.message || '';
    throw new Error(`Mattermost API ${path} failed (${res.status}): ${msg}`);
  }
  return body;
}

async function main() {
  must(TOKEN, 'bottoken (or MM_BOT_TOKEN) in .env');
  must(USERS_RAW, 'MM_DM_USERS in .env');

  const dmUsers = USERS_RAW.split(',').map((s) => s.trim()).filter(Boolean);
  if (dmUsers.length === 0) {
    throw new Error('MM_DM_USERS is empty');
  }

  const me = await mmFetch('/api/v4/users/me');
  const botId = me.id;

  for (const username of dmUsers) {
    const user = await mmFetch(`/api/v4/users/username/${encodeURIComponent(username)}`);
    const channel = await mmFetch('/api/v4/channels/direct', {
      method: 'POST',
      body: JSON.stringify([botId, user.id])
    });
    await mmFetch('/api/v4/posts', {
      method: 'POST',
      body: JSON.stringify({ channel_id: channel.id, message: MESSAGE })
    });
    process.stdout.write(`Sent DM to ${username}\n`);
  }
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});

