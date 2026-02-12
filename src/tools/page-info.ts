import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getPage } from "../lib/browser.js";
import { detectReact } from "../lib/react-fiber.js";

export function registerPageInfoTool(server: McpServer) {
  server.tool(
    "get_page_info",
    "Get current page information including URL, title, React version, and whether React DevTools hook is available.",
    {},
    async () => {
      try {
        const page = getPage();
        const info = await detectReact(page);

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
