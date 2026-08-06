module.exports = {
  apps: [
    {
      name: 'vps-ci-cd',
      script: 'server/src/index.js',
      cwd: '/opt/vps-ci-cd',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
