---
name: koyeb
description: Run Koyeb CLI (koyeb) commands via the `koyeb` tool (a direct CLI wrapper, not MCP). Use for any question about Koyeb apps, services, deployments, instances, secrets, domains, databases, volumes, or the Koyeb platform — especially when the user references Koyeb, a deploy, a service, or an instance.
---

## When to Use

Use whenever the user asks about anything on Koyeb — listing or deploying apps, managing services, checking deployments or instances, viewing logs, managing secrets/domains/databases/volumes, or running one-shot deploys. Triggers: "list my apps", "deploy to Koyeb", "service logs", "get instances", "create a secret", "attach a domain", "koyeb whoami", "scale the service".

**IMPORTANT**: The `koyeb` tool calls the Koyeb CLI (`koyeb`) directly. It is **not** an MCP server — do not use the `mcp` gateway. The `koyeb` CLI must be installed and authenticated. If the tool returns "not authenticated", tell the user to run `koyeb login` via bash.

**Discovering commands**: the top-level subcommands are `apps`, `services`, `deployments`, `instances`, `deploy`, `compose`, `secrets`, `domains`, `databases`, `volumes`, `archives`, `snapshots`, `sandbox`, `metrics`, `organizations`, `regional-deployments`, `login`, `whoami`, `version`, `completion`. Run `koyeb --help` via bash for the authoritative list.

## Tool reference

The `koyeb` tool takes:

- `subcommand` (required, string) — the full koyeb CLI command path (e.g. `"apps list"`, `"services logs <id>"`, `"deploy ./dir app/svc"`). Top-level parameter — never nest it inside `args`.
- `args` (optional object) — a key/value object of flags ONLY (never an array; do not nest `subcommand`, `output`, or `organization` here). Booleans become bare `--flag` (`{debug: true}` → `--debug`). Strings/numbers become `--flag value` tokens. Arrays become repeated `--flag value` pairs. `false`/`null`/`undefined` are skipped.
- `output` (optional string) — output format: `yaml`, `json`, or `table` (translates to `-o <format>`). Use `json` or `yaml` for parseable structured output; `table` is the human-readable default.
- `organization` (optional string) — organization ID override (translates to `--organization <id>`). Defaults to the token's organization.
- `timeoutSeconds` (optional, default 30, max 120) — command timeout.
- `forceDangerous` (optional boolean) — opt-in for destructive commands (all `delete`, `cancel`, `kill` ops). Requires explicit user confirmation.

### Call shape

All parameters are TOP-LEVEL siblings. `args` is a key/value object of flags ONLY — never an array, and never nest the other parameters inside it.

```json
{
  "subcommand": "apps list",
  "args": {},
  "output": "json"
}
```

### Structured output

For parseable results, pass `output`:

```
subcommand: "apps list"
output: "json"
```

This produces `koyeb apps list -o json`.

## Common koyeb subcommands

### Apps

- `apps list` — list all apps (`output: "json"` for structured).
- `apps get <id>` — get a specific app.
- `apps describe <id>` — describe an app (human-readable details).
- `apps create` — create an app (`args: { name: "my-app" }`).
- `apps init` — create an app and service in one step.
- `apps update <id>` — update an app.
- `apps pause <id>` — pause an app.
- `apps resume <id>` — resume a paused app.
- `apps delete <id>` — delete an app. **Requires `forceDangerous: true`.**

### Services

- `services list` — list all services (`output: "json"`).
- `services get <id>` — get a specific service.
- `services describe <id>` — describe a service.
- `services create` — create a service.
- `services update <id>` — update a service.
- `services logs <id>` — get service logs (`args: { type: "deploy" }` for deploy logs).
- `services exec <id>` — run a command in a service instance.
- `services scale <id>` — set manual scaling (`args: { instances: 3 }`).
- `services redeploy <id>` — redeploy a service.
- `services pause <id>` / `services resume <id>` — pause/resume.
- `services delete <id>` — delete a service. **Requires `forceDangerous: true`.**

### Deploy (one-shot)

- `deploy <path> <app>/<service>` — deploy a directory to Koyeb (`subcommand: "deploy ./myapp my-app/web"`, `args: { git: "main", ports: "8080:http" }`).

### Deployments

- `deployments list` — list deployments (`output: "json"`).
- `deployments get <id>` — get a deployment.
- `deployments describe <id>` — describe a deployment.
- `deployments logs <id>` — get deployment logs.
- `deployments cancel <id>` — cancel a deployment. **Requires `forceDangerous: true`.**

### Instances

- `instances list` — list instances (`output: "json"`).
- `instances get <id>` — get an instance.
- `instances describe <id>` — describe an instance.
- `instances logs <id>` — get instance logs.
- `instances exec <id>` — run a command in an instance.
- `instances cp` — copy files to/from an instance.

### Secrets

- `secrets list` — list secrets (`output: "json"`).
- `secrets get <id>` — get a secret.
- `secrets describe <id>` — describe a secret.
- `secrets create` — create a secret (`args: { name: "MY_SECRET", value: "secret-value" }`).
- `secrets update <id>` — update a secret.
- `secrets reveal <id>` — reveal a secret's value.
- `secrets delete <id>` — delete a secret. **Requires `forceDangerous: true`.**

### Domains

- `domains list` — list domains (`output: "json"`).
- `domains get <id>` — get a domain.
- `domains create` — create a domain.
- `domains attach` — attach a custom domain to an app.
- `domains detach` — detach a custom domain.
- `domains refresh <id>` — refresh domain verification status.
- `domains delete <id>` — delete a domain. **Requires `forceDangerous: true`.**

### Databases

- `databases list` — list databases (`output: "json"`).
- `databases get <id>` — get a database.
- `databases create` — create a database.
- `databases update <id>` — update a database.
- `databases delete <id>` — delete a database. **Requires `forceDangerous: true`.**

### Volumes & snapshots

- `volumes list/get/create/update/delete` — manage persistent volumes.
- `snapshots list/get/create/update/delete` — manage snapshots.
- Both `volumes delete` and `snapshots delete` require `forceDangerous: true`.

### Sandbox

- `sandbox create` — create an interactive sandbox.
- `sandbox list` — list sandboxes.
- `sandbox start <id>` — start a sandbox.
- `sandbox run` — run a command in a sandbox.
- `sandbox exec <id>` — exec in a sandbox.
- `sandbox kill <id>` — kill a sandbox. **Requires `forceDangerous: true`.**
- `sandbox logs <id>` — sandbox logs.
- `sandbox ps` — list processes.
- `sandbox health` — health check.
- `sandbox fs` — filesystem operations.
- `sandbox expose-port` / `unexpose-port` — port forwarding.

### Compose

- `compose` — create Koyeb resources from a `koyeb-compose.yaml` file.
- `compose logs` — view compose logs.
- `compose delete` — delete compose resources. **Requires `forceDangerous: true`.**

### Auth & diagnostics

- `whoami` — show the authenticated user/organization.
- `login` — log in to your Koyeb account (browser flow).
- `version` — get the CLI version.
- `organizations list` — list organizations.
- `organizations switch` — switch active organization.
- `metrics get` — get metrics for a resource.
- `archives create` — create an archive.

> `regional-deployments` (get/list), `completion` (shell completions), and `help` also exist. Run `koyeb --help` via bash for the authoritative top-level command list.

## Full command surface (quick reference)

Top-level subcommands (run `koyeb --help` via bash for the authoritative list):

- **Apps:** `apps` — create, delete, describe, get, init, list, pause, resume, update.
- **Services:** `services` — create, delete, describe, exec, get, list, logs, pause, redeploy, resume, scale, unapplied-changes, update.
- **Deploy:** `deploy <path> <app>/<service>` — one-shot directory deploy.
- **Deployments:** `deployments` — cancel, describe, get, list, logs.
- **Instances:** `instances` — cp, describe, exec, get, list, logs.
- **Secrets:** `secrets` — create, delete, describe, get, list, reveal, update.
- **Domains:** `domains` — attach, create, delete, describe, detach, get, list, refresh.
- **Databases:** `databases` — create, delete, get, list, update.
- **Volumes:** `volumes` — create, delete, get, list, update.
- **Snapshots:** `snapshots` — create, delete, get, list, update.
- **Sandbox:** `sandbox` — create, expose-port, fs, health, kill, list, logs, ps, run, start, unexpose-port.
- **Compose:** `compose` — create resources from koyeb-compose.yaml, logs, delete.
- **Archives:** `archives` — create.
- **Metrics:** `metrics` — get.
- **Organizations:** `organizations` — list, switch.
- **Regional deployments:** `regional-deployments` — get, list.
- **Auth:** `login`, `whoami`, `version`, `completion`.

For any command, run `koyeb <command> --help` via bash to see its flags.

## Pitfalls

- **`args` is an object, never an array** — pass `{ debug: true }`, not `["--debug"]`. The tool tolerates an array but it's not the correct shape.
- **Never nest parameters inside `args`** — `subcommand`, `output`, and `organization` are top-level siblings of `args`, not keys inside it.
- **All delete/cancel/kill ops require `forceDangerous: true`** — `apps delete`, `services delete`, `deployments cancel`, `secrets delete`, `domains delete`, `databases delete`, `volumes delete`, `snapshots delete`, `sandbox kill`, `compose delete`. Always confirm with the user before using them — these are unrecoverable.
- **Auth failures** — if the tool returns "not authenticated", tell the user to run `koyeb login` via bash. Do NOT retry the tool in a loop.
- **koyeb not installed** — if the tool reports `koyeb` is not on PATH, tell the user to install the Koyeb CLI and ensure it's on PATH.
- **`-o` for structured output** — use `output: "json"` or `output: "yaml"` for parseable results. The default is `table` (human-readable, hard to parse).
- **`--organization` overrides the token's org** — only use it when you need to target a different org.
- **`subcommand` is split on whitespace** — `"apps list"` becomes `["apps", "list"]`. Do not quote subcommands.
- **Large output is truncated** — the tool caps output at 2000 lines / 50KB. Use `output: "json"` and `args: { full: true }` for complete output when needed.

## Verification

1. `koyeb` tool with `subcommand: "whoami"` exits 0 and shows the authenticated org.
2. `koyeb` tool with `subcommand: "apps list", output: "json"` returns a JSON list of apps.
3. For write ops (create, deploy, delete), re-query with a list/get to confirm the change landed before reporting success.
