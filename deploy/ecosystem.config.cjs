module.exports = {
  apps: [
    {
      name: "medibridge",
      cwd: "/srv/medibridge/current",
      script: "deploy/start-medibridge.mjs",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};
