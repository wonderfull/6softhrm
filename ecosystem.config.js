// PM2 process definitions for the OnsideHR VPS.
//   pm2 start ecosystem.config.js            # api + nightly backup
//   pm2 start ecosystem.config.js --only onsidehr-api-staging
module.exports = {
  apps: [
    {
      // Must match the process pm2 is actually running on the VPS. It is
      // 6soft-hrm-backend; starting this file under a different name would
      // launch a second API against a port the first already holds, and the
      // new one would die on EADDRINUSE while the old one kept serving.
      name: '6soft-hrm-backend',
      cwd: './backend',
      script: 'dist/index.js',
      instances: 1, // cron jobs assume a single runner — do not switch to cluster
      env: { NODE_ENV: 'production', PORT: 4000 },
      max_memory_restart: '512M',
      out_file: '~/.pm2/logs/onsidehr-api.log',
      merge_logs: true,
    },
    {
      // Staging: same box, own database and env file (backend/.env.staging),
      // fronted by staging.onsidehr.co.uk in Nginx.
      name: 'onsidehr-api-staging',
      cwd: './backend',
      script: 'dist/index.js',
      instances: 1,
      env: { NODE_ENV: 'production', PORT: 4001, DOTENV_CONFIG_PATH: '.env.staging' },
      max_memory_restart: '384M',
    },
    {
      // Nightly DB backup at 02:30 — one-shot process PM2 re-runs on schedule.
      name: 'onsidehr-backup',
      cwd: './backend',
      script: 'node_modules/.bin/ts-node',
      args: '--transpile-only scripts/backup-db.ts',
      autorestart: false,
      cron_restart: '30 2 * * *',
    },
  ],
}
