module.exports = {
  apps: [
    {
      name: "commute-dashboard",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start",
      interpreter: "node",
      env: { NODE_ENV: "production", PORT: 3000 },
      autorestart: true,
      max_memory_restart: "512M",
      time: true,
      kill_timeout: 10000,
    },
    {
      name: "commute-collector",
      cwd: __dirname,
      script: "scripts/collect.ts",
      interpreter: "node",
      node_args: "--import tsx",
      env: { NODE_ENV: "production" },
      autorestart: true,
      restart_delay: 5000,
      time: true,
      kill_timeout: 15000,
    },
  ],
}
