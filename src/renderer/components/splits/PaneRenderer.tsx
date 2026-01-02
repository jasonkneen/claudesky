/**
 * Pane Renderer
 *
 * Renders content for a single pane based on its type.
 * Routes to appropriate page component (Chat, Todos, Kanban, etc.)
 */

import { useState } from 'react';

import type { SplitLeafNode } from '../../../shared/types/splits';
import Settings from '../../pages/Settings';
import { useSplitContext } from '../../contexts/SplitContext';

// Lazy load page components
import Browser from '../../pages/Browser';
import Chat from '../../pages/Chat';
import Kanban from '../../pages/Kanban';
import Notes from '../../pages/Notes';
import Todos from '../../pages/Todos';

import PanePicker from './PanePicker';

interface PaneRendererProps {
  pane: SplitLeafNode;
}

export default function PaneRenderer({ pane }: PaneRendererProps) {
  const { setActivePane, activePane, closePane, tree } = useSplitContext();
  const [showSettings, setShowSettings] = useState(false);
  const isActive = activePane === pane.id;

  const handleClick = () => {
    setActivePane(pane.id);
  };

  const openSettings = () => {
    setShowSettings(true);
  };

  const closeSettings = () => {
    setShowSettings(false);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    closePane(pane.id);
  };

  // Check if this is the only pane (can't close)
  const isOnlyPane = tree.root.kind === 'leaf';

  // Determine content to render
  let content: React.ReactNode;

  if (pane.content.type === 'picker' || pane.content.type === 'home') {
    // Show picker for user to choose content
    content = <PanePicker paneId={pane.id} />;
  } else {
    // Render actual content based on type
    // Special handling for Chat - needs paneId prop
    if (pane.content.type === 'project') {
      content = (
        <>
          {/* Settings overlay */}
          {showSettings && (
            <div className="absolute inset-0 z-50 bg-white dark:bg-neutral-900">
              <Settings onBack={closeSettings} />
            </div>
          )}

          {/* Chat with paneId for session isolation - relative container for absolute ChatInput */}
          <div className={`pane-content relative h-full w-full overflow-hidden ${showSettings ? 'hidden' : 'block'}`}>
            <Chat key={pane.id} paneId={pane.id} onOpenSettings={openSettings} />
          </div>
        </>
      );
    } else {
      // Other content types don't need paneId
      let ContentComponent: React.ComponentType<{ onOpenSettings: () => void }>;

      switch (pane.content.type) {
        case 'todos':
          ContentComponent = Todos;
          break;
        case 'kanban':
          ContentComponent = Kanban;
          break;
        case 'notes':
          ContentComponent = Notes;
          break;
        case 'browser':
          ContentComponent = Browser;
          break;
        default:
          ContentComponent = Todos;
      }

      content = (
        <>
          {/* Settings overlay */}
          {showSettings && (
            <div className="absolute inset-0 z-50 bg-white dark:bg-neutral-900">
              <Settings onBack={closeSettings} />
            </div>
          )}

          {/* Main content */}
          <div className={`pane-content relative h-full w-full overflow-hidden ${showSettings ? 'hidden' : 'block'}`}>
            <ContentComponent key={pane.id} onOpenSettings={openSettings} />
          </div>
        </>
      );
    }
  }

  return (
    <div
      className={`group relative h-full w-full overflow-hidden ${
        isActive ?
          'ring-2 ring-blue-500/80 ring-inset'
        : 'ring-1 ring-neutral-200/50 ring-inset dark:ring-neutral-700/50'
      } transition-all duration-150`}
      onClick={handleClick}
    >
      {/* Close button - macOS style, appears on hover */}
      {!isOnlyPane && (
        <button
          onClick={handleClose}
          className="absolute right-1.5 top-1.5 z-50 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-400/80 text-[10px] font-bold leading-none text-white opacity-0 transition-all hover:bg-red-500 group-hover:opacity-100 dark:bg-neutral-600/80"
        >
          ×
        </button>
      )}

      {content}
    </div>
  );
}
