/** Serialized representation of a React fiber node in the component tree */
export interface FiberNode {
  /** Auto-assigned index for referencing this fiber */
  fiberIndex: number;
  /** Component display name or HTML tag */
  name: string;
  /** Fiber tag type: FunctionComponent, ClassComponent, HostComponent, etc. */
  type: string;
  /** React key prop */
  key: string | null;
  /** Depth in the tree (0 = root) */
  depth: number;
  /** Children fibers */
  children: FiberNode[];
}

/** Detailed component inspection result */
export interface ComponentInfo {
  fiberIndex: number;
  name: string;
  type: string;
  key: string | null;
  props: Record<string, unknown>;
  state: unknown;
  hooks: HookInfo[];
  context: Record<string, unknown>;
  parentName: string | null;
  childNames: string[];
  /** Source file location if available (dev builds only) */
  source: SourceLocation | null;
  renderedHostElement: string | null;
}

export interface HookInfo {
  /** Hook index in the component */
  index: number;
  /** Hook type: useState, useEffect, useMemo, useRef, etc. */
  type: string;
  /** Current value/state */
  value: unknown;
}

export interface SourceLocation {
  fileName: string;
  lineNumber: number;
  columnNumber: number;
}

export interface SearchResult {
  fiberIndex: number;
  name: string;
  type: string;
  depth: number;
  parentName: string | null;
  key: string | null;
}

export interface PageInfo {
  url: string;
  title: string;
  reactDetected: boolean;
  reactVersion: string | null;
  rootCount: number;
  hookAvailable: boolean;
}

export interface ProfilerEntry {
  componentName: string;
  renderCount: number;
  totalDuration: number;
  avgDuration: number;
}
