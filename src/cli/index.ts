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
import { createToolRegistry } from "../tools/index.js";
import { createProvider } from "../llm/index.js";
import { setConfirmationHandler } from "../tools/confirmation.js";

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
    console.log(chalk.gray("  /help     — Show this help"));
    console.log(chalk.gray("  /clear    — Clear conversation history"));
    console.log(chalk.gray("  /tools    — List available tools"));
    console.log(chalk.gray("  /exit     — Exit the agent"));
    console.log(chalk.gray("  /verbose  — Toggle verbose mode"));
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

    const agent = new Agent(provider, tools, { verbose });

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
            console.log(chalk.gray("\n👋 Goodbye!\n"));
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
            // Create new agent with updated config (keeping conversation)
            console.log(
                chalk.green(`  Verbose mode: ${verbose ? "ON" : "OFF"}`)
            );
            continue;
        }

        // Process message through agent
        try {
            console.log(chalk.gray("\n  🤔 Thinking...\n"));
            const response = await agent.processMessage(input);
            console.log(chalk.bold.green("\n🤖 Agent:"));
            console.log(response);
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
