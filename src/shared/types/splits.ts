/**
 * Split Tab Types
 *
 * Defines the data structures for unlimited grid splits using a binary tree.
 * Each split creates exactly 2 panes (left/right or top/bottom).
 */

export type SplitDirection = 'horizontal' | 'vertical';

export type TabType = 'project' | 'todos' | 'kanban' | 'notes' | 'browser' | 'home' | 'picker';

export interface PaneContent {
  /** Type of content to display in this pane */
  type: TabType;
  /** For project tabs, the workspace directory */
  projectPath?: string;
  /** For browser tabs, the initial URL */
  url?: string;
}

export interface SplitLeafNode {
  kind: 'leaf';
  /** Unique identifier for this pane */
  id: string;
  /** Content to display in this pane */
  content: PaneContent;
  /** Optional per-pane state (scroll position, etc.) */
  state?: Record<string, unknown>;
}

export interface SplitBranchNode {
  kind: 'branch';
  /** Unique identifier for this split */
  id: string;
  /** Split direction: horizontal (top/bottom) or vertical (left/right) */
  direction: SplitDirection;
  /** Ratio for first child (0-1, e.g., 0.5 = 50/50 split) */
  ratio: number;
  /** First child (left or top) */
  first: SplitNode;
  /** Second child (right or bottom) */
  second: SplitNode;
}

export type SplitNode = SplitLeafNode | SplitBranchNode;

export interface SplitTree {
  /** Schema version for future migrations */
  version: 1;
  /** Root of the split tree */
  root: SplitNode;
  /** ID of currently active/focused pane */
  activePane?: string;
}

export interface PersistedWindowState {
  windowId: string;
  splitTree: SplitTree;
  lastModified: number;
}
