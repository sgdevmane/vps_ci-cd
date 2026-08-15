import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { migrate, isPostgres, db, purgeExpiredSessions } from "./db/index.js";
import { ensureDefaultAdmin } from "./auth/setup.js";
import { metricsMiddleware, register } from "./core/metrics.js";
import authRoutes from "./routes/auth.js";
import serviceRoutes from "./routes/services.js";
import triggerRoutes from "./routes/triggers.js";
import settingsRoutes from "./routes/settings.js";
import notificationsRoutes from "./routes/notifications.js";
import badgesRoutes from "./routes/badges.js";
import systemRoutes from "./routes/system.js";
import hookRoutes from "./routes/hooks.js";
import docsRoutes from "./routes/docs.js";

const pkg = JSON.parse(
  fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
);

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(cookieParser());

// Baseline security headers (complemented by the Nginx layer in Docker deployments)
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });
  next();
});

// Enable HTTP metrics collection
if (config.metricsEnabled) {
  app.use(metricsMiddleware);
}

// Prometheus metrics endpoint
app.get("/api/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

// Swagger / OpenAPI documentation
if (config.swaggerEnabled) {
  app.use("/api/docs", docsRoutes);
}

// Public badges endpoint (no auth required)
app.use("/api/badges", badgesRoutes);

// Webhooks get the raw body so HMAC signatures can be verified.
app.use("/api/hooks", express.raw({ type: "*/*", limit: "5mb" }));
app.use("/api", express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) =>
  res.json({
    ok: true,
    uptime: process.uptime(),
    dbEngine: isPostgres ? "postgresql" : "sqlite",
    version: pkg.version,
  }),
);

app.use("/api/auth", authRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/triggers", triggerRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api", hookRoutes);
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

const webRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "web",
);
const distDir = path.join(webRoot, "dist");

// API + UI on one port: Vite as middleware in development (with HMR),
// the built web/dist in production.
async function attachUi(httpServer) {
  if (config.env !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        root: webRoot,
        configFile: path.join(webRoot, "vite.config.js"),
        appType: "custom",
        server: { middlewareMode: true, ws: { server: httpServer } },
      });
      app.use(vite.middlewares);
      return "dev UI (Vite middleware + HMR)";
    } catch (err) {
      console.warn(
        `[warn] Vite dev middleware unavailable (${err.message}) — falling back to built UI.`,
      );
    }
  }
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.use((req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api")) {
        return res.sendFile(path.join(distDir, "index.html"));
      }
      next();
    });
    return "built UI (web/dist)";
  }
  console.warn(
    '[warn] web/dist not found — run "npm run build" to build the UI.',
  );
  return "no UI";
}

async function main() {
  await migrate();
  await purgeExpiredSessions();
  // Purge expired sessions every 6 hours to keep the sessions table lean.
  const sessionPurgeTimer = setInterval(purgeExpiredSessions, 6 * 60 * 60 * 1000);
  sessionPurgeTimer.unref?.();
  const admin = await ensureDefaultAdmin();
  const httpServer = http.createServer(app);
  const uiMode = await attachUi(httpServer);

  // Error handling middleware
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error("[error]", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "Internal server error" });
  });

  httpServer.listen(config.port, config.host, () => {
    console.log("");
    console.log("  ┌─────────────────────────────────────────────┐");
    console.log("  │  VPS CI/CD — webhook git sync & deploy      │");
    console.log("  └─────────────────────────────────────────────┘");
    console.log(`  Listening on  http://${config.host}:${config.port}`);
    console.log(`  UI            ${uiMode}`);
    console.log(`  Database      ${isPostgres ? "PostgreSQL (Remote URL)" : `SQLite (${config.dbFile})`}`);
    console.log(`  Swagger Docs  http://${config.host}:${config.port}/api/docs`);
    console.log(`  Metrics       http://${config.host}:${config.port}/api/metrics`);
    console.log(`  Data dir      ${config.dataDir}`);
    if (admin.created) {
      console.log("");
      console.log(
        `  First run — login with:  ${admin.username} / ${admin.password}`,
      );
      console.log("  You will be asked to change the password.");
    }
    console.log("");
  });

  // --- graceful shutdown (SIGTERM from Docker / systemd / PM2) ---
  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[info] ${signal} received — draining connections…`);
    httpServer.close(() => {
      db.destroy()
        .catch(() => {})
        .finally(() => process.exit(0));
    });
    // Force-exit if connections do not drain in time.
    setTimeout(() => process.exit(0), 10_000).unref?.();
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
