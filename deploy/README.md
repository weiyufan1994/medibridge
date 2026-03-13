# EC2 deployment assets

This directory contains the minimum runtime config for deploying MediBridge to a
single Ubuntu EC2 instance with Nginx and PM2.

- `ecosystem.config.cjs`: PM2 app definition, reads env from
  `/srv/medibridge/shared/.env.production`
- `nginx.medibridge.conf`: reverse proxy from port `80` to app port `3000`
- `start-medibridge.mjs`: runtime bootstrap that can read secure values from
  AWS Systems Manager Parameter Store before starting the app

## GitHub Actions production deploy

The repository also includes `.github/workflows/deploy-production.yml`.

It deploys on every push to `main` and on manual `workflow_dispatch`.

Required GitHub repository secrets:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Current deployment targets baked into the workflow:

- AWS region: `ap-southeast-1`
- S3 artifact bucket: `medibridge-deploy-artifacts-525164180577-ap-southeast-1`
- EC2 instance id: `i-0c9bfbb5287d85ccf`

The workflow packages a release archive, uploads it to S3, and asks SSM to:

1. Download the archive on the EC2 instance
2. Extract it into `/srv/medibridge/releases/<release-id>`
3. Install production dependencies with `pnpm`
4. Switch `/srv/medibridge/current` to the new release
5. Reload PM2 and run a local health check on port `3000`

Detailed operating guide:

- `docs/ops/production_deploy.md`
