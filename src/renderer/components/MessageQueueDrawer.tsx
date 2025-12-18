import { ChevronDown, Edit2, Send, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { QueuedMessage } from '@/types/chat';

const HEADER_HEIGHT = 40;
const ITEM_HEIGHT = 32;
const MAX_VISIBLE_ITEMS = 5;
const BOTTOM_PADDING = 20;

interface MessageQueueDrawerProps {
  messages: QueuedMessage[];
  onSendImmediate: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onEdit: (messageId: string, newText: string) => void;
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export default function MessageQueueDrawer({
  messages,
  onSendImmediate,
  onDelete,
  onEdit
}: MessageQueueDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const isOpen = messages.length > 0;

  useEffect(() => {
    if (!isOpen) {
      setIsExpanded(false);
    }
  }, [isOpen]);

  const handleEdit = (messageId: string, text: string) => {
    setEditingId(messageId);
    setEditText(text);
  };

  const handleSaveEdit = (messageId: string) => {
    if (editText.trim()) {
      onEdit(messageId, editText.trim());
      setEditingId(null);
      setEditText('');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditText('');
  };

  const itemCount = Math.min(messages.length, MAX_VISIBLE_ITEMS);
  const expandedHeight = HEADER_HEIGHT + itemCount * ITEM_HEIGHT + BOTTOM_PADDING;
  const drawerHeight =
    isOpen ?
      isExpanded ? expandedHeight
      : HEADER_HEIGHT
    : 0;

  return (
    <div
      className="overflow-hidden rounded-t-2xl border border-b-0 border-neutral-700 bg-black transition-all duration-300 ease-out"
      style={{
        height: `${drawerHeight}px`,
        opacity: isOpen ? 1 : 0
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-4 text-sm font-medium text-white transition-colors hover:text-neutral-200"
        style={{ height: `${HEADER_HEIGHT}px` }}
      >
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
        />
        <span>
          {messages.length} prompt{messages.length !== 1 ? 's' : ''} queued
        </span>
      </button>

      {/* Message list */}
      <div className="px-4" style={{ paddingBottom: `${BOTTOM_PADDING}px` }}>
        {messages.slice(0, MAX_VISIBLE_ITEMS).map((message) =>
          editingId === message.id ?
            <div key={message.id} className="space-y-2 py-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full resize-none rounded bg-neutral-800 px-2 py-1.5 text-sm text-white placeholder-neutral-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                rows={2}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancel}
                  className="px-2 py-1 text-xs text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveEdit(message.id)}
                  className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          : <div
              key={message.id}
              className="flex items-center gap-3"
              style={{ height: `${ITEM_HEIGHT}px` }}
            >
              <span className="flex-shrink-0 text-sm text-neutral-500">
                {formatTime(message.timestamp)}
              </span>
              <p className="min-w-0 flex-1 truncate text-sm text-neutral-100">{message.text}</p>
              {isExpanded && (
                <div className="flex flex-shrink-0 gap-1">
                  <button
                    onClick={() => onSendImmediate(message.id)}
                    className="rounded p-1 text-neutral-400 hover:bg-neutral-700 hover:text-blue-400"
                    title="Send now"
                  >
                    <Send size={14} />
                  </button>
                  <button
                    onClick={() => handleEdit(message.id, message.text)}
                    className="rounded p-1 text-neutral-400 hover:bg-neutral-700 hover:text-amber-400"
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => onDelete(message.id)}
                    className="rounded p-1 text-neutral-400 hover:bg-neutral-700 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
        )}
      </div>
    </div>
  );
}
