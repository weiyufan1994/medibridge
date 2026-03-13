# Production Deploy

## Summary

MediBridge production deploys automatically from GitHub Actions.

Current rule:

- Daily development happens on `dev`
- Production deploy is triggered by pushes to `main`

Do not treat `/srv/medibridge/current` as a manual git working tree.
Production runs from release directories under `/srv/medibridge/releases/`.

## Branch flow

Recommended flow:

1. Start feature work from `dev`
2. Push feature branches and merge back into `dev`
3. Test on `dev`
4. Merge `dev` into `main` when ready to release
5. Let GitHub Actions deploy `main` automatically

Hotfix flow:

1. Fix the issue on a branch based on `main`
2. Merge into `main`
3. Confirm production deploy succeeds
4. Merge the same fix back into `dev`

## What deploys production

Workflow file:

```text
.github/workflows/deploy-production.yml
```

Trigger:

- `push` to `main`
- manual `workflow_dispatch`

The workflow does this:

1. Install dependencies
2. Run `pnpm check`
3. Run `pnpm lint:imports`
4. Build and package a release archive
5. Upload the archive to S3
6. Send an SSM command to the EC2 instance
7. Download the archive by presigned URL on the server
8. Extract to `/srv/medibridge/releases/<release-id>`
9. Switch `/srv/medibridge/current`
10. Reload PM2
11. Run a health check against `http://127.0.0.1:3000/`

## Server layout

Important production paths:

- current symlink: `/srv/medibridge/current`
- release directory root: `/srv/medibridge/releases`
- shared env file: `/srv/medibridge/shared/.env.production`
- PM2 config: `/srv/medibridge/current/deploy/ecosystem.config.cjs`
- PM2 logs: `/root/.pm2/logs/medibridge-out-0.log`
- PM2 error logs: `/root/.pm2/logs/medibridge-error-0.log`

## GitHub requirements

Repository secrets currently required:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Current fixed deployment targets:

- region: `ap-southeast-1`
- artifact bucket: `medibridge-deploy-artifacts-525164180577-ap-southeast-1`
- EC2 instance: `i-0c9bfbb5287d85ccf`

## Do we need AWS CLI on the server?

No, not for the current production deploy flow.

Reason:

- GitHub Actions uploads the release archive to S3
- GitHub Actions generates a presigned download URL
- The EC2 instance downloads the archive with `curl`

So the production deploy path no longer depends on server-side `aws cli`.

You would only need `aws cli` on the server for separate operational tasks, such as:

- manual AWS debugging from the instance
- cron jobs that call AWS services directly
- scripts that pull SSM parameters or S3 files outside the deploy workflow

## Release verification

After a production deploy, check:

```bash
readlink -f /srv/medibridge/current
sudo pm2 list
curl -I http://127.0.0.1:3000/
```

If needed, inspect logs:

```bash
sudo tail -n 100 /root/.pm2/logs/medibridge-out-0.log
sudo tail -n 100 /root/.pm2/logs/medibridge-error-0.log
```

## Typical release steps

### Standard release

```bash
git checkout dev
git pull
# feature work / merge into dev
git checkout main
git pull --rebase origin main
git merge dev
git push origin main
```

Then watch GitHub Actions `Deploy Production`.

### If production deploy fails

1. Open the latest `Deploy Production` run in GitHub Actions
2. Check the failed step
3. Read the uploaded `production-deploy-result` artifact if present
4. Check server logs and PM2 state
5. Fix on `main` if it is a release-only issue
6. Sync the fix back to `dev`

## Notes

- `main` is the production branch
- `dev` is the integration branch
- Do not manually `git pull` inside `/srv/medibridge/current`
- Prefer fixing deploy logic in GitHub Actions instead of mutating the server manually
