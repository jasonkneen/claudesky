import { useEffect, useRef, useState } from 'react';

import ChatHistoryDrawer from '@/components/ChatHistoryDrawer';
import ChatInput from '@/components/ChatInput';
import MessageList from '@/components/MessageList';
import MessageQueueDrawer from '@/components/MessageQueueDrawer';
import TitleBar from '@/components/TitleBar';
import { ThinkingModeProvider } from '@/contexts/ThinkingModeContext';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useClaudeChat } from '@/hooks/useClaudeChat';
import type { Message, MessageAttachment, QueuedMessage } from '@/types/chat';
import { saveToHistory } from '@/utils/historyUtils';
import type { Mention } from '@/utils/mentionUtils';

import { MAX_ATTACHMENT_BYTES } from '../../shared/constants';
import type { ChatModelPreference, SerializedAttachmentPayload } from '../../shared/types/ipc';

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl?: string;
  previewIsBlobUrl?: boolean;
  isImage: boolean;
}

const MAX_ATTACHMENT_SIZE_MB = Math.floor(MAX_ATTACHMENT_BYTES / (1024 * 1024));
const WORKSPACE_FALLBACK_LABEL = 'the configured claude-agent workspace directory';
const IMAGE_FILE_EXTENSIONS = new Set([
  'png',
  'apng',
  'avif',
  'gif',
  'jpg',
  'jpeg',
  'jfif',
  'pjpeg',
  'pjp',
  'svg',
  'webp',
  'bmp',
  'ico',
  'cur',
  'heic',
  'heif',
  'tif',
  'tiff'
]);

function releaseAttachmentPreviews(attachments: PendingAttachment[]): void {
  attachments.forEach((attachment) => {
    if (attachment.previewUrl && attachment.previewIsBlobUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  });
}

function isLikelyImageFile(file: File): boolean {
  if (file.type?.startsWith('image/')) {
    return true;
  }
  const extension = file.name?.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_FILE_EXTENSIONS.has(extension);
}

async function serializeAttachment(
  attachment: PendingAttachment
): Promise<SerializedAttachmentPayload> {
  const arrayBuffer = await attachment.file.arrayBuffer();
  return {
    name: attachment.file.name,
    mimeType: attachment.file.type || 'application/octet-stream',
    size: attachment.file.size,
    data: new Uint8Array(arrayBuffer)
  };
}

async function createImagePreview(file: File): Promise<{ url: string; isBlob: boolean } | null> {
  try {
    const dataUrl = await readFileAsDataUrl(file);
    return dataUrl ? { url: dataUrl, isBlob: false } : null;
  } catch {
    try {
      const objectUrl = URL.createObjectURL(file);
      return { url: objectUrl, isBlob: true };
    } catch {
      return null;
    }
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Invalid preview data'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

type PersistedMessage = Omit<Message, 'timestamp'> & { timestamp: string };

function serializeMessagesForStorage(messages: Message[]): PersistedMessage[] {
  return messages.map((msg) => ({
    ...msg,
    attachments: msg.attachments?.map(
      ({ previewUrl: _previewUrl, ...attachmentRest }) => attachmentRest
    ),
    timestamp: msg.timestamp.toISOString()
  }));
}

interface ChatProps {
  onOpenSettings?: () => void;
  isVisible?: boolean;
}

export default function Chat({ onOpenSettings, isVisible = true }: ChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatInputHeight, setChatInputHeight] = useState(0);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [workspaceDir, setWorkspaceDir] = useState<string | null>(null);
  // Per-tab project path (cwd) - set once when tab opens
  const [projectCwd] = useState<string | null>(() => window.electron.project.getFromUrl());
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [modelPreference, setModelPreference] = useState<ChatModelPreference>('fast');
  const [isModelPreferenceUpdating, setIsModelPreferenceUpdating] = useState(false);
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const { messages, setMessages, isLoading, setIsLoading, isThinking } = useClaudeChat();
  const messagesContainerRef = useAutoScroll(isLoading, messages);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([]);
  const autoProcessQueueRef = useRef<boolean>(true);

  // Re-fetch workspace directory when Chat becomes visible (e.g., after changing settings)
  useEffect(() => {
    if (!isVisible) return;

    let isMounted = true;
    window.electron.config
      .getWorkspaceDir()
      .then(({ workspaceDir: newWorkspaceDir }) => {
        if (isMounted) {
          setWorkspaceDir(newWorkspaceDir);
        }
      })
      .catch((error) => {
        console.error('Error loading workspace directory:', error);
      });
    return () => {
      isMounted = false;
    };
  }, [isVisible]);

  useEffect(() => {
    let isMounted = true;
    window.electron.chat
      .getModelPreference()
      .then(({ preference }) => {
        if (isMounted && preference) {
          setModelPreference(preference);
        }
      })
      .catch((error) => {
        console.error('Error loading model preference:', error);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  // Auto-send queued messages when agent is idle
  useEffect(() => {
    // Auto-send if agent is not loading and there are queued messages
    if (!isLoading && queuedMessages.length > 0 && autoProcessQueueRef.current) {
      // Mark as processing to avoid race conditions
      autoProcessQueueRef.current = false;

      // Delay slightly to ensure UI has settled
      const timer = setTimeout(async () => {
        const firstQueued = queuedMessages[0];
        if (firstQueued) {
          await handleSendQueuedMessageImmediately(firstQueued.id);
          // Re-enable auto-processing for next queue item
          autoProcessQueueRef.current = true;
        }
      }, 500);

      return () => {
        clearTimeout(timer);
        // Ensure flag is reset if effect unmounts
        autoProcessQueueRef.current = true;
      };
    }
  }, [isLoading, queuedMessages.length]);

  useEffect(() => {
    return () => {
      releaseAttachmentPreviews(pendingAttachmentsRef.current);
    };
  }, []);

  const handleFilesSelected = (fileList: FileList | File[]) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) {
      return;
    }

    const processFiles = async () => {
      const accepted: PendingAttachment[] = [];
      let rejectionMessage: string | null = null;

      for (const file of files) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          const workspaceLabel = workspaceDir ?? WORKSPACE_FALLBACK_LABEL;
          rejectionMessage =
            `"${file.name}" is larger than ${MAX_ATTACHMENT_SIZE_MB} MB. ` +
            `Please drop it directly into the Claude Agent workspace at ${workspaceLabel}.`;
          continue;
        }

        const isImage = isLikelyImageFile(file);
        let previewUrl: string | undefined;
        let previewIsBlobUrl = false;

        if (isImage) {
          const preview = await createImagePreview(file);
          if (preview?.url) {
            previewUrl = preview.url;
            previewIsBlobUrl = preview.isBlob;
          }
        }

        accepted.push({
          id: crypto.randomUUID(),
          file,
          previewUrl,
          previewIsBlobUrl,
          isImage
        });
      }

      if (accepted.length > 0) {
        setPendingAttachments((prev) => [...prev, ...accepted]);
      }

      if (rejectionMessage) {
        setAttachmentError(rejectionMessage);
      } else if (accepted.length > 0) {
        setAttachmentError(null);
      }
    };

    void processFiles();
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((attachment) => attachment.id === attachmentId);
      if (target?.previewUrl && target.previewIsBlobUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((attachment) => attachment.id !== attachmentId);
    });
  };

  const clearPendingAttachments = () => {
    setPendingAttachments((prev) => {
      releaseAttachmentPreviews(prev);
      return [];
    });
    setAttachmentError(null);
  };

  // Auto-save conversation when messages change
  useEffect(() => {
    // Skip auto-save on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    // Don't save empty conversations
    if (messages.length === 0) {
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save by 2 seconds
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const messagesToSave = serializeMessagesForStorage(messages);

        if (currentConversationId) {
          // Update existing conversation
          await window.electron.conversation.update(
            currentConversationId,
            undefined,
            messagesToSave,
            currentSessionId ?? undefined
          );
        } else {
          // Create new conversation
          const response = await window.electron.conversation.create(
            messagesToSave,
            currentSessionId ?? undefined
          );
          if (response.success && response.conversation) {
            setCurrentConversationId(response.conversation.id);
          }
        }
      } catch (error) {
        console.error('Error saving conversation:', error);
      }
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [messages, currentConversationId, currentSessionId]);

  // Listen for session updates from the main process (new or resumed sessions)
  useEffect(() => {
    const unsubscribe = window.electron.chat.onSessionUpdated(({ sessionId }) => {
      setCurrentSessionId((prev) => (prev === sessionId ? prev : sessionId));
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleNewChat = async () => {
    if (isLoading) return;

    clearPendingAttachments();

    try {
      // Save current conversation before clearing
      if (currentConversationId && messages.length > 0) {
        try {
          const messagesToSave = serializeMessagesForStorage(messages);
          await window.electron.conversation.update(
            currentConversationId,
            undefined,
            messagesToSave,
            currentSessionId ?? undefined
          );
        } catch (error) {
          console.error('Error saving conversation before new chat:', error);
        }
      }

      // Reset the backend session
      await window.electron.chat.resetSession();
      // Clear frontend messages
      setMessages([]);
      // Clear input and mentions
      setInputValue('');
      setMentions([]);
      // Clear current conversation ID and session
      setCurrentConversationId(null);
      setCurrentSessionId(null);
      isInitialLoadRef.current = true;
    } catch (error) {
      console.error('Error starting new chat:', error);
    }
  };

  const handleLoadConversation = async (conversationId: string) => {
    if (isLoading) return;

    clearPendingAttachments();

    try {
      // Save current conversation before switching
      if (currentConversationId && messages.length > 0) {
        try {
          const messagesToSave = serializeMessagesForStorage(messages);
          await window.electron.conversation.update(
            currentConversationId,
            undefined,
            messagesToSave,
            currentSessionId ?? undefined
          );
        } catch (error) {
          console.error('Error saving conversation before switching:', error);
        }
      }

      // Load the conversation
      const response = await window.electron.conversation.get(conversationId);
      if (response.success && response.conversation) {
        // Parse messages from JSON string
        const parsedMessages: Message[] = JSON.parse(response.conversation.messages).map(
          (msg: Omit<Message, 'timestamp'> & { timestamp: string }) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          })
        );

        // Reset session and load messages
        await window.electron.chat.resetSession(response.conversation.sessionId ?? null);
        setMessages(parsedMessages);
        setCurrentConversationId(conversationId);
        setCurrentSessionId(response.conversation.sessionId ?? null);
        // Clear mentions when loading a conversation
        setMentions([]);
        isInitialLoadRef.current = true;

        // Populate history with user messages from this conversation
        parsedMessages.forEach((msg) => {
          if (msg.role === 'user') {
            const contentText = typeof msg.content === 'string' ? msg.content : '';
            if (contentText) {
              saveToHistory(contentText, conversationId);
            }
          }
        });
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const handleSendMessage = async () => {
    console.log('[Chat.tsx] handleSendMessage called');
    const trimmedMessage = inputValue.trim();
    const hasSendableContent = trimmedMessage.length > 0 || pendingAttachments.length > 0;
    console.log(
      '[Chat.tsx] hasSendableContent:',
      hasSendableContent,
      'trimmedMessage:',
      trimmedMessage
    );
    if (!hasSendableContent) return;

    const messageAttachments: MessageAttachment[] = pendingAttachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.file.name,
      size: attachment.file.size,
      mimeType: attachment.file.type || 'application/octet-stream',
      previewUrl: attachment.previewIsBlobUrl ? undefined : attachment.previewUrl,
      isImage: attachment.isImage
    }));

    // Clear input immediately
    const currentAttachments = [...pendingAttachments];
    setInputValue('');
    setPendingAttachments([]);
    setAttachmentError(null);

    if (isLoading) {
      // Streaming: add to queue
      const queuedMessage: QueuedMessage = {
        id: crypto.randomUUID(),
        text: trimmedMessage,
        attachments: messageAttachments.length > 0 ? messageAttachments : undefined,
        contextFiles: mentions.length > 0 ? mentions : undefined,
        timestamp: new Date()
      };
      setQueuedMessages((prev) => [...prev, queuedMessage]);
    } else {
      // Not streaming: send directly
      const userMessage = {
        id: Date.now().toString(),
        role: 'user' as const,
        content: trimmedMessage,
        timestamp: new Date(),
        attachments: messageAttachments.length > 0 ? messageAttachments : undefined,
        contextFiles: mentions.length > 0 ? mentions : undefined
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      let serializedAttachments: SerializedAttachmentPayload[] = [];
      if (currentAttachments.length > 0) {
        try {
          serializedAttachments = await Promise.all(currentAttachments.map(serializeAttachment));
        } catch (error) {
          console.error('Error preparing attachments:', error);
        }
      }

      try {
        console.log('[Chat.tsx] Calling window.electron.chat.sendMessage...');
        const response = await window.electron.chat.sendMessage({
          text: trimmedMessage,
          attachments: serializedAttachments.length > 0 ? serializedAttachments : undefined,
          cwd: projectCwd ?? undefined
        });
        console.log('[Chat.tsx] sendMessage response:', response);
      } catch (error) {
        console.error('[Chat.tsx] Error sending message:', error);
        setIsLoading(false);
      }
      setMentions([]);
    }
  };

  const handleStopStreaming = async () => {
    if (!isLoading) return;

    try {
      const response = await window.electron.chat.stopMessage();
      if (!response.success && response.error) {
        console.error('Error stopping response:', response.error);
      }
    } catch (error) {
      console.error('Error stopping response:', error);
    }
  };

  const handleDeleteQueuedMessage = (messageId: string) => {
    setQueuedMessages((prev) => prev.filter((msg) => msg.id !== messageId));
  };

  const handleEditQueuedMessage = (messageId: string, newText: string) => {
    setQueuedMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, text: newText } : msg))
    );
  };

  const handleSendQueuedMessageImmediately = async (messageId: string) => {
    const queuedMsg = queuedMessages.find((msg) => msg.id === messageId);
    if (!queuedMsg || isLoading) return;

    // Remove from queue
    setQueuedMessages((prev) => prev.filter((msg) => msg.id !== messageId));

    // Send the message
    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: queuedMsg.text,
      timestamp: new Date(),
      attachments: queuedMsg.attachments,
      contextFiles: queuedMsg.contextFiles
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    let serializedAttachments: SerializedAttachmentPayload[] = [];
    if (queuedMsg.attachments && queuedMsg.attachments.length > 0) {
      try {
        // For queued messages, we don't have the original File objects anymore
        // So we can't serialize them. In a real app, you might want to store the files differently.
        // For now, we'll just send the message without the attachments that were queued.
        serializedAttachments = [];
      } catch (error) {
        console.error('Error preparing attachments:', error);
      }
    }

    try {
      let messageContent = queuedMsg.text;
      if (queuedMsg.contextFiles && queuedMsg.contextFiles.length > 0) {
        const mentionContext = queuedMsg.contextFiles
          .map((m) => `- ${m.label} (${m.value})`)
          .join('\n');
        messageContent = `${queuedMsg.text}\n\nContext files:\n${mentionContext}`;
      }

      const response = await window.electron.chat.sendMessage({
        text: messageContent,
        attachments: serializedAttachments.length > 0 ? serializedAttachments : undefined,
        cwd: projectCwd ?? undefined
      });

      if (!response.success && response.error) {
        const errorMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant' as const,
          content: `Error: ${response.error}`,
          timestamp: new Date()
        };
        setMessages((prev) => [...prev, errorMessage]);
        setIsLoading(false);
      }
    } catch (error) {
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  const messageListBottomPadding = chatInputHeight > 0 ? chatInputHeight + 48 : 160;

  const handleNewChatFromTitleBar = async () => {
    await handleNewChat();
    setIsHistoryOpen(false);
  };

  const handleModelPreferenceChange = async (preference: ChatModelPreference) => {
    if (preference === modelPreference) {
      return;
    }

    const previousPreference = modelPreference;
    setModelPreference(preference);
    setIsModelPreferenceUpdating(true);

    try {
      const response = await window.electron.chat.setModelPreference(preference);
      if (!response.success) {
        console.error('Error updating model preference:', response.error);
        setModelPreference(response.preference ?? previousPreference);
      } else if (response.preference) {
        setModelPreference(response.preference);
      }
    } catch (error) {
      console.error('Error updating model preference:', error);
      setModelPreference(previousPreference);
    } finally {
      setIsModelPreferenceUpdating(false);
    }
  };

  return (
    <ThinkingModeProvider>
      <div className="flex h-screen flex-col bg-white dark:bg-neutral-900">
        <TitleBar
          onOpenHistory={() => setIsHistoryOpen((prev) => !prev)}
          onNewChat={handleNewChatFromTitleBar}
          onOpenSettings={onOpenSettings}
        />

        {/* Messages container with padding at bottom for floating input */}
        <div className="flex flex-1 flex-col overflow-hidden pt-[48px]">
          <MessageList
            messages={messages}
            isLoading={isLoading}
            containerRef={messagesContainerRef}
            bottomPadding={messageListBottomPadding}
          />

          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSendMessage}
            isLoading={isLoading}
            onStopStreaming={handleStopStreaming}
            autoFocus
            onHeightChange={setChatInputHeight}
            attachments={pendingAttachments}
            onFilesSelected={handleFilesSelected}
            onRemoveAttachment={handleRemoveAttachment}
            canSend={Boolean(inputValue.trim()) || pendingAttachments.length > 0}
            attachmentError={attachmentError}
            modelPreference={modelPreference}
            onModelPreferenceChange={handleModelPreferenceChange}
            isModelPreferenceUpdating={isModelPreferenceUpdating}
            mentions={mentions}
            onMentionsChange={setMentions}
            workspaceDir={projectCwd ?? workspaceDir ?? undefined}
            conversationId={currentConversationId}
            queuedMessages={queuedMessages}
            onQueueSendImmediate={handleSendQueuedMessageImmediately}
            onQueueDelete={handleDeleteQueuedMessage}
            onQueueEdit={handleEditQueuedMessage}
            isThinking={isThinking}
          />
        </div>

        <ChatHistoryDrawer
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          onLoadConversation={handleLoadConversation}
          currentConversationId={currentConversationId}
          onNewChat={handleNewChat}
        />
      </div>
    </ThinkingModeProvider>
  );
}
