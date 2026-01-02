/**
 * Split Tree Utilities
 *
 * Pure functions for manipulating split trees.
 * All operations return new tree (immutable).
 */

import type {
  PaneContent,
  SplitDirection,
  SplitLeafNode,
  SplitNode,
  SplitTree
} from '../types/splits';

/**
 * Create a default single-pane tree
 */
export function createDefaultTree(content?: PaneContent): SplitTree {
  const defaultContent: PaneContent = content || { type: 'home' };

  return {
    version: 1,
    root: {
      kind: 'leaf',
      id: generateId(),
      content: defaultContent
    },
    activePane: undefined
  };
}

/**
 * Generate unique ID for nodes
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Split a pane into two panes
 *
 * @param tree Current split tree
 * @param targetPaneId ID of pane to split
 * @param direction Split orientation
 * @param newContent Content for the new pane
 * @returns New tree with split applied
 */
export function splitPane(
  tree: SplitTree,
  targetPaneId: string,
  direction: SplitDirection,
  newContent: PaneContent
): SplitTree {
  const newPaneId = generateId();
  const branchId = generateId();

  const transformNode = (node: SplitNode): SplitNode => {
    if (node.kind === 'leaf' && node.id === targetPaneId) {
      // Replace leaf with branch containing old leaf + new leaf
      return {
        kind: 'branch',
        id: branchId,
        direction,
        ratio: 0.5, // Default 50/50 split
        first: node, // Keep existing pane
        second: {
          kind: 'leaf',
          id: newPaneId,
          content: newContent
        }
      };
    }

    if (node.kind === 'branch') {
      return {
        ...node,
        first: transformNode(node.first),
        second: transformNode(node.second)
      };
    }

    return node;
  };

  return {
    ...tree,
    root: transformNode(tree.root),
    activePane: newPaneId
  };
}

/**
 * Close a pane and collapse tree
 *
 * @param tree Current split tree
 * @param targetPaneId ID of pane to close
 * @returns New tree with pane removed
 */
export function closePane(tree: SplitTree, targetPaneId: string): SplitTree {
  // Special case: closing last pane = reset to default
  if (tree.root.kind === 'leaf' && tree.root.id === targetPaneId) {
    return createDefaultTree();
  }

  const transformNode = (node: SplitNode): SplitNode | null => {
    if (node.kind === 'branch') {
      // Check if one of the children is the target leaf
      if (node.first.kind === 'leaf' && node.first.id === targetPaneId) {
        return node.second; // Promote sibling
      }
      if (node.second.kind === 'leaf' && node.second.id === targetPaneId) {
        return node.first; // Promote sibling
      }

      // Recursively transform children
      const newFirst = transformNode(node.first);
      const newSecond = transformNode(node.second);

      if (!newFirst) return newSecond;
      if (!newSecond) return newFirst;

      return {
        ...node,
        first: newFirst,
        second: newSecond
      };
    }

    return node;
  };

  const newRoot = transformNode(tree.root);

  if (!newRoot) {
    return createDefaultTree();
  }

  return {
    ...tree,
    root: newRoot,
    activePane: tree.activePane === targetPaneId ? findFirstLeafId(newRoot) : tree.activePane
  };
}

/**
 * Update split ratio for a branch node
 *
 * @param tree Current split tree
 * @param branchId ID of branch to update
 * @param newRatio New ratio (clamped to 0.1-0.9)
 * @returns New tree with ratio updated
 */
export function updateRatio(tree: SplitTree, branchId: string, newRatio: number): SplitTree {
  const clampedRatio = Math.max(0.1, Math.min(0.9, newRatio));

  const transformNode = (node: SplitNode): SplitNode => {
    if (node.kind === 'branch' && node.id === branchId) {
      return { ...node, ratio: clampedRatio };
    }

    if (node.kind === 'branch') {
      return {
        ...node,
        first: transformNode(node.first),
        second: transformNode(node.second)
      };
    }

    return node;
  };

  return {
    ...tree,
    root: transformNode(tree.root)
  };
}

/**
 * Update content of a pane
 *
 * @param tree Current split tree
 * @param paneId ID of pane to update
 * @param newContent New content
 * @returns New tree with content updated
 */
export function updatePaneContent(
  tree: SplitTree,
  paneId: string,
  newContent: PaneContent
): SplitTree {
  const transformNode = (node: SplitNode): SplitNode => {
    if (node.kind === 'leaf' && node.id === paneId) {
      return { ...node, content: newContent };
    }

    if (node.kind === 'branch') {
      return {
        ...node,
        first: transformNode(node.first),
        second: transformNode(node.second)
      };
    }

    return node;
  };

  return {
    ...tree,
    root: transformNode(tree.root)
  };
}

/**
 * Find ID of first leaf node in tree
 */
export function findFirstLeafId(node: SplitNode): string {
  if (node.kind === 'leaf') return node.id;
  return findFirstLeafId(node.first);
}

/**
 * Find all leaf nodes in tree
 */
export function findAllLeaves(node: SplitNode): SplitLeafNode[] {
  if (node.kind === 'leaf') return [node];

  return [...findAllLeaves(node.first), ...findAllLeaves(node.second)];
}

/**
 * Count total panes in tree
 */
export function countPanes(node: SplitNode): number {
  if (node.kind === 'leaf') return 1;
  return countPanes(node.first) + countPanes(node.second);
}

/**
 * Validate split tree structure
 *
 * @throws Error if tree is invalid
 */
export function validateSplitNode(node: SplitNode): void {
  if (node.kind === 'leaf') {
    if (!node.id || !node.content?.type) {
      throw new Error('Invalid leaf node: missing id or content.type');
    }
  } else if (node.kind === 'branch') {
    if (!node.id || !node.direction) {
      throw new Error('Invalid branch node: missing id or direction');
    }
    if (typeof node.ratio !== 'number' || node.ratio < 0 || node.ratio > 1) {
      throw new Error('Invalid ratio: must be number between 0 and 1');
    }
    if (!node.first || !node.second) {
      throw new Error('Invalid branch node: missing children');
    }
    validateSplitNode(node.first);
    validateSplitNode(node.second);
  } else {
    throw new Error('Unknown node kind');
  }
}

/**
 * Serialize split tree to JSON string
 */
export function serializeSplitTree(tree: SplitTree): string {
  return JSON.stringify(tree, null, 2);
}

/**
 * Deserialize and validate split tree from JSON string
 *
 * @throws Error if JSON is invalid or tree structure is invalid
 */
export function deserializeSplitTree(json: string): SplitTree {
  const parsed = JSON.parse(json);

  if (parsed.version !== 1) {
    throw new Error(`Unsupported split tree version: ${parsed.version}`);
  }

  validateSplitNode(parsed.root);

  return parsed as SplitTree;
}

/**
 * Check if tree has any splits (more than 1 pane)
 */
export function hasSplits(tree: SplitTree): boolean {
  return tree.root.kind === 'branch';
}

/**
 * Find pane by ID
 */
export function findPane(node: SplitNode, paneId: string): SplitLeafNode | null {
  if (node.kind === 'leaf') {
    return node.id === paneId ? node : null;
  }

  return findPane(node.first, paneId) || findPane(node.second, paneId);
}
