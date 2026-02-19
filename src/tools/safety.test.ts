/**
 * Tests for safety guardrails
 */

import { describe, it, expect } from "vitest";
import {
    isDangerousCommand,
    isWithinWorkingDirectory,
    checkPathSandbox,
    isProtectedFromOverwrite,
    checkWriteSafety,
    checkEditSafety,
} from "./safety.js";

// ── Delete command blocking ────────────────────────────

describe("isDangerousCommand", () => {
    it("should block rm", () => {
        expect(isDangerousCommand("rm file.txt")).toBeTruthy();
    });

    it("should block rm -rf", () => {
        expect(isDangerousCommand("rm -rf src")).toBeTruthy();
    });

    it("should block rm -f", () => {
        expect(isDangerousCommand("rm -f package.json")).toBeTruthy();
    });

    it("should block unlink", () => {
        expect(isDangerousCommand("unlink some-file")).toBeTruthy();
    });

    it("should block rmdir", () => {
        expect(isDangerousCommand("rmdir old-directory")).toBeTruthy();
    });

    it("should block git clean", () => {
        expect(isDangerousCommand("git clean -fd")).toBeTruthy();
    });

    it("should block git reset --hard", () => {
        expect(isDangerousCommand("git reset --hard HEAD~1")).toBeTruthy();
    });

    it("should block git checkout -- .", () => {
        expect(isDangerousCommand("git checkout -- .")).toBeTruthy();
    });

    it("should allow safe commands", () => {
        expect(isDangerousCommand("ls -la")).toBeNull();
        expect(isDangerousCommand("npm test")).toBeNull();
        expect(isDangerousCommand("git status")).toBeNull();
        expect(isDangerousCommand("git add .")).toBeNull();
        expect(isDangerousCommand("git commit -m 'msg'")).toBeNull();
        expect(isDangerousCommand("git push origin main")).toBeNull();
        expect(isDangerousCommand("echo hello")).toBeNull();
        expect(isDangerousCommand("cat file.txt")).toBeNull();
        expect(isDangerousCommand("npm install")).toBeNull();
    });
});

// ── Directory sandboxing ───────────────────────────────

describe("isWithinWorkingDirectory", () => {
    it("should allow files in project", () => {
        expect(isWithinWorkingDirectory("src/tools/safety.ts")).toBe(true);
    });

    it("should allow nested paths", () => {
        expect(isWithinWorkingDirectory("src/agent/agent.ts")).toBe(true);
    });

    it("should block paths outside project", () => {
        expect(isWithinWorkingDirectory("/tmp/evil.ts")).toBe(false);
    });

    it("should block parent traversal", () => {
        expect(isWithinWorkingDirectory("../../etc/passwd")).toBe(false);
    });

    it("should block absolute paths to other dirs", () => {
        expect(isWithinWorkingDirectory("/Users/ashish.bhutani/.zshrc")).toBe(false);
    });
});

describe("checkPathSandbox", () => {
    it("should return null for safe paths", () => {
        expect(checkPathSandbox("src/new-file.ts")).toBeNull();
    });

    it("should return reason for outside paths", () => {
        const result = checkPathSandbox("/tmp/bad-file.ts");
        expect(result).toBeTruthy();
        expect(result).toContain("outside");
    });
});

// ── Protected config files ─────────────────────────────

describe("isProtectedFromOverwrite", () => {
    it("should protect package.json", () => {
        expect(isProtectedFromOverwrite("package.json")).toBe(true);
    });

    it("should protect tsconfig.json", () => {
        expect(isProtectedFromOverwrite("tsconfig.json")).toBe(true);
    });

    it("should protect .gitignore", () => {
        expect(isProtectedFromOverwrite(".gitignore")).toBe(true);
    });

    it("should allow normal source files", () => {
        expect(isProtectedFromOverwrite("src/tools/new-tool.ts")).toBe(false);
    });
});

// ── Composite checks ──────────────────────────────────

describe("checkWriteSafety", () => {
    it("should block protected files", () => {
        const result = checkWriteSafety("package.json");
        expect(result).toBeTruthy();
        expect(result).toContain("protected");
    });

    it("should block outside paths", () => {
        const result = checkWriteSafety("/tmp/outside.ts");
        expect(result).toBeTruthy();
        expect(result).toContain("outside");
    });

    it("should allow normal project files", () => {
        expect(checkWriteSafety("src/tools/new-tool.ts")).toBeNull();
    });
});

describe("checkEditSafety", () => {
    it("should allow editing protected files (edit_file is fine)", () => {
        expect(checkEditSafety("package.json")).toBeNull();
    });

    it("should block editing outside project", () => {
        const result = checkEditSafety("/tmp/evil.ts");
        expect(result).toBeTruthy();
        expect(result).toContain("outside");
    });
});
