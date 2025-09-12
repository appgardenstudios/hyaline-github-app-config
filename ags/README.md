# Hyaline GitHub App Deployment

This directory contains the Cloudflare Workers deployment configuration for the Hyaline GitHub App for internal App Garden Studios use.

## Architecture

The GitHub App is built from the source code located in `../.github/apps/_hyaline/` and deployed to Cloudflare Workers using the configuration in `wrangler.toml`.

## Environments

### Development Environment
- **Domain**: `github-app-dev.hyaline.dev`
- **GitHub App**: Uses the `internal.hyaline.dev` GitHub app
- **Config Repository**: `hyaline-github-app-config-internal`
- **Purpose**: For internal use by App Garden Studios

### Production Environment  
- **Domain**: `github-app.hyaline.dev`
- **GitHub App**: Uses the `hyaline.dev` GitHub app
- **Purpose**: Intended for customer use

## Deployment

Deployment is handled through the GitHub Actions workflow at `../.github/workflows/deploy-github-app.yml`.

1. Go to the Actions tab in the GitHub repository
2. Select "Deploy GitHub App" workflow
3. Click "Run workflow"
4. Choose the environment (`dev` or `prod`)
5. Click "Run workflow"

## Secrets

The deployment workflow uses the following GitHub repository secrets:
- `CLOUDFLARE_API_TOKEN` - API token for deploying to Cloudflare Workers
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account identifier
- `HYALINE_GITHUB_PRIVATE_KEY` - Private key for authenticating as the GitHub App
- `HYALINE_GITHUB_APP_WEBHOOK_SECRET` - Secret for validating GitHub webhook payloads
- `HYALINE_GITHUB_APP_ID` - The GitHub App's ID