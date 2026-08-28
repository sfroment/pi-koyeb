# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-08-28

### Added
- `koyeb` tool: typed wrapper around the Koyeb `koyeb` CLI with `subcommand` + `args`
  map + `output` + `organization` + `timeoutSeconds` + `forceDangerous` parameters.
- Prompt guidance injected when a prompt mentions Koyeb / apps / services /
  deployments / instances / secrets / domains / databases.
- Bundled `koyeb` skill documenting the tool and common `koyeb` commands.
- Safety guards: refuses all delete/cancel/kill ops (`apps delete`, `services
  delete`, `deployments cancel`, `secrets delete`, `domains delete`, `databases
  delete`, `volumes delete`, `snapshots delete`, `sandbox kill`, `compose delete`)
  unless `forceDangerous: true`; detects "not authenticated" and returns actionable
  `koyeb login` guidance; output truncation.
- Runtime tolerance for two common mis-shaped calls: `args` as a JSON array
  (positional tokens) and `subcommand`/`output`/`organization` nested inside `args`.
  An internal `normalizeParams` step at the `buildArgv`/`runKoyeb` seams coerces both
  to the correct argv, and `runKoyeb` normalizes before `assertSafeCommand` so a
  nested dangerous command cannot bypass the guard.
- Single-source content constants (`KOYEB_CALL_EXAMPLE`, `KOYEB_ARGS_DESCRIPTION`,
  `KOYEB_SUBCOMMAND_DESCRIPTION`) wired into the tool description, schema, prompt
  guidelines, `KOYEB_GUIDANCE`, `SKILL.md`, and `README.md`.
- Tests — pure helpers (`buildArgv`, `normalizeParams`, `assertSafeCommand`,
  `formatOutput`) tested directly, `runKoyeb` tested via dependency injection at
  the `KoyebExec` system boundary; content-contract tests for the guidance
  constants.
- `scripts/link-pi-deps.sh` + `pretest` hook for reproducible test resolution.
- GPL-3.0 license.
