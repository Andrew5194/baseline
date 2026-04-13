<h1 align="center">
  <img src="website/public/baseline-logo.svg" alt="" width="28" height="28" style="vertical-align: middle;" />
  Baseline
</h1>

<p align="center">
  <strong>Measure your rate of progress.</strong>
</p>

<p align="center">
  <a href="https://github.com/Andrew5194/automate-my-life/actions/workflows/docker-build.yml"><img src="https://github.com/Andrew5194/automate-my-life/actions/workflows/docker-build.yml/badge.svg" alt="Build and Push Docker Image" /></a>
  <a href="https://github.com/Andrew5194/automate-my-life"><img src="https://visitor-badge.laobi.icu/badge?page_id=Andrew5194.automate-my-life" alt="Visitors" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPLv3-blue?logo=gnu&logoColor=white" alt="License: GPL v3" /></a>
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

- 📈 Real-time productivity dashboard with interactive trend charts and rolling averages
- 🐙 GitHub contribution heatmaps, commit drill-downs, streak tracking, and pattern analysis
- 🔢 Consistency scores, deep work days, day-of-week patterns, and monthly trends
- 🐳 Self-hostable with Docker, PostgreSQL, and Redis
- 📬 Built-in contact form powered by Resend

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| APIs | GitHub GraphQL & REST |
| Infrastructure | Docker, PostgreSQL, Redis |
| Email | Resend |
| Deployment | Vercel or Docker self-hosting |

## Getting Started

### Local Development

```bash
git clone https://github.com/Andrew5194/automate-my-life.git
cd automate-my-life

make install
make dev

# Access at http://localhost:3000
```

### Environment Setup

Create `website/.env.local`:

```bash
NEXT_PUBLIC_GITHUB_USERNAME=your-username
GITHUB_TOKEN=your-github-token        # Optional, enables higher API rate limits
RESEND_API_KEY=re_your_api_key_here    # Optional, enables contact form
CONTACT_EMAIL=you@example.com          # Optional, contact form recipient
```

### Self-Hosting with Docker

```bash
make docker-install   # Creates .env from template
nano .env             # Edit with your configuration
make docker-build
make docker-start     # Starts web app, PostgreSQL, and Redis
```

See [SELF_HOSTING.md](SELF_HOSTING.md) for full deployment guide including Nginx, SSL, backups, and monitoring.

### Quick Commands

| Command | Description |
|---|---|
| `make dev` | Start development server |
| `make build` | Production build |
| `make docker-start` | Start all Docker services |
| `make docker-stop` | Stop all services |
| `make docker-logs` | View logs |
| `make docker-backup` | Backup database |
| `make help` | See all commands |

## Project Structure

```
├── website/                # Next.js web platform
│   └── src/app/
│       ├── api/            # API routes (GitHub, contact)
│       ├── components/     # React components
│       ├── lib/            # Analytics and API utilities
│       └── page.tsx        # Landing page
├── docker-compose.yml      # Self-hosting configuration
├── Makefile                # Dev and deployment commands
└── SELF_HOSTING.md         # Deployment guide
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Test locally with `make dev`
4. Submit a Pull Request

## License

GPL v3 — see [LICENSE](LICENSE) file for details.
