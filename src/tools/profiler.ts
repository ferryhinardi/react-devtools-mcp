import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getPage } from "../lib/browser.js";
import { startProfiler, stopProfiler } from "../lib/react-fiber.js";

export function registerProfilerTools(server: McpServer) {
  server.tool(
    "start_profiler",
    "Start profiling React component renders. Hooks into React's commit cycle to track render counts and durations. Call stop_profiler to get results.",
    {},
    async () => {
      try {
        const page = getPage();
        await startProfiler(page);
        return {
          content: [
            {
              type: "text" as const,
              text: "Profiler started. Interact with the app, then call stop_profiler to see results.",
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

  server.tool(
    "stop_profiler",
    "Stop profiling and return render statistics for each component (render count, total duration, average duration).",
    {},
    async () => {
      try {
        const page = getPage();
        const results = await stopProfiler(page);

        if (results.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No renders captured. Make sure you started the profiler and interacted with the app.",
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
