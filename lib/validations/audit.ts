import { z } from "zod";

export const auditActionRequestSchema = z
  .object({
    action: z.literal("FLAG_FOR_AUDIT"),
    actor: z.string().trim().min(1).max(256).default("human:command-mode"),
  })
  .strict();

export const auditActionResponseSchema = z.object({
  action: z.literal("FLAG_FOR_AUDIT"),
  incidentId: z.string(),
  fromStatus: z.string(),
  toStatus: z.literal("AUDIT_RECOMMENDED"),
  actor: z.string(),
  createdByType: z.literal("HUMAN_ACTION"),
  historyId: z.string(),
  idempotent: z.boolean(),
});

export type AuditActionRequest = z.infer<typeof auditActionRequestSchema>;
export type AuditActionResponse = z.infer<typeof auditActionResponseSchema>;
