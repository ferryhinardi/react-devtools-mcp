/**
 * JS snippets evaluated inside the browser via page.evaluate().
 * Each function is self-contained — no external dependencies.
 *
 * React Fiber Tag constants (React 18+):
 *   0  = FunctionComponent
 *   1  = ClassComponent
 *   2  = IndeterminateComponent
 *   3  = HostRoot
 *   5  = HostComponent (div, span, etc.)
 *   6  = HostText
 *   7  = Fragment
 *   10 = ForwardRef
 *   11 = SimpleMemoComponent
 *   12 = MemoComponent
 *   13 = SuspenseComponent
 *   15 = ContextConsumer
 *   16 = ContextProvider
 *   22 = OffscreenComponent
 */

import type { Page } from "puppeteer-core";
import type {
  FiberNode,
  ComponentInfo,
  SearchResult,
  PageInfo,
  HookInfo,
} from "./types.js";

// ─── Fiber tag enum (mirrors React internals) ───────────────────────────────

const FIBER_TAGS: Record<number, string> = {
  0: "FunctionComponent",
  1: "ClassComponent",
  2: "IndeterminateComponent",
  3: "HostRoot",
  5: "HostComponent",
  6: "HostText",
  7: "Fragment",
  8: "Mode",
  10: "ForwardRef",
  11: "SimpleMemoComponent",
  12: "MemoComponent",
  13: "SuspenseComponent",
  14: "ProfilerComponent",
  15: "ContextConsumer",
  16: "ContextProvider",
  22: "OffscreenComponent",
};

// ─── Page-level detection ────────────────────────────────────────────────────

export async function detectReact(page: Page): Promise<PageInfo> {
  return page.evaluate(() => {
    const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    const info: any = {
      url: window.location.href,
      title: document.title,
      reactDetected: false,
      reactVersion: null,
      rootCount: 0,
      hookAvailable: !!hook,
    };

    if (!hook) return info;

    // renderers is a Map<number, Renderer>
    const renderers = hook.renderers;
    if (renderers && renderers.size > 0) {
      info.reactDetected = true;
      const first = renderers.values().next().value;
      info.reactVersion = first?.version ?? first?.currentDispatcherRef ? "18+" : null;
    }

    // Count root fiber containers
    let rootCount = 0;
    if (hook.getFiberRoots) {
      for (const [, roots] of hook.getFiberRoots ? [[1, hook.getFiberRoots(1)]] : []) {
        if (roots) rootCount += roots.size;
      }
      // Try all renderer IDs
      if (renderers) {
        rootCount = 0;
        for (const [id] of renderers) {
          const roots = hook.getFiberRoots(id);
          if (roots) rootCount += roots.size;
        }
      }
    }
    info.rootCount = rootCount;

    return info;
  });
}

// ─── Component tree ──────────────────────────────────────────────────────────

export async function getComponentTree(
  page: Page,
  maxDepth: number = 20,
  includeHtml: boolean = false
): Promise<FiberNode[]> {
  return page.evaluate(
    (maxDepth: number, includeHtml: boolean) => {
      const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (!hook) return [];

      const TAGS: Record<number, string> = {
        0: "FunctionComponent", 1: "ClassComponent", 2: "IndeterminateComponent",
        3: "HostRoot", 5: "HostComponent", 6: "HostText", 7: "Fragment",
        8: "Mode", 10: "ForwardRef", 11: "SimpleMemoComponent",
        12: "MemoComponent", 13: "SuspenseComponent", 14: "ProfilerComponent",
        15: "ContextConsumer", 16: "ContextProvider", 22: "OffscreenComponent",
      };

      let index = 0;
      // Store fibers globally for later inspection by fiberIndex
      (window as any).__RDM_FIBERS__ = [];

      function getName(fiber: any): string {
        if (!fiber.type) return TAGS[fiber.tag] ?? `Unknown(${fiber.tag})`;
        if (typeof fiber.type === "string") return fiber.type;
        return (
          fiber.type.displayName ??
          fiber.type.name ??
          fiber.type.render?.displayName ??
          fiber.type.render?.name ??
          "Anonymous"
        );
      }

      function shouldInclude(fiber: any): boolean {
        // Always include components (tag 0, 1, 10, 11, 12, 13)
        if ([0, 1, 10, 11, 12, 13, 14, 16].includes(fiber.tag)) return true;
        // Include host elements if requested
        if (includeHtml && fiber.tag === 5) return true;
        // Skip HostRoot, HostText, Fragment, Mode, etc.
        return false;
      }

      function walkFiber(fiber: any, depth: number): any[] {
        const results: any[] = [];
        if (!fiber || depth > maxDepth) return results;

        if (shouldInclude(fiber)) {
          const fiberIndex = index++;
          (window as any).__RDM_FIBERS__[fiberIndex] = fiber;

          const node: any = {
            fiberIndex,
            name: getName(fiber),
            type: TAGS[fiber.tag] ?? `Tag(${fiber.tag})`,
            key: fiber.key ?? null,
            depth,
            children: [],
          };

          // Walk children
          let child = fiber.child;
          while (child) {
            node.children.push(...walkFiber(child, depth + 1));
            child = child.sibling;
          }

          results.push(node);
        } else {
          // Skip this node but walk children at same depth
          let child = fiber.child;
          while (child) {
            results.push(...walkFiber(child, depth));
            child = child.sibling;
          }
        }

        return results;
      }

      const trees: any[] = [];
      const renderers = hook.renderers;
      if (!renderers) return trees;

      for (const [id] of renderers) {
        const roots = hook.getFiberRoots?.(id);
        if (!roots) continue;
        for (const root of roots) {
          const fiber = root.current;
          if (fiber) {
            trees.push(...walkFiber(fiber, 0));
          }
        }
      }

      return trees;
    },
    maxDepth,
    includeHtml
  );
}

// ─── Component inspection ────────────────────────────────────────────────────

export async function inspectComponent(
  page: Page,
  fiberIndex: number
): Promise<ComponentInfo | null> {
  return page.evaluate((idx: number) => {
    const fibers = (window as any).__RDM_FIBERS__;
    if (!fibers || !fibers[idx]) return null;

    const fiber = fibers[idx];

    const TAGS: Record<number, string> = {
      0: "FunctionComponent", 1: "ClassComponent", 3: "HostRoot",
      5: "HostComponent", 7: "Fragment", 10: "ForwardRef",
      11: "SimpleMemoComponent", 12: "MemoComponent",
      13: "SuspenseComponent", 16: "ContextProvider",
    };

    function getName(f: any): string {
      if (!f.type) return TAGS[f.tag] ?? `Unknown(${f.tag})`;
      if (typeof f.type === "string") return f.type;
      return f.type.displayName ?? f.type.name ?? f.type.render?.displayName ?? f.type.render?.name ?? "Anonymous";
    }

    function safeSerialize(val: any, depth: number = 0): any {
      if (depth > 3) return "[max depth]";
      if (val === null || val === undefined) return val;
      if (typeof val === "function") return `[Function: ${val.name || "anonymous"}]`;
      if (typeof val === "symbol") return val.toString();
      if (val instanceof HTMLElement) return `[${val.tagName.toLowerCase()}.${val.className}]`;
      if (typeof val !== "object") return val;
      if (Array.isArray(val)) return val.slice(0, 10).map((v) => safeSerialize(v, depth + 1));
      // React element
      if (val.$$typeof) return `[ReactElement: ${val.type?.displayName ?? val.type?.name ?? val.type ?? "unknown"}]`;

      const result: Record<string, any> = {};
      const keys = Object.keys(val).slice(0, 20);
      for (const k of keys) {
        try {
          result[k] = safeSerialize(val[k], depth + 1);
        } catch {
          result[k] = "[unserializable]";
        }
      }
      return result;
    }

    // Extract hooks from memoizedState linked list (function components)
    function extractHooks(fiber: any): any[] {
      const hooks: any[] = [];
      if (fiber.tag !== 0 && fiber.tag !== 10 && fiber.tag !== 11) return hooks;

      let state = fiber.memoizedState;
      let i = 0;
      while (state) {
        const hook: any = { index: i };

        // Determine hook type from queue shape
        if (state.queue !== null && state.queue !== undefined) {
          // useState or useReducer
          hook.type = state.queue.lastRenderedReducer?.name === "basicStateReducer" ? "useState" : "useReducer";
          hook.value = safeSerialize(state.memoizedState);
        } else if (state.memoizedState && typeof state.memoizedState === "object" && "destroy" in state.memoizedState) {
          hook.type = "useEffect";
          hook.value = state.memoizedState.deps ? safeSerialize(state.memoizedState.deps) : null;
        } else if (state.memoizedState && typeof state.memoizedState === "object" && "current" in state.memoizedState) {
          hook.type = "useRef";
          hook.value = safeSerialize(state.memoizedState.current);
        } else if (Array.isArray(state.memoizedState) && state.memoizedState.length === 2) {
          hook.type = "useMemo/useCallback";
          hook.value = safeSerialize(state.memoizedState[0]);
        } else {
          hook.type = "unknown";
          hook.value = safeSerialize(state.memoizedState);
        }

        hooks.push(hook);
        state = state.next;
        i++;
      }
      return hooks;
    }

    // Extract class component state
    function extractClassState(fiber: any): any {
      if (fiber.tag === 1 && fiber.stateNode) {
        return safeSerialize(fiber.stateNode.state);
      }
      return null;
    }

    // Collect child names
    const childNames: string[] = [];
    let child = fiber.child;
    while (child) {
      childNames.push(getName(child));
      child = child.sibling;
    }

    // Find rendered host element
    let renderedHostElement: string | null = null;
    let current = fiber;
    while (current) {
      if (current.tag === 5 && current.stateNode) {
        renderedHostElement = current.stateNode.tagName?.toLowerCase() ?? null;
        break;
      }
      current = current.child;
    }

    // Source location
    let source = null;
    if (fiber._debugSource) {
      source = {
        fileName: fiber._debugSource.fileName,
        lineNumber: fiber._debugSource.lineNumber,
        columnNumber: fiber._debugSource.columnNumber ?? 0,
      };
    }

    return {
      fiberIndex: idx,
      name: getName(fiber),
      type: TAGS[fiber.tag] ?? `Tag(${fiber.tag})`,
      key: fiber.key ?? null,
      props: safeSerialize(fiber.memoizedProps ?? fiber.pendingProps ?? {}),
      state: fiber.tag === 1 ? extractClassState(fiber) : safeSerialize(fiber.memoizedState),
      hooks: extractHooks(fiber),
      context: safeSerialize(fiber._debugOwner ? { owner: getName(fiber._debugOwner) } : {}),
      parentName: fiber.return ? getName(fiber.return) : null,
      childNames,
      source,
      renderedHostElement,
    };
  }, fiberIndex);
}

// ─── Search components ───────────────────────────────────────────────────────

export async function searchComponents(
  page: Page,
  query: string,
  maxResults: number = 20
): Promise<SearchResult[]> {
  return page.evaluate(
    (query: string, maxResults: number) => {
      const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (!hook) return [];

      const TAGS: Record<number, string> = {
        0: "FunctionComponent", 1: "ClassComponent", 5: "HostComponent",
        10: "ForwardRef", 11: "SimpleMemoComponent", 12: "MemoComponent",
        13: "SuspenseComponent", 16: "ContextProvider",
      };

      function getName(f: any): string {
        if (!f.type) return TAGS[f.tag] ?? `Unknown(${f.tag})`;
        if (typeof f.type === "string") return f.type;
        return f.type.displayName ?? f.type.name ?? f.type.render?.displayName ?? f.type.render?.name ?? "Anonymous";
      }

      const lowerQuery = query.toLowerCase();
      const results: any[] = [];
      let index = 0;

      // Ensure fibers array exists
      if (!(window as any).__RDM_FIBERS__) {
        (window as any).__RDM_FIBERS__ = [];
      }

      function search(fiber: any, depth: number, parentName: string | null) {
        if (!fiber || results.length >= maxResults) return;

        const name = getName(fiber);
        const fiberIndex = index++;
        (window as any).__RDM_FIBERS__[fiberIndex] = fiber;

        if (name.toLowerCase().includes(lowerQuery)) {
          results.push({
            fiberIndex,
            name,
            type: TAGS[fiber.tag] ?? `Tag(${fiber.tag})`,
            depth,
            parentName,
            key: fiber.key ?? null,
          });
        }

        let child = fiber.child;
        while (child && results.length < maxResults) {
          search(child, depth + 1, name);
          child = child.sibling;
        }
      }

      const renderers = hook.renderers;
      if (!renderers) return results;

      for (const [id] of renderers) {
        const roots = hook.getFiberRoots?.(id);
        if (!roots) continue;
        for (const root of roots) {
          if (root.current) search(root.current, 0, null);
        }
      }

      return results;
    },
    query,
    maxResults
  );
}

// ─── Modify state ────────────────────────────────────────────────────────────

export async function modifyState(
  page: Page,
  fiberIndex: number,
  hookIndex: number,
  newValue: unknown
): Promise<{ success: boolean; error?: string }> {
  return page.evaluate(
    (idx: number, hookIdx: number, value: any) => {
      const fibers = (window as any).__RDM_FIBERS__;
      if (!fibers || !fibers[idx]) {
        return { success: false, error: "Fiber not found. Run get_component_tree first." };
      }

      const fiber = fibers[idx];

      // Class component
      if (fiber.tag === 1 && fiber.stateNode && typeof fiber.stateNode.setState === "function") {
        try {
          fiber.stateNode.setState(value);
          return { success: true };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }

      // Function component — walk memoizedState linked list to hookIdx
      if (fiber.tag === 0 || fiber.tag === 10 || fiber.tag === 11) {
        let state = fiber.memoizedState;
        let i = 0;
        while (state && i < hookIdx) {
          state = state.next;
          i++;
        }

        if (!state) {
          return { success: false, error: `Hook at index ${hookIdx} not found.` };
        }

        if (state.queue && typeof state.queue.dispatch === "function") {
          try {
            state.queue.dispatch(value);
            return { success: true };
          } catch (e: any) {
            return { success: false, error: e.message };
          }
        }

        return { success: false, error: "Hook does not have a dispatch function (not useState/useReducer)." };
      }

      return { success: false, error: "Component is not a class or function component." };
    },
    fiberIndex,
    hookIndex,
    newValue
  );
}

// ─── Profiler ────────────────────────────────────────────────────────────────

export async function startProfiler(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).__RDM_PROFILER_DATA__ = {};
    const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook) return;

    // Patch the onCommitFiberRoot to track renders
    const original = hook.onCommitFiberRoot;
    hook.__rdm_original_onCommitFiberRoot = original;

    hook.onCommitFiberRoot = function (id: number, root: any, ...rest: any[]) {
      const data = (window as any).__RDM_PROFILER_DATA__;
      const now = performance.now();

      function walk(fiber: any) {
        if (!fiber) return;
        // Only track components (tag 0 = Function, 1 = Class)
        if ((fiber.tag === 0 || fiber.tag === 1) && fiber.alternate) {
          const name =
            fiber.type?.displayName ?? fiber.type?.name ?? "Anonymous";
          if (!data[name]) data[name] = { renderCount: 0, totalDuration: 0 };
          data[name].renderCount++;
          // actualDuration available on Profiler fibers
          if (fiber.actualDuration) {
            data[name].totalDuration += fiber.actualDuration;
          }
        }
        let child = fiber.child;
        while (child) {
          walk(child);
          child = child.sibling;
        }
      }

      walk(root.current);

      if (typeof original === "function") {
        return original.call(this, id, root, ...rest);
      }
    };
  });
}

export async function stopProfiler(
  page: Page
): Promise<
  Array<{
    componentName: string;
    renderCount: number;
    totalDuration: number;
    avgDuration: number;
  }>
> {
  return page.evaluate(() => {
    const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (hook && hook.__rdm_original_onCommitFiberRoot) {
      hook.onCommitFiberRoot = hook.__rdm_original_onCommitFiberRoot;
      delete hook.__rdm_original_onCommitFiberRoot;
    }

    const data = (window as any).__RDM_PROFILER_DATA__ ?? {};
    const results: any[] = [];

    for (const [name, entry] of Object.entries(data) as any) {
      results.push({
        componentName: name,
        renderCount: entry.renderCount,
        totalDuration: Math.round(entry.totalDuration * 100) / 100,
        avgDuration:
          entry.renderCount > 0
            ? Math.round((entry.totalDuration / entry.renderCount) * 100) / 100
            : 0,
      });
    }

    // Sort by render count descending
    results.sort((a, b) => b.renderCount - a.renderCount);
    delete (window as any).__RDM_PROFILER_DATA__;

    return results;
  });
}

export { FIBER_TAGS };
