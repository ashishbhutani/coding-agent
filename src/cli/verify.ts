/**
 * Quick verification script — tests that all modules load and tools work.
 */

import { createToolRegistry } from "../tools/index.js";
import { createProvider } from "../llm/index.js";
import { Agent } from "../agent/agent.js";

async function main() {
    console.log("=== Phase 0 Verification ===\n");

    // 1. Tool Registry
    const tools = createToolRegistry();
    console.log("✅ Tools registered:", tools.listNames().join(", "));
    console.log("✅ Tool definitions count:", tools.getDefinitions().length);

    // 2. Test list_dir
    const listResult = await tools.execute("list_dir", { path: "." });
    console.log("\n--- list_dir test ---");
    console.log(listResult.isError ? "❌" : "✅", "list_dir:", listResult.output.split("\n").slice(0, 5).join("\n"));

    // 3. Test read_file
    const readResult = await tools.execute("read_file", {
        path: "package.json",
        start_line: 1,
        end_line: 5,
    });
    console.log("\n--- read_file test ---");
    console.log(readResult.isError ? "❌" : "✅", "read_file:", readResult.output.split("\n").slice(0, 3).join("\n"));

    // 4. Test grep_search
    const grepResult = await tools.execute("grep_search", {
        pattern: "Agent",
        path: "src",
    });
    console.log("\n--- grep_search test ---");
    console.log(grepResult.isError ? "❌" : "✅", "grep_search:", grepResult.output.split("\n").slice(0, 4).join("\n"));

    // 5. Test write_file
    const writeResult = await tools.execute("write_file", {
        path: "/tmp/agent-test-output.txt",
        content: "Hello from the coding agent!\nLine 2\nLine 3",
    });
    console.log("\n--- write_file test ---");
    console.log(writeResult.isError ? "❌" : "✅", "write_file:", writeResult.output);

    // 6. Test run_command
    const cmdResult = await tools.execute("run_command", {
        command: "echo 'Hello from run_command' && node --version",
    });
    console.log("\n--- run_command test ---");
    console.log(cmdResult.isError ? "❌" : "✅", "run_command:", cmdResult.output);

    // 7. Test LLM provider creation (without making API call)
    try {
        const provider = createProvider("gemini", {
            apiKey: "test-key",
            model: "gemini-2.5-pro",
        });
        console.log("\n✅ Gemini provider created:", provider.name, provider.model);
    } catch (e) {
        console.log("\n❌ Provider creation failed:", e);
    }

    // 8. Test Agent creation
    try {
        const provider = createProvider("gemini", {
            apiKey: "test-key",
            model: "gemini-2.5-pro",
        });
        const agent = new Agent(provider, tools);
        console.log("✅ Agent created, conversation length:", agent.getConversationLength());
    } catch (e) {
        console.log("❌ Agent creation failed:", e);
    }

    console.log("\n=== All verifications complete! ===");
}

main().catch((err) => {
    console.error("❌ Verification failed:", err);
    process.exit(1);
});
