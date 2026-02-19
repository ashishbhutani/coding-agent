/**
 * Tests for git helper utilities
 *
 * Tests run against the actual coding-agent repo (which is a git repo).
 */

import { describe, it, expect } from "vitest";
import {
    isGitRepo,
    getGitRoot,
    getCurrentBranch,
    gitStatus,
    gitDiff,
    gitLog,
    hasUncommittedChanges,
} from "./git-helpers.js";

const REPO_DIR = process.cwd();

describe("git helpers", () => {
    it("should detect a git repo", async () => {
        const result = await isGitRepo(REPO_DIR);
        expect(result).toBe(true);
    });

    it("should return false for non-git dir", async () => {
        const result = await isGitRepo("/tmp");
        expect(result).toBe(false);
    });

    it("should get the git root", async () => {
        const root = await getGitRoot(REPO_DIR);
        expect(root).toBeTruthy();
        expect(root).toContain("coding-agent");
    });

    it("should get current branch", async () => {
        const branch = await getCurrentBranch(REPO_DIR);
        expect(branch).toBeTruthy();
        expect(typeof branch).toBe("string");
    });

    it("should get git status", async () => {
        const result = await gitStatus(REPO_DIR);
        expect(result.success).toBe(true);
        // output may be empty (clean) or have entries — both are valid
        expect(typeof result.output).toBe("string");
    });

    it("should get git diff", async () => {
        const result = await gitDiff(false, REPO_DIR);
        expect(result.success).toBe(true);
    });

    it("should get git log", async () => {
        const result = await gitLog(5, REPO_DIR);
        expect(result.success).toBe(true);
        expect(result.output).toContain("feat:");
    });

    it("should check for uncommitted changes", async () => {
        const result = await hasUncommittedChanges(REPO_DIR);
        expect(typeof result).toBe("boolean");
    });
});
