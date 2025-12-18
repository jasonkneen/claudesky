import { GripVertical, Plus, X } from 'lucide-react';
import { useState } from 'react';

import TitleBar from '@/components/TitleBar';

interface Card {
  id: string;
  text: string;
}

interface Column {
  id: string;
  title: string;
  cards: Card[];
}

interface KanbanProps {
  onOpenSettings: () => void;
}

const defaultColumns: Column[] = [
  { id: 'todo', title: 'To Do', cards: [] },
  { id: 'in-progress', title: 'In Progress', cards: [] },
  { id: 'done', title: 'Done', cards: [] }
];

export default function Kanban({ onOpenSettings }: KanbanProps) {
  const [columns, setColumns] = useState<Column[]>(defaultColumns);
  const [newCardText, setNewCardText] = useState<Record<string, string>>({});
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);

  const addCard = (columnId: string) => {
    const text = newCardText[columnId]?.trim();
    if (!text) return;

    const newCard: Card = {
      id: crypto.randomUUID(),
      text
    };

    setColumns(
      columns.map((col) => (col.id === columnId ? { ...col, cards: [...col.cards, newCard] } : col))
    );
    setNewCardText({ ...newCardText, [columnId]: '' });
    setAddingToColumn(null);
  };

  const deleteCard = (columnId: string, cardId: string) => {
    setColumns(
      columns.map((col) =>
        col.id === columnId ? { ...col, cards: col.cards.filter((c) => c.id !== cardId) } : col
      )
    );
  };

  const moveCard = (fromColumnId: string, toColumnId: string, cardId: string) => {
    const fromColumn = columns.find((c) => c.id === fromColumnId);
    const card = fromColumn?.cards.find((c) => c.id === cardId);
    if (!card) return;

    setColumns(
      columns.map((col) => {
        if (col.id === fromColumnId) {
          return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
        }
        if (col.id === toColumnId) {
          return { ...col, cards: [...col.cards, card] };
        }
        return col;
      })
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent, columnId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCard(columnId);
    }
    if (e.key === 'Escape') {
      setAddingToColumn(null);
      setNewCardText({ ...newCardText, [columnId]: '' });
    }
  };

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-neutral-900">
      <TitleBar onOpenSettings={onOpenSettings} />

      <div className="flex-1 overflow-auto pt-[48px]">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
              Kanban Board
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Organize your work visually
            </p>
          </div>

          {/* Board */}
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map((column) => (
              <div
                key={column.id}
                className="w-72 flex-shrink-0 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/50"
              >
                {/* Column Header */}
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {column.title}
                  </h3>
                  <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                    {column.cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {column.cards.map((card) => (
                    <div
                      key={card.id}
                      className="group flex items-start gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-600 dark:bg-neutral-800"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('cardId', card.id);
                        e.dataTransfer.setData('fromColumn', column.id);
                      }}
                    >
                      <GripVertical className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-grab text-neutral-300 dark:text-neutral-600" />
                      <span className="flex-1 text-sm text-neutral-900 dark:text-neutral-100">
                        {card.text}
                      </span>
                      <button
                        onClick={() => deleteCard(column.id, card.id)}
                        className="flex-shrink-0 text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Drop Zone */}
                <div
                  className="mt-2 min-h-[40px] rounded-lg border-2 border-dashed border-transparent transition-colors"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add(
                      'border-blue-400',
                      'bg-blue-50',
                      'dark:bg-blue-950/20'
                    );
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.classList.remove(
                      'border-blue-400',
                      'bg-blue-50',
                      'dark:bg-blue-950/20'
                    );
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove(
                      'border-blue-400',
                      'bg-blue-50',
                      'dark:bg-blue-950/20'
                    );
                    const cardId = e.dataTransfer.getData('cardId');
                    const fromColumn = e.dataTransfer.getData('fromColumn');
                    if (fromColumn !== column.id) {
                      moveCard(fromColumn, column.id, cardId);
                    }
                  }}
                />

                {/* Add Card */}
                {addingToColumn === column.id ?
                  <div className="mt-2">
                    <textarea
                      value={newCardText[column.id] || ''}
                      onChange={(e) =>
                        setNewCardText({ ...newCardText, [column.id]: e.target.value })
                      }
                      onKeyDown={(e) => handleKeyDown(e, column.id)}
                      placeholder="Enter card text..."
                      className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                      rows={2}
                      autoFocus
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => addCard(column.id)}
                        disabled={!newCardText[column.id]?.trim()}
                        className="rounded bg-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setAddingToColumn(null);
                          setNewCardText({ ...newCardText, [column.id]: '' });
                        }}
                        className="rounded px-3 py-1 text-sm font-medium text-neutral-600 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                : <button
                    onClick={() => setAddingToColumn(column.id)}
                    className="mt-2 flex w-full items-center gap-2 rounded-lg p-2 text-sm text-neutral-500 transition-colors hover:bg-neutral-200/50 dark:text-neutral-400 dark:hover:bg-neutral-700/50"
                  >
                    <Plus className="h-4 w-4" />
                    Add a card
                  </button>
                }
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
