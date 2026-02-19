/**
 * Git Helpers
 *
 * Utility functions for git operations. These are used programmatically
 * by the agent and other tools — not directly exposed as agent tools.
 *
 * The agent can still do git operations via run_command, but these
 * helpers provide type-safe, error-handled wrappers.
 */

import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { cwd } from "node:process";

interface GitResult {
    success: boolean;
    output: string;
    error?: string;
}

/**
 * Run a git command and return the result.
 */
function gitExec(args: string[], workDir?: string): Promise<GitResult> {
    return new Promise((resolve) => {
        execFile(
            "git",
            args,
            {
                cwd: workDir || cwd(),
                maxBuffer: 1024 * 1024,
                timeout: 30_000,
            },
            (error, stdout, stderr) => {
                if (error) {
                    resolve({
                        success: false,
                        output: stdout.trim(),
                        error: stderr.trim() || error.message,
                    });
                } else {
                    resolve({
                        success: true,
                        output: stdout.trim(),
                    });
                }
            }
        );
    });
}

/**
 * Check if a directory is inside a git repository.
 */
export async function isGitRepo(dir?: string): Promise<boolean> {
    const result = await gitExec(
        ["rev-parse", "--is-inside-work-tree"],
        dir
    );
    return result.success && result.output === "true";
}

/**
 * Get the root directory of the current git repository.
 */
export async function getGitRoot(dir?: string): Promise<string | null> {
    const result = await gitExec(
        ["rev-parse", "--show-toplevel"],
        dir
    );
    return result.success ? result.output : null;
}

/**
 * Get the current branch name.
 */
export async function getCurrentBranch(dir?: string): Promise<string | null> {
    const result = await gitExec(
        ["rev-parse", "--abbrev-ref", "HEAD"],
        dir
    );
    return result.success ? result.output : null;
}

/**
 * Get the status of the working tree (short format).
 */
export async function gitStatus(dir?: string): Promise<GitResult> {
    return gitExec(["status", "--short"], dir);
}

/**
 * Get the diff of uncommitted changes.
 */
export async function gitDiff(
    staged?: boolean,
    dir?: string
): Promise<GitResult> {
    const args = ["diff"];
    if (staged) args.push("--cached");
    return gitExec(args, dir);
}

/**
 * Stage files for commit.
 */
export async function gitAdd(
    files: string | string[],
    dir?: string
): Promise<GitResult> {
    const fileList = Array.isArray(files) ? files : [files];
    return gitExec(["add", ...fileList], dir);
}

/**
 * Commit staged changes.
 */
export async function gitCommit(
    message: string,
    dir?: string
): Promise<GitResult> {
    return gitExec(["commit", "-m", message], dir);
}

/**
 * Get recent commit log (short format).
 */
export async function gitLog(
    count: number = 10,
    dir?: string
): Promise<GitResult> {
    return gitExec(
        ["log", `--oneline`, `-n`, String(count)],
        dir
    );
}

/**
 * Check if there are uncommitted changes.
 */
export async function hasUncommittedChanges(dir?: string): Promise<boolean> {
    const status = await gitStatus(dir);
    return status.success && status.output.length > 0;
}

/**
 * Create a new branch.
 */
export async function gitCreateBranch(
    name: string,
    dir?: string
): Promise<GitResult> {
    return gitExec(["checkout", "-b", name], dir);
}

/**
 * Switch to an existing branch.
 */
export async function gitCheckout(
    branch: string,
    dir?: string
): Promise<GitResult> {
    return gitExec(["checkout", branch], dir);
}
