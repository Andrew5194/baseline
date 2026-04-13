# Self-Hosting Baseline

This guide will help you deploy Baseline on your own infrastructure using Docker.

## Prerequisites

- Docker (version 20.10 or higher)
- Docker Compose (version 2.0 or higher)
- At least 2GB of available RAM
- 10GB of available disk space

## Deployment

Pre-built Docker images are automatically published to [Docker Hub](https://hub.docker.com/r/andrew5194/automate-my-life) via GitHub Actions.

### 1. Clone the Repository

```bash
git clone https://github.com/Andrew5194/automate-my-life.git
cd automate-my-life
```

### 2. Configure Environment

```bash
cp .env.example .env
nano .env  # Edit with your settings
```

Edit `.env` and update these critical values:
- `POSTGRES_PASSWORD` - Set a strong database password
- `REDIS_PASSWORD` - Set a strong Redis password
- `APP_URL` - Your domain or IP address

### 3. Build and Start Services

```bash
docker compose up -d --build
```

This will start:
- PostgreSQL database (port 5432)
- Redis cache (port 6379)
- Baseline web application (port 3000)

### 4. Access Your Instance

Open your browser and navigate to:
```
http://localhost:3000
```

Or if you set a custom domain:
```
http://your-domain.com:3000
```

## Configuration Options

### Database

The default PostgreSQL configuration should work for most users. If you need to customize:

```env
POSTGRES_USER=aml
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=aml
POSTGRES_PORT=5432
```

### Redis Cache

Redis is used for session management and caching:

```env
REDIS_PASSWORD=your_secure_redis_password
REDIS_PORT=6379
```

### Application Port

Change the web application port:

```env
WEB_PORT=3000
```

### GitHub Integration (Optional)

To display GitHub activity on your landing page:

1. Create a Personal Access Token at https://github.com/settings/tokens
2. Required scope: `read:user`
3. Add to `.env`:

```env
GITHUB_USERNAME=your_username
GITHUB_TOKEN=ghp_your_token_here
```

### Contact Form (Optional)

To enable the contact form:

1. Sign up for Resend at https://resend.com
2. Get your API key from https://resend.com/api-keys
3. Add to `.env`:

```env
RESEND_API_KEY=re_your_api_key_here
CONTACT_EMAIL=your-email@example.com
```

## Management Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f web
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Restart Services

```bash
# All services
docker-compose restart

# Specific service
docker-compose restart web
```

### Stop Services

```bash
docker-compose stop
```

### Update to Latest Version

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Backup Database

```bash
# Create backup
docker-compose exec postgres pg_dump -U aml aml > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
cat backup_20250124_120000.sql | docker-compose exec -T postgres psql -U aml aml
```

## Production Deployment

### Using Nginx as Reverse Proxy

1. Uncomment the nginx service in `docker-compose.yml`
2. Create nginx configuration:

```bash
mkdir -p nginx
```

3. Create `nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream aml {
        server web:3000;
    }

    server {
        listen 80;
        server_name your-domain.com;

        location / {
            proxy_pass http://aml;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

4. Restart services:

```bash
docker-compose up -d
```

### SSL/HTTPS Setup

For production, use Let's Encrypt with Certbot:

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal (runs twice daily)
sudo systemctl enable certbot.timer
```

### Security Recommendations

1. **Change default passwords** - Update `POSTGRES_PASSWORD` and `REDIS_PASSWORD`
2. **Use strong passwords** - At least 32 characters, random
3. **Enable firewall** - Only expose necessary ports (80, 443)
4. **Regular updates** - Keep Docker images and application updated
5. **Backup regularly** - Automate database backups
6. **Use HTTPS** - Always use SSL certificates in production
7. **Environment variables** - Never commit `.env` to git

### Resource Requirements

**Minimum:**
- CPU: 1 core
- RAM: 2GB
- Disk: 10GB

**Recommended:**
- CPU: 2 cores
- RAM: 4GB
- Disk: 50GB SSD

### Monitoring

Check service health:

```bash
# Check all containers
docker-compose ps

# Check resource usage
docker stats

# Check disk usage
docker system df
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs web

# Check if ports are in use
sudo netstat -tlnp | grep :3000
```

### Database Connection Issues

```bash
# Test database connection
docker-compose exec postgres psql -U aml -d aml -c "SELECT 1;"

# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d
```

### Redis Connection Issues

```bash
# Test Redis connection
docker-compose exec redis redis-cli -a your_redis_password ping
```

### Out of Memory

Increase Docker memory limits or upgrade your server RAM.

### Permission Issues

```bash
# Fix permissions
sudo chown -R $USER:$USER .
```

## Updating

To update to the latest version:

```bash
# Backup first
docker-compose exec postgres pg_dump -U aml aml > backup.sql

# Update code
git pull origin main

# Rebuild images
docker-compose build --no-cache

# Restart services
docker-compose down
docker-compose up -d

# Check logs
docker-compose logs -f
```

## Support

- Documentation: https://github.com/Andrew5194/automate-my-life
- Issues: https://github.com/Andrew5194/automate-my-life/issues
- Contact: Use the contact form on your Baseline instance

## License

This project is open source under the GPL v3 License. See LICENSE file for details.
