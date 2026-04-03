import fs from "node:fs";
import path from "node:path";
import { REGISTRY_PATH, APPS_ROOT } from "./config.js";
import type {
  PortRegistry,
  ProjectRecord,
  RegistryPortEntry,
  ReservationRecord
} from "./types.js";

export function emptyRegistry(): PortRegistry {
  return {
    generatedAt: null,
    rootPath: APPS_ROOT,
    projects: [],
    reservations: []
  };
}

export function loadRegistry(): PortRegistry {
  if (!fs.existsSync(REGISTRY_PATH)) {
    return emptyRegistry();
  }

  const raw = fs.readFileSync(REGISTRY_PATH, "utf8");
  const parsed = JSON.parse(raw) as Partial<PortRegistry>;

  return {
    generatedAt: parsed.generatedAt ?? null,
    rootPath: parsed.rootPath ?? APPS_ROOT,
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    reservations: Array.isArray(parsed.reservations) ? parsed.reservations : []
  };
}

export function saveRegistry(registry: PortRegistry): void {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

export function replaceDetectedProjects(
  registry: PortRegistry,
  projects: ProjectRecord[]
): PortRegistry {
  return {
    ...registry,
    generatedAt: new Date().toISOString(),
    rootPath: APPS_ROOT,
    projects
  };
}

export function addReservation(
  registry: PortRegistry,
  reservation: ReservationRecord
): PortRegistry {
  const nextReservations = registry.reservations
    .filter((entry) => entry.port !== reservation.port)
    .concat(reservation)
    .sort((a, b) => a.port - b.port);

  return {
    ...registry,
    reservations: nextReservations
  };
}

export function collectUsedPorts(registry: PortRegistry): Set<number> {
  const usedPorts = new Set<number>();

  for (const project of registry.projects) {
    for (const entry of project.ports) {
      usedPorts.add(entry.port);
    }
  }

  for (const reservation of registry.reservations) {
    usedPorts.add(reservation.port);
  }

  return usedPorts;
}

export function findPortOwner(
  registry: PortRegistry,
  port: number
): { type: "project"; project: ProjectRecord; entry: RegistryPortEntry } | { type: "reservation"; reservation: ReservationRecord } | null {
  for (const project of registry.projects) {
    for (const entry of project.ports) {
      if (entry.port === port) {
        return { type: "project", project, entry };
      }
    }
  }

  for (const reservation of registry.reservations) {
    if (reservation.port === port) {
      return { type: "reservation", reservation };
    }
  }

  return null;
}
