/**
 * Tests for read_file, write_file, list_dir, grep_search, and run_command tools
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readFileTool } from "./read-file.js";
import { writeFileTool } from "./write-file.js";
import { listDirTool } from "./list-dir.js";
import { grepSearchTool } from "./grep-search.js";
import { runCommandTool } from "./run-command.js";

const TEST_DIR = join(process.cwd(), ".test-sandbox");

beforeAll(() => {
    // Create test sandbox
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, "subdir"), { recursive: true });

    writeFileSync(join(TEST_DIR, "hello.txt"), "Hello World\nLine 2\nLine 3\n");
    writeFileSync(join(TEST_DIR, "code.ts"), 'const x = 42;\nfunction greet() {\n  return "hi";\n}\n');
    writeFileSync(join(TEST_DIR, "subdir", "nested.txt"), "Nested file content\n");
});

afterAll(() => {
    // Clean up test sandbox
    if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true, force: true });
    }
});

// ── read_file ──────────────────────────────────────────

describe("read_file", () => {
    it("should read an entire file with line numbers", async () => {
        const result = await readFileTool.execute({
            path: join(TEST_DIR, "hello.txt"),
        });

        expect(result.isError).toBeUndefined();
        expect(result.output).toContain("Hello World");
        expect(result.output).toContain("1:");
        expect(result.output).toContain("Line 2");
    });

    it("should read a line range", async () => {
        const result = await readFileTool.execute({
            path: join(TEST_DIR, "hello.txt"),
            start_line: 2,
            end_line: 3,
        });

        expect(result.output).toContain("2: Line 2");
        expect(result.output).toContain("3: Line 3");
        expect(result.output).not.toContain("1: Hello");
    });

    it("should return error for non-existent file", async () => {
        const result = await readFileTool.execute({
            path: join(TEST_DIR, "nope.txt"),
        });

        expect(result.isError).toBe(true);
        expect(result.output).toContain("Error");
    });

    it("should return error for a directory", async () => {
        const result = await readFileTool.execute({
            path: TEST_DIR,
        });

        expect(result.isError).toBe(true);
        expect(result.output).toContain("not a file");
    });
});

// ── write_file ─────────────────────────────────────────

describe("write_file", () => {
    it("should create a new file", async () => {
        const target = join(TEST_DIR, "new-file.txt");
        const result = await writeFileTool.execute({
            path: target,
            content: "New content\nSecond line",
        });

        expect(result.isError).toBeUndefined();
        expect(result.output).toContain("2 lines");
        expect(existsSync(target)).toBe(true);
    });

    it("should create parent directories", async () => {
        const target = join(TEST_DIR, "deep", "nested", "file.txt");
        const result = await writeFileTool.execute({
            path: target,
            content: "Deep content",
        });

        expect(result.isError).toBeUndefined();
        expect(existsSync(target)).toBe(true);
    });

    it("should overwrite existing file", async () => {
        const target = join(TEST_DIR, "overwrite-me.txt");
        await writeFileTool.execute({ path: target, content: "original" });
        await writeFileTool.execute({ path: target, content: "replaced" });

        const read = await readFileTool.execute({ path: target });
        expect(read.output).toContain("replaced");
        expect(read.output).not.toContain("original");
    });
});

// ── list_dir ───────────────────────────────────────────

describe("list_dir", () => {
    it("should list directory contents", async () => {
        const result = await listDirTool.execute({ path: TEST_DIR });

        expect(result.isError).toBeUndefined();
        expect(result.output).toContain("hello.txt");
        expect(result.output).toContain("subdir/");
    });

    it("should show directories before files", async () => {
        const result = await listDirTool.execute({ path: TEST_DIR });
        const lines = result.output.split("\n");

        const subdirLine = lines.findIndex((l) => l.includes("subdir/"));
        const helloLine = lines.findIndex((l) => l.includes("hello.txt"));
        expect(subdirLine).toBeLessThan(helloLine);
    });

    it("should return error for non-existent directory", async () => {
        const result = await listDirTool.execute({
            path: join(TEST_DIR, "nonexistent"),
        });

        expect(result.isError).toBe(true);
    });
});

// ── grep_search ────────────────────────────────────────

describe("grep_search", () => {
    it("should find literal text matches", async () => {
        const result = await grepSearchTool.execute({
            pattern: "Hello World",
            path: TEST_DIR,
        });

        expect(result.isError).toBeUndefined();
        expect(result.output).toContain("hello.txt");
        expect(result.output).toContain("Hello World");
    });

    it("should find matches across multiple files", async () => {
        const result = await grepSearchTool.execute({
            pattern: "content",
            path: TEST_DIR,
            case_insensitive: true,
        });

        // Both nested.txt ("Nested file content") and new files may match
        expect(result.output).toContain("match");
    });

    it("should support regex search", async () => {
        const result = await grepSearchTool.execute({
            pattern: "function\\s+\\w+",
            path: TEST_DIR,
            is_regex: true,
        });

        expect(result.output).toContain("code.ts");
        expect(result.output).toContain("greet");
    });

    it("should return no matches message", async () => {
        const result = await grepSearchTool.execute({
            pattern: "ZZZZZZNOTFOUNDZZZZZ",
            path: TEST_DIR,
        });

        expect(result.output).toContain("No matches");
    });
});

// ── run_command ────────────────────────────────────────

describe("run_command", () => {
    it("should execute a simple command", async () => {
        const result = await runCommandTool.execute({
            command: "echo 'hello from test'",
        });

        expect(result.isError).toBeUndefined();
        expect(result.output).toContain("hello from test");
    });

    it("should capture stderr on failure", async () => {
        const result = await runCommandTool.execute({
            command: "ls /nonexistent_directory_xyz",
        });

        expect(result.isError).toBe(true);
        expect(result.output).toContain("No such file or directory");
    });

    it("should respect working directory", async () => {
        const result = await runCommandTool.execute({
            command: "ls hello.txt",
            cwd: TEST_DIR,
        });

        expect(result.isError).toBeUndefined();
        expect(result.output).toContain("hello.txt");
    });

    it("should timeout long commands", async () => {
        const result = await runCommandTool.execute({
            command: "sleep 10",
            timeout_ms: 500,
        });

        expect(result.isError).toBe(true);
        expect(result.output).toContain("timed out");
        expect(result.output).toContain("timeout_ms");
    });

    it("should handle no-output commands", async () => {
        const result = await runCommandTool.execute({
            command: "true",
        });

        expect(result.isError).toBeUndefined();
        expect(result.output).toContain("no output");
    });
});
