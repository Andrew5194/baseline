# Docker Hub CI/CD Setup

This document explains how to set up the automated Docker image builds that push to Docker Hub.

## Prerequisites

- Docker Hub account (create at https://hub.docker.com)
- GitHub repository with Actions enabled

## Setup Steps

### 1. Create Docker Hub Access Token

1. Go to https://hub.docker.com/settings/security
2. Click "New Access Token"
3. Name it: `github-actions-baseline`
4. Permissions: `Read & Write`
5. Click "Generate"
6. **Copy the token immediately** (you won't be able to see it again)

### 2. Add Secret to GitHub

1. Go to your GitHub repository: https://github.com/Andrew5194/automate-my-life
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `DOCKERHUB_TOKEN`
5. Value: Paste the Docker Hub access token from step 1
6. Click "Add secret"

### 3. Verify Setup

The workflow is already configured in `.github/workflows/docker-build.yml`.

When you push to the `main` branch, it will automatically:
- Build the Docker image for `linux/amd64` and `linux/arm64`
- Push to Docker Hub as `andrew5194/automate-my-life:latest`
- Tag with branch name, commit SHA, and semantic versions

## Usage

### Automatic Builds

Builds trigger automatically on:
- Push to `main` branch (when website/ files change)
- New release published
- Manual workflow dispatch

### Manual Trigger

You can manually trigger a build from GitHub:
1. Go to Actions tab
2. Select "Build and Push Docker Image"
3. Click "Run workflow"
4. Select branch and click "Run workflow"

## Image Tags

The workflow creates multiple tags:

- `andrew5194/automate-my-life:latest` - Latest from main branch
- `andrew5194/automate-my-life:main` - Main branch
- `andrew5194/automate-my-life:main-abc123` - Commit SHA
- `andrew5194/automate-my-life:v1.0.0` - Release version
- `andrew5194/automate-my-life:1.0` - Major.minor version
- `andrew5194/automate-my-life:1` - Major version

## Viewing Builds

- **GitHub Actions**: https://github.com/Andrew5194/automate-my-life/actions
- **Docker Hub**: https://hub.docker.com/r/andrew5194/automate-my-life

## Troubleshooting

### Build fails with "denied: requested access to the resource is denied"

- Check that `DOCKERHUB_TOKEN` secret is set correctly
- Verify the token hasn't expired
- Ensure Docker Hub username is correct (`andrew5194`)

### Image not updating

- Check if the workflow ran successfully in GitHub Actions
- Docker Hub can take a few minutes to show new images
- Try pulling with a specific tag: `docker pull andrew5194/automate-my-life:main-abc123`

## Security Notes

- Never commit the Docker Hub token to git
- Rotate the token if it's ever exposed
- The token is stored securely in GitHub Secrets
- Only repository maintainers can access the secret
