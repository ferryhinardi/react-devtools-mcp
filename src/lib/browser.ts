import puppeteer, { type Browser, type Page } from "puppeteer-core";

let browser: Browser | null = null;
let activePage: Page | null = null;

/**
 * Connect to a Chrome instance running with --remote-debugging-port.
 * Returns the active page (first non-blank tab).
 */
export async function connect(port: number = 9222): Promise<Page> {
  if (browser) {
    try {
      // Check if still connected
      await browser.version();
    } catch {
      browser = null;
      activePage = null;
    }
  }

  if (!browser) {
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

  return activePage;
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
