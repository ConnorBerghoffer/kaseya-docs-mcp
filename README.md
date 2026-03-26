# kaseya-docs-mcp

> **Instant semantic search across the entire Kaseya ecosystem documentation — 30+ products, 5,500+ pages.**

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that gives AI assistants like Claude instant access to documentation for **Kaseya, Datto, Autotask, IT Glue**, and every product in the Kaseya ecosystem. No API keys required. Works offline after first run.

[![npm version](https://img.shields.io/npm/v/kaseya-docs-mcp.svg)](https://www.npmjs.com/package/kaseya-docs-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Why?

If you work with Kaseya products — Datto RMM, Autotask PSA, IT Glue, BCDR, or any of the 30+ tools in the ecosystem — you know the documentation is scattered across dozens of separate help sites. Finding the right answer means searching multiple portals.

**kaseya-docs-mcp** fixes this. It puts the entire documentation library into a single semantic search index that AI assistants can query instantly.

Ask things like:
- *"How do I install the Datto RMM agent on Linux?"*
- *"What are the Autotask PSA API rate limits?"*
- *"How to configure SNMP monitoring in VSA?"*
- *"Set up SaaS Protection for Microsoft 365"*
- *"IT Glue flexible asset types"*

And get back the exact documentation pages with source URLs.

---

## Quick Start

### Claude Code

```bash
claude mcp add kaseya-docs -- npx -y kaseya-docs-mcp@latest
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kaseya-docs": {
      "command": "npx",
      "args": ["-y", "kaseya-docs-mcp@latest"]
    }
  }
}
```

### Cursor / VS Code

Add to your MCP settings:

```json
{
  "mcpServers": {
    "kaseya-docs": {
      "command": "npx",
      "args": ["-y", "kaseya-docs-mcp@latest"]
    }
  }
}
```

That's it. On first run, the server downloads a pre-built search index (~50MB). Subsequent starts are instant.

---

## Products Covered

| Category | Products |
|----------|----------|
| **RMM / Endpoint** | Datto RMM, VSA 10, VSA 9 |
| **PSA / Ticketing** | Autotask PSA, Autotask REST API, Kaseya BMS |
| **Backup / BCDR** | Datto Continuity (SIRIS, ALTO, NAS), Unitrends, Spanning Backup, SaaS Protection (M365 + Google) |
| **Security** | Datto EDR, RocketCyber SOC, Graphus, BullPhish ID, Dark Web ID, SaaS Alerts, SaaS Defense, vPenTest, INKY |
| **Documentation** | IT Glue |
| **Networking** | Datto Networking |
| **File Sync** | Datto File Protection, Datto Workplace |
| **Commerce / Billing** | Datto Commerce, ConnectBooster |
| **Compliance / Audit** | Network Detective Pro, Compliance Manager GRC, VulScan, Cyber Hawk |
| **Platform** | KaseyaOne |

**Total: 33 products, 5,500+ documentation pages, 15,000+ searchable chunks.**

---

## Tools

### `search_docs`

Semantic search across all documentation.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | *required* | Natural language search query |
| `top_k` | number | 10 | Number of results to return |
| `product` | string | *all* | Filter by product slug (e.g. `"datto-rmm"`, `"autotask-psa"`) |

**Returns:** Matching documentation chunks with text, source URL, product name, section hierarchy, and relevance score.

### `list_products`

List all available products with page counts.

---

## Product Slugs

Use these with the `product` parameter to filter search results:

| Slug | Product |
|------|---------|
| `kaseyone` | KaseyaOne |
| `datto-rmm` | Datto RMM |
| `vsa10` | VSA 10 |
| `vsa9` | VSA 9 |
| `autotask-psa` | Autotask PSA |
| `autotask-api` | Autotask REST API |
| `kaseya-bms` | Kaseya BMS |
| `datto-continuity` | Datto Continuity |
| `unitrends` | Unitrends Backup |
| `spanning-backup` | Spanning Backup |
| `saas-protection-m365` | SaaS Protection (M365) |
| `saas-protection-goog` | SaaS Protection (Google) |
| `datto-edr` | Datto EDR |
| `rocketcyber` | RocketCyber SOC |
| `graphus` | Graphus |
| `bullphish-id` | BullPhish ID |
| `darkweb-id` | Dark Web ID |
| `saas-alerts` | SaaS Alerts |
| `saas-defense` | SaaS Defense |
| `vpentest` | vPenTest |
| `it-glue` | IT Glue |
| `datto-networking` | Datto Networking |
| `datto-fileprotect` | Datto File Protection |
| `datto-workplace` | Datto Workplace |
| `datto-commerce` | Datto Commerce |
| `connectbooster` | ConnectBooster |
| `network-detective` | Network Detective Pro |
| `compliance-mgr-grc` | Compliance Manager GRC |
| `vulscan` | VulScan |
| `cyber-hawk` | Cyber Hawk |
| `inky` | INKY |

---

## How It Works

1. **Pre-built index**: All 5,500+ documentation pages have been scraped, chunked, and embedded into a [LanceDB](https://lancedb.com) vector database using the `all-MiniLM-L6-v2` embedding model.
2. **On first run**: The pre-built database (~50MB) is downloaded from GitHub Releases and cached at `~/.kaseya-docs-mcp/`.
3. **At query time**: Your search query is embedded locally using the same model (no API calls, no API keys) and matched against the index using vector similarity search.
4. **Results**: The most relevant documentation chunks are returned with their source URLs, product names, and section hierarchies.

**No API keys. No cloud services. Fully local after first download.**

---

## Requirements

- Node.js >= 18
- ~200MB disk space (model + index, cached after first run)

---

## Updating Documentation

The documentation index is updated periodically. To get the latest version:

```bash
rm -rf ~/.kaseya-docs-mcp/vectordb
```

The next run will download the latest index.

---

## FAQ

### Does this require an API key?

No. Embeddings are computed locally using the open-source `all-MiniLM-L6-v2` model. No OpenAI, no Anthropic, no cloud APIs needed.

### How current is the documentation?

The index is rebuilt periodically from the official Kaseya help sites. Check the [releases page](https://github.com/ConnorBerghoffer/kaseya-docs-mcp/releases) for the latest update date.

### Can I search a specific product only?

Yes — use the `product` parameter with a slug from the table above. For example: `search_docs({ query: "agent install", product: "datto-rmm" })`.

### What MCP clients are supported?

Any MCP-compatible client: Claude Code, Claude Desktop, Cursor, VS Code with MCP extensions, Windsurf, and more.

### How is this different from searching the Kaseya help sites directly?

This searches **all 33 products at once** with semantic understanding. Instead of keyword matching on one site at a time, you get AI-powered search across the entire ecosystem. It also finds related concepts even when the exact words don't match.

---

## Contributing

Contributions welcome! Open an issue or PR on [GitHub](https://github.com/ConnorBerghoffer/kaseya-docs-mcp).

---

## License

MIT

---

## Disclaimer

This project is not affiliated with, endorsed by, or sponsored by Kaseya, Inc. All product names, trademarks, and documentation are the property of their respective owners. This tool indexes publicly available documentation for search purposes.
