# Playwright → Mattermost (GitHub Actions)

This repo can post a Playwright run summary to Mattermost (DM, channel, or both) and include a **report link** that points to the GitHub Actions run page where the `playwright-report` artifact can be downloaded.

## 1) Add GitHub Actions workflow

Workflow file: `.github/workflows/playwright.yml`

It runs `npm run test:notify` and uploads `playwright-report/` as an artifact (always).

## 2) Configure GitHub Secrets

Add these secrets in your GitHub repo settings.

### Required for tests

- `BASE_URL`
- `LOGIN_EMAIL`
- `LOGIN_PASSWORD`
- `LOGIN_PATH` (optional if your tests don’t need it)
- `TRANSLATOR_EMAIL`
- `TRANSLATOR_PASSWORD`

### Required for Mattermost notify

- `MM_URL` (example: `https://chat.digitaltolk.net`)
- `MM_BOT_TOKEN` (your bot PAT)

### Choose where notifications go

#### DM (only listed users)

- `MM_DM_USERS` (comma-separated usernames, e.g. `zeeshan,hamza`)
- `MM_NOTIFY_TARGET` = `dm` (optional; default is `dm`)

#### Channel (everyone in channel)

- `MM_NOTIFY_TARGET` = `channel`
- One of:
  - `MM_CHANNEL_ID`
  - or `MM_CHANNEL_TEAM` + `MM_CHANNEL_NAME` (example `digitaltolk` + `qa-community`)

#### Both

- `MM_NOTIFY_TARGET` = `both`
- Include both DM + channel settings above

## 3) Where the “Report” link points

In CI, `MM_REPORT_URL` is set automatically to:

- `https://github.com/<org>/<repo>/actions/runs/<run_id>`

From that page, download the `playwright-report` artifact.

