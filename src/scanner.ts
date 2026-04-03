import fs from "node:fs";
import path from "node:path";
import {
  APPS_ROOT,
  SCAN_FILES,
  TOP_LEVEL_EXCLUDES
} from "./config.js";
import {
  relativeToAppsRoot,
  shouldExcludeName,
  inferPurposeFromDetail,
  inferPurposeFromKey,
  isDirectEnvPortKey,
  isValidPort,
  parsePortValue
} from "./utils.js";
import type {
  PortConfidence,
  PortPurpose,
  ProjectRecord,
  RegistryPortEntry,
  ScanCandidate
} from "./types.js";

export function scanProjects(): ProjectRecord[] {
  const projects: ProjectRecord[] = [];
  const entries = fs.readdirSync(APPS_ROOT, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (TOP_LEVEL_EXCLUDES.has(entry.name) || shouldExcludeName(entry.name)) {
      continue;
    }

    const projectPath = path.join(APPS_ROOT, entry.name);
    const candidates: ScanCandidate[] = [];

    for (const fileName of SCAN_FILES) {
      const filePath = path.join(projectPath, fileName);
      if (!fs.existsSync(filePath)) {
        continue;
      }

      const raw = fs.readFileSync(filePath, "utf8");
      if (fileName.startsWith("docker-compose")) {
        candidates.push(...parseDockerCompose(raw, relativeToAppsRoot(filePath, APPS_ROOT)));
      } else if (fileName.startsWith(".env")) {
        candidates.push(...parseEnvFile(raw, relativeToAppsRoot(filePath, APPS_ROOT)));
      } else if (fileName === "package.json") {
        candidates.push(...parsePackageJson(raw, relativeToAppsRoot(filePath, APPS_ROOT)));
      }
    }

    const ports = mergeCandidates(candidates);
    if (ports.length === 0) {
      continue;
    }

    projects.push({
      name: entry.name,
      path: projectPath,
      ports
    });
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

function parseDockerCompose(contents: string, relativeFile: string): ScanCandidate[] {
  const candidates: ScanCandidate[] = [];
  const lines = contents.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/["']?(?:[\d.]+:)?(?:\$\{[A-Z0-9_]+:-?(\d+)\}|(\d+)):(\d+)(?::(tcp|udp))?["']?/i);
    if (!match) {
      continue;
    }

    const hostPort = Number(match[1] ?? match[2]);
    const containerPort = Number(match[3]);
    if (!isValidPort(hostPort)) {
      continue;
    }

    const detail = `docker host port ${hostPort} -> container ${containerPort}`;
    candidates.push({
      port: hostPort,
      purpose: inferPurposeFromDetail(detail),
      confidence: "confirmed",
      source: {
        file: relativeFile,
        kind: "docker-compose",
        detail
      }
    });
  }

  return candidates;
}

function parseEnvFile(contents: string, relativeFile: string): ScanCandidate[] {
  const candidates: ScanCandidate[] = [];
  const lines = contents.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const keyValue = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!keyValue) {
      continue;
    }

    const key = keyValue[1];
    const rawValue = stripInlineComment(keyValue[2]).trim().replace(/^['"]|['"]$/g, "");
    if (!rawValue) {
      continue;
    }

    if (isDirectEnvPortKey(key)) {
      const directPort = parsePortValue(rawValue);
      if (directPort !== null) {
        candidates.push(buildCandidate(relativeFile, "env", key, directPort, inferPurposeFromKey(key), "confirmed"));
      }
    }

    for (const port of extractPortsFromUrlishValue(rawValue)) {
      candidates.push(buildCandidate(relativeFile, "env", `${key} URL`, port, inferPurposeFromKey(key), "reference"));
    }
  }

  return candidates;
}

function parsePackageJson(contents: string, relativeFile: string): ScanCandidate[] {
  const candidates: ScanCandidate[] = [];

  try {
    const parsed = JSON.parse(contents) as { scripts?: Record<string, string> };
    const scripts = parsed.scripts ?? {};

    for (const [scriptName, command] of Object.entries(scripts)) {
      const ports = extractPortsFromScript(command);
      for (const port of ports) {
        candidates.push(buildCandidate(relativeFile, "package-json", `script:${scriptName}`, port, "app", "reference"));
      }
    }
  } catch {
    return candidates;
  }

  return candidates;
}

function extractPortsFromScript(command: string): number[] {
  const ports = new Set<number>();
  const patterns = [
    /--port(?:=|\s+)(\d{2,5})/g,
    /(?:^|\s)-p\s+(\d{2,5})(?:\s|$)/g
  ];

  for (const pattern of patterns) {
    for (const match of command.matchAll(pattern)) {
      const port = Number(match[1]);
      if (isValidPort(port)) {
        ports.add(port);
      }
    }
  }

  return [...ports];
}

function extractPortsFromUrlishValue(value: string): number[] {
  const ports = new Set<number>();

  const localhostPattern = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|[a-z0-9.-]+):(\d{2,5})/gi;
  for (const match of value.matchAll(localhostPattern)) {
    const port = Number(match[1]);
    if (isValidPort(port)) {
      ports.add(port);
    }
  }

  const schemePattern = /^[a-z][a-z0-9+.-]*:\/\/[^/:]+:(\d{2,5})(?:\/|$)/i;
  const schemeMatch = value.match(schemePattern);
  if (schemeMatch) {
    const port = Number(schemeMatch[1]);
    if (isValidPort(port)) {
      ports.add(port);
    }
  }

  return [...ports];
}

function buildCandidate(
  relativeFile: string,
  kind: "docker-compose" | "env" | "package-json",
  detailLabel: string,
  port: number,
  purpose: PortPurpose,
  confidence: PortConfidence
): ScanCandidate {
  return {
    port,
    purpose,
    confidence,
    source: {
      file: relativeFile,
      kind,
      detail: `${detailLabel}=${port}`
    }
  };
}

function mergeCandidates(candidates: ScanCandidate[]): RegistryPortEntry[] {
  const merged = new Map<number, RegistryPortEntry>();

  for (const candidate of candidates) {
    const existing = merged.get(candidate.port);
    if (!existing) {
      merged.set(candidate.port, {
        port: candidate.port,
        purpose: candidate.purpose,
        status: "detected",
        confidence: candidate.confidence,
        sources: [candidate.source]
      });
      continue;
    }

    existing.sources.push(candidate.source);

    if (existing.confidence === "reference" && candidate.confidence === "confirmed") {
      existing.confidence = "confirmed";
    }

    if (existing.purpose === "other" && candidate.purpose !== "other") {
      existing.purpose = candidate.purpose;
    }
  }

  return [...merged.values()].sort((a, b) => a.port - b.port);
}

function stripInlineComment(value: string): string {
  const hashIndex = value.indexOf(" #");
  if (hashIndex >= 0) {
    return value.slice(0, hashIndex);
  }
  return value;
}
