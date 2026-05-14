import { createHash } from "node:crypto";

const HERMES_RUNTIME_CONFIG_TTL_MS = 10_000;

export interface HermesRuntimeConfig {
  model: string | null;
  capabilities: string[];
  configHash: string;
  resolvedAt: string;
  cacheState: "hit" | "miss";
}

interface HermesRuntimeConfigCacheEntry {
  expiresAtMs: number;
  value: Omit<HermesRuntimeConfig, "cacheState">;
}

const runtimeConfigCache = new Map<string, HermesRuntimeConfigCacheEntry>();

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function buildCacheKey(companyId: string, agentId: string) {
  return `${companyId}:${agentId}`;
}

export function invalidateHermesRuntimeConfig(companyId: string, agentId: string): void {
  runtimeConfigCache.delete(buildCacheKey(companyId, agentId));
}

export function resolveHermesRuntimeConfig(
  companyId: string,
  agentId: string,
  adapterConfig: unknown,
): HermesRuntimeConfig {
  const nowMs = Date.now();
  const cacheKey = buildCacheKey(companyId, agentId);
  const cached = runtimeConfigCache.get(cacheKey);
  if (cached && cached.expiresAtMs > nowMs) {
    return { ...cached.value, cacheState: "hit" };
  }

  const record = typeof adapterConfig === "object" && adapterConfig && !Array.isArray(adapterConfig)
    ? (adapterConfig as Record<string, unknown>)
    : {};

  const model = typeof record.model === "string" && record.model.trim().length > 0 ? record.model.trim() : null;
  const capabilities = Array.isArray(record.capabilities)
    ? record.capabilities.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  const digestSource = stableStringify({ model, capabilities, adapterConfig: record });
  const configHash = createHash("sha256").update(digestSource).digest("hex").slice(0, 12);
  const value = {
    model,
    capabilities,
    configHash,
    resolvedAt: new Date(nowMs).toISOString(),
  };

  runtimeConfigCache.set(cacheKey, { value, expiresAtMs: nowMs + HERMES_RUNTIME_CONFIG_TTL_MS });
  return { ...value, cacheState: "miss" };
}
