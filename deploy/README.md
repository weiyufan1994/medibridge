# EC2 deployment assets

This directory contains the minimum runtime config for deploying MediBridge to a
single Ubuntu EC2 instance with Nginx and PM2.

- `ecosystem.config.cjs`: PM2 app definition, reads env from
  `/srv/medibridge/shared/.env.production`
- `nginx.medibridge.conf`: reverse proxy from port `80` to app port `3000`
- `start-medibridge.mjs`: runtime bootstrap that can read secure values from
  AWS Systems Manager Parameter Store before starting the app
