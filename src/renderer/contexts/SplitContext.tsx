/**
 * Split Context
 *
 * Manages split tree state in the renderer process.
 * Provides methods to split, close, and update panes.
 */

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

import type { PaneContent, SplitDirection, SplitTree } from '../../shared/types/splits';
import {
  closePane,
  createDefaultTree,
  splitPane,
  updatePaneContent,
  updateRatio
} from '../../shared/utils/split-utils';

interface SplitContextType {
  /** Current split tree */
  tree: SplitTree;
  /** ID of currently active pane */
  activePane: string | undefined;
  /** Window ID for this renderer */
  windowId: string;
  /** Current project name */
  projectName?: string;

  // Mutations
  /** Split a pane into two */
  splitPane: (paneId: string, direction: SplitDirection, newContent: PaneContent) => void;
  /** Close a pane */
  closePane: (paneId: string) => void;
  /** Update content of a pane */
  updatePaneContent: (paneId: string, content: PaneContent) => void;
  /** Set active pane */
  setActivePane: (paneId: string) => void;
  /** Update split ratio */
  updateRatio: (branchId: string, newRatio: number) => void;
  /** Reset to single pane */
  resetToSingle: (content: PaneContent) => void;
}

const SplitContext = createContext<SplitContextType | undefined>(undefined);

export function useSplitContext(): SplitContextType {
  const context = useContext(SplitContext);
  if (!context) {
    throw new Error('useSplitContext must be used within SplitProvider');
  }
  return context;
}

interface SplitProviderProps {
  children: ReactNode;
  initialContent?: PaneContent;
  projectName?: string;
}

export function SplitProvider({ children, initialContent, projectName }: SplitProviderProps) {
  console.log('[SplitProvider] ========== INITIALIZING ==========');
  console.log('[SplitProvider] initialContent:', JSON.stringify(initialContent));
  console.log('[SplitProvider] projectName:', projectName);
  const [windowId, setWindowId] = useState<string>('');
  const [tree, setTree] = useState<SplitTree>(() => {
    console.log('[SplitProvider] Creating default tree with content:', JSON.stringify(initialContent));
    const defaultTree = createDefaultTree(initialContent);
    console.log('[SplitProvider] Tree created, root content:', JSON.stringify(defaultTree.root.kind === 'leaf' ? defaultTree.root.content : 'branch'));
    // Auto-focus first pane
    return {
      ...defaultTree,
      activePane: defaultTree.root.kind === 'leaf' ? defaultTree.root.id : undefined
    };
  });

  // Load window ID on mount
  useEffect(() => {
    window.electron.window.getId().then(({ windowId: id }) => {
      setWindowId(id);
      console.log(`[SplitContext] Window ID: ${id} - Starting fresh (persistence disabled)`);
    });
  }, []);

  // Persistence disabled for MVP - split layouts are ephemeral (reset on new tab)
  // TODO Phase 5: Add "Save Layout" / "Restore Layout" feature with explicit user control

  const contextValue: SplitContextType = {
    tree,
    activePane: tree.activePane,
    windowId,
    projectName,

    splitPane: (paneId: string, direction: SplitDirection, newContent: PaneContent) => {
      setTree((prev) => splitPane(prev, paneId, direction, newContent));
    },

    closePane: (paneId: string) => {
      setTree((prev) => closePane(prev, paneId));
    },

    updatePaneContent: (paneId: string, content: PaneContent) => {
      setTree((prev) => updatePaneContent(prev, paneId, content));
    },

    setActivePane: (paneId: string) => {
      setTree((prev) => ({ ...prev, activePane: paneId }));
    },

    updateRatio: (branchId: string, newRatio: number) => {
      setTree((prev) => updateRatio(prev, branchId, newRatio));
    },

    resetToSingle: (content: PaneContent) => {
      setTree(createDefaultTree(content));
    }
  };

  return <SplitContext.Provider value={contextValue}>{children}</SplitContext.Provider>;
}
