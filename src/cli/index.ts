#!/usr/bin/env node

/**
 * Coding Agent — CLI Entry Point
 *
 * Interactive REPL for the coding agent.
 * Usage: npm run dev
 */

import { config } from "dotenv";
import chalk from "chalk";
import readlineSync from "readline-sync";
import { Agent } from "../agent/agent.js";
import { Summarizer } from "../agent/summarizer.js";
import { createToolRegistry } from "../tools/index.js";
import { createProvider } from "../llm/index.js";
import { setConfirmationHandler } from "../tools/confirmation.js";
import { execFile } from "node:child_process";

// Load environment variables
config();

// Register CLI confirmation handler — prompts the user for dangerous operations
setConfirmationHandler((prompt: string): boolean => {
    console.log(chalk.yellow(`\n${prompt}`));
    const answer = readlineSync.question(
        chalk.bold.yellow("   Allow? [y/N] ")
    );
    const approved = answer.trim().toLowerCase() === "y";
    if (approved) {
        console.log(chalk.green("   ✅ Approved by user."));
    } else {
        console.log(chalk.red("   ❌ Denied by user."));
    }
    return approved;
});

function printBanner(): void {
    console.log(
        chalk.bold.cyan(`
╔═══════════════════════════════════════════╗
║         🤖 Coding Agent v0.1.0           ║
║     Your AI-powered coding assistant      ║
╚═══════════════════════════════════════════╝
`)
    );
}

function printHelp(): void {
    console.log(chalk.yellow("Commands:"));
    console.log(chalk.gray("  /help            — Show this help"));
    console.log(chalk.gray("  /clear           — Clear conversation history"));
    console.log(chalk.gray("  /tools           — List available tools"));
    console.log(chalk.gray("  /cost            — Show session cost breakdown"));
    console.log(chalk.gray("  /cost reset      — Reset cost tracking"));
    console.log(chalk.gray("  /session         — Show previous session summary"));
    console.log(chalk.gray("  /session clear   — Delete saved session"));
    console.log(chalk.gray("  /exit            — Exit the agent"));
    console.log(chalk.gray("  /verbose         — Toggle verbose mode"));
    console.log();
}

async function main(): Promise<void> {
    printBanner();

    // Validate configuration
    const providerName = process.env.LLM_PROVIDER || "gemini";
    const model = process.env.LLM_MODEL || "gemini-2.5-pro";

    const apiKeyMap: Record<string, string> = {
        gemini: "GEMINI_API_KEY",
        anthropic: "ANTHROPIC_API_KEY",
        openai: "OPENAI_API_KEY",
    };

    const apiKeyEnv = apiKeyMap[providerName];
    const apiKey = apiKeyEnv ? process.env[apiKeyEnv] : undefined;

    if (!apiKey || apiKey.includes("your_") || apiKey.includes("YOUR_")) {
        console.error(
            chalk.red(
                `\n❌ Missing API key. Set ${apiKeyEnv} in your .env file.\n` +
                `   Copy .env.example to .env and fill in your key.\n`
            )
        );
        process.exit(1);
    }

    // Initialize components
    console.log(
        chalk.gray(`  Provider: ${providerName} | Model: ${model}\n`)
    );

    const provider = createProvider(providerName, {
        apiKey,
        model,
    });

    const tools = createToolRegistry();
    let verbose = true;

    const summarizer = new Summarizer(apiKey);
    const agent = new Agent(provider, tools, { verbose }, summarizer);

    // ── Session restore ──────────────────────────────────────────────────────
    const session = await agent.sessionStore.load();
    if (session) {
        // Verify against current git state
        const gitLog = await new Promise<string>((resolve) => {
            execFile("git", ["log", "--oneline", "-5"], (err, stdout) =>
                resolve(err ? "(no git history)" : stdout.trim())
            );
        });

        agent.injectSessionContext(session.summary, session.timestamp, gitLog);

        console.log(
            chalk.cyan(
                `\n  📂 Previous session restored (${new Date(session.timestamp).toLocaleString()})`
            )
        );
        console.log(chalk.gray(`     ${session.summary.slice(0, 120)}...`));
        console.log();
    }

    // ── SIGINT (Ctrl+C) — save session before exiting ───────────────────────
    process.on("SIGINT", async () => {
        console.log(chalk.gray("\n\n  💾 Saving session..."));
        await agent.saveSession();
        console.log(chalk.gray("  👋 Goodbye!\n"));
        process.exit(0);
    });

    console.log(
        chalk.green("  ✅ Agent ready. Type your request or /help for commands.\n")
    );

    // REPL loop
    while (true) {
        const input = readlineSync.question(chalk.bold.blue("\n🧑 You: "), {
            keepWhitespace: true,
        });

        if (!input.trim()) continue;

        const trimmed = input.trim().toLowerCase();

        // Handle commands
        if (trimmed === "/exit" || trimmed === "/quit") {
            console.log(chalk.gray("\n  💾 Saving session..."));
            await agent.saveSession();
            console.log(chalk.gray("  👋 Goodbye!\n"));
            break;
        }

        if (trimmed === "/help") {
            printHelp();
            continue;
        }

        if (trimmed === "/clear") {
            agent.resetConversation();
            console.log(chalk.green("  ✅ Conversation cleared."));
            continue;
        }

        if (trimmed === "/tools") {
            const toolNames = tools.listNames();
            console.log(chalk.yellow("\n  Available tools:"));
            for (const name of toolNames) {
                const tool = tools.get(name);
                console.log(
                    chalk.gray(`    • ${name} — ${tool?.definition.description?.slice(0, 80)}...`)
                );
            }
            continue;
        }

        if (trimmed === "/verbose") {
            verbose = !verbose;
            console.log(
                chalk.green(`  Verbose mode: ${verbose ? "ON" : "OFF"}`)
            );
            continue;
        }

        if (trimmed === "/cost reset") {
            agent.resetCost();
            console.log(chalk.green("  ✅ Cost tracking reset."));
            continue;
        }

        if (trimmed === "/cost") {
            console.log(chalk.yellow(`\n${agent.getCostDetails()}`));
            continue;
        }

        if (trimmed === "/session clear") {
            await agent.sessionStore.clear();
            console.log(chalk.green("  ✅ Session cleared."));
            continue;
        }

        if (trimmed === "/session") {
            const s = await agent.sessionStore.load();
            if (!s) {
                console.log(chalk.gray("  No saved session found."));
            } else {
                console.log(chalk.yellow(`\n  📂 Last session: ${new Date(s.timestamp).toLocaleString()}`));
                console.log(chalk.gray(`  Working dir: ${s.workingDir}`));
                console.log(chalk.gray(`  Git commit:  ${s.gitCommit ?? "unknown"}`));
                console.log(chalk.gray(`  Summary:\n    ${s.summary}`));
            }
            continue;
        }

        // Process message through agent
        try {
            console.log(chalk.gray("\n  🤔 Thinking...\n"));
            const response = await agent.processMessage(input);
            console.log(chalk.bold.green("\n🤖 Agent:"));
            console.log(response);
            console.log(chalk.gray(`\n  💰 ${agent.getCostSummary()}`));
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error(chalk.red(`\n  ❌ Error: ${msg}`));

            if (msg.includes("API")) {
                console.error(
                    chalk.yellow("  💡 Check your API key and internet connection.")
                );
            }
        }
    }
}

main().catch((err) => {
    console.error(chalk.red("Fatal error:"), err);
    process.exit(1);
});
