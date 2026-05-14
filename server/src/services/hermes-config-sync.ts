import { and, eq } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "node:crypto";
import { agents, type Db } from "@paperclipai/db";

type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

type HermesConfigUpdateRecord = {
  eventId: string;
  companyId: string;
  agentId: string;
  configVersion: string;
  changedAt: string;
  receivedAt: string;
};

const processedEvents = new Map<string, HermesConfigUpdateRecord>();
const latestVersionByAgent = new Map<string, { companyId: string; configVersion: string; changedAt: string; receivedAt: string }>();

function safeCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

export function verifyHermesWebhookHmac(payloadRaw: string, signatureHeader: string | null | undefined): boolean {
  const secret = process.env.HERMES_CONFIG_PUSH_SECRET?.trim();
  if (!secret) return false;
  const signature = (signatureHeader ?? "").trim();
  if (!signature) return false;
  const digest = createHmac("sha256", secret).update(payloadRaw).digest("hex");
  const expected = `sha256=${digest}`;
  return safeCompare(signature, expected);
}

export async function assertHermesAgentCompanyMapping(
  db: Db | DbTransaction,
  input: { agentId: string; companyId: string },
): Promise<boolean> {
  const row = await db.query.agents.findFirst({
    where: and(eq(agents.id, input.agentId), eq(agents.companyId, input.companyId)),
    columns: { id: true },
  });
  return Boolean(row);
}

export function hasProcessedHermesConfigEvent(eventId: string): boolean {
  return processedEvents.has(eventId);
}

export function recordHermesConfigEvent(input: HermesConfigUpdateRecord): void {
  processedEvents.set(input.eventId, input);
  latestVersionByAgent.set(input.agentId, {
    companyId: input.companyId,
    configVersion: input.configVersion,
    changedAt: input.changedAt,
    receivedAt: input.receivedAt,
  });
}

export function getHermesAgentConfigVersion(agentId: string): string | null {
  return latestVersionByAgent.get(agentId)?.configVersion ?? null;
}

export function invalidateHermesAgentCache(agentId: string): void {
  latestVersionByAgent.delete(agentId);
}
