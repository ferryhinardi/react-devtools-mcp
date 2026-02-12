import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getPage } from "../lib/browser.js";
import { searchComponents } from "../lib/react-fiber.js";

export function registerSearchTool(server: McpServer) {
  server.tool(
    "search_components",
    "Search for React components by name (case-insensitive partial match). Returns matching components with their fiber indices.",
    {
      query: z.string().describe("Component name to search for"),
      maxResults: z
        .number()
        .optional()
        .describe("Maximum number of results (default: 20)"),
    },
    async ({ query, maxResults }) => {
      try {
        const page = getPage();
        const results = await searchComponents(
          page,
          query,
          maxResults ?? 20
        );

        if (results.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No components matching "${query}" found.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(results, null, 2),
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
