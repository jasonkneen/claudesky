/**
 * Split Layout
 *
 * Top-level component for rendering split tree.
 * Recursively renders nodes as either panes or split containers.
 */

import { useEffect, useState } from 'react';

import type { SplitNode } from '../../../shared/types/splits';
import TitleBar from '../TitleBar';
import { useSplitContext } from '../../contexts/SplitContext';
import { findFirstLeafId } from '../../../shared/utils/split-utils';

import PaneRenderer from './PaneRenderer';
import SplitContainer from './SplitContainer';

export default function SplitLayout() {
  const { tree, splitPane, closePane, activePane, projectName } = useSplitContext();
  const [openSettings, setOpenSettings] = useState(false);

  // Keyboard shortcuts:
  // Cmd+D - Split vertically (like iTerm2)
  // Cmd+Shift+D - Split horizontally
  // Cmd+W - Close active pane
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+D - Split
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();

        // Split the ACTIVE pane, or first pane if none active
        const paneToSplit = activePane || findFirstLeafId(tree.root);

        // Split direction based on Shift key
        const direction = e.shiftKey ? 'horizontal' : 'vertical';

        // New pane shows picker so user can choose what to open
        splitPane(paneToSplit, direction, { type: 'picker' });
      }

      // Cmd+W - Close active pane (only if multiple panes exist)
      if ((e.metaKey || e.ctrlKey) && e.key === 'w' && tree.root.kind === 'branch') {
        e.preventDefault();

        if (activePane) {
          closePane(activePane);
        } else {
          // No active pane, close first leaf
          const firstLeafId = findFirstLeafId(tree.root);
          closePane(firstLeafId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tree, splitPane, closePane, activePane]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col">
      <TitleBar onOpenSettings={() => setOpenSettings(!openSettings)} projectName={projectName} />
      <div className="flex-1 overflow-hidden pt-[48px]">
        <SplitNode node={tree.root} />
      </div>
    </div>
  );
}

interface SplitNodeProps {
  node: SplitNode;
}

function SplitNode({ node }: SplitNodeProps) {
  if (node.kind === 'leaf') {
    return <PaneRenderer pane={node} />;
  }

  // Branch: render split container with resizable divider
  return (
    <SplitContainer
      direction={node.direction}
      ratio={node.ratio}
      branchId={node.id}
      first={<SplitNode node={node.first} />}
      second={<SplitNode node={node.second} />}
    />
  );
}
