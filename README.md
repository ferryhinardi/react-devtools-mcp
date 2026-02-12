# react-devtools-mcp

MCP (Model Context Protocol) server for React DevTools — inspect component trees, props, state, hooks, and profile renders via AI agents.

## How It Works

```
[AI Agent / Warp] <--stdio--> [MCP Server] <--CDP/WebSocket--> [Chrome + React App]
```

The server uses `puppeteer-core` (~2MB, no bundled browser) to connect to an existing Chrome instance via the Chrome DevTools Protocol (CDP). It then accesses React's internal fiber tree through `__REACT_DEVTOOLS_GLOBAL_HOOK__` to extract component information.

## Prerequisites

1. **Node.js ≥ 20**
2. **Chrome, Chromium, Edge, or Brave** installed (auto-detected)
3. **React app running in development mode** (production builds strip fiber debug info)

> **Note:** You do **not** need to manually launch Chrome with `--remote-debugging-port`. The MCP auto-detects your browser installation and launches a debug instance automatically when you call `connect_to_browser`. A temporary profile is used so it won't affect your existing sessions.
>
> If you prefer manual control, you can still launch Chrome yourself:
> ```bash
> # macOS
> /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
>
> # Linux
> google-chrome --remote-debugging-port=9222
>
> # Windows
> "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
> ```

## Installation

### From npm

```bash
npm install -g @ferryhinardi/react-devtools-mcp
```

### From source

```bash
git clone https://github.com/ferryhinardi/react-devtools-mcp.git
cd react-devtools-mcp
npm install
npm run build
```

## Configuration

### Warp

Add to your MCP configuration:

```json
{
  "name": "react-devtools-mcp",
  "command": "react-devtools-mcp"
}
```

Or if installed from source:

```json
{
  "name": "react-devtools-mcp",
  "command": "node",
  "args": ["/path/to/react-devtools-mcp/dist/index.js"]
}
```

### OpenCode

Add to `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "react-devtools": {
      "type": "local",
      "command": ["node", "/path/to/react-devtools-mcp/dist/index.js"],
      "enabled": true
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "react-devtools": {
      "command": "react-devtools-mcp"
    }
  }
}
```

## Available Tools

### `connect_to_browser`
Connect to Chrome. Auto-detects installation and launches with remote debugging if needed. Must be called first.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `port` | number | 9222 | Chrome remote debugging port |
| `autoLaunch` | boolean | true | Auto-launch Chrome if no debug port is found |

### `get_component_tree`
Get the **React component tree** (not the HTML DOM tree). Only React components are returned by default — use `includeHtml: true` to also include host elements like `div`, `span`.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `depth` | number | 20 | Maximum tree depth |
| `includeHtml` | boolean | false | Include HTML elements (div, span) |

### `inspect_component`
Deep-inspect a component's props, state, hooks, context, and source location.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fiberIndex` | number | Fiber index from tree/search results |
| `componentName` | string | Component name (alternative to fiberIndex) |
| `instanceIndex` | number | Nth instance if multiple matches (default: 0) |

### `search_components`
Search for components by name (case-insensitive partial match).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | — | Search query |
| `maxResults` | number | 20 | Maximum results |

### `get_page_info`
Get page URL, title, React version, and hook availability.

### `start_profiler`
Start profiling component renders. Hooks into React's commit cycle.

### `stop_profiler`
Stop profiling and return render statistics (render count, total/avg duration per component).

### `modify_state`
Modify a component's state to trigger a re-render.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fiberIndex` | number | Fiber index of target component |
| `hookIndex` | number | Hook index for function components (default: 0) |
| `value` | any | New state value |

## Example Usage

```
> connect_to_browser
✓ Connected to http://localhost:3000 — React 18.2.0 detected

> get_component_tree { depth: 3 }
[
  { fiberIndex: 0, name: "App", type: "FunctionComponent", children: [
    { fiberIndex: 1, name: "Header", ... },
    { fiberIndex: 5, name: "TodoList", ... }
  ]}
]

> inspect_component { componentName: "TodoList" }
{
  name: "TodoList",
  props: { items: [...] },
  hooks: [
    { index: 0, type: "useState", value: [...] },
    { index: 1, type: "useEffect", value: null }
  ],
  ...
}

> start_profiler
Profiler started.

> stop_profiler
[
  { componentName: "TodoItem", renderCount: 12, totalDuration: 3.45, avgDuration: 0.29 },
  { componentName: "TodoList", renderCount: 3, totalDuration: 1.2, avgDuration: 0.4 }
]
```

## Browser Auto-Detection

The MCP searches for browsers in this order:

**macOS:** Google Chrome → Chrome Canary → Chromium → Microsoft Edge → Brave

**Linux:** google-chrome → chromium → chromium-browser (snap) → Microsoft Edge → Brave

**Windows:** Chrome (Program Files) → Chrome (x86) → Chrome (AppData) → Edge → Brave

If none are found, it falls back to `which google-chrome` / `which chromium` on unix systems.

## Limitations

- **Dev mode only**: Production React builds strip fiber debug info. The app must be running in development mode.
- **Single browser**: Connects to one Chrome instance at a time.
- **Fiber indices are ephemeral**: They reset when you call `get_component_tree` or `search_components` again.
- **React 16.8+**: Requires React with hooks support (fiber architecture).

## License

MIT
