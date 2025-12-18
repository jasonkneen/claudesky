import { FileText, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';

import TitleBar from '@/components/TitleBar';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

interface NotesProps {
  onOpenSettings: () => void;
}

export default function Notes({ onOpenSettings }: NotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const createNote = () => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: 'Untitled Note',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    setNotes([newNote, ...notes]);
    setSelectedNote(newNote);
  };

  const updateNote = (id: string, updates: Partial<Pick<Note, 'title' | 'content'>>) => {
    setNotes(
      notes.map((note) => (note.id === id ? { ...note, ...updates, updatedAt: Date.now() } : note))
    );
    if (selectedNote?.id === id) {
      setSelectedNote({ ...selectedNote, ...updates, updatedAt: Date.now() });
    }
  };

  const deleteNote = (id: string) => {
    setNotes(notes.filter((note) => note.id !== id));
    if (selectedNote?.id === id) {
      setSelectedNote(null);
    }
  };

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-neutral-900">
      <TitleBar onOpenSettings={onOpenSettings} />

      <div className="flex flex-1 overflow-hidden pt-[48px]">
        {/* Sidebar */}
        <div className="flex w-72 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50">
          {/* Header */}
          <div className="border-b border-neutral-200 p-4 dark:border-neutral-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Notes</h2>
              <button
                onClick={createNote}
                className="rounded-lg bg-blue-500 p-2 text-white transition-colors hover:bg-blue-600"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {/* Search */}
            <div className="relative mt-3">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                className="w-full rounded-lg border border-neutral-200 bg-white py-2 pr-3 pl-9 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>
          </div>

          {/* Notes List */}
          <div className="flex-1 overflow-auto p-2">
            {filteredNotes.length > 0 ?
              <div className="space-y-1">
                {filteredNotes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                    className={`group w-full rounded-lg p-3 text-left transition-colors ${
                      selectedNote?.id === note.id ?
                        'bg-blue-100 dark:bg-blue-900/30'
                      : 'hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                          {note.title || 'Untitled'}
                        </h3>
                        <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
                          {note.content || 'No content'}
                        </p>
                        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                          {formatDate(note.updatedAt)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNote(note.id);
                        }}
                        className="ml-2 flex-shrink-0 text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            : <div className="flex flex-col items-center justify-center py-8">
                <FileText className="h-8 w-8 text-neutral-300 dark:text-neutral-600" />
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                  {searchQuery ? 'No matching notes' : 'No notes yet'}
                </p>
              </div>
            }
          </div>
        </div>

        {/* Editor */}
        <div className="flex flex-1 flex-col">
          {selectedNote ?
            <>
              {/* Title */}
              <div className="border-b border-neutral-200 p-4 dark:border-neutral-700">
                <input
                  type="text"
                  value={selectedNote.title}
                  onChange={(e) => updateNote(selectedNote.id, { title: e.target.value })}
                  placeholder="Note title..."
                  className="w-full bg-transparent text-xl font-semibold text-neutral-900 placeholder-neutral-400 outline-none dark:text-neutral-100"
                />
              </div>
              {/* Content */}
              <div className="flex-1 overflow-auto p-4">
                <textarea
                  value={selectedNote.content}
                  onChange={(e) => updateNote(selectedNote.id, { content: e.target.value })}
                  placeholder="Start writing..."
                  className="h-full w-full resize-none bg-transparent text-neutral-700 placeholder-neutral-400 outline-none dark:text-neutral-300"
                />
              </div>
            </>
          : <div className="flex flex-1 flex-col items-center justify-center">
              <FileText className="h-12 w-12 text-neutral-300 dark:text-neutral-600" />
              <p className="mt-3 text-neutral-500 dark:text-neutral-400">
                Select a note or create a new one
              </p>
              <button
                onClick={createNote}
                className="mt-4 flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-600"
              >
                <Plus className="h-4 w-4" />
                New Note
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  );
}
