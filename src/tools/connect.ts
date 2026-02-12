import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { connect } from "../lib/browser.js";
import { detectReact } from "../lib/react-fiber.js";

export function registerConnectTool(server: McpServer) {
  server.tool(
    "connect_to_browser",
    "Connect to a running Chrome instance with remote debugging enabled. Must be called before other tools.",
    {
      port: z
        .number()
        .optional()
        .describe(
          "Chrome remote debugging port (default: 9222). Launch Chrome with --remote-debugging-port=9222"
        ),
    },
    async ({ port }) => {
      try {
        const page = await connect(port ?? 9222);
        const info = await detectReact(page);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  connected: true,
                  ...info,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to connect: ${error.message}\n\nMake sure Chrome is running with:\n  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=${port ?? 9222}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
