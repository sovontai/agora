import app from "../src/app.js";

export async function call(
  method: string,
  path: string,
  opts: { body?: any; key?: string; headers?: Record<string, string> } = {}
) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.key) headers["Authorization"] = `Bearer ${opts.key}`;
  const res = await app.request(path, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw */
  }
  return { status: res.status, body, headers: res.headers };
}

export async function mintKey(name = "test-key") {
  const res = await call("POST", "/v1/keys", {
    body: { name },
    key: process.env.ADMIN_KEY,
  });
  if (res.status !== 201) {
    throw new Error(`mintKey failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.key as string;
}

export const sampleAgent = (overrides: any = {}) => ({
  name: "Invoice Parser",
  description: "Extracts structured data from PDF invoices",
  url: "https://agents.acme.com/invoice-parser",
  capabilities: [
    { id: "parse-invoice", name: "Parse Invoice", description: "PDF → JSON" },
  ],
  categories: ["finance", "document-processing"],
  tags: ["invoice", "ocr", "pdf"],
  protocols: {
    a2a: { agentCardUrl: "https://agents.acme.com/.well-known/agent.json" },
  },
  ...overrides,
});
