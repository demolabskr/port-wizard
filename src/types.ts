export type PortPurpose = "app" | "db" | "admin" | "other";

export type PortStatus = "detected" | "reserved";

export type PortConfidence = "confirmed" | "reference";

export interface PortSource {
  file: string;
  kind: "docker-compose" | "env" | "package-json" | "manual";
  detail: string;
}

export interface RegistryPortEntry {
  port: number;
  purpose: PortPurpose;
  status: PortStatus;
  confidence: PortConfidence;
  sources: PortSource[];
}

export interface ProjectRecord {
  name: string;
  path: string;
  ports: RegistryPortEntry[];
}

export interface ReservationRecord {
  project: string;
  port: number;
  purpose: PortPurpose;
  status: "reserved";
  note: string;
  createdAt: string;
}

export interface PortRegistry {
  generatedAt: string | null;
  rootPath: string;
  projects: ProjectRecord[];
  reservations: ReservationRecord[];
}

export interface ScanCandidate {
  port: number;
  purpose: PortPurpose;
  confidence: PortConfidence;
  source: PortSource;
}
