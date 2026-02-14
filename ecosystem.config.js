module.exports = {
  apps: [{
    name: 'moltbook-multi-bot',
    script: 'src/multi-scheduler.js',
    cwd: '.',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '800M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    combine_logs: true
  }]
};
