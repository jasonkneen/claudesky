export type VoiceProviderType = 'gemini' | 'openai' | 'local';

export interface VoiceSettings {
  provider: VoiceProviderType;
  enabled: boolean;
  geminiApiKey?: string;
  openaiApiKey?: string;
  autoSubmit: boolean;
  voice: string;
  microphoneDeviceId?: string;
}

export interface VoiceStreamState {
  isConnected: boolean;
  isListening: boolean;
  transcript: string;
  error: string | null;
}

export interface VoiceProviderCallbacks {
  onUserTranscript?: (text: string) => void; // What the USER said (for input field)
  onAssistantText?: (text: string) => void; // What Zephyr responds with (for chat)
  onResponse?: (audio: ArrayBuffer, text: string) => void;
  onError?: (error: string) => void;
  onSilenceDetected?: () => void;
}

export interface IVoiceProvider {
  state: VoiceStreamState;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  registerCallbacks(callbacks: VoiceProviderCallbacks): void;
  setStateChangeCallback(callback: (state: VoiceStreamState) => void): void;
}
