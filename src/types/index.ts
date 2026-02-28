import { z } from "zod";

export const CapabilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  inputModes: z.array(z.string()).optional(),
  outputModes: z.array(z.string()).optional(),
});

export const ProviderSchema = z.object({
  organization: z.string().optional(),
  contact: z.string().optional(),
  url: z.string().url().optional(),
});

export const ProtocolsSchema = z.object({
  a2a: z.object({ agentCardUrl: z.string().url() }).optional(),
  mcp: z.object({ serverUrl: z.string().url() }).optional(),
});

export const RegisterAgentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  url: z.string().url(),
  version: z.string().optional(),
  provider: ProviderSchema.optional(),
  capabilities: z.array(CapabilitySchema).default([]),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).max(20).default([]),
  protocols: ProtocolsSchema.optional(),
  authSchemes: z.array(z.string()).optional(),
});

export const UpdateAgentSchema = RegisterAgentSchema.partial();

export const SearchParamsSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  tag: z.string().optional(),
  protocol: z.enum(["a2a", "mcp"]).optional(),
  verified: z.coerce.boolean().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export type Capability = z.infer<typeof CapabilitySchema>;
export type RegisterAgentInput = z.infer<typeof RegisterAgentSchema>;
export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;
export type SearchParams = z.infer<typeof SearchParamsSchema>;
