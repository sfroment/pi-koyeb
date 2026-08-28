import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	truncateTail,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "typebox";

/** Commands that are destructive/unrecoverable — refused unless forceDangerous is set. */
const DANGEROUS_COMMANDS = [
	"apps delete",
	"services delete",
	"deployments cancel",
	"secrets delete",
	"domains delete",
	"databases delete",
	"volumes delete",
	"snapshots delete",
	"sandbox kill",
	"compose delete",
];

/** Regex matching koyeb's not-authenticated error messages. */
const NOT_AUTHED = /not logged in|unauthorized|authentication required|auth.*fail|token.*invalid|login.*required|401/i;

export type KoyebParams = {
	subcommand: string;
	args?: Record<string, string | number | boolean | string[] | null | undefined>;
	output?: string;
	organization?: string;
	timeoutSeconds?: number;
	forceDangerous?: boolean;
};

export type RawKoyebParams = Omit<KoyebParams, "subcommand" | "args"> & {
	subcommand?: string;
	args?: KoyebParams["args"] | string[];
};

/** Flags in array-args that promote to typed top-level fields when unset. */
const PROMOTABLE_FLAGS = new Set(["output", "organization"]);

/**
 * Normalize raw tool params into canonical KoyebParams. Tolerates two mis-shaped
 * calls the model produces: args as a JSON array (mode #1) and known top-level
 * keys nested inside an object args (mode #2). Top-level fields always win.
 */
function normalizeParams(raw: RawKoyebParams): KoyebParams {
	const { args: rawArgs, ...rest } = raw;
	const subcommand = rest.subcommand ?? "";

	// Mode #1: args is an array of positional/flag tokens.
	if (Array.isArray(rawArgs)) {
		const parts: string[] = subcommand.trim().split(/\s+/).filter(Boolean);
		const flags: NonNullable<KoyebParams["args"]> = {};
		let output = rest.output;
		let organization = rest.organization;

		for (let i = 0; i < rawArgs.length; i++) {
			const token = rawArgs[i];
			if (token.startsWith("--")) {
				let name: string;
				let value: string | undefined;

				const eq = token.indexOf("=");
				if (eq >= 0) {
					name = token.slice(2, eq);
					value = token.slice(eq + 1);
				} else {
					name = token.slice(2);
					if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith("--")) {
						value = rawArgs[++i];
					}
				}

				if (PROMOTABLE_FLAGS.has(name)) {
					if (name === "output" && output === undefined && value !== undefined) {
						output = value;
					} else if (name === "organization" && organization === undefined && value !== undefined) {
						organization = value;
					}
					// If top-level is already set, the parsed duplicate is dropped.
				} else {
					flags[name] = value === undefined ? true : value;
				}
			} else {
				parts.push(token);
			}
		}

		return {
			...rest,
			subcommand: parts.join(" "),
			args: Object.keys(flags).length > 0 ? flags : undefined,
			output,
			organization,
		};
	}

	// Object args or no args — harvest known top-level keys from nested args (mode #2).
	if (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)) {
		const knownKeys: (keyof RawKoyebParams)[] = [
			"subcommand", "output", "organization", "timeoutSeconds", "forceDangerous",
		];
		const harvested: Partial<KoyebParams> = {};
		const remaining: NonNullable<KoyebParams["args"]> = {};

		for (const [key, value] of Object.entries(rawArgs)) {
			if (knownKeys.includes(key as keyof RawKoyebParams)) {
				if (key === "subcommand") {
					if (!subcommand && typeof value === "string") harvested.subcommand = value;
					else if (!subcommand) remaining[key] = value as string | number | boolean | string[];
				} else if (key === "output") {
					if (rest.output === undefined && typeof value === "string") harvested.output = value;
					else if (rest.output === undefined) remaining[key] = value as string | number | boolean | string[];
				} else if (key === "organization") {
					if (rest.organization === undefined && typeof value === "string") harvested.organization = value;
					else if (rest.organization === undefined) remaining[key] = value as string | number | boolean | string[];
				} else if (key === "timeoutSeconds") {
					if (rest.timeoutSeconds === undefined && typeof value === "number") harvested.timeoutSeconds = value;
					else if (rest.timeoutSeconds === undefined) remaining[key] = value as string | number | boolean | string[];
				} else if (key === "forceDangerous") {
					if (rest.forceDangerous === undefined && typeof value === "boolean") harvested.forceDangerous = value;
					else if (rest.forceDangerous === undefined) remaining[key] = value as string | number | boolean | string[];
				}
			} else if (key === "args" && Array.isArray(value)) {
				// Nested args inside args (array form) — recurse via mode #1.
				const inner = normalizeParams({ ...rest, subcommand, args: value });
				if (inner.subcommand && !subcommand) harvested.subcommand = inner.subcommand;
				if (inner.output !== undefined && rest.output === undefined) harvested.output = inner.output;
				if (inner.organization !== undefined && rest.organization === undefined) harvested.organization = inner.organization;
				if (inner.args) Object.assign(remaining, inner.args);
			} else if (key === "args" && typeof value === "object" && value !== null && !Array.isArray(value)) {
				// Nested args inside args (object form) — merge remaining flags.
				Object.assign(remaining, value as Record<string, string | number | boolean | string[]>);
			} else {
				remaining[key] = value as string | number | boolean | string[];
			}
		}

		return {
			...rest,
			subcommand: harvested.subcommand ?? subcommand,
			args: Object.keys(remaining).length > 0 ? remaining : undefined,
			output: harvested.output ?? rest.output,
			organization: harvested.organization ?? rest.organization,
			timeoutSeconds: harvested.timeoutSeconds ?? rest.timeoutSeconds,
			forceDangerous: harvested.forceDangerous ?? rest.forceDangerous,
		};
	}

	return { ...rest, subcommand, args: rawArgs };
}

/**
 * Serialize params into the koyeb CLI's argv format.
 *
 * The subcommand is split on whitespace (e.g. "apps list" → ["apps", "list"]).
 * Args are serialized as `--flag value` token pairs; booleans become bare
 * `--flag` tokens; arrays become repeated `--flag value` pairs;
 * false/null/undefined are skipped. Keys without a `--` prefix are prefixed.
 * Global flags (-o for output, --organization) are appended after subcommand
 * and args, in that order (-o before --organization).
 */
export function buildArgv(params: RawKoyebParams): string[] {
	const normalized = normalizeParams(params);
	const trimmed = normalized.subcommand.trim();
	if (trimmed.length === 0) {
		throw new Error("subcommand is required and must not be empty or whitespace");
	}

	const argv: string[] = trimmed.split(/\s+/);
	const args = normalized.args ?? {};
	for (const [key, value] of Object.entries(args)) {
		if (value === false || value === null || value === undefined) continue;
		const flag = key.startsWith("--") ? key : `--${key}`;
		if (value === true) {
			argv.push(flag);
		} else if (Array.isArray(value)) {
			for (const v of value) {
				argv.push(flag, String(v));
			}
		} else {
			argv.push(flag, String(value));
		}
	}

	if (normalized.output) {
		argv.push("-o", normalized.output);
	}
	if (normalized.organization) {
		argv.push("--organization", normalized.organization);
	}

	return argv;
}

/**
 * Guard against destructive koyeb operations that are hard or impossible to
 * reverse. The tool refuses these unless the caller explicitly sets
 * `forceDangerous: true`, which keeps the LLM from deleting an app or service
 * by accident.
 */
export function assertSafeCommand(params: KoyebParams): void {
	const words = params.subcommand.trim().toLowerCase().split(/\s+/);
	for (let i = 0; i < words.length - 1; i++) {
		const pair = `${words[i]} ${words[i + 1]}`;
		if (DANGEROUS_COMMANDS.includes(pair)) {
			if (params.forceDangerous === true) return;
			throw new Error(
				`Refusing \`${pair}\` from the koyeb tool — this operation is unrecoverable. ` +
					"To override, set `forceDangerous: true` and confirm with the user first.",
			);
		}
	}
}

/**
 * Format stdout/stderr into a single human-readable string.
 * If both are empty/whitespace, returns a placeholder.
 */
export function formatOutput(stdout: string, stderr: string): string {
	const chunks: string[] = [];
	if (stdout.trim().length > 0) chunks.push(stdout.trimEnd());
	if (stderr.trim().length > 0) chunks.push(`stderr:\n${stderr.trimEnd()}`);
	return chunks.join("\n\n") || "(no output)";
}

/** Result shape returned by the injected exec boundary (compatible with pi.exec). */
export type ExecResult = { stdout?: string; stderr?: string; code?: number | null; killed?: boolean };

/** System boundary: spawns the koyeb CLI. Injected for testing. */
export type KoyebExec = (
	command: string,
	args: string[],
	options: { signal?: AbortSignal; timeout?: number },
) => Promise<ExecResult>;

/**
 * Core execution logic, separated from the Pi tool wiring so it can be tested
 * with an injected `exec` (the only system boundary). Returns the same shape
 * as a Pi tool result.
 */
export async function runKoyeb(
	rawParams: RawKoyebParams,
	exec: KoyebExec,
	signal?: AbortSignal,
): Promise<{
	content: { type: "text"; text: string }[];
	details: Record<string, unknown>;
	isError: boolean;
}> {
	// Normalize before guard: the model may nest subcommand inside args,
	// so we must harvest it before assertSafeCommand can see it.
	const params = normalizeParams(rawParams);

	if (!params.subcommand || params.subcommand.trim().length === 0) {
		throw new Error("Pass a koyeb subcommand, for example `subcommand: 'apps list'` or `subcommand: 'services logs <id>'`.");
	}
	assertSafeCommand(params);

	const argv = buildArgv(params);
	const timeoutSeconds = Math.min(Math.max(params.timeoutSeconds ?? 30, 1), 120);

	let result: ExecResult;
	try {
		result = await exec("koyeb", argv, { signal, timeout: timeoutSeconds * 1000 });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to run koyeb CLI. Is it installed and on PATH? ${message}`);
	}

	const stdout = result.stdout ?? "";
	const stderr = result.stderr ?? "";
	const code = result.code;

	// Detect the common "not authenticated" failure and give actionable guidance.
	if (code !== 0 && (NOT_AUTHED.test(stdout) || NOT_AUTHED.test(stderr))) {
		return {
			content: [
				{
					type: "text",
					text:
						"You are not authenticated with the Koyeb CLI. Run `koyeb login` to authenticate, " +
						"then retry the command.",
				},
			],
			details: { subcommand: params.subcommand, code, notAuthed: true },
			isError: true,
		};
	}

	const output = formatOutput(stdout, stderr);
	const truncation = truncateTail(output, {
		maxLines: DEFAULT_MAX_LINES,
		maxBytes: DEFAULT_MAX_BYTES,
	});
	const commandLine = `koyeb ${argv.join(" ")}`;
	const codeText = code === null || code === undefined ? "unknown" : String(code);
	let text = `Command: ${commandLine}\nExit code: ${codeText}${result.killed ? " (killed)" : ""}\n\n${truncation.content}`;
	if (truncation.truncated) {
		text += `\n\n[Output truncated: ${truncation.outputLines} of ${truncation.totalLines} lines (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).]`;
	}

	return {
		content: [{ type: "text", text }],
		details: {
			subcommand: params.subcommand,
			argv,
			code,
			killed: result.killed,
			truncated: truncation.truncated,
		},
		isError: code !== 0,
	};
}

const baseDir = dirname(fileURLToPath(import.meta.url));
const skillPath = join(baseDir, "skill", "SKILL.md");

const RELEVANT_PROMPT = /\b(koyeb|deploy|service|app|instance|secret|domain|database)\b/i;

/** Canonical flat call-shape example — single source of truth for all prompt surfaces. */
export const KOYEB_CALL_EXAMPLE = {
	subcommand: "apps list",
	args: {},
	output: "json",
} as const;

export const KOYEB_ARGS_DESCRIPTION =
	"Command flags as a key/value object map (e.g. {debug: true}). " +
	"Must be an object, not an array. " +
	"Never put subcommand, output, or organization inside args — " +
	"those are top-level params, not nested inside args.";

export const KOYEB_SUBCOMMAND_DESCRIPTION =
	"The koyeb CLI subcommand as a top-level param, e.g. 'apps list' or 'services logs <id>'. " +
	"Split on spaces into the command path. " +
	"This is a top-level param — never nest it inside args.";

const KOYEB_CALL_EXAMPLE_JSON = JSON.stringify(KOYEB_CALL_EXAMPLE, null, 2);

/**
 * Guidance injected into the system prompt when the user's message looks
 * Koyeb-related. Kept short — the full reference lives in the SKILL.md.
 */
export const KOYEB_GUIDANCE = `## Koyeb CLI (koyeb) guidance

The \`koyeb\` tool wraps the Koyeb CLI (\`koyeb\`) as a single typed tool. All params are top-level siblings — never nest subcommand, output, or organization inside args.

Call shape (all params flat at top level):
\`\`\`json
${KOYEB_CALL_EXAMPLE_JSON}
\`\`\`

- \`subcommand\` (top-level): the koyeb command, e.g. "apps list" or "services logs <id>".
- \`args\` (top-level): key/value object map of flags only, e.g. {debug: true}. Must be an object, not an array.
- \`output\` (top-level): output format — yaml, json, or table (translates to -o <format>).
- \`organization\` (top-level): organization ID override (translates to --organization <id>).

Key patterns:
- List apps: \`subcommand: "apps list"\`, \`output: "json"\`.
- Get service logs: \`subcommand: "services logs <id>"\`, \`args: { type: "deploy" }\`.
- Deploy a directory: \`subcommand: "deploy ./dir app/svc"\`, \`args: { git: "main" }\`.
- Destructive ops (\`apps delete\`, \`services delete\`, etc.) require \`forceDangerous: true\` and explicit user confirmation.

If the tool reports you are not authenticated, run \`koyeb login\` via bash.`;

export default function koyebExtension(pi: ExtensionAPI) {
	// Make the bundled SKILL.md discoverable as a skill.
	pi.on("resources_discover", () => ({
		skillPaths: [skillPath],
	}));

	// Inject concise guidance when the prompt looks Koyeb-related.
	pi.on("before_agent_start", (event) => {
		if (!RELEVANT_PROMPT.test(event.prompt)) return;
		return {
			systemPrompt: `${event.systemPrompt}\n\n${KOYEB_GUIDANCE}\n`,
		};
	});

	pi.registerTool({
		name: "koyeb",
		label: "Koyeb CLI",
		description:
			"Call the Koyeb CLI (koyeb) to interact with apps, services, deployments, instances, secrets, domains, databases, volumes, and one-shot deploys. " +
			"Top-level subcommands: apps, services, deployments, instances, deploy, compose, secrets, domains, databases, volumes, snapshots, sandbox, metrics, organizations, login, whoami, version. " +
			"All params are top-level siblings: subcommand (e.g. 'apps list'), args (object of flags), output, organization. " +
			"Never nest subcommand/output/organization inside args — args is a flat key/value object of flags only.\n" +
			"Run `koyeb --help` via bash for the authoritative command list.\n" +
			"Example call shape:\n" + KOYEB_CALL_EXAMPLE_JSON + "\n" +
			"Destructive operations (apps delete, services delete, deployments cancel, secrets delete, domains delete, databases delete, volumes delete, snapshots delete, sandbox kill, compose delete) require `forceDangerous: true`.",
		promptSnippet:
			"Interact with Koyeb (apps, services, deployments, instances, secrets, domains, databases) via the koyeb CLI.",
		promptGuidelines: [
			"Use the `koyeb` tool when the user asks about Koyeb — apps, services, deployments, instances, secrets, domains, databases, or deploys. It calls the koyeb CLI directly. Top-level subcommands: apps, services, deployments, instances, deploy, compose, secrets, domains, databases, volumes, snapshots, sandbox, metrics, organizations, login, whoami, version. Run `koyeb --help` via bash for the authoritative list.",
			"All params are top-level siblings: subcommand, args, output, organization, timeoutSeconds, forceDangerous. Never nest one inside another.",
			"`args` is a key/value object of flags only (e.g. {debug: true}), never an array, and never contains subcommand/output/organization.",
			"Use `output: \"json\"` for structured output (translates to -o json). Use `organization` to target a different org.",
			"Destructive operations (`apps delete`, `services delete`, `deployments cancel`, `secrets delete`, `domains delete`, `databases delete`, `volumes delete`, `snapshots delete`, `sandbox kill`, `compose delete`) require `forceDangerous: true`. Always confirm with the user before using it.",
			"If the tool reports you are not authenticated, tell the user to run `koyeb login`.",
		],
		parameters: Type.Object({
			subcommand: Type.Optional(
				Type.String({
					description: KOYEB_SUBCOMMAND_DESCRIPTION,
				}),
			),
			args: Type.Optional(
				Type.Union([
					Type.Record(
						Type.String(),
						Type.Union([Type.String(), Type.Number(), Type.Boolean(), Type.Array(Type.String())]),
					),
					Type.Array(Type.String()),
				], {
					description: KOYEB_ARGS_DESCRIPTION,
				}),
			),
			output: Type.Optional(
				Type.String({
					description: "Output format: yaml, json, or table (translates to -o <format>). Use json for structured output.",
				}),
			),
			organization: Type.Optional(
				Type.String({ description: "Organization ID override (translates to --organization <id>)." }),
			),
			timeoutSeconds: Type.Optional(
				Type.Integer({
					minimum: 1,
					maximum: 120,
					default: 30,
					description: "Command timeout in seconds (default 30, max 120).",
				}),
			),
			forceDangerous: Type.Optional(
				Type.Boolean({
					description: "Opt-in flag to allow destructive commands (apps delete, services delete, deployments cancel, secrets delete, domains delete, databases delete, volumes delete, snapshots delete, sandbox kill, compose delete). Requires explicit user confirmation.",
				}),
			),
		}),
		async execute(_toolCallId, params: RawKoyebParams, signal) {
			return runKoyeb(params, (cmd, args, opts) => pi.exec(cmd, args, opts), signal);
		},
	});
}
