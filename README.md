<h1 align="center">
  <img src="apps/marketing/public/baseline-logo.svg" alt="" width="32" height="32" style="vertical-align: middle;" />
  Baseline
</h1>

<p align="center">
  <strong>Measure your rate of progress.</strong>
</p>

<p align="center">
  <a href="https://github.com/Andrew5194/baseline/actions/workflows/docker-ci.yml"><img src="https://github.com/Andrew5194/baseline/actions/workflows/docker-ci.yml/badge.svg" alt="Build" /></a>
  <a href="https://github.com/Andrew5194/baseline"><img src="https://visitor-badge.laobi.icu/badge?page_id=Andrew5194.baseline" alt="Visitors" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL%20v3-blue?logo=gnu&logoColor=white" alt="License: AGPL v3" /></a>
</p>

---

## How Baseline Works

Baseline integrates with your existing development and project management tools, captures activity passively, and derives quantitative metrics and trend analysis — with minimal configuration required.

1. **Connect your tools** — Link GitHub, your calendar, and your project boards. Baseline pulls your activity automatically — no timers, no manual entry, no behavior changes.
2. **See your metrics** — Baseline calculates the metrics that matter: output, cycle time, focus hours, and consistency scores.
3. **Track your trends** — See how your productivity changes week over week, month over month. Spot patterns, identify what's working, and understand where your time goes.

## Getting Started

#### Configuration

All configuration lives in a single `.env` file at the project root. Run `make setup` to create it from `.env.example` and generate a secure `AUTH_SECRET` automatically (`make local`/`remote` do this for you on first run):

```bash
make setup
```

`AUTH_SECRET` is the only required variable, and `make setup` fills it in. Baseline signs in with **email and password**, so it runs without any third-party keys — the integrations below are opt-in.

```bash
# === Required ===
AUTH_SECRET=            # signing key for login sessions — generate: openssl rand -base64 32

# === Optional (integrations) ===
GITHUB_CLIENT_ID=       # GitHub activity integration (not a sign-in method)
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=       # Google Calendar integration
GOOGLE_CLIENT_SECRET=
WEB_URL=                # auto-detected; set only to pin a fixed public origin
```

> **GitHub integration:** to connect your GitHub activity from the Sources page, create an OAuth app at [github.com/settings/developers](https://github.com/settings/developers) with the callback URL `<your-url>/v1/integrations/github/callback`.

Everything else is configured automatically. Postgres and ports have working defaults, and advanced overrides (`API_INTERNAL_URL`, `NEXT_PUBLIC_API_URL` for split-origin deployments) are documented in `.env.example`.

### Docker Compose (recommended)

If running on a local environment, execute the following:

```
make local
```

If running on a remote environment (such as a Cloud Developer Environment), execute the following:

```
make remote
```

This pulls the published images from Docker Hub and starts them. The database is created automatically on first boot. Follow logs with `make logs` and stop with `make down`. The images run `:latest` — edit the tags in `docker-compose.yml` to pin a release. One URL is exposed:

| Service | URL | Description |
|---|---|---|
| Dashboard | http://localhost:3002 | Product dashboard — your entry point |

Sign up at http://localhost:3002/sign-up, then connect GitHub from the Sources page. The API and database run internally (the dashboard proxies API calls), so there are no other URLs to manage.

### Building from Source

For developing without Docker. Requires Node.js 20+, pnpm 10+, and a local PostgreSQL instance.

```bash
make install     # install dependencies
make migrate     # create database tables
make dev         # start all apps
```

Each app reads its own `.env.local` (Next.js loads env from the app directory), so add one per app you run using the variables from `.env.example`.

Apps will start on marketing (3000), API (3001), dashboard (3002).

## Project Structure

```
apps/
  marketing/              Public website (landing page, contact, GitHub heatmap)
  web/                    Product dashboard (metrics, heatmap, activity feed)
  api/                    HTTP API server
packages/
  db/                     Drizzle schema, migrations, and typed client
  events/                 Canonical event types
  metrics/                12 derived metric functions (pure, no DB)
  api-client/             OpenAPI 3.1 spec and generated types
  ui/                     Shared components
  integrations/
    github/               GitHub OAuth, GraphQL client, event normalizer
docker-compose.yml        Self-hosting configuration
turbo.json                Turborepo pipeline config
pnpm-workspace.yaml       Workspace definitions
```

## Contributing

Contributions are welcome. Before submitting, please read
[CONTRIBUTING.md](CONTRIBUTING.md) and sign the [CLA](CLA.md).

## License

Baseline is open source under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0).

- You may **self-host, modify, and redistribute** Baseline freely.
- If you run a modified version as a network-accessible service, you must make
  your modified source code available to users of that service (AGPL's network
  copyleft clause).
- A **commercial license** is available for organizations that cannot comply
  with AGPL's source-disclosure requirements.

For commercial licensing inquiries, [get in touch via the Baseline contact page](https://baseline-labs.vercel.app/contact).
