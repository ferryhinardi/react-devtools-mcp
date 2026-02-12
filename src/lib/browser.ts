import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { execSync, spawn, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import { platform } from "os";

let browser: Browser | null = null;
let activePage: Page | null = null;
let launchedProcess: ChildProcess | null = null;

// ─── Chrome path detection ───────────────────────────────────────────────────

const CHROME_PATHS: Record<string, string[]> = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
    "/usr/bin/microsoft-edge",
    "/usr/bin/brave-browser",
  ],
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA +
      "\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
  ],
};

/** Find the first existing Chrome/Chromium binary on this machine. */
export function findChromePath(): string | null {
  const os = platform();
  const candidates = CHROME_PATHS[os] ?? [];

  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }

  // Fallback: try `which` on unix
  if (os !== "win32") {
    for (const bin of ["google-chrome", "chromium", "chromium-browser"]) {
      try {
        const result = execSync(`which ${bin}`, { encoding: "utf-8" }).trim();
        if (result && existsSync(result)) return result;
      } catch {
        // not found, continue
      }
    }
  }

  return null;
}

// ─── Check if debugging port is already listening ────────────────────────────

async function isDebugPortOpen(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`);
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Launch Chrome with remote debugging ─────────────────────────────────────

export async function launchChrome(
  port: number = 9222
): Promise<{ launched: boolean; chromePath: string | null; error?: string }> {
  // Already listening?
  if (await isDebugPortOpen(port)) {
    return { launched: false, chromePath: null }; // already running
  }

  const chromePath = findChromePath();
  if (!chromePath) {
    return {
      launched: false,
      chromePath: null,
      error:
        "Chrome/Chromium not found. Searched:\n" +
        (CHROME_PATHS[platform()] ?? []).map((p) => `  - ${p}`).join("\n"),
    };
  }

  // Launch with a temp profile so it doesn't conflict with existing sessions
  const userDataDir = `/tmp/react-devtools-mcp-chrome-${port}`;
  launchedProcess = spawn(
    chromePath,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
    {
      detached: true,
      stdio: "ignore",
    }
  );
  launchedProcess.unref();

  // Wait for the debug port to become available (up to 10s)
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await isDebugPortOpen(port)) {
      return { launched: true, chromePath };
    }
  }

  return {
    launched: false,
    chromePath,
    error: `Chrome was spawned at ${chromePath} but debug port ${port} did not become available within 10s.`,
  };
}

// ─── Connect ─────────────────────────────────────────────────────────────────

/**
 * Connect to a Chrome instance running with --remote-debugging-port.
 * If autoLaunch is true and no debug port is found, launches Chrome automatically.
 * Returns the active page (first non-blank tab).
 */
export async function connect(
  port: number = 9222,
  autoLaunch: boolean = true
): Promise<{ page: Page; chromeLaunched: boolean; chromePath: string | null }> {
  if (browser) {
    try {
      await browser.version();
    } catch {
      browser = null;
      activePage = null;
    }
  }

  let chromeLaunched = false;
  let chromePath: string | null = null;

  if (!browser) {
    // Try connecting first
    const portOpen = await isDebugPortOpen(port);

    if (!portOpen && autoLaunch) {
      const result = await launchChrome(port);
      if (result.error) {
        throw new Error(result.error);
      }
      chromeLaunched = result.launched;
      chromePath = result.chromePath;
    } else if (!portOpen) {
      throw new Error(
        `No Chrome debug port found at ${port}. Launch Chrome with --remote-debugging-port=${port}`
      );
    }

    browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${port}`,
    });

    browser.on("disconnected", () => {
      browser = null;
      activePage = null;
    });
  }

  // Pick the first non-blank page
  const pages = await browser.pages();
  activePage =
    pages.find((p) => {
      const url = p.url();
      return url !== "about:blank" && url !== "chrome://newtab/";
    }) ?? pages[0] ?? null;

  if (!activePage) {
    throw new Error("No open pages found in Chrome. Open a page first.");
  }

  return { page: activePage, chromeLaunched, chromePath };
}

/** Returns the current active page or throws if not connected. */
export function getPage(): Page {
  if (!activePage) {
    throw new Error(
      "Not connected to Chrome. Call connect_to_browser tool first."
    );
  }
  return activePage;
}

/** Switch to a specific page by URL substring match. */
export async function switchPage(urlSubstring: string): Promise<Page> {
  if (!browser) {
    throw new Error(
      "Not connected to Chrome. Call connect_to_browser tool first."
    );
  }

  const pages = await browser.pages();
  const match = pages.find((p) =>
    p.url().toLowerCase().includes(urlSubstring.toLowerCase())
  );

  if (!match) {
    const urls = pages.map((p) => p.url()).join(", ");
    throw new Error(
      `No page matching "${urlSubstring}". Open pages: ${urls}`
    );
  }

  activePage = match;
  return activePage;
}

/** Disconnect from Chrome. */
export async function disconnect(): Promise<void> {
  if (browser) {
    browser.disconnect();
    browser = null;
    activePage = null;
  }
}

/** Check if currently connected. */
export function isConnected(): boolean {
  return browser !== null && activePage !== null;
}
