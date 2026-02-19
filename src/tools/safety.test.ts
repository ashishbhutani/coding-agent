/**
 * Tests for safety guardrails
 */

import { describe, it, expect } from "vitest";
import { isProtectedPath, isDangerousCommand, isProtectedDirectory } from "./safety.js";

describe("isProtectedPath", () => {
    it("should protect package.json", () => {
        expect(isProtectedPath("package.json")).toBe(true);
    });

    it("should protect tsconfig.json", () => {
        expect(isProtectedPath("tsconfig.json")).toBe(true);
    });

    it("should protect .gitignore", () => {
        expect(isProtectedPath(".gitignore")).toBe(true);
    });

    it("should allow normal source files", () => {
        expect(isProtectedPath("src/tools/new-tool.ts")).toBe(false);
    });

    it("should allow files outside project", () => {
        expect(isProtectedPath("/tmp/test.txt")).toBe(false);
    });
});

describe("isDangerousCommand", () => {
    it("should block rm -rf src", () => {
        expect(isDangerousCommand("rm -rf src")).toBeTruthy();
    });

    it("should block rm -rf with src anywhere", () => {
        expect(isDangerousCommand("rm -rf ./src")).toBeTruthy();
    });

    it("should block rm -f package.json", () => {
        expect(isDangerousCommand("rm -f package.json")).toBeTruthy();
    });

    it("should allow safe commands", () => {
        expect(isDangerousCommand("ls -la")).toBeNull();
        expect(isDangerousCommand("npm test")).toBeNull();
        expect(isDangerousCommand("git status")).toBeNull();
        expect(isDangerousCommand("echo hello")).toBeNull();
    });

    it("should allow rm on non-protected paths", () => {
        expect(isDangerousCommand("rm /tmp/test-file.txt")).toBeNull();
    });
});

describe("isProtectedDirectory", () => {
    it("should protect src/", () => {
        expect(isProtectedDirectory("src")).toBe(true);
    });

    it("should not protect subdirectories of src", () => {
        expect(isProtectedDirectory("src/tools")).toBe(false);
    });
});
