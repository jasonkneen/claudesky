import { Check, Circle, Loader2 } from 'lucide-react';

export type LoadingStep = {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'complete' | 'error';
};

interface LoadingStatusProps {
  steps: LoadingStep[];
  title?: string;
}

export default function LoadingStatus({ steps, title = 'Initializing...' }: LoadingStatusProps) {
  const allComplete = steps.every((step) => step.status === 'complete');

  if (allComplete) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <h2 className="text-center text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          {title}
        </h2>

        <div className="space-y-3">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-all ${
                step.status === 'complete' ?
                  'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30'
                : step.status === 'loading' ?
                  'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30'
                : step.status === 'error' ?
                  'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
                : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/30'
              }`}
            >
              {step.status === 'complete' ?
                <Check className="h-5 w-5 flex-shrink-0 text-green-500" />
              : step.status === 'loading' ?
                <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-blue-500" />
              : step.status === 'error' ?
                <Circle className="h-5 w-5 flex-shrink-0 text-red-500" />
              : <Circle className="h-5 w-5 flex-shrink-0 text-neutral-300 dark:text-neutral-600" />}
              <span
                className={`text-sm font-medium ${
                  step.status === 'complete' ? 'text-green-700 dark:text-green-300'
                  : step.status === 'loading' ? 'text-blue-700 dark:text-blue-300'
                  : step.status === 'error' ? 'text-red-700 dark:text-red-300'
                  : 'text-neutral-500 dark:text-neutral-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Compact chip-style loading status for inline display
export function LoadingChips({ steps }: { steps: LoadingStep[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((step) => (
        <div
          key={step.id}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
            step.status === 'complete' ?
              'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
            : step.status === 'loading' ?
              'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
            : step.status === 'error' ?
              'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
            : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
          }`}
        >
          {step.status === 'complete' ?
            <Check className="h-3 w-3" />
          : step.status === 'loading' ?
            <Loader2 className="h-3 w-3 animate-spin" />
          : <Circle className="h-3 w-3" />}
          <span>{step.label}</span>
        </div>
      ))}
    </div>
  );
}
