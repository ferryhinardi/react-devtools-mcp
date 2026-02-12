import { describe, it, expect, vi, beforeEach } from "vitest";
import { FIBER_TAGS } from "../lib/react-fiber.js";

describe("FIBER_TAGS", () => {
  it("maps known fiber tag numbers to names", () => {
    expect(FIBER_TAGS[0]).toBe("FunctionComponent");
    expect(FIBER_TAGS[1]).toBe("ClassComponent");
    expect(FIBER_TAGS[3]).toBe("HostRoot");
    expect(FIBER_TAGS[5]).toBe("HostComponent");
    expect(FIBER_TAGS[6]).toBe("HostText");
    expect(FIBER_TAGS[7]).toBe("Fragment");
    expect(FIBER_TAGS[10]).toBe("ForwardRef");
    expect(FIBER_TAGS[11]).toBe("SimpleMemoComponent");
    expect(FIBER_TAGS[12]).toBe("MemoComponent");
    expect(FIBER_TAGS[13]).toBe("SuspenseComponent");
    expect(FIBER_TAGS[16]).toBe("ContextProvider");
  });

  it("includes all expected tags", () => {
    const tagCount = Object.keys(FIBER_TAGS).length;
    expect(tagCount).toBeGreaterThanOrEqual(12);
  });
});

describe("browser module", () => {
  it("getPage throws when not connected", async () => {
    const { getPage } = await import("../lib/browser.js");
    expect(() => getPage()).toThrow("Not connected to Chrome");
  });

  it("isConnected returns false initially", async () => {
    const { isConnected } = await import("../lib/browser.js");
    expect(isConnected()).toBe(false);
  });
});

describe("detectReact returns expected shape", () => {
  it("should call page.evaluate with a function", async () => {
    const { detectReact } = await import("../lib/react-fiber.js");

    const mockResult = {
      url: "http://localhost:3000",
      title: "Test App",
      reactDetected: true,
      reactVersion: "18.2.0",
      rootCount: 1,
      hookAvailable: true,
    };

    const mockPage = {
      evaluate: vi.fn().mockResolvedValue(mockResult),
    } as any;

    const result = await detectReact(mockPage);
    expect(result).toEqual(mockResult);
    expect(mockPage.evaluate).toHaveBeenCalledOnce();
  });
});

describe("getComponentTree", () => {
  it("passes maxDepth and includeHtml to page.evaluate", async () => {
    const { getComponentTree } = await import("../lib/react-fiber.js");

    const mockTree = [
      {
        fiberIndex: 0,
        name: "App",
        type: "FunctionComponent",
        key: null,
        depth: 0,
        children: [],
      },
    ];

    const mockPage = {
      evaluate: vi.fn().mockResolvedValue(mockTree),
    } as any;

    const result = await getComponentTree(mockPage, 10, true);
    expect(result).toEqual(mockTree);
    expect(mockPage.evaluate).toHaveBeenCalledWith(
      expect.any(Function),
      10,
      true
    );
  });
});

describe("searchComponents", () => {
  it("passes query and maxResults to page.evaluate", async () => {
    const { searchComponents } = await import("../lib/react-fiber.js");

    const mockResults = [
      {
        fiberIndex: 3,
        name: "Header",
        type: "FunctionComponent",
        depth: 1,
        parentName: "App",
        key: null,
      },
    ];

    const mockPage = {
      evaluate: vi.fn().mockResolvedValue(mockResults),
    } as any;

    const result = await searchComponents(mockPage, "Header", 5);
    expect(result).toEqual(mockResults);
    expect(mockPage.evaluate).toHaveBeenCalledWith(
      expect.any(Function),
      "Header",
      5
    );
  });
});

describe("inspectComponent", () => {
  it("passes fiberIndex to page.evaluate", async () => {
    const { inspectComponent } = await import("../lib/react-fiber.js");

    const mockInfo = {
      fiberIndex: 0,
      name: "App",
      type: "FunctionComponent",
      key: null,
      props: { title: "Test" },
      state: null,
      hooks: [{ index: 0, type: "useState", value: 42 }],
      context: {},
      parentName: null,
      childNames: ["Header", "Main"],
      source: null,
      renderedHostElement: "div",
    };

    const mockPage = {
      evaluate: vi.fn().mockResolvedValue(mockInfo),
    } as any;

    const result = await inspectComponent(mockPage, 0);
    expect(result).toEqual(mockInfo);
    expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), 0);
  });
});

describe("modifyState", () => {
  it("passes all args to page.evaluate", async () => {
    const { modifyState } = await import("../lib/react-fiber.js");

    const mockPage = {
      evaluate: vi.fn().mockResolvedValue({ success: true }),
    } as any;

    const result = await modifyState(mockPage, 5, 0, "new value");
    expect(result).toEqual({ success: true });
    expect(mockPage.evaluate).toHaveBeenCalledWith(
      expect.any(Function),
      5,
      0,
      "new value"
    );
  });
});
