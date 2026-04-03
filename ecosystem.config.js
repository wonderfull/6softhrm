module.exports = {
  apps: [{
    name: '6soft-hrm-backend',
    script: 'dist/index.js',
    cwd: '/var/www/6softhrm/backend',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    error_file: '/var/log/pm2/6soft-hrm-error.log',
    out_file: '/var/log/pm2/6soft-hrm-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    min_uptime: '10s',
    max_restarts: 10
  }]
}
