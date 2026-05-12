/**
 * @sovont/agora — command-line interface.
 *
 * Zero-dependency CLI for the Agora registry. Reads config from env or
 * `~/.config/agora/config.json`.
 *
 *   agora search "invoice parsing"
 *   agora get <id>
 *   agora register agent.json
 *   agora import <a2a-card-url>
 *   agora verify <id> <domain>
 *   agora verify confirm <id>
 *   agora ping <id>
 *   agora stats
 *   agora init
 *   agora whoami
 */

import { Agora, AgoraError } from "./index.js";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as readline from "node:readline/promises";

const VERSION = "0.3.0";
const CONFIG_PATH = path.join(os.homedir(), ".config", "agora", "config.json");

function color(s: string, code: number): string {
  if (!process.stdout.isTTY) return s;
  return `\x1b[${code}m${s}\x1b[0m`;
}
const dim = (s: string) => color(s, 2);
const red = (s: string) => color(s, 31);
const green = (s: string) => color(s, 32);
const yellow = (s: string) => color(s, 33);
const cyan = (s: string) => color(s, 36);
const bold = (s: string) => color(s, 1);

interface Config {
  baseUrl?: string;
  apiKey?: string;
}

async function loadConfig(): Promise<Config> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveConfig(cfg: Config) {
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", {
    mode: 0o600,
  });
}

async function client(): Promise<{ agora: Agora; cfg: Config }> {
  const cfg = await loadConfig();
  const baseUrl = process.env.AGORA_BASE_URL ?? cfg.baseUrl;
  const apiKey = process.env.AGORA_KEY ?? cfg.apiKey;
  const agora = new Agora({ baseUrl, apiKey });
  return { agora, cfg };
}

function out(value: unknown) {
  if (typeof value === "string") console.log(value);
  else console.log(JSON.stringify(value, null, 2));
}

function die(msg: string, code = 1): never {
  console.error(red(msg));
  process.exit(code);
}

function table(
  rows: Array<Record<string, string>>,
  cols: string[],
  headers?: string[]
) {
  if (rows.length === 0) {
    console.log(dim("(no results)"));
    return;
  }
  const widths = cols.map((c, i) =>
    Math.max(
      (headers?.[i] ?? c).length,
      ...rows.map((r) => (r[c] ?? "").length)
    )
  );
  const pad = (s: string, w: number) => s + " ".repeat(Math.max(0, w - s.length));
  console.log(
    cols.map((c, i) => bold(pad(headers?.[i] ?? c, widths[i]))).join("  ")
  );
  console.log(cols.map((_, i) => dim("─".repeat(widths[i]))).join("  "));
  for (const r of rows)
    console.log(cols.map((c, i) => pad(r[c] ?? "", widths[i])).join("  "));
}

function truncate(s: string | null | undefined, n: number): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

// ── Commands ────────────────────────────────────────────────────────────────

async function cmdSearch(args: string[]) {
  const opts = parseFlags(args, ["q", "category", "tag", "tool", "protocol", "limit"]);
  const query = opts._positional.join(" ").trim();
  const { agora } = await client();
  const result = await agora.search({
    q: query || (opts.q as string | undefined),
    category: opts.category as string | undefined,
    tag: opts.tag as string | undefined,
    tool: opts.tool as string | undefined,
    protocol: opts.protocol as "a2a" | "mcp" | undefined,
    limit: opts.limit ? Number(opts.limit) : 20,
  });
  const rows = result.agents.map((a) => ({
    id: a.id.slice(0, 8),
    name: truncate(a.name, 28),
    desc: truncate(a.description, 56),
    proto: [
      a.protocols.a2a ? "A2A" : "",
      a.protocols.mcp ? "MCP" : "",
    ]
      .filter(Boolean)
      .join("/") || "-",
    flags:
      (a.verification.verified ? green("✓") : dim("·")) +
      (a.health.status === "healthy" ? green("●") : dim("○")),
  }));
  table(rows, ["id", "name", "proto", "flags", "desc"], [
    "ID",
    "NAME",
    "PROTO",
    "V/H",
    "DESCRIPTION",
  ]);
  console.log(
    dim(
      `\nshowing ${result.agents.length}/${result.total} · ${green(
        "✓"
      )} = verified · ${green("●")} = healthy`
    )
  );
}

async function cmdGet(args: string[]) {
  if (!args[0]) die("Usage: agora get <id>");
  const { agora } = await client();
  const agent = await agora.get(args[0]);
  out(agent);
}

async function cmdStats() {
  const { agora } = await client();
  const stats = await agora.stats();
  console.log(`${bold("Agora")} ${dim("agora.sovont.com")}`);
  console.log(`  ${bold(String(stats.totalAgents).padStart(6))}  total agents`);
  console.log(
    `  ${green(String(stats.verifiedAgents).padStart(6))}  verified`
  );
  console.log(`  ${cyan(String(stats.a2aAgents).padStart(6))}  A2A`);
  console.log(`  ${cyan(String(stats.mcpAgents).padStart(6))}  MCP`);
  console.log(
    `  ${green(String(stats.healthyAgents).padStart(6))}  currently healthy`
  );
}

async function cmdCategories() {
  const { agora } = await client();
  const cats = await agora.categories();
  for (const c of cats) console.log(`${cyan(c.slug.padEnd(28))} ${c.agentCount}`);
}

async function cmdRegister(args: string[]) {
  const file = args[0];
  if (!file) die("Usage: agora register <file.json>");
  const raw = await fs.readFile(file === "-" ? "/dev/stdin" : file, "utf-8");
  const input = JSON.parse(raw);
  const { agora } = await client();
  const agent = await agora.register(input);
  console.log(green(`✓ Registered ${agent.name}`));
  console.log(dim(`  id:   ${agent.id}`));
  console.log(dim(`  page: https://agora.sovont.com/agents/${agent.id}`));
}

async function cmdImport(args: string[]) {
  const url = args[0];
  if (!url) die("Usage: agora import <a2a-card-url>");
  const { agora } = await client();
  const result = await agora.importA2A(url);
  const verb = result.updated ? "Updated" : "Imported";
  console.log(green(`✓ ${verb} ${result.agent.name}`));
  console.log(dim(`  id:   ${result.agent.id}`));
  console.log(dim(`  page: https://agora.sovont.com/agents/${result.agent.id}`));
}

async function cmdBulkImport(args: string[]) {
  const file = args[0];
  if (!file) die("Usage: agora bulk-import <file-of-urls>");
  const lines = (await fs.readFile(file, "utf-8"))
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  const { agora } = await client();
  let ok = 0;
  let fail = 0;
  for (const url of lines) {
    try {
      const r = await agora.importA2A(url);
      console.log(`${green(r.updated ? "↻" : "+")} ${r.agent.name} ${dim(url)}`);
      ok++;
    } catch (e: any) {
      console.log(`${red("✗")} ${url} ${dim(e.message)}`);
      fail++;
    }
  }
  console.log(dim(`\n${ok} imported, ${fail} failed`));
}

async function cmdVerify(args: string[]) {
  if (args[0] === "confirm") {
    const id = args[1];
    if (!id) die("Usage: agora verify confirm <id>");
    const { agora } = await client();
    const result = await agora.verifyConfirm(id);
    if (result.verified) {
      console.log(green(`✓ Verified ${result.domain}`));
    } else {
      console.log(red(`✗ Not verified: ${result.error}`));
      if (result.expected) console.log(dim(`  expected TXT: ${result.expected}`));
    }
    return;
  }
  const id = args[0];
  const domain = args[1];
  if (!id || !domain) die("Usage: agora verify <id> <domain>");
  const { agora } = await client();
  const r = await agora.verify(id, domain);
  console.log(`Add this DNS TXT record to verify ${cyan(domain)}:`);
  console.log();
  console.log(`  ${bold("Host:")}   ${cyan(r.instructions.record)}`);
  console.log(`  ${bold("Type:")}   TXT`);
  console.log(`  ${bold("Value:")}  ${cyan(r.instructions.value)}`);
  console.log();
  console.log(dim(`Once propagated, run: agora verify confirm ${id}`));
}

async function cmdPing(args: string[]) {
  const id = args[0];
  if (!id) die("Usage: agora ping <id>");
  const { agora } = await client();
  const r = await agora.ping(id);
  const c = r.status === "healthy" ? green : r.status === "reachable" ? cyan : red;
  console.log(c(`${r.status} ${dim(`(${r.durationMs}ms)`)}`));
}

async function cmdInit() {
  console.log(`${bold("Agora")} init — first-time setup.`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const baseUrl =
    (await rl.question(`Registry URL [https://agora.sovont.com]: `)) ||
    "https://agora.sovont.com";
  const apiKey = await rl.question(`API key (leave blank for read-only): `);
  rl.close();
  await saveConfig({
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey: apiKey || undefined,
  });
  console.log(green(`✓ Wrote ${CONFIG_PATH}`));
}

async function cmdWhoami() {
  const { agora, cfg } = await client();
  const baseUrl = process.env.AGORA_BASE_URL ?? cfg.baseUrl ?? "https://agora.sovont.com";
  console.log(`Base URL: ${cyan(baseUrl)}`);
  const hasKey = Boolean(process.env.AGORA_KEY ?? cfg.apiKey);
  console.log(`API key:  ${hasKey ? green("set") : yellow("not set (read-only)")}`);
  try {
    const stats = await agora.stats();
    console.log(green(`✓ Reachable — ${stats.totalAgents} agents`));
  } catch (e: any) {
    console.log(red(`✗ Cannot reach registry: ${e.message}`));
  }
}

// ── Flag parser (minimal, no external deps) ─────────────────────────────────

interface ParsedFlags {
  [key: string]: string | boolean | string[];
  _positional: string[];
}

function parseFlags(args: string[], allowed: string[]): ParsedFlags {
  const out: ParsedFlags = { _positional: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      if (key.includes("=")) {
        const [k, v] = key.split("=", 2);
        if (!allowed.includes(k)) die(`Unknown flag: --${k}`);
        out[k] = v;
      } else if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        if (!allowed.includes(key)) die(`Unknown flag: --${key}`);
        out[key] = args[++i];
      } else {
        if (!allowed.includes(key)) die(`Unknown flag: --${key}`);
        out[key] = true;
      }
    } else {
      out._positional.push(a);
    }
  }
  return out;
}

function help() {
  console.log(`${bold("agora")} v${VERSION} — the open AI agent registry`);
  console.log();
  console.log("Commands:");
  console.log(`  ${cyan("search")} [query]     find agents (flags: --category --tag --tool --protocol --limit)`);
  console.log(`  ${cyan("get")} <id>           show full details`);
  console.log(`  ${cyan("stats")}              registry totals`);
  console.log(`  ${cyan("categories")}         list categories`);
  console.log(`  ${cyan("register")} <file>    register from JSON file (or '-' for stdin)`);
  console.log(`  ${cyan("import")} <url>       import an A2A agent card`);
  console.log(`  ${cyan("bulk-import")} <file> import many A2A cards (one URL per line)`);
  console.log(`  ${cyan("verify")} <id> <dom>  start DNS-TXT verification`);
  console.log(`  ${cyan("verify confirm")} <id>  complete verification`);
  console.log(`  ${cyan("ping")} <id>          health-probe an agent`);
  console.log(`  ${cyan("init")}               interactive setup`);
  console.log(`  ${cyan("whoami")}             show config and connectivity`);
  console.log();
  console.log("Configuration:");
  console.log(`  AGORA_BASE_URL                registry URL`);
  console.log(`  AGORA_KEY                     API key`);
  console.log(`  ${CONFIG_PATH}`);
  console.log();
  console.log(`Docs: https://github.com/sovontai/agora`);
}

// ── Dispatch ────────────────────────────────────────────────────────────────

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    switch (cmd) {
      case undefined:
      case "help":
      case "--help":
      case "-h":
        help();
        return;
      case "version":
      case "--version":
      case "-v":
        console.log(VERSION);
        return;
      case "search":
        await cmdSearch(rest);
        return;
      case "get":
        await cmdGet(rest);
        return;
      case "stats":
        await cmdStats();
        return;
      case "categories":
        await cmdCategories();
        return;
      case "register":
        await cmdRegister(rest);
        return;
      case "import":
        await cmdImport(rest);
        return;
      case "bulk-import":
        await cmdBulkImport(rest);
        return;
      case "verify":
        await cmdVerify(rest);
        return;
      case "ping":
        await cmdPing(rest);
        return;
      case "init":
        await cmdInit();
        return;
      case "whoami":
        await cmdWhoami();
        return;
      default:
        die(`Unknown command: ${cmd}\nRun 'agora help' for usage.`);
    }
  } catch (e: any) {
    if (e instanceof AgoraError) {
      die(`Agora ${e.status}: ${JSON.stringify(e.body)}`);
    }
    die(e?.stack ?? String(e));
  }
}

main();
