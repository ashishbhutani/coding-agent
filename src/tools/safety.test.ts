/**
 * Tests for safety guardrails + confirmation system
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    checkCommandSafety,
    isWithinWorkingDirectory,
    checkPathSandbox,
    isProtectedFromOverwrite,
    checkWriteSafety,
    checkEditSafety,
} from "./safety.js";
import { setConfirmationHandler, resetConfirmationHandler } from "./confirmation.js";

// Helper: mock confirmation to always approve
function mockApproveAll() {
    setConfirmationHandler(() => true);
}

// Helper: mock confirmation to always deny
function mockDenyAll() {
    setConfirmationHandler(() => false);
}

beforeEach(() => {
    resetConfirmationHandler(); // reset to deny-all before each test
});

// ── Dangerous command detection ────────────────────────

describe("checkCommandSafety — denied (default)", () => {
    it("should deny rm", () => {
        expect(checkCommandSafety("rm file.txt")).toBeTruthy();
    });

    it("should deny rm -rf", () => {
        expect(checkCommandSafety("rm -rf src")).toBeTruthy();
    });

    it("should deny unlink", () => {
        expect(checkCommandSafety("unlink some-file")).toBeTruthy();
    });

    it("should deny rmdir", () => {
        expect(checkCommandSafety("rmdir old-dir")).toBeTruthy();
    });

    it("should deny git clean", () => {
        expect(checkCommandSafety("git clean -fd")).toBeTruthy();
    });

    it("should deny git reset --hard", () => {
        expect(checkCommandSafety("git reset --hard HEAD~1")).toBeTruthy();
    });

    it("should deny git checkout -- .", () => {
        expect(checkCommandSafety("git checkout -- .")).toBeTruthy();
    });
});

describe("checkCommandSafety — approved", () => {
    it("should allow rm when user approves", () => {
        mockApproveAll();
        expect(checkCommandSafety("rm file.txt")).toBeNull();
    });

    it("should allow git clean when user approves", () => {
        mockApproveAll();
        expect(checkCommandSafety("git clean -fd")).toBeNull();
    });
});

describe("checkCommandSafety — safe commands (no prompt)", () => {
    it("should pass safe commands without prompting", () => {
        // These should return null WITHOUT triggering the confirmation handler
        expect(checkCommandSafety("ls -la")).toBeNull();
        expect(checkCommandSafety("npm test")).toBeNull();
        expect(checkCommandSafety("git status")).toBeNull();
        expect(checkCommandSafety("git add .")).toBeNull();
        expect(checkCommandSafety("git commit -m 'msg'")).toBeNull();
        expect(checkCommandSafety("git push origin main")).toBeNull();
        expect(checkCommandSafety("echo hello")).toBeNull();
        expect(checkCommandSafety("cat file.txt")).toBeNull();
        expect(checkCommandSafety("npm install")).toBeNull();
    });
});

// ── Directory sandboxing ───────────────────────────────

describe("isWithinWorkingDirectory", () => {
    it("should allow files in project", () => {
        expect(isWithinWorkingDirectory("src/tools/safety.ts")).toBe(true);
    });

    it("should block paths outside project", () => {
        expect(isWithinWorkingDirectory("/tmp/evil.ts")).toBe(false);
    });

    it("should block parent traversal", () => {
        expect(isWithinWorkingDirectory("../../etc/passwd")).toBe(false);
    });
});

describe("checkPathSandbox", () => {
    it("should return null for safe paths", () => {
        expect(checkPathSandbox("src/new-file.ts")).toBeNull();
    });

    it("should deny outside paths (default handler)", () => {
        const result = checkPathSandbox("/tmp/bad-file.ts");
        expect(result).toBeTruthy();
        expect(result).toContain("Denied");
    });

    it("should allow outside paths when user approves", () => {
        mockApproveAll();
        expect(checkPathSandbox("/tmp/allowed.ts")).toBeNull();
    });
});

// ── Protected config files ─────────────────────────────

describe("isProtectedFromOverwrite", () => {
    it("should protect package.json", () => {
        expect(isProtectedFromOverwrite("package.json")).toBe(true);
    });

    it("should allow normal source files", () => {
        expect(isProtectedFromOverwrite("src/tools/new-tool.ts")).toBe(false);
    });
});

describe("checkWriteSafety", () => {
    it("should deny protected files (default)", () => {
        const result = checkWriteSafety("package.json");
        expect(result).toBeTruthy();
        expect(result).toContain("Denied");
    });

    it("should allow protected files when user approves", () => {
        mockApproveAll();
        expect(checkWriteSafety("package.json")).toBeNull();
    });

    it("should allow normal project files", () => {
        expect(checkWriteSafety("src/tools/new-tool.ts")).toBeNull();
    });
});

describe("checkEditSafety", () => {
    it("should allow editing protected files (edit is fine)", () => {
        expect(checkEditSafety("package.json")).toBeNull();
    });

    it("should deny editing outside project (default)", () => {
        const result = checkEditSafety("/tmp/evil.ts");
        expect(result).toBeTruthy();
    });

    it("should allow editing outside project when user approves", () => {
        mockApproveAll();
        expect(checkEditSafety("/tmp/outside.ts")).toBeNull();
    });
});
