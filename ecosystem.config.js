/**
 * PM2 Ecosystem Config — PM Orchestrator
 *
 * Usage:
 *   pm2 start ecosystem.config.js          # start both processes
 *   pm2 stop ecosystem.config.js           # stop both
 *   pm2 restart ecosystem.config.js        # restart both
 *   pm2 logs                               # tail all logs
 *   pm2 save && pm2 startup                # persist across reboots
 *
 * First-time setup:
 *   npm install && npm run build           # build Next.js first
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup                            # run the printed command as root
 */

const path = require("path");
const os   = require("os");

const APP_DIR  = __dirname;                                   // project root
const LOG_DIR  = path.join(os.homedir(), "claude-ui-designs", "logs", "pm2");

module.exports = {
  apps: [

    // ── 1. MCP HTTP Server ────────────────────────────────────────────────────
    // Must start BEFORE Next.js so the health check in route.ts succeeds.
    // Serves all 21 MCP tools on port 3100 (internal loopback only).
    {
      name:         "pm-orch-mcp",
      script:       "npx",
      args:         "tsx src/mcp-http-server.ts",
      cwd:          APP_DIR,

      // Restart policy
      autorestart:  true,
      watch:        false,           // don't watch — restarts are manual or on crash
      max_restarts: 10,
      restart_delay: 3000,           // 3 s between restart attempts

      // Environment
      env: {
        NODE_ENV:   "production",
        MCP_HOST:   "127.0.0.1",    // never expose externally
        MCP_PORT:   "3100",
      },

      // Logs
      out_file:    path.join(LOG_DIR, "mcp-out.log"),
      error_file:  path.join(LOG_DIR, "mcp-err.log"),
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs:  true,

      // Resources
      max_memory_restart: "1G",      // restart if AST graph grows past 1 GB
    },

    // ── 2. Next.js Web Server ─────────────────────────────────────────────────
    // Serves the UI on port 3000 (put nginx in front for HTTPS + auth).
    // Run `npm run build` before starting this for the first time.
    {
      name:         "pm-orch-next",
      script:       "npm",
      args:         "run start",
      cwd:          APP_DIR,

      // Start after MCP is up (PM2 starts in array order; delay gives MCP time to bind)
      wait_ready:   false,
      kill_timeout: 5000,

      // Restart policy
      autorestart:  true,
      watch:        false,
      max_restarts: 10,
      restart_delay: 2000,

      // Environment — override per-environment using --env flag:
      //   pm2 start ecosystem.config.js --env production
      env: {
        NODE_ENV: "development",
        PORT:     "3000",
      },
      env_production: {
        NODE_ENV: "production",
        PORT:     "3000",
      },

      // Logs
      out_file:    path.join(LOG_DIR, "next-out.log"),
      error_file:  path.join(LOG_DIR, "next-err.log"),
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs:  true,

      max_memory_restart: "512M",
    },

  ],
};
