/**
 * SessionStore
 *
 * Saves and loads agent session state to/from a JSON file in the
 * current working directory (.agent-session.json).
 *
 * Enables the agent to resume context after a restart without the
 * user re-explaining what they were working on.
 */

import { readFile, writeFile, unlink, access } from "node:fs/promises";
import { join } from "node:path";
import { cwd } from "node:process";

export const SESSION_FILE = ".agent-session.json";
export const SESSION_VERSION = 1;

export interface SessionData {
    version: typeof SESSION_VERSION;
    timestamp: string;
    workingDir: string;
    gitCommit: string | null;
    summary: string;
    lastUserMessage: string;
}

export class SessionStore {
    private filePath: string;

    constructor(dir?: string) {
        this.filePath = join(dir ?? cwd(), SESSION_FILE);
    }

    /**
     * Save session data to disk.
     */
    async save(data: Omit<SessionData, "version" | "timestamp">): Promise<void> {
        const session: SessionData = {
            version: SESSION_VERSION,
            timestamp: new Date().toISOString(),
            ...data,
        };
        await writeFile(this.filePath, JSON.stringify(session, null, 2), "utf-8");
    }

    /**
     * Load session data from disk. Returns null if no session exists or is invalid.
     */
    async load(): Promise<SessionData | null> {
        try {
            await access(this.filePath);
        } catch {
            return null; // file doesn't exist
        }

        try {
            const raw = await readFile(this.filePath, "utf-8");
            const data = JSON.parse(raw) as SessionData;

            if (data.version !== SESSION_VERSION || !data.summary || !data.timestamp) {
                return null; // stale or corrupt
            }

            return data;
        } catch {
            return null;
        }
    }

    /**
     * Delete the session file.
     */
    async clear(): Promise<void> {
        try {
            await unlink(this.filePath);
        } catch {
            // ignore — file may not exist
        }
    }

    /**
     * Check if a session file exists.
     */
    async exists(): Promise<boolean> {
        try {
            await access(this.filePath);
            return true;
        } catch {
            return false;
        }
    }

    getFilePath(): string {
        return this.filePath;
    }
}
