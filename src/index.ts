import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerConnectTool } from "./tools/connect.js";
import { registerComponentTreeTool } from "./tools/component-tree.js";
import { registerInspectTool } from "./tools/inspect.js";
import { registerSearchTool } from "./tools/search.js";
import { registerProfilerTools } from "./tools/profiler.js";
import { registerStateTool } from "./tools/state.js";
import { registerPageInfoTool } from "./tools/page-info.js";

const server = new McpServer({
  name: "react-devtools-mcp",
  version: "1.0.0",
});

// Register all tools
registerConnectTool(server);
registerComponentTreeTool(server);
registerInspectTool(server);
registerSearchTool(server);
registerProfilerTools(server);
registerStateTool(server);
registerPageInfoTool(server);

// Start stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
