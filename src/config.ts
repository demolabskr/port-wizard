import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PortPurpose } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_ROOT = path.resolve(__dirname, "..");
export const APPS_ROOT = "/Users/dev/Apps";
export const REGISTRY_PATH = path.join(PROJECT_ROOT, "data", "ports.json");

export const TOP_LEVEL_EXCLUDES = new Set([
  "port-wizard"
]);

export const NAME_EXCLUDE_PATTERNS = [
  /^\./,
  /^node_modules$/i,
  /^dist$/i,
  /^build$/i,
  /^backup/i,
  /^old$/i,
  /^analysis_tmp$/i,
  /^migration-bundle/i
];

export const SCAN_FILES = [
  "docker-compose.yml",
  "docker-compose.yaml",
  ".env",
  ".env.local",
  "package.json"
] as const;

export const PURPOSE_RANGES: Record<PortPurpose, Array<[number, number]>> = {
  app: [
    [3000, 3999],
    [8000, 8999]
  ],
  db: [
    [5400, 5999]
  ],
  admin: [
    [9000, 9999]
  ],
  other: [
    [10000, 10999]
  ]
};

export const EXPLICIT_PURPOSE_KEYS: Array<{
  pattern: RegExp;
  purpose: PortPurpose;
}> = [
  { pattern: /DB|DATABASE|POSTGRES|PG/i, purpose: "db" },
  { pattern: /ADMIN|DASHBOARD/i, purpose: "admin" },
  { pattern: /APP|WEB|PORT/i, purpose: "app" }
];

export const DIRECT_ENV_PORT_KEY_PATTERNS = [
  /^PORT$/i,
  /^(APP|WEB|SERVER|DEV|API|VITE|NEXT|FRONTEND|BACKEND|DJANGO)_PORT$/i,
  /^(DB|DB_BIND|DATABASE|POSTGRES|POSTGRESQL|PG)_PORT$/i,
  /^(ADMIN|ADMIN_DASHBOARD|DASHBOARD)_PORT$/i
];
