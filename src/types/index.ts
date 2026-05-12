import { z } from "zod";

const httpsUrl = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), {
    message: "must be an http(s) URL",
  });

export const CapabilitySchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  inputModes: z.array(z.string().max(200)).max(20).optional(),
  outputModes: z.array(z.string().max(200)).max(20).optional(),
});

export const ProviderSchema = z.object({
  organization: z.string().max(200).optional(),
  contact: z.string().max(200).optional(),
  url: httpsUrl.optional(),
});

export const ProtocolsSchema = z.object({
  a2a: z.object({ agentCardUrl: httpsUrl }).optional(),
  mcp: z.object({ serverUrl: httpsUrl }).optional(),
});

export const RegisterAgentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  url: httpsUrl,
  version: z.string().max(40).optional(),
  provider: ProviderSchema.optional(),
  capabilities: z.array(CapabilitySchema).max(50).default([]),
  categories: z.array(z.string().min(1).max(80)).max(20).default([]),
  tags: z.array(z.string().min(1).max(80)).max(20).default([]),
  protocols: ProtocolsSchema.optional(),
  authSchemes: z.array(z.string().max(80)).max(10).optional(),
});

export const UpdateAgentSchema = RegisterAgentSchema.partial();

/** "true"/"1" → true, "false"/"0" → false, anything else → undefined. */
const boolish = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (typeof v === "boolean") return v;
    const s = v.toLowerCase();
    if (s === "true" || s === "1" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "no") return false;
    return undefined;
  });

export const SearchParamsSchema = z.object({
  q: z.string().max(200).optional(),
  category: z.string().max(80).optional(),
  tag: z.string().max(80).optional(),
  tool: z.string().max(120).optional(),
  protocol: z.enum(["a2a", "mcp"]).optional(),
  verified: boolish,
  status: z.enum(["active", "inactive", "deprecated"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type Capability = z.infer<typeof CapabilitySchema>;
export type RegisterAgentInput = z.infer<typeof RegisterAgentSchema>;
export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;
export type SearchParams = z.infer<typeof SearchParamsSchema>;
