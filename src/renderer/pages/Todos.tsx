import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import TitleBar from '@/components/TitleBar';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

interface TodosProps {
  onOpenSettings: () => void;
}

export default function Todos({ onOpenSettings }: TodosProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodoText, setNewTodoText] = useState('');

  const addTodo = () => {
    if (!newTodoText.trim()) return;

    const newTodo: Todo = {
      id: crypto.randomUUID(),
      text: newTodoText.trim(),
      completed: false,
      createdAt: Date.now()
    };

    setTodos([newTodo, ...todos]);
    setNewTodoText('');
  };

  const toggleTodo = (id: string) => {
    setTodos(
      todos.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo))
    );
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter((todo) => todo.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTodo();
    }
  };

  const pendingTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-neutral-900">
      <TitleBar onOpenSettings={onOpenSettings} />

      <div className="flex-1 overflow-auto pt-[48px]">
        <div className="mx-auto max-w-2xl p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Todos</h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Keep track of your tasks
            </p>
          </div>

          {/* Add Todo Input */}
          <div className="mb-6 flex gap-2">
            <input
              type="text"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a new todo..."
              className="flex-1 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-neutral-900 placeholder-neutral-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500"
            />
            <button
              onClick={addTodo}
              disabled={!newTodoText.trim()}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>

          {/* Pending Todos */}
          {pendingTodos.length > 0 && (
            <div className="mb-6 space-y-2">
              {pendingTodos.map((todo) => (
                <div
                  key={todo.id}
                  className="group flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 transition-colors hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-neutral-600"
                >
                  <button
                    onClick={() => toggleTodo(todo.id)}
                    className="flex-shrink-0 text-neutral-400 hover:text-blue-500 dark:text-neutral-500"
                  >
                    <Circle className="h-5 w-5" />
                  </button>
                  <span className="flex-1 text-neutral-900 dark:text-neutral-100">{todo.text}</span>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="flex-shrink-0 text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Completed Todos */}
          {completedTodos.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Completed ({completedTodos.length})
              </h3>
              {completedTodos.map((todo) => (
                <div
                  key={todo.id}
                  className="group flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/50"
                >
                  <button
                    onClick={() => toggleTodo(todo.id)}
                    className="flex-shrink-0 text-green-500"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                  </button>
                  <span className="flex-1 text-neutral-500 line-through dark:text-neutral-400">
                    {todo.text}
                  </span>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="flex-shrink-0 text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {todos.length === 0 && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-8 text-center dark:border-neutral-800 dark:bg-neutral-900/30">
              <CheckCircle2 className="mx-auto h-10 w-10 text-neutral-300 dark:text-neutral-600" />
              <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">No todos yet</p>
              <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                Add your first todo above
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
