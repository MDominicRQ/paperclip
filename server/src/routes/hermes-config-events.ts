import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { z } from "zod";
import {
  assertHermesAgentCompanyMapping,
  hasProcessedHermesConfigEvent,
  invalidateHermesAgentCache,
  recordHermesConfigEvent,
  verifyHermesWebhookHmac,
} from "../services/hermes-config-sync.js";

const configUpdateSchema = z.object({
  event_id: z.string().min(1),
  event_type: z.literal("agent.config.updated"),
  agent_id: z.string().uuid(),
  company_id: z.string().uuid(),
  config_version: z.string().min(1),
  changed_at: z.string().datetime(),
});

export function hermesConfigEventRoutes(db: Db): Router {
  const router = Router();

  router.post("/hermes/events", async (req, res) => {
    const rawBody = JSON.stringify(req.body ?? {});
    const signature = req.header("x-hermes-signature");
    const authorized = verifyHermesWebhookHmac(rawBody, signature)
      || (process.env.HERMES_CONFIG_PUSH_TOKEN && req.header("authorization") === `Bearer ${process.env.HERMES_CONFIG_PUSH_TOKEN}`);
    if (!authorized) {
      res.status(401).json({ error: "Invalid Hermes config push signature" });
      return;
    }

    const parsed = configUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Invalid event payload", details: parsed.error.flatten() });
      return;
    }

    const event = parsed.data;
    if (hasProcessedHermesConfigEvent(event.event_id)) {
      res.status(200).json({ status: "duplicate", eventId: event.event_id });
      return;
    }

    const validMapping = await assertHermesAgentCompanyMapping(db, {
      agentId: event.agent_id,
      companyId: event.company_id,
    });
    if (!validMapping) {
      res.status(404).json({ error: "Agent/company mapping not found" });
      return;
    }

    invalidateHermesAgentCache(event.agent_id);
    recordHermesConfigEvent({
      eventId: event.event_id,
      companyId: event.company_id,
      agentId: event.agent_id,
      configVersion: event.config_version,
      changedAt: event.changed_at,
      receivedAt: new Date().toISOString(),
    });

    res.status(202).json({ status: "accepted", eventId: event.event_id });
  });

  return router;
}
