/**
 * Agora SDK — TypeScript client for the Agora agent registry
 *
 * @example
 * ```ts
 * import { Agora } from '@sovont/agora';
 *
 * const agora = new Agora({ apiKey: 'your-key' });
 *
 * // Register an agent
 * await agora.register({
 *   name: 'My Agent',
 *   description: 'Does cool things',
 *   url: 'https://myagent.com',
 *   categories: ['automation'],
 * });
 *
 * // Search agents
 * const results = await agora.search({ q: 'invoice parsing' });
 *
 * // Discover by category
 * const finance = await agora.search({ category: 'finance' });
 * ```
 */

export interface AgoraConfig {
  /** Base URL of the Agora instance */
  baseUrl?: string;
  /** API key for authenticated operations (register, update, delete) */
  apiKey?: string;
}

export interface Capability {
  id: string;
  name: string;
  description?: string;
  inputModes?: string[];
  outputModes?: string[];
}

export interface Provider {
  organization?: string;
  contact?: string;
  url?: string;
}

export interface Protocols {
  a2a?: { agentCardUrl: string };
  mcp?: { serverUrl: string };
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
  authSchemes: string[];
  verification: {
    domain: string | null;
    verified: boolean;
    verifiedAt: string | null;
  };
  status: string;
  registeredAt: string;
  updatedAt: string;
}

export interface SearchParams {
  q?: string;
  category?: string;
  tag?: string;
  protocol?: "a2a" | "mcp";
  verified?: boolean;
  status?: string;
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
}

export class AgoraError extends Error {
  constructor(
    public status: number,
    public body: any
  ) {
    super(`Agora API error (${status}): ${JSON.stringify(body)}`);
    this.name = "AgoraError";
  }
}

const DEFAULT_BASE_URL = "https://agora-production-ee3b.up.railway.app";

export class Agora {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: AgoraConfig = {}) {
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    const body = await res.json();

    if (!res.ok) {
      throw new AgoraError(res.status, body);
    }

    return body as T;
  }

  // ── Public (no auth required) ──────────────────────

  /** Search and list agents */
  async search(params: SearchParams = {}): Promise<SearchResult> {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.category) qs.set("category", params.category);
    if (params.tag) qs.set("tag", params.tag);
    if (params.protocol) qs.set("protocol", params.protocol);
    if (params.verified !== undefined)
      qs.set("verified", String(params.verified));
    if (params.status) qs.set("status", params.status);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.offset) qs.set("offset", String(params.offset));

    const query = qs.toString();
    return this.request<SearchResult>(
      `/v1/agents${query ? `?${query}` : ""}`
    );
  }

  /** Get a single agent by ID */
  async get(id: string): Promise<Agent> {
    return this.request<Agent>(`/v1/agents/${id}`);
  }

  /** List all categories with agent counts */
  async categories(): Promise<Category[]> {
    const res = await this.request<{ categories: Category[] }>(
      `/v1/categories`
    );
    return res.categories;
  }

  /** Get registry statistics */
  async stats(): Promise<Stats> {
    return this.request<Stats>(`/v1/stats`);
  }

  // ── Authenticated (API key required) ───────────────

  /** Register a new agent */
  async register(input: RegisterInput): Promise<Agent> {
    return this.request<Agent>("/v1/agents", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  /** Update an existing agent */
  async update(id: string, input: Partial<RegisterInput>): Promise<Agent> {
    return this.request<Agent>(`/v1/agents/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  }

  /** Delete an agent */
  async delete(id: string): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>(`/v1/agents/${id}`, {
      method: "DELETE",
    });
  }

  /** Import an A2A Agent Card from a URL */
  async importA2A(agentCardUrl: string): Promise<{ imported: boolean; agent: Agent }> {
    return this.request<{ imported: boolean; agent: Agent }>("/v1/import/a2a", {
      method: "POST",
      body: JSON.stringify({ url: agentCardUrl }),
    });
  }

  /** Initiate domain verification */
  async verify(id: string, domain: string) {
    return this.request<any>(`/v1/agents/${id}/verify`, {
      method: "POST",
      body: JSON.stringify({ domain }),
    });
  }

  /** Confirm domain verification */
  async verifyConfirm(id: string) {
    return this.request<any>(`/v1/agents/${id}/verify/confirm`, {
      method: "POST",
    });
  }

  /** Ping an agent to check health */
  async ping(id: string) {
    return this.request<{ status: string }>(`/v1/agents/${id}/ping`, {
      method: "POST",
    });
  }
}

export default Agora;
