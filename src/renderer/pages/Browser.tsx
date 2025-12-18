import { ArrowLeft, ArrowRight, Clock, Globe, RotateCw, Search, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import TitleBar from '@/components/TitleBar';

interface BrowserProps {
  onOpenSettings: () => void;
  initialUrl?: string;
}

interface RecentUrl {
  url: string;
  timestamp: number;
  title?: string;
}

export default function Browser({ onOpenSettings, initialUrl }: BrowserProps) {
  const [url, setUrl] = useState(initialUrl || '');
  const [inputValue, setInputValue] = useState(initialUrl || '');
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [recentUrls, setRecentUrls] = useState<RecentUrl[]>([]);
  const webviewRef = useRef<Electron.WebviewTag | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent URLs on mount
  useEffect(() => {
    const loadRecentUrls = async () => {
      try {
        const result = await window.electron.browser.getRecentUrls();
        setRecentUrls(result.urls);
      } catch (error) {
        console.error('Failed to load recent URLs:', error);
      }
    };
    loadRecentUrls();
  }, []);

  // Focus input on mount if no initial URL
  useEffect(() => {
    if (!initialUrl && inputRef.current) {
      inputRef.current.focus();
    }
  }, [initialUrl]);

  const normalizeUrl = (input: string): string => {
    let normalized = input.trim();

    // If it looks like a URL (has dots and no spaces), add https://
    if (normalized && !normalized.includes(' ') && normalized.includes('.')) {
      if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        normalized = `https://${normalized}`;
      }
    }
    // Otherwise treat as search query
    else if (normalized && !normalized.startsWith('http')) {
      normalized = `https://www.google.com/search?q=${encodeURIComponent(normalized)}`;
    }

    return normalized;
  };

  const navigate = async (targetUrl: string) => {
    const normalized = normalizeUrl(targetUrl);
    if (normalized) {
      setUrl(normalized);
      setInputValue(normalized);

      // Save to recent URLs (skip search queries)
      if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
        try {
          await window.electron.browser.addRecentUrl(normalized);
          const result = await window.electron.browser.getRecentUrls();
          setRecentUrls(result.urls);
        } catch (error) {
          console.error('Failed to save recent URL:', error);
        }
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      navigate(inputValue);
    }
  };

  const goBack = () => {
    webviewRef.current?.goBack();
  };

  const goForward = () => {
    webviewRef.current?.goForward();
  };

  const reload = () => {
    webviewRef.current?.reload();
  };

  const stopLoading = () => {
    webviewRef.current?.stop();
  };

  const formatUrl = (urlString: string): string => {
    try {
      const urlObj = new URL(urlString);
      return urlObj.hostname || urlString;
    } catch {
      return urlString;
    }
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const removeRecentUrl = async (urlToRemove: string) => {
    try {
      await window.electron.browser.removeRecentUrl(urlToRemove);
      const result = await window.electron.browser.getRecentUrls();
      setRecentUrls(result.urls);
    } catch (error) {
      console.error('Failed to remove recent URL:', error);
    }
  };

  // Handle webview events
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleLoadStart = () => setIsLoading(true);
    const handleLoadStop = () => {
      setIsLoading(false);
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
    };
    const handleNavigate = (e: Electron.DidNavigateEvent) => {
      setInputValue(e.url);
    };

    webview.addEventListener('did-start-loading', handleLoadStart);
    webview.addEventListener('did-stop-loading', handleLoadStop);
    webview.addEventListener('did-navigate', handleNavigate as EventListener);
    webview.addEventListener('did-navigate-in-page', handleNavigate as EventListener);

    return () => {
      webview.removeEventListener('did-start-loading', handleLoadStart);
      webview.removeEventListener('did-stop-loading', handleLoadStop);
      webview.removeEventListener('did-navigate', handleNavigate as EventListener);
      webview.removeEventListener('did-navigate-in-page', handleNavigate as EventListener);
    };
  }, [url]);

  // New tab view - URL input centered
  if (!url) {
    return (
      <div className="flex h-screen flex-col bg-white dark:bg-neutral-900">
        <TitleBar onOpenSettings={onOpenSettings} />

        <div className="flex flex-1 flex-col items-center justify-center p-8 pt-[48px]">
          <div className="w-full max-w-xl">
            <div className="mb-8 text-center">
              <Globe className="mx-auto h-16 w-16 text-neutral-300 dark:text-neutral-600" />
              <h1 className="mt-4 text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                New Tab
              </h1>
              <p className="mt-2 text-neutral-500 dark:text-neutral-400">
                Enter a URL or search query
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="relative">
                <Search className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search or enter URL..."
                  className="w-full rounded-full border border-neutral-200 bg-white py-4 pr-4 pl-12 text-lg text-neutral-900 placeholder-neutral-400 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                  autoFocus
                />
              </div>
            </form>

            {/* Recent URLs section */}
            {recentUrls.length > 0 && (
              <div className="mt-12">
                <div className="mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                  <h2 className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                    Recent URLs
                  </h2>
                </div>

                <div className="space-y-2">
                  {recentUrls.slice(0, 5).map((item) => (
                    <button
                      key={item.url}
                      onClick={() => navigate(item.url)}
                      className="group flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-left transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 flex-shrink-0 rounded bg-neutral-300 dark:bg-neutral-600" />
                          <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {formatUrl(item.url)}
                          </span>
                        </div>
                        <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                          {item.url}
                        </span>
                      </div>
                      <div className="ml-2 flex flex-shrink-0 items-center gap-2">
                        <span className="text-xs text-neutral-400 dark:text-neutral-500">
                          {formatTime(item.timestamp)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRecentUrl(item.url);
                          }}
                          className="rounded p-1 opacity-0 transition-all group-hover:opacity-100 hover:bg-neutral-200 dark:hover:bg-neutral-600"
                        >
                          <Trash2 className="h-3 w-3 text-neutral-500 dark:text-neutral-400" />
                        </button>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Browser view with webview
  return (
    <div className="flex h-screen flex-col bg-white dark:bg-neutral-900">
      <TitleBar onOpenSettings={onOpenSettings} />

      {/* Browser toolbar */}
      <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2 pt-[48px] dark:border-neutral-700 dark:bg-neutral-800">
        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={goBack}
            disabled={!canGoBack}
            className="rounded p-1.5 text-neutral-600 hover:bg-neutral-200 disabled:opacity-30 disabled:hover:bg-transparent dark:text-neutral-400 dark:hover:bg-neutral-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goForward}
            disabled={!canGoForward}
            className="rounded p-1.5 text-neutral-600 hover:bg-neutral-200 disabled:opacity-30 disabled:hover:bg-transparent dark:text-neutral-400 dark:hover:bg-neutral-700"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={isLoading ? stopLoading : reload}
            className="rounded p-1.5 text-neutral-600 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
          >
            {isLoading ?
              <X className="h-4 w-4" />
            : <RotateCw className="h-4 w-4" />}
          </button>
        </div>

        {/* URL bar */}
        <form onSubmit={handleSubmit} className="flex-1">
          <div className="relative">
            <Globe className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white py-1.5 pr-3 pl-9 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
            />
          </div>
        </form>
      </div>

      {/* Webview */}
      <div className="flex-1">
        <webview
          ref={webviewRef as React.RefObject<Electron.WebviewTag>}
          src={url}
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
