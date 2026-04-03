import path from "node:path";
import { DIRECT_ENV_PORT_KEY_PATTERNS, NAME_EXCLUDE_PATTERNS } from "./config.js";
import type { PortPurpose } from "./types.js";

export function shouldExcludeName(name: string): boolean {
  return NAME_EXCLUDE_PATTERNS.some((pattern) => pattern.test(name));
}

export function isValidPort(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 65535;
}

export function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

export function relativeToAppsRoot(targetPath: string, appsRoot: string): string {
  const relativePath = path.relative(appsRoot, targetPath);
  return relativePath || ".";
}

export function inferPurposeFromKey(key: string): PortPurpose {
  if (/DB|DATABASE|POSTGRES|PG/i.test(key)) {
    return "db";
  }
  if (/ADMIN|DASHBOARD/i.test(key)) {
    return "admin";
  }
  if (/APP|WEB|PORT/i.test(key)) {
    return "app";
  }
  return "other";
}

export function isDirectEnvPortKey(key: string): boolean {
  return DIRECT_ENV_PORT_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export function inferPurposeFromDetail(detail: string): PortPurpose {
  if (/5432|postgres|db/i.test(detail)) {
    return "db";
  }
  if (/admin|dashboard/i.test(detail)) {
    return "admin";
  }
  return "app";
}

export function parsePortValue(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) {
    return null;
  }
  const value = Number(raw.trim());
  return isValidPort(value) ? value : null;
}
