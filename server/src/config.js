import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");

export const config = {
  env: process.env.NODE_ENV || "development",
  host: process.env.HOST || "0.0.0.0",
  dataDir: path.resolve(process.env.DATA_DIR || path.join(projectRoot, "data")),
  sessionDays: parseInt(process.env.SESSION_DAYS || "7", 10),
  cookieSecure: process.env.COOKIE_SECURE === "true",
  defaultAdminUser: process.env.DEFAULT_ADMIN_USER || "admin",
  defaultAdminPass: process.env.DEFAULT_ADMIN_PASS || "admin123",
};

fs.mkdirSync(config.dataDir, { recursive: true });
config.dbFile =
  process.env.DATABASE_FILE || path.join(config.dataDir, "app.db");

// One port for API + UI. PORT wins; otherwise a random 5-digit port is picked
// once and remembered in data/runtime.json so webhook URLs stay stable.
const runtimeFile = path.join(config.dataDir, "runtime.json");
let runtime = {};
try {
  runtime = JSON.parse(fs.readFileSync(runtimeFile, "utf8"));
} catch {
  /* first boot */
}

if (process.env.PORT) {
  config.port = parseInt(process.env.PORT, 10);
} else if (Number.isInteger(runtime.port)) {
  config.port = runtime.port;
} else {
  config.port = 10000 + Math.floor(Math.random() * 55536); // 10000..65535
  runtime.port = config.port;
  fs.writeFileSync(runtimeFile, JSON.stringify(runtime, null, 2) + "\n");
}
