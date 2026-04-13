# Baseline

The quantitative productivity analytics platform for knowledge workers. Connect your tools, establish your baseline, and measure your rate of progress.

## Features

- **Productivity Dashboard**: Real-time activity tracking with interactive trend charts and rolling averages
- **GitHub Integration**: Contribution heatmaps, commit drill-downs, streak tracking, and pattern analysis
- **Quantitative Analytics**: Consistency scores, deep work days, day-of-week patterns, and monthly trends
- **Self-Hostable**: Full Docker deployment with PostgreSQL and Redis
- **Contact Form**: Built-in contact page powered by Resend

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **APIs**: GitHub GraphQL & REST
- **Infrastructure**: Docker, PostgreSQL, Redis
- **Email**: Resend
- **Deployment**: Vercel or Docker self-hosting

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

GPL v3 - see [LICENSE](LICENSE) file for details.
