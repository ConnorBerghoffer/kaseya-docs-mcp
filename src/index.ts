#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { connect, type Table } from "@lancedb/lancedb";
import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { Readable } from "stream";
import { finished } from "stream/promises";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const VECTORDB_VERSION = "v1.0.0";
const VECTORDB_URL = `https://github.com/ConnorBerghoffer/kaseya-docs-mcp/releases/download/${VECTORDB_VERSION}/vectordb.tar.gz`;
const DATA_DIR = join(homedir(), ".kaseya-docs-mcp");
const VECTORDB_DIR = join(DATA_DIR, "vectordb");
const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";

// ---------------------------------------------------------------------------
// Product names
// ---------------------------------------------------------------------------
const PRODUCT_NAMES: Record<string, string> = {
  "kaseyone": "KaseyaOne",
  "datto-rmm": "Datto RMM",
  "vsa10": "VSA 10",
  "vsa9": "VSA 9",
  "autotask-psa": "Autotask PSA",
  "autotask-api": "Autotask REST API",
  "kaseya-bms": "Kaseya BMS",
  "datto-continuity": "Datto Continuity (SIRIS/ALTO/NAS)",
  "unitrends": "Unitrends Backup",
  "unitrends-uniview": "Unitrends UniView",
  "spanning-backup": "Spanning Backup",
  "saas-protection-m365": "SaaS Protection (Microsoft 365)",
  "saas-protection-goog": "SaaS Protection (Google Workspace)",
  "saas-defense": "SaaS Defense",
  "datto-edr": "Datto EDR / Endpoint Security",
  "rocketcyber": "RocketCyber SOC",
  "graphus": "Graphus",
  "bullphish-id": "BullPhish ID",
  "darkweb-id": "Dark Web ID",
  "saas-alerts": "SaaS Alerts",
  "vpentest": "vPenTest (Vonahi)",
  "it-glue": "IT Glue",
  "datto-networking": "Datto Networking",
  "datto-fileprotect": "Datto File Protection",
  "datto-workplace": "Datto Workplace",
  "datto-workplace-mgr": "Datto Workplace Manager",
  "datto-commerce": "Datto Commerce",
  "connectbooster": "ConnectBooster",
  "network-detective": "Network Detective Pro",
  "compliance-mgr-grc": "Compliance Manager GRC",
  "vulscan": "VulScan",
  "cyber-hawk": "Cyber Hawk",
  "inky": "INKY",
};

// ---------------------------------------------------------------------------
// Lazy globals
// ---------------------------------------------------------------------------
let _table: Table | null = null;
let _embedder: FeatureExtractionPipeline | null = null;

async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!_embedder) {
    _embedder = await pipeline("feature-extraction", MODEL_NAME, {
      quantized: true,
    });
  }
  return _embedder;
}

async function embedQuery(query: string): Promise<number[]> {
  const embedder = await getEmbedder();
  const output = await embedder(query, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

async function downloadVectorDB(): Promise<void> {
  if (existsSync(join(VECTORDB_DIR, "docs.lance"))) {
    return;
  }

  console.error(`[kaseya-docs-mcp] Downloading vector database (first run only)...`);
  mkdirSync(DATA_DIR, { recursive: true });

  const response = await fetch(VECTORDB_URL);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download vectordb: ${response.status} ${response.statusText}`);
  }

  const tarPath = join(DATA_DIR, "vectordb.tar.gz");
  const fileStream = createWriteStream(tarPath);
  await finished(Readable.fromWeb(response.body as any).pipe(fileStream));

  // Extract
  const { execSync } = await import("child_process");
  execSync(`tar -xzf "${tarPath}" -C "${DATA_DIR}"`, { stdio: "pipe" });
  // Rename extracted directory to expected name
  const extracted = join(DATA_DIR, "vectordb-minilm");
  if (existsSync(extracted) && !existsSync(VECTORDB_DIR)) {
    execSync(`mv "${extracted}" "${VECTORDB_DIR}"`, { stdio: "pipe" });
  }
  execSync(`rm -f "${tarPath}"`, { stdio: "pipe" });

  console.error(`[kaseya-docs-mcp] Vector database ready.`);
}

async function getTable(): Promise<Table> {
  if (!_table) {
    await downloadVectorDB();
    const db = await connect(VECTORDB_DIR);
    _table = await db.openTable("docs");
  }
  return _table;
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------
const server = new McpServer({
  name: "kaseya-docs",
  version: "1.0.0",
});

server.tool(
  "search_docs",
  `Search Kaseya/Datto/Autotask documentation using semantic search across 30+ products and 5500+ pages.

Use this tool to find documentation about any Kaseya ecosystem product including:
Datto RMM, Autotask PSA, VSA, IT Glue, Datto Continuity (SIRIS/ALTO),
Datto EDR, Graphus, BullPhish ID, Dark Web ID, SaaS Alerts, RocketCyber,
Datto Networking, ConnectBooster, Spanning Backup, and more.

Returns matching documentation chunks with source URLs, product names, and relevance scores.`,
  {
    query: z.string().describe("Natural language search query"),
    top_k: z.number().default(10).describe("Number of results to return (default 10)"),
    product: z
      .string()
      .optional()
      .describe(
        'Optional product slug filter (e.g. "datto-rmm", "autotask-psa", "graphus")'
      ),
  },
  async ({ query, top_k, product }) => {
    const table = await getTable();
    const queryVector = await embedQuery(query);

    let search = table.search(queryVector).limit(top_k * 3);

    if (product) {
      search = search.where(`product_slug = '${product}'`);
    }

    const results = await search.toArray();

    const output = results.slice(0, top_k).map((row: any) => {
      const distance = row._distance ?? 1;
      const score = Math.max(0, 1 - distance);

      return {
        text: row.text,
        source_url: row.source_url,
        product_name: row.product_name,
        product_slug: row.product_slug,
        header_chain: row.header_chain,
        score: Math.round(score * 10000) / 10000,
      };
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(output, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "list_products",
  "List all available Kaseya/Datto products in the documentation database with their page counts.",
  {},
  async () => {
    const table = await getTable();
    const allRows = await table
      .search(new Array(384).fill(0))
      .limit(100000)
      .toArray();

    const counts: Record<string, number> = {};
    const files: Record<string, Set<string>> = {};

    for (const row of allRows) {
      const slug = row.product_slug as string;
      if (!files[slug]) files[slug] = new Set();
      files[slug].add(row.file_path as string);
    }

    const products = Object.entries(PRODUCT_NAMES)
      .map(([slug, name]) => ({
        slug,
        name,
        page_count: files[slug]?.size ?? 0,
      }))
      .filter((p) => p.page_count > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(products, null, 2),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
