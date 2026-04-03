#!/usr/bin/env node

import { PURPOSE_RANGES, REGISTRY_PATH } from "./config.js";
import {
  addReservation,
  collectUsedPorts,
  findPortOwner,
  loadRegistry,
  replaceDetectedProjects,
  saveRegistry
} from "./registry.js";
import { scanProjects } from "./scanner.js";
import type { PortPurpose, ReservationRecord } from "./types.js";
import { isValidPort } from "./utils.js";

const args = process.argv.slice(2);
const command = args[0] ?? "help";

try {
  switch (command) {
    case "scan":
      runScan();
      break;
    case "list":
      runList(args.slice(1));
      break;
    case "suggest":
      runSuggest(args.slice(1));
      break;
    case "reserve":
      runReserve(args.slice(1));
      break;
    default:
      printHelp();
      process.exitCode = command === "help" ? 0 : 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
}

function runScan(): void {
  const registry = loadRegistry();
  const projects = scanProjects();
  const nextRegistry = replaceDetectedProjects(registry, projects);
  saveRegistry(nextRegistry);

  const portCount = projects.reduce((sum, project) => sum + project.ports.length, 0);
  console.log(`Scanned ${projects.length} projects and recorded ${portCount} ports.`);
  console.log(`Registry updated: ${REGISTRY_PATH}`);
}

function runList(argv: string[]): void {
  const registry = loadRegistry();
  if (argv.includes("--json")) {
    console.log(JSON.stringify(registry, null, 2));
    return;
  }

  console.log(`Registry: ${REGISTRY_PATH}`);
  console.log(`Generated: ${registry.generatedAt ?? "never"}`);

  if (registry.projects.length === 0 && registry.reservations.length === 0) {
    console.log("No ports recorded yet. Run `scan` first.");
    return;
  }

  for (const project of registry.projects) {
    const summary = project.ports
      .map((entry) => `${entry.port}/${entry.purpose}/${entry.confidence}`)
      .join(", ");
    console.log(`${project.name}: ${summary}`);
  }

  if (registry.reservations.length > 0) {
    console.log("Reservations:");
    for (const reservation of registry.reservations) {
      console.log(`- ${reservation.project}: ${reservation.port}/${reservation.purpose} (${reservation.note || "no note"})`);
    }
  }
}

function runSuggest(argv: string[]): void {
  const purpose = parsePurpose(getOption(argv, "--purpose") ?? "app");
  const count = parseCount(getOption(argv, "--count") ?? "5");
  const registry = loadRegistry();
  const usedPorts = collectUsedPorts(registry);
  const suggestions = findSuggestions(purpose, count, usedPorts);

  if (suggestions.length === 0) {
    throw new Error(`No available ports found for purpose '${purpose}'.`);
  }

  console.log(`Suggested ${purpose} ports: ${suggestions.join(", ")}`);
}

function runReserve(argv: string[]): void {
  const project = getRequiredOption(argv, "--project");
  const note = getOption(argv, "--note") ?? "";
  const purpose = parsePurpose(getRequiredOption(argv, "--purpose"));
  const port = Number(getRequiredOption(argv, "--port"));

  if (!isValidPort(port)) {
    throw new Error(`Invalid port: ${port}`);
  }

  const registry = loadRegistry();
  const owner = findPortOwner(registry, port);
  if (owner) {
    if (owner.type === "project") {
      throw new Error(`Port ${port} is already used by detected project '${owner.project.name}'.`);
    }
    throw new Error(`Port ${port} is already reserved by '${owner.reservation.project}'.`);
  }

  const reservation: ReservationRecord = {
    project,
    port,
    purpose,
    status: "reserved",
    note,
    createdAt: new Date().toISOString()
  };

  const nextRegistry = addReservation(registry, reservation);
  saveRegistry(nextRegistry);
  console.log(`Reserved port ${port} for ${project} (${purpose}).`);
}

function findSuggestions(
  purpose: PortPurpose,
  count: number,
  usedPorts: Set<number>
): number[] {
  const suggestions: number[] = [];

  for (const [start, end] of PURPOSE_RANGES[purpose]) {
    for (let port = start; port <= end; port += 1) {
      if (usedPorts.has(port)) {
        continue;
      }
      suggestions.push(port);
      if (suggestions.length >= count) {
        return suggestions;
      }
    }
  }

  return suggestions;
}

function parsePurpose(value: string): PortPurpose {
  if (value === "app" || value === "db" || value === "admin" || value === "other") {
    return value;
  }
  throw new Error(`Unsupported purpose: ${value}`);
}

function parseCount(value: string): number {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    throw new Error(`Invalid count: ${value}`);
  }
  return count;
}

function getOption(argv: string[], name: string): string | null {
  const index = argv.indexOf(name);
  if (index < 0) {
    return null;
  }
  return argv[index + 1] ?? null;
}

function getRequiredOption(argv: string[], name: string): string {
  const value = getOption(argv, name);
  if (!value) {
    throw new Error(`Missing required option ${name}`);
  }
  return value;
}

function printHelp(): void {
  console.log("port-wizard commands:");
  console.log("  scan");
  console.log("  list [--json]");
  console.log("  suggest [--purpose app|db|admin|other] [--count 5]");
  console.log("  reserve --project <name> --port <number> --purpose <app|db|admin|other> [--note <text>]");
}
