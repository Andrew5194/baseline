<h1 align="center">
  <img src="apps/marketing/public/baseline-logo.svg" alt="" width="28" height="28" style="vertical-align: middle;" />
  Baseline
</h1>

<p align="center">
  <strong>Measure your rate of progress.</strong>
</p>

<p align="center">
  <a href="https://github.com/Andrew5194/baseline/actions/workflows/docker-build.yml"><img src="https://github.com/Andrew5194/baseline/actions/workflows/docker-build.yml/badge.svg" alt="Build and Push Docker Image" /></a>
  <a href="https://github.com/Andrew5194/baseline"><img src="https://visitor-badge.laobi.icu/badge?page_id=Andrew5194.baseline" alt="Visitors" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Elastic%20v2-0077CC" alt="License: Elastic License 2.0" /></a>
</p>

---

## The Problem

Tracking productivity shouldn't be this hard. Existing tools shift the burden of measurement onto the individual — the result is fragmented data, inconsistent tracking, and no reliable way to evaluate performance over time.

- **Fragmented tooling** — Meaningful work output is distributed across version control, project management, communication platforms, and calendars with no unified view.
- **High-friction tracking** — Traditional time tracking demands constant manual input. Adherence drops off within days.
- **Data without insight** — Most tools surface raw activity logs, not the trajectory analysis needed to identify trends over weeks and months.

## How Baseline Works

Baseline integrates with your existing development and project management tools, captures activity passively, and derives quantitative metrics and trend analysis — with minimal configuration required.

1. **Connect your tools** — Link GitHub, your calendar, and your project boards. Baseline pulls your activity automatically — no timers, no manual entry, no behavior changes.
2. **See your metrics** — Baseline calculates the metrics that matter: output, cycle time, focus hours, and consistency scores.
3. **Track your trends** — See how your productivity changes week over week, month over month. Spot patterns, identify what's working, and understand where your time goes.

## Features

- **Productivity dashboard** — consistency score, focus hours, cycle time, and active days with trend comparisons across 7d/30d/90d windows
- **GitHub integration** — OAuth connect, automatic ingestion of commits, PRs, and reviews
- **Activity heatmap & patterns** — contribution grid, day-of-week and hour-of-day distributions, drill-down into individual days
- **12 computed metrics** — output, velocity, and calibration categories derived from your real activity
- **Self-hostable** — single `docker compose up` with PostgreSQL and Redis included


## Getting Started

### Docker Compose (recommended)

#### Configure

Copy `.env.example` to `.env` at the project root and fill in your credentials:

| Variable | Required | Description |
|---|---|---|
| `AUTH_SECRET` | Yes | Random string for signing auth tokens |
| `GITHUB_CLIENT_ID` | For OAuth | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | For OAuth | GitHub OAuth app client secret |
| `GITHUB_USERNAME` | For marketing | GitHub username for the landing page heatmap |
| `GITHUB_TOKEN` | No | GitHub PAT for higher API rate limits (60/hr without, 5000/hr with) |
| `RESEND_API_KEY` | No | Enables the contact form ([resend.com](https://resend.com)) |
| `CONTACT_EMAIL` | No | Recipient for contact form submissions |

#### Run

```bash
docker compose up
```

That's it. The database is created automatically on first boot. Three services start:

| Service | URL | Description |
|---|---|---|
| Marketing | http://localhost:3000 | Public landing page |
| API | http://localhost:3001 | Backend server |
| Dashboard | http://localhost:3002 | Product dashboard |

Sign up at http://localhost:3002/sign-up, then connect GitHub from the Sources page. Database, Redis, and inter-service URLs are all handled automatically.

### Build from Source

Requires Node.js 20+, pnpm 10+, and a local PostgreSQL instance.

```bash
git clone https://github.com/Andrew5194/baseline.git
cd baseline
pnpm install

# Configure each app
cat > apps/api/.env.local << 'EOF'
DATABASE_URL=postgresql://user:pass@localhost:5432/baseline
AUTH_SECRET=your-random-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
API_URL=http://localhost:3001
WEB_URL=http://localhost:3002
EOF

cat > apps/web/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3001
EOF

cat > apps/marketing/.env.local << 'EOF'
NEXT_PUBLIC_GITHUB_USERNAME=your-github-username
GITHUB_TOKEN=your-github-pat
RESEND_API_KEY=your-resend-api-key
CONTACT_EMAIL=you@example.com
EOF

# Create tables
pnpm --filter @baseline/db migrate

# Start all apps
pnpm dev
```

Apps start on the same ports: marketing (3000), API (3001), dashboard (3002).

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
[CONTRIBUTING.md](CONTRIBUTING.md) and sign the appropriate CLA
([individual](CLA.md) or [entity](CLA-entity.md)).

## License

Baseline is source-available under the [Elastic License 2.0](LICENSE) (ELv2).

**You may:**
- Self-host Baseline for any purpose, including commercial internal use
- Modify the source code freely
- View, copy, and redistribute the source

**You may not:**
- Offer Baseline as a hosted or managed service to third parties
- Circumvent any license key functionality
- Remove or obscure licensing/copyright notices

For commercial licensing inquiries, contact andrew.yang5194@gmail.com.
