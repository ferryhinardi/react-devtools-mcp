import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getPage } from "../lib/browser.js";
import { getComponentTree } from "../lib/react-fiber.js";

export function registerComponentTreeTool(server: McpServer) {
  server.tool(
    "get_component_tree",
    "Get the React component tree hierarchy. Returns component names, types, and fiber indices for further inspection.",
    {
      depth: z
        .number()
        .optional()
        .describe("Maximum tree depth to traverse (default: 20)"),
      includeHtml: z
        .boolean()
        .optional()
        .describe(
          "Include HTML host elements like div, span (default: false, only React components)"
        ),
    },
    async ({ depth, includeHtml }) => {
      try {
        const page = getPage();
        const tree = await getComponentTree(
          page,
          depth ?? 20,
          includeHtml ?? false
        );

        if (tree.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No React components found. Make sure the page has React running in development mode.",
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(tree, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            { type: "text" as const, text: `Error: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );
}
