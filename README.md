# pi-koyeb

[![CI](https://github.com/sfroment/pi-koyeb/actions/workflows/ci.yml/badge.svg)](https://github.com/sfroment/pi-koyeb/actions/workflows/ci.yml)
[![Release](https://github.com/sfroment/pi-koyeb/actions/workflows/release.yml/badge.svg)](https://github.com/sfroment/pi-koyeb/actions/workflows/release.yml)
[![npm version](https://img.shields.io/npm/v/@sfroment/pi-koyeb.svg?cacheSeconds=120)](https://www.npmjs.com/package/@sfroment/pi-koyeb)
[![npm downloads](https://img.shields.io/npm/dm/@sfroment/pi-koyeb.svg?cacheSeconds=120)](https://www.npmjs.com/package/@sfroment/pi-koyeb)
[![npm bundle size](https://img.shields.io/bundlephobia/min/@sfroment/pi-koyeb.svg?cacheSeconds=120)](https://bundlephobia.com/package/@sfroment/pi-koyeb)
[![GitHub Release](https://img.shields.io/github/v/release/sfroment/pi-koyeb.svg?cacheSeconds=120)](https://github.com/sfroment/pi-koyeb/releases)
[![GitHub stars](https://img.shields.io/github/stars/sfroment/pi-koyeb.svg?cacheSeconds=120)](https://github.com/sfroment/pi-koyeb/stargazers)
[![GitHub last commit](https://img.shields.io/github/last-commit/sfroment/pi-koyeb.svg?cacheSeconds=120)](https://github.com/sfroment/pi-koyeb/commits)
[![GitHub commits since latest release](https://img.shields.io/github/commits-since/sfroment/pi-koyeb/latest.svg?cacheSeconds=120)](https://github.com/sfroment/pi-koyeb/releases)
[![license](https://img.shields.io/npm/l/@sfroment/pi-koyeb.svg?cacheSeconds=120)](https://github.com/sfroment/pi-koyeb/blob/main/LICENSE)
[![Bun](https://img.shields.io/badge/runtime-Bun-fd4b3a?logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/lang-TypeScript-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A [pi coding agent](https://github.com/earendil-works/pi-mono) extension that wraps the `koyeb` CLI as a single typed tool — **directly**, not via an MCP server.

## What it provides

- a `koyeb` custom tool with typed parameters (`subcommand` + `args` map + `output` + `organization` + `timeoutSeconds` + `forceDangerous`)
- a bundled `SKILL.md` documenting the tool and common `koyeb` commands
- per-turn prompt guidance when a prompt mentions Koyeb, apps, services, deployments, instances, secrets, domains, or databases
- graceful detection of the "not authenticated" failure with actionable guidance
- a safety guard that refuses all delete/cancel/kill ops unless `forceDangerous: true` is set

## Why not MCP?

The `koyeb` CLI already exposes the full Koyeb API (apps, services, deployments, instances, secrets, domains, databases, volumes, one-shot deploy) and uses the user's existing `koyeb login` credentials. Wrapping it in a typed pi tool gives structured, discoverable parameters and output truncation without an extra server process.

## Requirements

- `koyeb` CLI on PATH — [koyeb.com/docs/cli](https://www.koyeb.com/docs/cli)
- Authenticated via `koyeb login`

## Installation

Drop the extension into `~/.pi/agent/extensions/` (global) or `.pi/extensions/` (project-local), then reload:

```text
/reload
```

Or install from git:

```bash
pi install git:github.com/sfroment/pi-koyeb
```

## Tool parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `subcommand` | `string` | The full koyeb subcommand path (e.g. `"apps list"`, `"services logs <id>"`, `"deploy ./dir app/svc"`). Top-level — never nest inside `args`. |
| `args` | `object` | A key/value object of flags ONLY — **never an array**, and do not nest `subcommand`/`output`/`organization` here. Booleans → bare `--flag` (`{debug: true}` → `--debug`). Strings/numbers → `--flag value`. Arrays → repeated `--flag value` pairs. `false`/`null`/`undefined` are skipped. |
| `output` | `string` | Output format: `yaml`, `json`, or `table` (translates to `-o <format>`). Use `json` for parseable structured output. |
| `organization` | `string` | Organization ID override (translates to `--organization <id>`). |
| `timeoutSeconds` | `integer` | Command timeout (default 30, max 120). |
| `forceDangerous` | `boolean` | Opt-in for destructive ops (`apps delete`, `services delete`, `deployments cancel`, `secrets delete`, `domains delete`, `databases delete`, `volumes delete`, `snapshots delete`, `sandbox kill`, `compose delete`). Requires explicit user confirmation. |

## Examples

List apps as JSON:

```json
{
  "subcommand": "apps list",
  "output": "json"
}
```

Deploy a directory:

```json
{
  "subcommand": "deploy ./myapp my-app/web",
  "args": { "git": "main", "ports": "8080:http" }
}
```

Get service logs:

```json
{
  "subcommand": "services logs <service-id>",
  "args": { "type": "deploy" }
}
```

## Development

```bash
bun test          # pretest links pi runtime deps automatically
bunx tsc --noEmit # type-check
```

## License

GPL-3.0

## Links

- **Author:** [Sacha Froment](https://sacha42.com)
- **Source:** <https://github.com/sfroment/pi-koyeb>
- **Issues:** <https://github.com/sfroment/pi-koyeb/issues>
