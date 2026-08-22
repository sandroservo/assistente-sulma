module.exports = {
  apps: [
    {
      name: "sulma-campaign-sender",
      script: "node_modules/.bin/tsx",
      args: "src/workers/campaign-sender.ts",
      cwd: __dirname + "/..",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      kill_timeout: 30000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
