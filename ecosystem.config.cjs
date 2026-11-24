/**
 * PM2 Process Configuration for Lumenist
 *
 * Uses PM2 cluster mode with 1 instance by default so:
 *  - `pm2 reload lumenist` performs zero-downtime rolling reloads (spawns the new
 *    worker and waits until it is listening before gracefully draining the old one).
 *  - Steady-state execution stays single-process, avoiding concurrent write races
 *    against local JSON data files (data/photos.json, data/settings.json).
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 reload lumenist
 *   pm2 save
 */
module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || "lumenist",
      script: "./node_modules/next/dist/bin/next",
      args: "start",
      cwd: __dirname,
      exec_mode: "cluster",
      instances: Number(process.env.PM2_INSTANCES) || 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      listen_timeout: 15000,
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3000,
      },
    },
  ],
};
