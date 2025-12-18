import { useVoiceProvider, useVoiceSettings } from '@voice-provider/core';
import { ArrowUp, Brain, Loader2, Mic, Paperclip, Square, Wand2 } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import AttachmentPreviewList from '@/components/AttachmentPreviewList';
import HistoryPopover from '@/components/HistoryPopover';
import MentionChips from '@/components/MentionChips';
import MentionPopover, { type PopoverItem } from '@/components/MentionPopover';
import MessageQueueDrawer from '@/components/MessageQueueDrawer';
import ThinkingModePopover, { getThinkingModeBackground } from '@/components/ThinkingModePopover';
import { useThinkingMode } from '@/contexts/ThinkingModeContext';
import type { QueuedMessage } from '@/types/chat';
import { getRelativePath, getWorkspaceFiles } from '@/utils/fileUtils';
import {
  fuzzySearchHistory,
  INITIAL_LOAD_SIZE,
  loadHistory,
  loadMoreHistory,
  saveToHistory,
  type HistoryItem
} from '@/utils/historyUtils';
import { detectMentionTrigger, fuzzyFilter, type Mention } from '@/utils/mentionUtils';

import type { ChatModelPreference, SmartModelVariant } from '../../shared/types/ipc';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  onStopStreaming?: () => void;
  autoFocus?: boolean;
  onHeightChange?: (height: number) => void;
  attachments?: {
    id: string;
    file: File;
    previewUrl?: string;
    previewIsBlobUrl?: boolean;
    isImage: boolean;
  }[];
  onFilesSelected?: (files: FileList | File[]) => void;
  onRemoveAttachment?: (id: string) => void;
  canSend?: boolean;
  attachmentError?: string | null;
  modelPreference: ChatModelPreference;
  onModelPreferenceChange: (preference: ChatModelPreference) => void;
  isModelPreferenceUpdating?: boolean;
  mentions?: Mention[];
  onMentionsChange?: (mentions: Mention[]) => void;
  workspaceDir?: string;
  conversationId?: string | null;
  queuedMessages?: QueuedMessage[];
  onQueueSendImmediate?: (messageId: string) => void;
  onQueueDelete?: (messageId: string) => void;
  onQueueEdit?: (messageId: string, newText: string) => void;
  isThinking?: boolean;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  isLoading,
  onStopStreaming,
  autoFocus = false,
  onHeightChange,
  attachments = [],
  onFilesSelected,
  onRemoveAttachment,
  canSend,
  attachmentError,
  modelPreference,
  onModelPreferenceChange,
  isModelPreferenceUpdating = false,
  mentions = [],
  onMentionsChange,
  workspaceDir,
  conversationId = null,
  queuedMessages = [],
  onQueueSendImmediate,
  onQueueDelete,
  onQueueEdit,
  isThinking = false
}: ChatInputProps) {
  const { thinkingMode, setThinkingMode } = useThinkingMode();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MIN_TEXTAREA_HEIGHT = 44;
  const MAX_TEXTAREA_HEIGHT = 200;
  const lastReportedHeightRef = useRef<number | null>(null);
  const dragCounterRef = useRef(0);
  const lastSmartPreferenceRef = useRef<ChatModelPreference>('smart-sonnet');
  const [isDragActive, setIsDragActive] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isThinkingPopoverOpen, setIsThinkingPopoverOpen] = useState(false);
  const thinkingButtonRef = useRef<HTMLButtonElement>(null);

  // Voice provider setup
  const { settings: voiceSettings } = useVoiceSettings();
  const voice = useVoiceProvider(voiceSettings.geminiApiKey || '');

  // Mention popover state
  const [popover, setPopover] = useState<{
    isOpen: boolean;
    trigger?: '@' | '/';
    query: string;
    selectedIndex: number;
    items: Array<{ id: string; label: string }>;
    position: { top: number; left: number };
    startPos: number;
  }>({
    isOpen: false,
    query: '',
    selectedIndex: 0,
    items: [],
    position: { top: 0, left: 0 },
    startPos: -1
  });

  const [allFiles, setAllFiles] = useState<Array<{ path: string; name: string }>>([]);

  // History popover state
  const [history, setHistory] = useState<{
    isOpen: boolean;
    query: string;
    selectedIndex: number;
    items: HistoryItem[];
    position: { top: number; left: number };
    offset: number;
    totalCount: number;
  }>({
    isOpen: false,
    query: '',
    selectedIndex: 0,
    items: [],
    position: { top: 0, left: 0 },
    offset: 0,
    totalCount: 0
  });

  const computedCanSend = canSend ?? Boolean(value.trim());
  const isSmartMode = modelPreference !== 'fast';
  const smartVariant = modelPreference === 'smart-opus' ? 'opus' : 'sonnet';

  const modelPillClass = (isActive: boolean, size: 'default' | 'compact' = 'default') =>
    `rounded-full ${size === 'compact' ? 'px-2.5 py-1' : 'px-3 py-1'} text-xs font-semibold transition ${
      isActive ?
        'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100'
      : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
    } ${isModelPreferenceUpdating ? 'opacity-70' : ''}`;

  const handleModelPreferenceSelect = (preference: ChatModelPreference) => {
    if (preference === modelPreference) return;
    if (isModelPreferenceUpdating) return;
    onModelPreferenceChange(preference);
  };

  const handlePrimaryModelToggle = (mode: 'fast' | 'smart') => {
    if (mode === 'fast') {
      handleModelPreferenceSelect('fast');
      return;
    }

    const nextPreference = isSmartMode ? modelPreference : lastSmartPreferenceRef.current;
    handleModelPreferenceSelect(nextPreference);
  };

  const handleSmartModelToggle = (variant: SmartModelVariant) => {
    const nextPreference: ChatModelPreference = variant === 'opus' ? 'smart-opus' : 'smart-sonnet';
    handleModelPreferenceSelect(nextPreference);
  };

  const handleThinkingButtonClick = () => {
    setIsThinkingPopoverOpen((prev) => !prev);
  };

  const handleThinkingModeSelect = (mode: typeof thinkingMode) => {
    setThinkingMode(mode);
  };

  const getThinkingPopoverPosition = () => {
    if (!thinkingButtonRef.current) {
      return { top: 0, left: 0 };
    }
    const rect = thinkingButtonRef.current.getBoundingClientRect();
    return {
      top: rect.top - 320, // Position above the button
      left: Math.max(8, rect.left - 100) // Center roughly
    };
  };

  const handleEnhancePrompt = useCallback(async () => {
    console.log('[EnhancePrompt] Button clicked, value:', value, 'isEnhancing:', isEnhancing);
    if (!value.trim() || isEnhancing) {
      console.log('[EnhancePrompt] Skipping - empty value or already enhancing');
      return;
    }

    setIsEnhancing(true);
    try {
      console.log('[EnhancePrompt] Calling enhancePrompt...');
      const response = await window.electron.chat.enhancePrompt(value);
      console.log('[EnhancePrompt] Response:', response);
      if (response.success && response.enhancedPrompt) {
        onChange(response.enhancedPrompt);
      } else if (!response.success) {
        console.error('[EnhancePrompt] Failed:', response.error);
      }
    } catch (error) {
      console.error('[EnhancePrompt] Error:', error);
    } finally {
      setIsEnhancing(false);
    }
  }, [value, isEnhancing, onChange]);

  const reportHeight = useCallback(
    (height: number) => {
      if (!onHeightChange) return;
      const roundedHeight = Math.round(height);
      if (lastReportedHeightRef.current === roundedHeight) return;
      lastReportedHeightRef.current = roundedHeight;
      onHeightChange(roundedHeight);
    },
    [onHeightChange]
  );

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const measuredHeight = Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT);
    textarea.style.height = `${Math.max(measuredHeight, MIN_TEXTAREA_HEIGHT)}px`;
  };

  // Auto-focus when autoFocus is true
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Load workspace files on mount
  useEffect(() => {
    if (!workspaceDir) return;

    (async () => {
      try {
        const files = await getWorkspaceFiles(workspaceDir);
        setAllFiles(files);
      } catch (error) {
        console.error('Failed to load workspace files:', error);
      }
    })();
  }, [workspaceDir]);

  // Register voice provider callbacks
  useEffect(() => {
    voice.registerCallbacks({
      onUserTranscript: (text: string) => {
        // User's speech from Web Speech API → goes into input field
        console.log('[Voice] User said:', text);
        setVoiceTranscript(text); // Replace (Web Speech gives full transcript each time)
      },
      onAssistantText: (text: string) => {
        // Zephyr's response → TODO: add to chat stream via IPC
        console.log('[Voice] Zephyr responded:', text);
        // For now, we could send this to main process to inject as a chat message
        // window.electronAPI?.addChatMessage?.({ role: 'assistant', content: text, source: 'zephyr' });
      },
      onResponse: (_audio: ArrayBuffer, _text: string) => {
        // Audio playback is handled internally by the provider
      },
      onError: (error: string) => {
        console.error('[Voice] Error:', error);
      },
      onSilenceDetected: () => {
        console.log('[Voice] Silence detected, auto-submitting');
        // Auto-submit the voice transcript
        if (voiceTranscript.trim()) {
          onChange(value + voiceTranscript);
          setTimeout(() => {
            onSend();
            setVoiceTranscript('');
          }, 100);
        }
      }
    });
  }, [voice, voiceTranscript, value, onChange, onSend]);

  // Set microphone device when settings change
  useEffect(() => {
    if (voiceSettings.microphoneDeviceId) {
      voice.setMicrophoneDevice(voiceSettings.microphoneDeviceId);
    }
  }, [voice, voiceSettings.microphoneDeviceId]);

  const closePopover = useCallback(() => {
    setPopover((p) => ({ ...p, isOpen: false }));
  }, []);

  const closeHistory = useCallback(() => {
    setHistory((h) => ({ ...h, isOpen: false }));
  }, []);

  const openHistory = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Load all history, filter, then paginate
    const allHistory = loadHistory(conversationId);
    const filtered = fuzzySearchHistory(allHistory, value);
    const total = filtered.length;
    const paginated = filtered.slice(0, INITIAL_LOAD_SIZE);

    const rect = textarea.getBoundingClientRect();

    // Smart positioning: show above with padding from edges
    const popoverHeight = 280;
    const spaceBefore = rect.top;
    const spaceAfter = window.innerHeight - rect.bottom;

    let top: number;
    const minTop = 120; // Minimum distance from top of page to avoid overlapping header
    if (spaceBefore >= popoverHeight + 20 && rect.top - popoverHeight - 20 >= minTop) {
      // Show above textarea with 20px padding (only if it won't go too high)
      top = rect.top - popoverHeight - 20;
    } else if (spaceAfter >= popoverHeight + 20) {
      // Show below textarea with 20px padding
      top = rect.bottom + 20;
    } else {
      // Constrain to visible area, respecting minimum top
      top = Math.max(
        minTop,
        Math.min(rect.top - popoverHeight - 20, window.innerHeight - popoverHeight - 8)
      );
    }

    setHistory((h) => ({
      ...h,
      isOpen: true,
      query: value,
      items: paginated,
      selectedIndex: 0,
      position: {
        top,
        left: Math.max(8, rect.left)
      },
      offset: INITIAL_LOAD_SIZE,
      totalCount: total
    }));
  }, [value, conversationId]);

  const selectMentionItem = useCallback(
    (item: PopoverItem) => {
      const newMention: Mention = {
        id: crypto.randomUUID?.() || `mention-${Date.now()}`,
        type: 'file',
        label: item.label,
        value:
          allFiles.find((f) => getRelativePath(f.path, workspaceDir || '') === item.label)?.path ||
          item.label
      };

      const updatedMentions = [...mentions, newMention];
      onMentionsChange?.(updatedMentions);

      // Remove the mention trigger and query from text
      const textarea = textareaRef.current;
      if (textarea && popover.startPos >= 0) {
        const before = textarea.value.slice(0, popover.startPos);
        const after = textarea.value.slice(textarea.selectionStart);
        const newValue = before + after;
        onChange(newValue);

        // Move cursor
        setTimeout(() => {
          textarea.selectionStart = before.length;
          textarea.selectionEnd = before.length;
        }, 0);
      }

      closePopover();
    },
    [mentions, onMentionsChange, allFiles, workspaceDir, popover.startPos, closePopover, onChange]
  );

  const selectHistoryItem = useCallback(
    (item: HistoryItem, insertMode: boolean = false) => {
      if (insertMode) {
        // Tab: insert the selected history item at cursor position
        const textarea = textareaRef.current;
        if (!textarea) return;
        const cursorPos = textarea.selectionStart;
        const before = value.slice(0, cursorPos);
        const after = value.slice(cursorPos);
        onChange(before + item.text + after);
        closeHistory();
        setTimeout(() => {
          textarea.selectionStart = cursorPos + item.text.length;
          textarea.selectionEnd = cursorPos + item.text.length;
          textarea.focus();
        }, 0);
      } else {
        // Enter: replace entire input with history item and send
        onChange(item.text);
        closeHistory();
        setTimeout(() => {
          if (!isLoading && canSend !== false) {
            saveToHistory(item.text, conversationId);
            onSend();
          }
        }, 0);
      }
    },
    [value, onChange, isLoading, canSend, onSend, closeHistory, conversationId]
  );

  const handleLoadMoreHistory = useCallback(() => {
    const moreItems = loadMoreHistory(conversationId, history.offset, INITIAL_LOAD_SIZE);
    const filteredMore = fuzzySearchHistory(moreItems, value);

    setHistory((h) => ({
      ...h,
      items: [...h.items, ...filteredMore],
      offset: h.offset + INITIAL_LOAD_SIZE
    }));
  }, [conversationId, value, history.offset]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle history popover navigation
    if (history.isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHistory((h) => ({
          ...h,
          selectedIndex: (h.selectedIndex + 1) % h.items.length
        }));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHistory((h) => ({
          ...h,
          selectedIndex: (h.selectedIndex - 1 + h.items.length) % h.items.length
        }));
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const item = history.items[history.selectedIndex];
        if (item) {
          selectHistoryItem(item, true); // Tab = insert mode
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = history.items[history.selectedIndex];
        if (item) {
          selectHistoryItem(item, false); // Enter = send mode
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeHistory();
        return;
      }
    }

    // Handle mention popover navigation
    if (popover.isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPopover((p) => ({
          ...p,
          selectedIndex: (p.selectedIndex + 1) % p.items.length
        }));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPopover((p) => ({
          ...p,
          selectedIndex: (p.selectedIndex - 1 + p.items.length) % p.items.length
        }));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const item = popover.items[popover.selectedIndex];
        if (item) {
          selectMentionItem(item);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closePopover();
        return;
      }
    }
    // Handle arrow keys to open history (only if not in mention popover and at boundary)
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !popover.isOpen) {
      const textarea = e.currentTarget;
      const cursorPos = textarea.selectionStart;
      const textValue = textarea.value;

      // Only open history if:
      // - ArrowUp and cursor is at the start (or on first line)
      // - ArrowDown and cursor is at the end (or on last line)
      const isAtStart = cursorPos === 0;
      const isAtEnd = cursorPos === textValue.length;

      if ((e.key === 'ArrowUp' && isAtStart) || (e.key === 'ArrowDown' && isAtEnd)) {
        e.preventDefault();
        openHistory();
        return;
      }
      // Otherwise, allow normal cursor movement (don't prevent default)
    }

    // Normal enter to send
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      console.log(
        '[ChatInput] Enter pressed, isLoading:',
        isLoading,
        'computedCanSend:',
        computedCanSend
      );
      if (!isLoading && computedCanSend) {
        saveToHistory(value, conversationId);
        console.log('[ChatInput] Calling onSend from Enter key');
        onSend();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    const items = Array.from(clipboardData.items);
    const fileItems = items.filter((item) => item.kind === 'file');

    if (fileItems.length > 0) {
      e.preventDefault();
      const files: File[] = [];

      for (const item of fileItems) {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }

      if (files.length > 0) {
        onFilesSelected?.(files);
      }
    }
  };

  const handleInputContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only focus if clicking on the container itself, not on interactive elements
    const target = e.target as HTMLElement;
    if (target.tagName !== 'TEXTAREA' && target.tagName !== 'BUTTON' && textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleTextareaInput = () => {
    adjustTextareaHeight();

    // Detect mentions
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    // Use textarea.value instead of the React value prop (which may not be updated yet)
    const detected = detectMentionTrigger(textarea.value, cursorPos);

    if (detected && detected.trigger === '@') {
      // Filter files
      const filtered = fuzzyFilter(allFiles, detected.query, (f) =>
        getRelativePath(f.path, workspaceDir || '')
      ).slice(0, 8); // Limit to 8 items

      if (filtered.length > 0) {
        const rect = textarea.getBoundingClientRect();
        setPopover((p) => ({
          ...p,
          isOpen: true,
          trigger: '@',
          query: detected.query,
          items: filtered.map((f) => ({
            id: f.path,
            label: getRelativePath(f.path, workspaceDir || '')
          })),
          position: {
            top: rect.top - 280, // Position above textarea
            left: rect.left
          },
          selectedIndex: 0,
          startPos: detected.start
        }));
      } else {
        closePopover();
      }
    } else {
      closePopover();
    }
  };

  const handleRemoveAttachmentClick = (attachmentId: string) => {
    onRemoveAttachment?.(attachmentId);
  };

  const handleAttachmentButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) {
      onFilesSelected?.(event.target.files);
    }
    event.target.value = '';
  };

  const handleVoiceToggle = async () => {
    try {
      if (voice.state.isListening) {
        console.log('[Voice] Stopping listening');
        await voice.stopListening();
        // Only manual submission on click when autoSubmit is off
        if (voiceTranscript.trim() && !voiceSettings.autoSubmit) {
          onChange(value + voiceTranscript);
          setTimeout(() => {
            onSend();
            setVoiceTranscript('');
          }, 100);
        }
      } else {
        console.log('[Voice] Starting listening');
        setVoiceTranscript('');
        // startListening() handles connection internally
        await voice.startListening();
        console.log('[Voice] Now listening');
      }
    } catch (error) {
      console.error('[Voice] Toggle error:', error);
    }
  };

  const isFileDrag = (event: React.DragEvent) =>
    Array.from(event.dataTransfer?.types ?? []).includes('Files');

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragCounterRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragCounterRef.current = 0;
    setIsDragActive(false);
    if (event.dataTransfer?.files?.length) {
      onFilesSelected?.(event.dataTransfer.files);
      event.dataTransfer.clearData();
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [value]);

  useEffect(() => {
    if (isSmartMode) {
      lastSmartPreferenceRef.current = modelPreference;
    }
  }, [isSmartMode, modelPreference]);

  // Close history when conversation changes
  useEffect(() => {
    closeHistory();
  }, [conversationId, closeHistory]);

  // Close history when model preference changes
  useEffect(() => {
    closeHistory();
  }, [modelPreference, closeHistory]);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    reportHeight(element.getBoundingClientRect().height);

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      reportHeight(entry.contentRect.height);
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [reportHeight]);

  // Close history on outside click
  useEffect(() => {
    if (!history.isOpen) return;

    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking on history popover or its contents
      if (target.closest('[data-history-popover]')) {
        return;
      }
      closeHistory();
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [history.isOpen, closeHistory]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-x-0 bottom-0 z-10 overflow-visible px-4 pb-5 [-webkit-app-region:no-drag]"
    >
      <div className="mx-auto flex max-w-3xl flex-col-reverse">
        {/* Input panel - sits on top, covers drawer bottom */}
        <div
          className={`relative z-10 rounded-3xl bg-white/95 p-2 shadow-[0_20px_60px_rgba(15,23,42,0.15)] backdrop-blur-xl dark:bg-neutral-900/90 dark:shadow-[0_16px_50px_rgba(0,0,0,0.65)] ${
            isDragActive ?
              'ring-2 ring-neutral-400/80 dark:ring-neutral-500/80'
            : 'ring-1 ring-neutral-200/80 dark:ring-neutral-700/70'
          }`}
          onClick={handleInputContainerClick}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />

          {mentions.length > 0 && (
            <MentionChips
              mentions={mentions}
              onRemove={(id) => {
                const updated = mentions.filter((m) => m.id !== id);
                onMentionsChange?.(updated);
              }}
            />
          )}

          {attachments.length > 0 && (
            <AttachmentPreviewList
              attachments={attachments.map((attachment) => ({
                id: attachment.id,
                name: attachment.file.name,
                size: attachment.file.size,
                isImage: attachment.isImage,
                previewUrl: attachment.previewUrl
              }))}
              onRemove={handleRemoveAttachmentClick}
              className="mb-2 px-2"
            />
          )}

          {attachmentError && (
            <p className="px-3 pb-2 text-xs text-red-600 dark:text-red-400">{attachmentError}</p>
          )}

          {voice.state.error && (
            <p className="px-3 pb-2 text-xs text-red-600 dark:text-red-400">{voice.state.error}</p>
          )}

          <textarea
            ref={textareaRef}
            value={voice.state.isListening ? value + voiceTranscript : value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={voice.state.isListening ? 'Listening...' : 'How can I help you today?'}
            rows={1}
            className={`w-full resize-none border-0 bg-transparent px-3 py-2 text-neutral-900 placeholder-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder-neutral-500 ${
              voice.state.isListening ? 'text-blue-600 italic dark:text-blue-400' : ''
            }`}
            style={{
              minHeight: `${MIN_TEXTAREA_HEIGHT}px`,
              maxHeight: `${MAX_TEXTAREA_HEIGHT}px`
            }}
            onInput={handleTextareaInput}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 px-2 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleVoiceToggle}
                className={`flex h-10 w-10 items-center justify-center rounded-full border transition focus:ring-2 focus:outline-none ${
                  voice.state.isListening ?
                    'border-blue-400 bg-blue-100 text-blue-600 focus:ring-blue-400 dark:border-blue-500 dark:bg-blue-900 dark:text-blue-200 dark:focus:ring-blue-500'
                  : 'border-neutral-200/80 bg-neutral-100 text-neutral-600 hover:bg-neutral-200 focus:ring-neutral-400 dark:border-neutral-700/70 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:focus:ring-neutral-500'
                }`}
                title={
                  voice.state.isListening ? 'Stop listening' : 'Start voice input (Gemini Voice)'
                }
              >
                <Mic className={`h-4 w-4 ${voice.state.isListening ? 'animate-pulse' : ''}`} />
              </button>
              <button
                type="button"
                onClick={handleAttachmentButtonClick}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/80 bg-neutral-100 text-neutral-600 transition hover:bg-neutral-200 focus:ring-2 focus:ring-neutral-400 focus:outline-none dark:border-neutral-700/70 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:focus:ring-neutral-500"
                title="Attach files"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleEnhancePrompt}
                disabled={!value.trim() || isEnhancing}
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-amber-300/80 bg-gradient-to-br from-amber-400 to-orange-500 text-white transition hover:from-amber-500 hover:to-orange-600 focus:ring-2 focus:ring-amber-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-600/70 dark:from-amber-600 dark:to-orange-600 dark:hover:from-amber-700 dark:hover:to-orange-700 dark:focus:ring-amber-500 ${isEnhancing ? 'enhance-btn-active' : ''}`}
                title="Enhance prompt with AI"
              >
                <Wand2 className="h-4 w-4" />
              </button>
              <div className="flex h-10 items-center gap-2 rounded-full border border-neutral-200/80 bg-neutral-100 px-2 py-1 transition dark:border-neutral-700/70 dark:bg-neutral-800">
                <button
                  type="button"
                  aria-pressed={!isSmartMode}
                  onClick={() => handlePrimaryModelToggle('fast')}
                  disabled={isModelPreferenceUpdating}
                  className={modelPillClass(!isSmartMode)}
                >
                  Fast
                </button>
                <div className="relative flex items-center overflow-hidden">
                  <div
                    className={`transition-[max-width,opacity,transform] duration-200 ease-out ${
                      isSmartMode ?
                        'pointer-events-none max-w-0 scale-95 opacity-0'
                      : 'max-w-[96px] scale-100 opacity-100'
                    }`}
                    aria-hidden={isSmartMode}
                  >
                    <button
                      type="button"
                      aria-pressed={isSmartMode}
                      onClick={() => handlePrimaryModelToggle('smart')}
                      disabled={isModelPreferenceUpdating}
                      className={modelPillClass(isSmartMode)}
                    >
                      Smart
                    </button>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 transition-[max-width,opacity,transform] duration-200 ease-out ${
                      isSmartMode ?
                        'max-w-[210px] scale-100 opacity-100'
                      : 'pointer-events-none max-w-0 scale-95 opacity-0'
                    }`}
                    aria-hidden={!isSmartMode}
                  >
                    <button
                      type="button"
                      aria-pressed={smartVariant === 'sonnet'}
                      onClick={() => handleSmartModelToggle('sonnet')}
                      disabled={!isSmartMode || isModelPreferenceUpdating}
                      className={modelPillClass(smartVariant === 'sonnet', 'compact')}
                      title="claude-sonnet-4-5-20250929"
                    >
                      Sonnet
                    </button>
                    <button
                      type="button"
                      aria-pressed={smartVariant === 'opus'}
                      onClick={() => handleSmartModelToggle('opus')}
                      disabled={!isSmartMode || isModelPreferenceUpdating}
                      className={modelPillClass(smartVariant === 'opus', 'compact')}
                      title="claude-opus-4-5-20251101"
                    >
                      Opus
                    </button>
                  </div>
                </div>
              </div>
              {isModelPreferenceUpdating && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400 dark:text-neutral-300" />
              )}
              <button
                ref={thinkingButtonRef}
                type="button"
                onClick={handleThinkingButtonClick}
                aria-label={`Thinking mode: ${thinkingMode.charAt(0).toUpperCase() + thinkingMode.slice(1)}${isThinking ? ' (active)' : ''}`}
                aria-haspopup="menu"
                aria-expanded={isThinkingPopoverOpen}
                aria-controls="thinking-mode-menu"
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition focus:ring-2 focus:outline-none ${getThinkingModeBackground(thinkingMode)} ${
                  thinkingMode === 'ultra' && isThinking ? 'thinking-btn-ultra'
                  : isThinking && thinkingMode !== 'off' ? 'thinking-btn-active'
                  : ''
                }`}
                title={`Thinking: ${thinkingMode.charAt(0).toUpperCase() + thinkingMode.slice(1)}`}
              >
                <Brain
                  className={`h-4 w-4 ${
                    thinkingMode === 'ultra' ? 'text-white'
                    : thinkingMode === 'off' ? 'text-neutral-400'
                    : 'text-white'
                  }`}
                  aria-hidden="true"
                />
                <span className="sr-only">
                  {thinkingMode === 'off' ?
                    'Off'
                  : `${thinkingMode.charAt(0).toUpperCase() + thinkingMode.slice(1)} thinking`}
                </span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              {isLoading ?
                /* Streaming: stop slides left, send queues messages */
                <>
                  <button
                    onClick={onStopStreaming}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-200 text-neutral-900 transition-all duration-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600"
                  >
                    <Square className="h-5 w-5" />
                  </button>
                  <button
                    onClick={onSend}
                    disabled={!computedCanSend}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                  >
                    <ArrowUp className="h-5 w-5" />
                  </button>
                </>
              : /* Not streaming: single send button */
                <button
                  onClick={() => {
                    console.log(
                      '[ChatInput] Send button clicked, computedCanSend:',
                      computedCanSend
                    );
                    onSend();
                  }}
                  disabled={!computedCanSend}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                >
                  <ArrowUp className="h-5 w-5" />
                </button>
              }
            </div>
          </div>
        </div>

        {/* Queue drawer - with flex-col-reverse, this appears ABOVE the input */}
        {/* Bottom is anchored to input, expands upward */}
        <div className="relative z-0" style={{ margin: '0 15px' }}>
          <MessageQueueDrawer
            messages={queuedMessages}
            onSendImmediate={onQueueSendImmediate || (() => {})}
            onDelete={onQueueDelete || (() => {})}
            onEdit={onQueueEdit || (() => {})}
          />
        </div>

        <MentionPopover
          isOpen={popover.isOpen}
          items={popover.items}
          selectedIndex={popover.selectedIndex}
          position={popover.position}
          trigger={popover.trigger || '@'}
          onSelect={selectMentionItem}
          onClose={closePopover}
        />

        <HistoryPopover
          isOpen={history.isOpen}
          items={history.items}
          selectedIndex={history.selectedIndex}
          position={history.position}
          onSelect={selectHistoryItem}
          onClose={closeHistory}
          onLoadMore={handleLoadMoreHistory}
          hasMore={history.items.length < history.totalCount}
        />

        <ThinkingModePopover
          isOpen={isThinkingPopoverOpen}
          currentMode={thinkingMode}
          onSelect={handleThinkingModeSelect}
          onClose={() => setIsThinkingPopoverOpen(false)}
          position={getThinkingPopoverPosition()}
        />
      </div>
    </div>
  );
}
