import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getPage } from "../lib/browser.js";
import { modifyState, inspectComponent } from "../lib/react-fiber.js";

export function registerStateTool(server: McpServer) {
  server.tool(
    "modify_state",
    "Modify a React component's state to trigger a re-render. Works with useState/useReducer hooks and class component setState.",
    {
      fiberIndex: z
        .number()
        .describe("Fiber index from get_component_tree or search_components"),
      hookIndex: z
        .number()
        .optional()
        .describe(
          "Index of the hook to modify (for function components, default: 0). Use inspect_component to see hook indices."
        ),
      value: z
        .any()
        .describe("New state value to set"),
    },
    async ({ fiberIndex, hookIndex, value }) => {
      try {
        const page = getPage();
        const result = await modifyState(
          page,
          fiberIndex,
          hookIndex ?? 0,
          value
        );

        if (!result.success) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Failed to modify state: ${result.error}`,
              },
            ],
            isError: true,
          };
        }

        // Re-inspect to show updated state
        const updated = await inspectComponent(page, fiberIndex);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  updatedComponent: updated,
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
            { type: "text" as const, text: `Error: ${error.message}` },
          ],
          isError: true,
        };
      }
    }
  );
}
