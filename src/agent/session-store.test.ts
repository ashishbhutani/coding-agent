/**
 * Tests for SessionStore
 */

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SessionStore, SESSION_VERSION } from "./session-store.js";

function makeTempDir(): string {
    return mkdtempSync(join(tmpdir(), "session-test-"));
}

describe("SessionStore", () => {
    let tempDir: string;

    afterEach(() => {
        if (tempDir) {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it("should return null when no session file exists", async () => {
        tempDir = makeTempDir();
        const store = new SessionStore(tempDir);
        const result = await store.load();
        expect(result).toBeNull();
    });

    it("should save and load a session", async () => {
        tempDir = makeTempDir();
        const store = new SessionStore(tempDir);

        await store.save({
            workingDir: "/some/project",
            gitCommit: "abc1234",
            summary: "User asked to scaffold a Spring AI project. Created pom.xml.",
            lastUserMessage: "scaffold a spring AI project",
        });

        const loaded = await store.load();
        expect(loaded).not.toBeNull();
        expect(loaded!.version).toBe(SESSION_VERSION);
        expect(loaded!.workingDir).toBe("/some/project");
        expect(loaded!.gitCommit).toBe("abc1234");
        expect(loaded!.summary).toContain("Spring AI");
        expect(loaded!.lastUserMessage).toBe("scaffold a spring AI project");
        expect(loaded!.timestamp).toBeTruthy();
    });

    it("should report exists() correctly", async () => {
        tempDir = makeTempDir();
        const store = new SessionStore(tempDir);

        expect(await store.exists()).toBe(false);

        await store.save({
            workingDir: "/x",
            gitCommit: null,
            summary: "test",
            lastUserMessage: "test",
        });

        expect(await store.exists()).toBe(true);
    });

    it("should clear the session file", async () => {
        tempDir = makeTempDir();
        const store = new SessionStore(tempDir);

        await store.save({
            workingDir: "/x",
            gitCommit: null,
            summary: "test",
            lastUserMessage: "test",
        });

        expect(await store.exists()).toBe(true);
        await store.clear();
        expect(await store.exists()).toBe(false);
    });

    it("should return null for corrupt session file", async () => {
        tempDir = makeTempDir();
        const store = new SessionStore(tempDir);

        // Write corrupt JSON
        const { writeFile } = await import("node:fs/promises");
        await writeFile(store.getFilePath(), "{ not valid json }", "utf-8");

        const result = await store.load();
        expect(result).toBeNull();
    });

    it("should return null for session with wrong version", async () => {
        tempDir = makeTempDir();
        const store = new SessionStore(tempDir);

        const { writeFile } = await import("node:fs/promises");
        await writeFile(
            store.getFilePath(),
            JSON.stringify({ version: 99, summary: "old", timestamp: "x" }),
            "utf-8"
        );

        const result = await store.load();
        expect(result).toBeNull();
    });

    it("should clear non-existent file without error", async () => {
        tempDir = makeTempDir();
        const store = new SessionStore(tempDir);
        await expect(store.clear()).resolves.not.toThrow();
    });

    it("should overwrite existing session on save", async () => {
        tempDir = makeTempDir();
        const store = new SessionStore(tempDir);

        await store.save({
            workingDir: "/a",
            gitCommit: "old",
            summary: "first session",
            lastUserMessage: "first",
        });

        await store.save({
            workingDir: "/b",
            gitCommit: "new",
            summary: "second session",
            lastUserMessage: "second",
        });

        const loaded = await store.load();
        expect(loaded!.summary).toBe("second session");
        expect(loaded!.gitCommit).toBe("new");
    });
});
