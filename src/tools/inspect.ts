import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getPage } from "../lib/browser.js";
import { inspectComponent, searchComponents } from "../lib/react-fiber.js";

export function registerInspectTool(server: McpServer) {
  server.tool(
    "inspect_component",
    "Inspect a specific React component's props, state, hooks, and context. Use fiberIndex from get_component_tree or componentName to find it.",
    {
      fiberIndex: z
        .number()
        .optional()
        .describe("Fiber index from get_component_tree result"),
      componentName: z
        .string()
        .optional()
        .describe(
          "Component name to search for (used if fiberIndex not provided)"
        ),
      instanceIndex: z
        .number()
        .optional()
        .describe(
          "If multiple components match the name, pick the Nth one (0-based, default: 0)"
        ),
    },
    async ({ fiberIndex, componentName, instanceIndex }) => {
      try {
        const page = getPage();

        let targetIndex = fiberIndex;

        // If no fiberIndex, search by name
        if (targetIndex === undefined && componentName) {
          const results = await searchComponents(page, componentName, 10);
          if (results.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `No component matching "${componentName}" found.`,
                },
              ],
            };
          }
          const idx = instanceIndex ?? 0;
          if (idx >= results.length) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Only ${results.length} instances found for "${componentName}". Use instanceIndex 0-${results.length - 1}.`,
                },
              ],
            };
          }
          targetIndex = results[idx].fiberIndex;
        }

        if (targetIndex === undefined) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Provide either fiberIndex or componentName.",
              },
            ],
            isError: true,
          };
        }

        const info = await inspectComponent(page, targetIndex);
        if (!info) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Fiber at index ${targetIndex} not found. Run get_component_tree first to populate fiber references.`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(info, null, 2),
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
