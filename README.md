# Insight RTLS - Backend

This repository is the backend for the Insight RTLS website. It provides a simple contact form endpoint and example Mailgun integration.

## Quick start

1. Copy `.env.example` to `.env` and fill in your Mailgun credentials.

2. Install dependencies:

```bash
npm install
```

3. Run locally:

```bash
npm start
# or for development with nodemon (install nodemon globally or as devDependency):
# npm run dev
```

The server listens on `PORT` (default: 3000). Health check endpoint: `GET /api/health`.

## Deploying

You can deploy this backend to Azure App Service, Azure Container Instances, or any container host. Example Dockerfile is included.

### GitHub Actions / Azure App Service
Add the Azure publish profile as a secret named `AZURE_WEBAPP_PUBLISH_PROFILE` in your repo and use the provided GitHub Actions workflow template (`.github/workflows/deploy.yml`).

## Environment variables
See `backend.env.example` for required variables.

## Notes
- This is a minimal example intended to be extended for production use (validation, rate limiting, persistence, logging, error tracking).
