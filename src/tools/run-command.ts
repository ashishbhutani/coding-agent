/**
 * run_command Tool
 *
 * Executes a shell command and returns stdout/stderr.
 * Has a configurable timeout and working directory.
 */

import { exec } from "node:child_process";
import { resolve } from "node:path";
import type { Tool, ToolExecutionResult } from "./registry.js";
import { checkCommandSafety } from "./safety.js";

const DEFAULT_TIMEOUT_MS = 120_000; // 120 seconds
const MAX_OUTPUT_LENGTH = 50_000; // 50KB output cap

export const runCommandTool: Tool = {
    definition: {
        name: "run_command",
        description:
            "Execute a shell command and return the output (stdout and stderr). " +
            "Has a 120-second timeout by default. For long builds (mvn, gradle, npm install), " +
            "set timeout_ms to 300000 (5 min) or higher. " +
            "Destructive commands (rm, unlink, etc.) will require user confirmation.",
        parameters: {
            type: "object",
            properties: {
                command: {
                    type: "string",
                    description: "The shell command to execute",
                },
                cwd: {
                    type: "string",
                    description:
                        "Working directory for the command (defaults to current directory)",
                },
                timeout_ms: {
                    type: "integer",
                    description: "Timeout in milliseconds (default: 120000). Use 300000+ for builds.",
                },
            },
            required: ["command"],
        },
    },

    async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
        const command = String(args.command);
        const cwd = resolve(String(args.cwd || "."));
        const timeout = Number(args.timeout_ms || DEFAULT_TIMEOUT_MS);

        // Safety: check for dangerous commands (asks user for confirmation)
        const denied = checkCommandSafety(command);
        if (denied) {
            return { output: denied, isError: true };
        }

        return new Promise((resolvePromise) => {
            exec(
                command,
                {
                    cwd,
                    timeout,
                    maxBuffer: MAX_OUTPUT_LENGTH * 2,
                    env: { ...process.env, PAGER: "cat" },
                },
                (error, stdout, stderr) => {
                    let output = "";

                    if (stdout) {
                        output += stdout;
                    }
                    if (stderr) {
                        output += (output ? "\n--- stderr ---\n" : "") + stderr;
                    }

                    // Truncate if too long
                    if (output.length > MAX_OUTPUT_LENGTH) {
                        output =
                            output.slice(0, MAX_OUTPUT_LENGTH) +
                            "\n... (output truncated)";
                    }

                    if (error) {
                        const exitCode = error.code ?? "unknown";
                        const isTimeout = error.killed || exitCode === 143 || exitCode === "SIGTERM";

                        if (isTimeout) {
                            resolvePromise({
                                output:
                                    `Command timed out after ${timeout / 1000}s. ` +
                                    `Partial output:\n${output}\n\n` +
                                    `💡 Tip: Retry with a higher timeout_ms (e.g. 300000 for 5 min).`.trim(),
                                isError: true,
                            });
                        } else {
                            resolvePromise({
                                output:
                                    `Command failed (exit code: ${exitCode}):\n${output}`.trim(),
                                isError: true,
                            });
                        }
                    } else {
                        resolvePromise({
                            output:
                                output.trim() || "(command completed with no output)",
                        });
                    }
                }
            );
        });
    },
};
