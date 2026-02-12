import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { connect, findChromePath } from "../lib/browser.js";
import { detectReact } from "../lib/react-fiber.js";

export function registerConnectTool(server: McpServer) {
  server.tool(
    "connect_to_browser",
    "Connect to a running Chrome instance with remote debugging enabled. If Chrome is not running with a debug port, it will auto-detect Chrome's install path and launch a new instance. Must be called before other tools.",
    {
      port: z
        .number()
        .optional()
        .describe(
          "Chrome remote debugging port (default: 9222)"
        ),
      autoLaunch: z
        .boolean()
        .optional()
        .describe(
          "Auto-launch Chrome with remote debugging if not already running (default: true)"
        ),
    },
    async ({ port, autoLaunch }) => {
      try {
        const { page, chromeLaunched, chromePath } = await connect(
          port ?? 9222,
          autoLaunch ?? true
        );
        const info = await detectReact(page);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  connected: true,
                  chromeLaunched,
                  chromePath: chromePath ?? findChromePath(),
                  ...info,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        // Provide helpful diagnostics
        const detected = findChromePath();
        const diagLines = [
          `Failed to connect: ${error.message}`,
          "",
          `Chrome detected at: ${detected ?? "NOT FOUND"}`,
        ];

        if (detected) {
          diagLines.push(
            "",
            "You can manually launch Chrome with remote debugging:",
            `  "${detected}" --remote-debugging-port=${port ?? 9222} --user-data-dir=/tmp/chrome-debug`
          );
        } else {
          diagLines.push(
            "",
            "No Chrome/Chromium installation found.",
            "Install Chrome or set a custom path."
          );
        }

        return {
          content: [
            {
              type: "text" as const,
              text: diagLines.join("\n"),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
