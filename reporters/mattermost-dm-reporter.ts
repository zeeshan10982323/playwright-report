import type {
  FullConfig,
  Reporter,
  Suite,
  TestCase,
  TestError,
  TestResult
} from '@playwright/test/reporter';

type Options = {
  url?: string;
  tokenEnv?: string;
  dmUsers?: string;
  channelTeam?: string;
  channelName?: string;
  channelId?: string;
  target?: string;
  failOnError?: boolean;
};

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function parseBool(v: string | undefined): boolean | undefined {
  if (!v) return undefined;
  if (/^(1|true|yes|y)$/i.test(v)) return true;
  if (/^(0|false|no|n)$/i.test(v)) return false;
  return undefined;
}

async function mmFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
}

async function readJsonOrText(res: Response): Promise<any> {
  const text = await res.text().catch(() => '');
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function getUserIdByUsername(mmUrl: string, token: string, username: string): Promise<string> {
  const res = await mmFetch(`${mmUrl}/api/v4/users/username/${encodeURIComponent(username)}`, token);
  const body = await readJsonOrText(res);
  if (!res.ok) {
    throw new Error(`Mattermost user lookup failed (${res.status}): ${typeof body === 'string' ? body : body?.message ?? ''}`);
  }
  if (!body?.id) {
    throw new Error(`Mattermost user lookup did not return id for ${username}`);
  }
  return body.id as string;
}

async function getBotId(mmUrl: string, token: string): Promise<string> {
  const res = await mmFetch(`${mmUrl}/api/v4/users/me`, token);
  const body = await readJsonOrText(res);
  if (!res.ok) {
    throw new Error(`Mattermost bot token invalid (${res.status}): ${typeof body === 'string' ? body : body?.message ?? ''}`);
  }
  if (!body?.id) {
    throw new Error('Mattermost /users/me did not return id');
  }
  return body.id as string;
}

async function createDirectChannel(mmUrl: string, token: string, userIds: [string, string]): Promise<string> {
  const res = await mmFetch(`${mmUrl}/api/v4/channels/direct`, token, {
    method: 'POST',
    body: JSON.stringify([userIds[0], userIds[1]])
  });
  const body = await readJsonOrText(res);
  if (!res.ok) {
    throw new Error(`Mattermost DM channel create failed (${res.status}): ${typeof body === 'string' ? body : body?.message ?? ''}`);
  }
  if (!body?.id) {
    throw new Error('Mattermost DM channel create did not return id');
  }
  return body.id as string;
}

async function postMessage(mmUrl: string, token: string, channelId: string, message: string): Promise<void> {
  const res = await mmFetch(`${mmUrl}/api/v4/posts`, token, {
    method: 'POST',
    body: JSON.stringify({ channel_id: channelId, message })
  });
  const body = await readJsonOrText(res);
  if (!res.ok) {
    throw new Error(`Mattermost post failed (${res.status}): ${typeof body === 'string' ? body : body?.message ?? ''}`);
  }
}

async function getChannelIdByTeamAndName(mmUrl: string, token: string, team: string, channel: string): Promise<string> {
  const res = await mmFetch(
    `${mmUrl}/api/v4/teams/name/${encodeURIComponent(team)}/channels/name/${encodeURIComponent(channel)}`,
    token
  );
  const body = await readJsonOrText(res);
  if (!res.ok) {
    throw new Error(`Mattermost channel lookup failed (${res.status}): ${typeof body === 'string' ? body : body?.message ?? ''}`);
  }
  if (!body?.id) {
    throw new Error(`Mattermost channel lookup did not return id for ${team}/${channel}`);
  }
  return body.id as string;
}

function formatSummary(params: {
  project?: string;
  baseURL?: string;
  reportUrl?: string;
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  durationMs: number;
  firstFailures: string[];
}): string {
  const lines: string[] = [];
  lines.push(`Playwright run finished`);
  if (params.project) lines.push(`Project: ${params.project}`);
  if (params.baseURL) lines.push(`Base URL: ${params.baseURL}`);
  if (params.reportUrl) {
    const url = params.reportUrl.trim();
    lines.push(`Report: ${/^https?:\/\//i.test(url) ? `[View Report](${url})` : url}`);
  }
  lines.push(`Total: ${params.total} | Passed: ${params.passed} | Failed: ${params.failed} | Flaky: ${params.flaky} | Skipped: ${params.skipped}`);
  lines.push(`Duration: ${Math.round(params.durationMs / 1000)}s`);
  if (params.firstFailures.length) {
    lines.push('');
    lines.push('First failures:');
    for (const f of params.firstFailures) lines.push(`- ${f}`);
  }
  return lines.join('\n');
}

export default class MattermostDmReporter implements Reporter {
  private options: Options;
  private startedAt = 0;

  private total = 0;
  private passed = 0;
  private failed = 0;
  private flaky = 0;
  private skipped = 0;
  private firstFailures: string[] = [];

  constructor(options: Options = {}) {
    this.options = options;
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    this.startedAt = Date.now();
    this.total = suite.allTests().length;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status === 'passed') this.passed += 1;
    else if (result.status === 'failed') this.failed += 1;
    else if (result.status === 'timedOut') this.failed += 1;
    else if (result.status === 'skipped') this.skipped += 1;
    else if (result.status === 'interrupted') this.failed += 1;

    if (result.status === 'failed' && this.firstFailures.length < 5) {
      this.firstFailures.push(test.titlePath().join(' › '));
    }

    if (result.status === 'passed' && result.retry > 0) {
      this.flaky += 1;
    }
  }

  onError(error: TestError): void {
    if (this.firstFailures.length < 5) {
      const msg = (error.message || '').split('\n')[0]?.trim();
      if (msg) this.firstFailures.push(msg);
    }
  }

  async onEnd(config: FullConfig): Promise<void> {
    const mmUrl = this.options.url ?? env('MM_URL') ?? 'https://chat.digitaltolk.net';
    const tokenEnv = this.options.tokenEnv ?? 'MM_BOT_TOKEN';
    const token = env(tokenEnv) ?? env('bottoken') ?? env('BOT_TOKEN');
    const dmUsersRaw = this.options.dmUsers ?? env('MM_DM_USERS') ?? env('MM_DM_USER') ?? '';
    const target = (this.options.target ?? env('MM_NOTIFY_TARGET') ?? 'dm').trim().toLowerCase();
    const channelTeam = this.options.channelTeam ?? env('MM_CHANNEL_TEAM') ?? env('MM_TEAM') ?? '';
    const channelName = this.options.channelName ?? env('MM_CHANNEL_NAME') ?? env('MM_CHANNEL') ?? '';
    const channelId = this.options.channelId ?? env('MM_CHANNEL_ID') ?? '';
    const reportUrl = env('MM_REPORT_URL') ?? 'playwright-report/index.html';
    const failOnError =
      this.options.failOnError ??
      parseBool(env('MM_NOTIFY_FAIL_ON_ERROR')) ??
      false;

    const dmUsers = dmUsersRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!token) {
      return;
    }

    const durationMs = Date.now() - this.startedAt;
    const message = formatSummary({
      project: config.projects?.[0]?.name,
      baseURL: config.projects?.[0]?.use?.baseURL as string | undefined,
      reportUrl,
      total: this.total,
      passed: this.passed,
      failed: this.failed,
      flaky: this.flaky,
      skipped: this.skipped,
      durationMs,
      firstFailures: this.firstFailures
    });

    try {
      if (target === 'dm' || target === 'both') {
        if (dmUsers.length === 0) {
          throw new Error('MM_DM_USERS is required for dm notifications');
        }
        const botId = await getBotId(mmUrl, token);
        for (const username of dmUsers) {
          const userId = await getUserIdByUsername(mmUrl, token, username);
          const dmChannelId = await createDirectChannel(mmUrl, token, [botId, userId]);
          await postMessage(mmUrl, token, dmChannelId, message);
        }
      }

      if (target === 'channel' || target === 'both') {
        let resolvedChannelId = channelId.trim();
        if (!resolvedChannelId) {
          if (!channelTeam.trim() || !channelName.trim()) {
            throw new Error('MM_CHANNEL_ID or (MM_CHANNEL_TEAM + MM_CHANNEL_NAME) is required for channel notifications');
          }
          resolvedChannelId = await getChannelIdByTeamAndName(mmUrl, token, channelTeam.trim(), channelName.trim());
        }
        await postMessage(mmUrl, token, resolvedChannelId, message);
      }
    } catch (e: any) {
      const err = e instanceof Error ? e : new Error(String(e));
      if (failOnError) {
        throw err;
      }
      process.stderr.write(`Mattermost notify failed: ${err.message}\n`);
    }
  }
}

