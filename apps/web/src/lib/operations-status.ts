export interface OperationsStatus {
  checkedAt: string;
  site: { status: "ok" | "error"; checkedAt: string };
  backup: {
    status: "ok" | "late" | "error" | "unknown" | "unconfigured";
    capturedAt: string | null;
    verifiedAt: string | null;
    failedAt: string | null;
    expectedDay: string;
  };
  mail: {
    mode: "smtp" | "simulation" | "local" | "unknown";
    configured: boolean;
    workerEnabled: boolean;
    lastAcceptedAt: string | null;
    lastFailedAt: string | null;
    failed24h: number | null;
    uncertain: number | null;
    waiting: number | null;
  };
}
