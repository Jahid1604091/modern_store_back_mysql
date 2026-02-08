module.exports = {
  apps: [
    {
      name: "modern-store-back",          // change app name
      script: "index.js",           // entry file (app.js / index.js / server.js)
      instances: "max",              // use all CPU cores
      exec_mode: "cluster",          // cluster mode for production
      watch: false,                  // turn on only for development
      autorestart: true,
      max_memory_restart: "500M",

      env: {
        NODE_ENV: "development",
        PORT: 3000
      },

      env_production: {
        NODE_ENV: "production",
        PORT: 3000
      },

      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      merge_logs: true
    }
  ]
};
