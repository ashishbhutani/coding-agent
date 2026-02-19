/**
 * Tests for edit_file, insert_lines, and delete_lines tools
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { editFileTool } from "./edit-file.js";
import { insertLinesTool } from "./insert-lines.js";
import { deleteLinesTool } from "./delete-lines.js";

const TEST_DIR = join(process.cwd(), ".test-sandbox-edit");
const TEST_FILE = join(TEST_DIR, "sample.ts");

const SAMPLE_CONTENT = `import { foo } from "bar";

function hello() {
    console.log("hello");
    console.log("world");
}

function goodbye() {
    return "bye";
}
`;

beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
});

afterAll(() => {
    if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true, force: true });
    }
});

beforeEach(() => {
    // Reset test file before each test
    writeFileSync(TEST_FILE, SAMPLE_CONTENT);
});

// ── edit_file: Search & Replace ────────────────────────

describe("edit_file — search & replace", () => {
    it("should replace exact text match", async () => {
        const result = await editFileTool.execute({
            path: TEST_FILE,
            old_text: 'console.log("hello");',
            new_text: 'console.log("hi there!");',
        });

        expect(result.isError).toBeUndefined();
        const content = readFileSync(TEST_FILE, "utf-8");
        expect(content).toContain('console.log("hi there!");');
        expect(content).not.toContain('console.log("hello");');
    });

    it("should replace multi-line text", async () => {
        const result = await editFileTool.execute({
            path: TEST_FILE,
            old_text: '    console.log("hello");\n    console.log("world");',
            new_text: '    console.log("replaced!");',
        });

        expect(result.isError).toBeUndefined();
        const content = readFileSync(TEST_FILE, "utf-8");
        expect(content).toContain('console.log("replaced!");');
        expect(content).not.toContain('console.log("hello");');
    });

    it("should fail when old_text not found", async () => {
        const result = await editFileTool.execute({
            path: TEST_FILE,
            old_text: "this text does not exist",
            new_text: "replacement",
        });

        expect(result.isError).toBe(true);
        expect(result.output).toContain("not found");
    });

    it("should fail when old_text matches multiple times", async () => {
        // "console.log" appears twice
        const result = await editFileTool.execute({
            path: TEST_FILE,
            old_text: "console.log",
            new_text: "console.warn",
        });

        expect(result.isError).toBe(true);
        expect(result.output).toContain("2 times");
    });

    it("should fail for non-existent file", async () => {
        const result = await editFileTool.execute({
            path: join(TEST_DIR, "nope.ts"),
            old_text: "x",
            new_text: "y",
        });

        expect(result.isError).toBe(true);
    });
});

// ── edit_file: Line Range Replace ──────────────────────

describe("edit_file — line range", () => {
    it("should replace a line range", async () => {
        const result = await editFileTool.execute({
            path: TEST_FILE,
            start_line: 4,
            end_line: 5,
            new_text: '    console.log("single line now");',
        });

        expect(result.isError).toBeUndefined();
        expect(result.output).toContain("-1 lines");
        const content = readFileSync(TEST_FILE, "utf-8");
        expect(content).toContain("single line now");
    });

    it("should replace a single line", async () => {
        const result = await editFileTool.execute({
            path: TEST_FILE,
            start_line: 1,
            end_line: 1,
            new_text: 'import { baz } from "qux";',
        });

        expect(result.isError).toBeUndefined();
        const content = readFileSync(TEST_FILE, "utf-8");
        expect(content).toContain('import { baz } from "qux";');
        expect(content).not.toContain('import { foo } from "bar";');
    });

    it("should fail for invalid line range", async () => {
        const result = await editFileTool.execute({
            path: TEST_FILE,
            start_line: 0,
            end_line: 5,
            new_text: "x",
        });

        expect(result.isError).toBe(true);
        expect(result.output).toContain("invalid line range");
    });

    it("should fail when neither mode params are provided", async () => {
        const result = await editFileTool.execute({
            path: TEST_FILE,
            new_text: "something",
        });

        expect(result.isError).toBe(true);
        expect(result.output).toContain("Must provide");
    });
});

// ── insert_lines ───────────────────────────────────────

describe("insert_lines", () => {
    it("should prepend content (line 0)", async () => {
        const result = await insertLinesTool.execute({
            path: TEST_FILE,
            line: 0,
            content: "// File header\n// Generated by agent",
        });

        expect(result.isError).toBeUndefined();
        const content = readFileSync(TEST_FILE, "utf-8");
        expect(content.startsWith("// File header\n")).toBe(true);
    });

    it("should append content (line -1)", async () => {
        const result = await insertLinesTool.execute({
            path: TEST_FILE,
            line: -1,
            content: "\n// End of file",
        });

        expect(result.isError).toBeUndefined();
        const content = readFileSync(TEST_FILE, "utf-8");
        expect(content).toContain("// End of file");
    });

    it("should insert before a specific line", async () => {
        const result = await insertLinesTool.execute({
            path: TEST_FILE,
            line: 3,
            content: "// This goes before function hello",
        });

        expect(result.isError).toBeUndefined();
        const lines = readFileSync(TEST_FILE, "utf-8").split("\n");
        expect(lines[2]).toBe("// This goes before function hello");
        expect(lines[3]).toBe("function hello() {");
    });

    it("should fail for out-of-range line", async () => {
        const result = await insertLinesTool.execute({
            path: TEST_FILE,
            line: 999,
            content: "nope",
        });

        expect(result.isError).toBe(true);
        expect(result.output).toContain("out of range");
    });
});

// ── delete_lines ───────────────────────────────────────

describe("delete_lines", () => {
    it("should delete a single line", async () => {
        const result = await deleteLinesTool.execute({
            path: TEST_FILE,
            start_line: 2,
            end_line: 2,
        });

        expect(result.isError).toBeUndefined();
        expect(result.output).toContain("1 line(s)");
        const content = readFileSync(TEST_FILE, "utf-8");
        // Line 2 was blank line after import — should be gone
        const lines = content.split("\n");
        expect(lines[1]).toBe("function hello() {");
    });

    it("should delete a range of lines", async () => {
        const result = await deleteLinesTool.execute({
            path: TEST_FILE,
            start_line: 3,
            end_line: 6,
        });

        expect(result.isError).toBeUndefined();
        expect(result.output).toContain("4 line(s)");
        const content = readFileSync(TEST_FILE, "utf-8");
        expect(content).not.toContain("function hello");
    });

    it("should fail for invalid range", async () => {
        const result = await deleteLinesTool.execute({
            path: TEST_FILE,
            start_line: 5,
            end_line: 3,
        });

        expect(result.isError).toBe(true);
        expect(result.output).toContain("invalid");
    });
});
