import { assertSafeCommand, buildArgv, formatOutput, runKoyeb, KOYEB_GUIDANCE, KOYEB_CALL_EXAMPLE, KOYEB_ARGS_DESCRIPTION, KOYEB_SUBCOMMAND_DESCRIPTION, type ExecResult, type KoyebExec, type KoyebParams } from "./index.ts";
import { describe, expect, mock, test } from "bun:test";

describe("buildArgv", () => {
	test("1. subcommand split on spaces", () => {
		expect(buildArgv({ subcommand: "apps list" })).toEqual(["apps", "list"]);
	});

	test("2. args become --flag value token pairs", () => {
		expect(
			buildArgv({ subcommand: "apps get", args: { debug: true, name: "my-app" } }),
		).toEqual(["apps", "get", "--debug", "--name", "my-app"]);
	});

	test("3. boolean true becomes a bare --flag", () => {
		const argv = buildArgv({ subcommand: "apps list", args: { full: true } });
		expect(argv).toContain("--full");
		expect(argv).not.toContain("--full=true");
		expect(argv).not.toContain("full=true");
	});

	test("4. boolean false is omitted", () => {
		const argv = buildArgv({ subcommand: "apps list", args: { full: false } });
		expect(argv).not.toContain("--full");
		expect(argv).not.toContain("full");
		expect(argv).not.toContain("full=false");
	});

	test("5. array values become repeated --flag value pairs", () => {
		expect(
			buildArgv({ subcommand: "services create", args: { label: ["bug", "urgent"] } }),
		).toEqual(["services", "create", "--label", "bug", "--label", "urgent"]);
	});

	test("6. output produces -o with the value", () => {
		const argv = buildArgv({
			subcommand: "apps list",
			output: "json",
		});
		expect(argv).toContain("-o");
		expect(argv).toContain("json");
	});

	test("7. organization produces --organization with the value", () => {
		const argv = buildArgv({ subcommand: "apps list", organization: "my-org-id" });
		expect(argv).toContain("--organization");
		expect(argv).toContain("my-org-id");
	});

	test("8. null and undefined args values are skipped", () => {
		expect(
			buildArgv({
				subcommand: "apps get",
				args: { debug: true, name: undefined, type: null },
			}),
		).toEqual(["apps", "get", "--debug"]);
	});

	test("9. -o appears after subcommand and args", () => {
		const argv = buildArgv({
			subcommand: "apps list",
			args: { debug: true },
			output: "json",
		});
		expect(argv.indexOf("-o")).toBeGreaterThan(argv.indexOf("list"));
		expect(argv.indexOf("-o")).toBeGreaterThan(argv.indexOf("--debug"));
	});

	test("10. --organization appears after -o", () => {
		const argv = buildArgv({
			subcommand: "apps list",
			output: "json",
			organization: "my-org",
		});
		expect(argv.indexOf("--organization")).toBeGreaterThan(argv.indexOf("-o"));
	});

	test("11a. empty subcommand throws", () => {
		expect(() => buildArgv({ subcommand: "" })).toThrow(/subcommand/i);
	});

	test("11b. whitespace-only subcommand throws", () => {
		expect(() => buildArgv({ subcommand: "   " })).toThrow(/subcommand/i);
	});
});

describe("buildArgv mode#1 (array args)", () => {
	test("A1.1 real payload: subcommand + array args with -o, top-level output wins", () => {
		expect(
			buildArgv({
				subcommand: "apps",
				args: ["list", "-o", "json"],
				output: "json",
			}),
		).toEqual(["apps", "list", "-o", "json"]);
	});

	test("A1.2 array args alone with -o (no top-level output) — promoted from array", () => {
		expect(
			buildArgv({ subcommand: "apps", args: ["list", "-o", "json"] }),
		).toEqual(["apps", "list", "-o", "json"]);
	});

	test("A1.3 array args with boolean flag", () => {
		expect(
			buildArgv({ subcommand: "apps", args: ["list", "--full"] }),
		).toEqual(["apps", "list", "--full"]);
	});

	test("A1.4 array args with --organization promoted", () => {
		expect(
			buildArgv({ subcommand: "apps", args: ["list", "--organization", "org-123"] }),
		).toEqual(["apps", "list", "--organization", "org-123"]);
	});
});

describe("buildArgv mode#2 (nested args)", () => {
	test("A2.1 real payload: subcommand+output nested inside args", () => {
		expect(
			buildArgv({
				args: {
					subcommand: "apps list",
					output: "json",
				},
			}),
		).toEqual(["apps", "list", "-o", "json"]);
	});

	test("A2.2 nested output+organization in args are harvested to top-level", () => {
		expect(
			buildArgv({
				args: { subcommand: "apps list", output: "json", organization: "org-1" },
			}),
		).toEqual(["apps", "list", "-o", "json", "--organization", "org-1"]);
	});

	test("A2.3 top-level value wins over nested duplicate", () => {
		expect(
			buildArgv({
				subcommand: "apps list",
				output: "yaml",
				args: { output: "json", debug: true },
			}),
		).toEqual(["apps", "list", "--debug", "-o", "yaml"]);
	});

	test("A2.4 mis-typed known key nested in args becomes a flag, not dropped", () => {
		// output as a number (type mismatch) should fall through to a --output flag
		// rather than being silently dropped by the harvest branch.
		expect(
			buildArgv({ args: { subcommand: "apps list", output: 42, debug: true } }),
		).toEqual(["apps", "list", "--output", "42", "--debug"]);
	});
});

describe("assertSafeCommand", () => {
	test("1. apps delete refused without opt-in", () => {
		expect(() => assertSafeCommand({ subcommand: "apps delete" })).toThrow(/apps delete/);
	});

	test("2. apps delete with args is refused as unrecoverable", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "apps delete <app-id>", args: { yes: true } }),
		).toThrow(/unrecoverable/);
	});

	test("3. apps delete with forceDangerous is allowed", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "apps delete <app-id>", forceDangerous: true }),
		).not.toThrow();
	});

	test("4. services delete refused", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "services delete" }),
		).toThrow(/services delete/);
	});

	test("5. services delete with forceDangerous is allowed", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "services delete <id>", forceDangerous: true }),
		).not.toThrow();
	});

	test("6. deployments cancel refused", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "deployments cancel" }),
		).toThrow(/deployments cancel/);
	});

	test("7. deployments cancel with forceDangerous is allowed", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "deployments cancel <id>", forceDangerous: true }),
		).not.toThrow();
	});

	test("8. secrets delete refused", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "secrets delete" }),
		).toThrow(/secrets delete/);
	});

	test("9. domains delete refused", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "domains delete" }),
		).toThrow(/domains delete/);
	});

	test("10. databases delete refused", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "databases delete" }),
		).toThrow(/databases delete/);
	});

	test("11. volumes delete refused", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "volumes delete" }),
		).toThrow(/volumes delete/);
	});

	test("12. snapshots delete refused", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "snapshots delete" }),
		).toThrow(/snapshots delete/);
	});

	test("13. sandbox kill refused", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "sandbox kill" }),
		).toThrow(/sandbox kill/);
	});

	test("14. compose delete refused", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "compose delete" }),
		).toThrow(/compose delete/);
	});

	test("15. apps list is allowed", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "apps list" }),
		).not.toThrow();
	});

	test("16. services logs is allowed", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "services logs <id>" }),
		).not.toThrow();
	});

	test("17. deploy is allowed", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "deploy ./dir app/svc" }),
		).not.toThrow();
	});

	test("18. whoami is allowed", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "whoami" }),
		).not.toThrow();
	});

	test("19. version is allowed", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "version" }),
		).not.toThrow();
	});

	test("20. dangerous command embedded in longer subcommand is caught (bypass fix)", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "run apps delete" }),
		).toThrow(/apps delete/);
	});

	test("21. whitespace-padded dangerous command is caught", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "  apps delete  " }),
		).toThrow(/apps delete/);
	});

	test("22. safe command with extra words is allowed", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "apps get <app-id>" }),
		).not.toThrow();
	});

	test("23. apps create is allowed (not destructive)", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "apps create" }),
		).not.toThrow();
	});

	test("24. services scale is allowed (not destructive)", () => {
		expect(() =>
			assertSafeCommand({ subcommand: "services scale <id>" }),
		).not.toThrow();
	});
});

describe("formatOutput", () => {
	test("1. stdout only", () => {
		expect(formatOutput("hello", "")).toBe("hello");
	});

	test("2. stderr appended with label", () => {
		expect(formatOutput("out", "err")).toBe("out\n\nstderr:\nerr");
	});

	test("3. empty produces placeholder", () => {
		expect(formatOutput("", "")).toBe("(no output)");
	});

	test("4. whitespace-only is treated as empty", () => {
		expect(formatOutput("   \n  ", "  ")).toBe("(no output)");
	});
});

describe("KOYEB_GUIDANCE", () => {
	test("1. does not contain stale key=value format", () => {
		expect(KOYEB_GUIDANCE).not.toContain("key=value");
	});
});

describe("KOYEB_CALL_EXAMPLE", () => {
	test("A4.1 structure: has subcommand, args, and output; args is non-array object; output is string", () => {
		const keys = Object.keys(KOYEB_CALL_EXAMPLE);
		expect(keys).toContain("subcommand");
		expect(keys).toContain("args");
		expect(keys).toContain("output");
		expect(Array.isArray(KOYEB_CALL_EXAMPLE.args)).toBe(false);
		expect(typeof KOYEB_CALL_EXAMPLE.args).toBe("object");
		expect(typeof KOYEB_CALL_EXAMPLE.output).toBe("string");
	});
});

describe("KOYEB_ARGS_DESCRIPTION", () => {
	test("A4.2 says object-not-array", () => {
		expect(KOYEB_ARGS_DESCRIPTION).toMatch(/not an array|never an array|must be an object/i);
	});

	test("A4.3 prohibits nesting with literal names", () => {
		expect(KOYEB_ARGS_DESCRIPTION).toMatch(/never[^.]*subcommand[^.]*output|top-level params, not nested/i);
		expect(KOYEB_ARGS_DESCRIPTION).toContain("subcommand");
		expect(KOYEB_ARGS_DESCRIPTION).toContain("output");
	});
});

describe("KOYEB_SUBCOMMAND_DESCRIPTION", () => {
	test("A4.4 says top-level, never in args, has command path", () => {
		expect(KOYEB_SUBCOMMAND_DESCRIPTION).toMatch(/top-level/i);
		expect(KOYEB_SUBCOMMAND_DESCRIPTION).toMatch(/never[^.]*args/i);
		expect(KOYEB_SUBCOMMAND_DESCRIPTION).toContain("apps list");
	});
});

describe("KOYEB_GUIDANCE content", () => {
	test("A4.5 embeds the flat example", () => {
		expect(KOYEB_GUIDANCE).toContain(JSON.stringify(KOYEB_CALL_EXAMPLE, null, 2));
	});
});

/**
 * Fake exec: returns a canned ExecResult, recording the call so tests can
 * assert on the argv that was built. This is the only system boundary mocked
 * (per the TDD mocking skill — mock at boundaries, never internal collaborators).
 */
function makeFakeExec(result: ExecResult): KoyebExec & { calls: Parameters<KoyebExec>[] } {
	const calls: Parameters<KoyebExec>[] = [];
	const fn = mock(async (_cmd: string, args: string[], opts) => {
		calls.push([_cmd, args, opts]);
		return result;
	}) as unknown as KoyebExec & { calls: Parameters<KoyebExec>[] };
	fn.calls = calls;
	return fn;
}

describe("runKoyeb", () => {
	test("1. builds argv from params and passes it to exec", async () => {
		const exec = makeFakeExec({ stdout: "ok", code: 0 });
		await runKoyeb({ subcommand: "apps list", args: { debug: true } }, exec);
		expect(exec.calls[0][0]).toBe("koyeb");
		expect(exec.calls[0][1]).toEqual(["apps", "list", "--debug"]);
	});

	test("2. success echoes command, exit code, and output", async () => {
		const exec = makeFakeExec({ stdout: "app-list-output", code: 0 });
		const res = await runKoyeb({ subcommand: "apps list" }, exec);
		expect(res.isError).toBe(false);
		expect(res.content[0].text).toContain("Command: koyeb apps list");
		expect(res.content[0].text).toContain("Exit code: 0");
		expect(res.content[0].text).toContain("app-list-output");
	});

	test("3. non-zero exit sets isError true and includes exit code + stderr", async () => {
		const exec = makeFakeExec({ stdout: "", stderr: "not found", code: 1 });
		const res = await runKoyeb({ subcommand: "apps get" }, exec);
		expect(res.isError).toBe(true);
		expect(res.content[0].text).toContain("Exit code: 1");
		expect(res.content[0].text).toContain("not found");
	});

	test("4. exec rejection (ENOENT) is wrapped with install hint", async () => {
		const failing: KoyebExec = async () => {
			throw new Error("spawn ENOENT");
		};
		await expect(runKoyeb({ subcommand: "apps list" }, failing)).rejects.toThrow(/installed and on PATH/);
	});

	test("5. not-authed returns isError with notAuthed detail and koyeb login guidance", async () => {
		const exec = makeFakeExec({
			stdout: "",
			stderr: "You are not logged in. Run koyeb login to authenticate.",
			code: 1,
		});
		const res = await runKoyeb({ subcommand: "apps list" }, exec);
		expect(res.isError).toBe(true);
		expect(res.details).toMatchObject({ notAuthed: true });
		expect(res.content[0].text).toContain("koyeb login");
	});

	test("6. apps delete refused before exec is called", async () => {
		const exec = makeFakeExec({ stdout: "", code: 0 });
		await expect(
			runKoyeb({ subcommand: "apps delete" }, exec),
		).rejects.toThrow(/apps delete/);
		expect(exec.calls).toHaveLength(0);
	});

	test("7. missing subcommand throws", async () => {
		const exec = makeFakeExec({ stdout: "", code: 0 });
		await expect(runKoyeb({} as KoyebParams, exec)).rejects.toThrow(/subcommand/);
	});

	test("8. large output is truncated and flagged", async () => {
		const huge = Array.from({ length: 5000 }, () => "line of content").join("\n");
		const exec = makeFakeExec({ stdout: huge, code: 0 });
		const res = await runKoyeb({ subcommand: "apps list" }, exec);
		expect(res.details).toMatchObject({ truncated: true });
		expect(res.content[0].text).toContain("Output truncated");
	});

	test("9. timeout 9999 is clamped to 120s", async () => {
		const exec = makeFakeExec({ stdout: "ok", code: 0 });
		await runKoyeb({ subcommand: "apps list", timeoutSeconds: 9999 }, exec);
		expect(exec.calls[0][2].timeout).toBe(120000);
	});

	test("10. no timeoutSeconds defaults to 30s", async () => {
		const exec = makeFakeExec({ stdout: "ok", code: 0 });
		await runKoyeb({ subcommand: "apps list" }, exec);
		expect(exec.calls[0][2].timeout).toBe(30000);
	});

	test("11. timeoutSeconds 0 is clamped to min 1s", async () => {
		const exec = makeFakeExec({ stdout: "ok", code: 0 });
		await runKoyeb({ subcommand: "apps list", timeoutSeconds: 0 }, exec);
		expect(exec.calls[0][2].timeout).toBe(1000);
	});

	test("12. output appears in argv as -o", async () => {
		const exec = makeFakeExec({ stdout: "ok", code: 0 });
		await runKoyeb({ subcommand: "apps list", output: "json" }, exec);
		expect(exec.calls[0][1]).toContain("-o");
		expect(exec.calls[0][1]).toContain("json");
	});

	test("13. organization appears in argv as --organization", async () => {
		const exec = makeFakeExec({ stdout: "ok", code: 0 });
		await runKoyeb({ subcommand: "apps list", organization: "org-123" }, exec);
		expect(exec.calls[0][1]).toContain("--organization");
		expect(exec.calls[0][1]).toContain("org-123");
	});
});

describe("runKoyeb tolerance", () => {
	test("A3.1 mode#1 array args → correct argv passed to exec, isError false", async () => {
		const exec = makeFakeExec({ stdout: "ok", code: 0 });
		const res = await runKoyeb({
			subcommand: "apps",
			args: ["list", "-o", "json"],
			output: "json",
		}, exec);
		expect(res.isError).toBe(false);
		expect(exec.calls[0][1]).toEqual(["apps", "list", "-o", "json"]);
	});

	test("A3.2 mode#2 nested args → correct argv passed to exec, isError false", async () => {
		const exec = makeFakeExec({ stdout: "ok", code: 0 });
		const res = await runKoyeb({
			args: {
				subcommand: "apps list",
				output: "json",
			},
		}, exec);
		expect(res.isError).toBe(false);
		expect(exec.calls[0][1]).toEqual(["apps", "list", "-o", "json"]);
	});

	test("A3.3 dangerous command nested in args is still refused", async () => {
		const exec = makeFakeExec({ stdout: "", code: 0 });
		await expect(
			runKoyeb({ args: { subcommand: "apps delete" } }, exec),
		).rejects.toThrow(/apps delete/);
		expect(exec.calls).toHaveLength(0);
	});
});

// --- Integration tests (opt-in) ---
// Gated by TEST_INTEGRATION=1. Skipped by default so CI runs don't need koyeb.
// When enabled + koyeb authed, these validate the full buildArgv→exec→formatOutput
// pipeline against the real koyeb binary's flag parser.

const realExec: KoyebExec = async (cmd, args, opts) => {
	const proc = Bun.spawn([cmd, ...args], {
		stdout: "pipe",
		stderr: "pipe",
		signal: opts.signal,
	});
	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();
	const code = await proc.exited;
	return { stdout, stderr, code };
};

describe("integration (real koyeb)", () => {
	test.skipIf(!process.env.TEST_INTEGRATION)("1. koyeb whoami succeeds", async () => {
		const res = await runKoyeb({ subcommand: "whoami" }, realExec);
		expect(res).toBeDefined();
	});

	test("2. koyeb apps list -o serialization (always runs, no auth needed for flag parsing)", async () => {
		// This is a unit test that builds argv but does NOT exec — kept here for visibility.
		expect(buildArgv({ subcommand: "apps list", output: "json" })).toEqual(["apps", "list", "-o", "json"]);
	});

	test.skipIf(!process.env.TEST_INTEGRATION)("3. koyeb version succeeds", async () => {
		const res = await runKoyeb({ subcommand: "version" }, realExec);
		expect(res).toBeDefined();
	});
});
