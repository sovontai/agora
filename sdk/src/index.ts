/**
 * Agora SDK — TypeScript client for the Agora agent registry.
 *
 * @example
 * ```ts
 * import { Agora } from '@sovont/agora';
 *
 * const agora = new Agora();                       // anonymous reads
 * const auth = new Agora({ apiKey: 'agora_…' });   // authenticated writes
 *
 * const results = await agora.search({ q: 'invoice parsing' });
 * const tooling = await agora.search({ tool: 'send_email' });   // MCP tools
 * await auth.register({ name: 'My Agent', description: '…', url: 'https://…' });
 * await auth.verify(agent.id, 'agents.acme.com');
 * const { instructions } = await auth.verify(agent.id, 'acme.com');
 * await auth.verifyConfirm(agent.id);
 * ```
 */

export interface AgoraConfig {
  /** Base URL of the Agora instance. */
  baseUrl?: string;
  /** API key for authenticated operations. */
  apiKey?: string;
  /** Override the fetch implementation (e.g. for testing or proxying). */
  fetch?: typeof fetch;
}

export interface Capability {
  id: string;
  name: string;
  description?: string;
  inputModes?: string[];
  outputModes?: string[];
}

export interface Provider {
  organization?: string | null;
  contact?: string | null;
  url?: string | null;
}

export interface Protocols {
  a2a?: { agentCardUrl: string } | null;
  mcp?: { serverUrl: string } | null;
}

export interface RegisterInput {
  name: string;
  description: string;
  url: string;
  version?: string;
  provider?: Provider;
  capabilities?: Capability[];
  categories?: string[];
  tags?: string[];
  protocols?: Protocols;
  authSchemes?: string[];
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface Verification {
  domain: string | null;
  verified: boolean;
  verifiedAt: string | null;
  checkedAt: string | null;
}

export interface Health {
  status: string | null;
  checkedAt: string | null;
  consecutiveFailures: number;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  url: string;
  version: string | null;
  provider: Provider;
  capabilities: Capability[];
  categories: string[];
  tags: string[];
  protocols: Protocols;
  mcpTools: McpTool[];
  authSchemes: string[];
  verification: Verification;
  health: Health;
  status: "active" | "inactive" | "deprecated";
  registeredAt: string;
  updatedAt: string;
}

export interface SearchParams {
  q?: string;
  category?: string;
  tag?: string;
  tool?: string;
  protocol?: "a2a" | "mcp";
  verified?: boolean;
  status?: "active" | "inactive" | "deprecated";
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  agents: Agent[];
  total: number;
  limit: number;
  offset: number;
}

export interface Category {
  slug: string;
  name: string;
  agentCount: number;
}

export interface Stats {
  totalAgents: number;
  verifiedAgents: number;
  a2aAgents: number;
  mcpAgents: number;
  healthyAgents: number;
}

export interface VerifyInstructions {
  domain: string;
  token: string;
  instructions: {
    method: "dns-txt";
    record: string;
    value: string;
    description: string;
  };
}

export interface VerifyConfirmResult {
  verified: boolean;
  domain?: string;
  error?: "no_verification_pending" | "token_not_found" | "dns_lookup_failed";
  expected?: string;
  message?: string;
}

export interface PingResult {
  status: string;
  statusCode?: number;
  durationMs: number;
}

export class AgoraError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`Agora API error (${status}): ${JSON.stringify(body)}`);
    this.name = "AgoraError";
  }
}

/** Where a local Agora server listens by default. Pass `baseUrl` to use another instance. */
export const DEFAULT_BASE_URL = "http://localhost:3340";

export class Agora {
  private baseUrl: string;
  private apiKey?: string;
  private fetchImpl: typeof fetch;

  constructor(config: AgoraConfig = {}) {
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.fetchImpl = config.fetch ?? globalThis.fetch;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    const text = await res.text();
    let body: unknown = text;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        /* keep raw */
      }
    }
    if (!res.ok) throw new AgoraError(res.status, body);
    return body as T;
  }

  // ── Public reads ────────────────────────────────────────────────────────

  async search(params: SearchParams = {}): Promise<SearchResult> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      qs.set(k, String(v));
    }
    const query = qs.toString();
    return this.request<SearchResult>(`/v1/agents${query ? `?${query}` : ""}`);
  }

  async get(id: string): Promise<Agent> {
    return this.request<Agent>(`/v1/agents/${encodeURIComponent(id)}`);
  }

  async categories(): Promise<Category[]> {
    const res = await this.request<{ categories: Category[] }>(`/v1/categories`);
    return res.categories;
  }

  async stats(): Promise<Stats> {
    return this.request<Stats>(`/v1/stats`);
  }

  /** URL of the verification badge SVG for an agent. */
  badgeUrl(id: string, kind: "verification" | "health" = "verification"): string {
    return kind === "health"
      ? `${this.baseUrl}/v1/badge/${encodeURIComponent(id)}/health.svg`
      : `${this.baseUrl}/v1/badge/${encodeURIComponent(id)}.svg`;
  }

  // ── Authenticated writes ────────────────────────────────────────────────

  async register(input: RegisterInput): Promise<Agent> {
    return this.request<Agent>("/v1/agents", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async update(id: string, input: Partial<RegisterInput>): Promise<Agent> {
    return this.request<Agent>(`/v1/agents/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  }

  async delete(id: string): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>(
      `/v1/agents/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
  }

  /** Import an A2A Agent Card; idempotent per (owner, source URL). */
  async importA2A(
    agentCardUrl: string
  ): Promise<{ imported: boolean; updated: boolean; agent: Agent }> {
    return this.request("/v1/import/a2a", {
      method: "POST",
      body: JSON.stringify({ url: agentCardUrl }),
    });
  }

  async verify(id: string, domain: string): Promise<VerifyInstructions> {
    return this.request(`/v1/agents/${encodeURIComponent(id)}/verify`, {
      method: "POST",
      body: JSON.stringify({ domain }),
    });
  }

  async verifyConfirm(id: string): Promise<VerifyConfirmResult> {
    return this.request(`/v1/agents/${encodeURIComponent(id)}/verify/confirm`, {
      method: "POST",
    });
  }

  async ping(id: string): Promise<PingResult> {
    return this.request(`/v1/agents/${encodeURIComponent(id)}/ping`, {
      method: "POST",
    });
  }
}

export default Agora;
