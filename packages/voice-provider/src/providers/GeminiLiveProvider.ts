import type { IVoiceProvider, VoiceProviderCallbacks, VoiceStreamState } from '../types';

// Tool definitions for Gemini Live API
const TOOLS_CONFIG = {
  tools: [
    {
      functionDeclarations: [
        {
          name: 'web_search',
          description: 'Search the web for information',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query'
              },
              num_results: {
                type: 'integer',
                description: 'Number of results to return (default: 5)'
              }
            },
            required: ['query']
          }
        },
        {
          name: 'read_file',
          description: 'Read the contents of a file',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The file path to read'
              }
            },
            required: ['path']
          }
        },
        {
          name: 'write_file',
          description: 'Write content to a file',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The file path to write to'
              },
              content: {
                type: 'string',
                description: 'The content to write'
              }
            },
            required: ['path', 'content']
          }
        },
        {
          name: 'run_shell_command',
          description: 'Execute a shell command in the workspace directory',
          parameters: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The shell command to execute'
              }
            },
            required: ['command']
          }
        },
        {
          name: 'handoff_to_agent',
          description: 'Hand off the conversation to a specialized agent with custom instructions',
          parameters: {
            type: 'object',
            properties: {
              agent_type: {
                type: 'string',
                enum: ['coding', 'code_review', 'architecture', 'debugging', 'documentation'],
                description: 'Type of specialized agent to hand off to'
              },
              context: {
                type: 'string',
                description: 'Context and briefing for the receiving agent'
              },
              custom_instructions: {
                type: 'string',
                description: 'Custom instructions for the agent (optional)'
              },
              task_description: {
                type: 'string',
                description: 'Clear description of what the agent should do'
              }
            },
            required: ['agent_type', 'context', 'task_description']
          }
        },
        {
          name: 'code_review',
          description: 'Perform code review on specified files or code snippets',
          parameters: {
            type: 'object',
            properties: {
              file_paths: {
                type: 'array',
                items: { type: 'string' },
                description: 'File paths to review'
              },
              code_snippet: {
                type: 'string',
                description: 'Code snippet to review (if not using file_paths)'
              },
              focus_areas: {
                type: 'array',
                items: { type: 'string' },
                description: 'Areas to focus on: performance, security, readability, testing, etc'
              }
            }
          }
        },
        {
          name: 'suggest_code_fixes',
          description: 'Analyze code and suggest specific fixes or improvements',
          parameters: {
            type: 'object',
            properties: {
              file_path: {
                type: 'string',
                description: 'File path to analyze'
              },
              issue_description: {
                type: 'string',
                description: 'Description of the issue or improvement needed'
              }
            },
            required: ['file_path', 'issue_description']
          }
        }
      ]
    }
  ]
};

interface LiveServerMessage {
  serverContent?: {
    textContent?: {
      text: string;
    };
    modelTurn?: {
      parts?: Array<{ inlineData?: { data: string } }>;
    };
  };
  toolCall?: {
    functionCalls: Array<{
      id: string;
      name: string;
      args: Record<string, any>;
    }>;
  };
}

export class GeminiLiveProvider implements IVoiceProvider {
  state: VoiceStreamState = {
    isConnected: false,
    isListening: false,
    transcript: '',
    error: null
  };

  private apiKey: string;
  private deviceId: string | undefined;
  private session: any = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private silenceTimeout: NodeJS.Timeout | null = null;
  private callbacks: VoiceProviderCallbacks = {};
  private playbackContext: AudioContext | null = null;
  private audioQueue: ArrayBuffer[] = [];
  private isPlaying = false;
  private nextPlayTime = 0;
  private stateChangeCallback: ((state: VoiceStreamState) => void) | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  registerCallbacks(callbacks: VoiceProviderCallbacks): void {
    this.callbacks = callbacks;
  }

  setStateChangeCallback(callback: (state: VoiceStreamState) => void): void {
    this.stateChangeCallback = callback;
  }

  private notifyStateChange(): void {
    if (this.stateChangeCallback) {
      this.stateChangeCallback({ ...this.state });
    }
  }

  setMicrophoneDevice(deviceId: string | undefined): void {
    this.deviceId = deviceId;
  }

  async connect(): Promise<void> {
    try {
      this.state = { ...this.state, error: null };

      // Validate API key
      if (!this.apiKey || this.apiKey.trim().length === 0) {
        const errorMsg =
          'Gemini API key is required. Please provide your API key in Voice Settings.';
        console.error('[VoiceProvider] Connection failed:', errorMsg);
        this.state = { ...this.state, error: errorMsg };
        this.callbacks.onError?.(errorMsg);
        throw new Error(errorMsg);
      }

      console.log('[VoiceProvider] Gemini API Key:', `${this.apiKey.substring(0, 10)}...`);

      // @ts-ignore - @google/genai doesn't have proper type definitions
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: this.apiKey });

      const systemInstruction = `You are an expert software engineer assistant integrated into Claude Agent Desktop. You have deep knowledge of:
- JavaScript, TypeScript, Python, Bash, SQL, and other programming languages
- React, Node.js, Electron, Web APIs, and modern development frameworks
- Software architecture, design patterns, debugging, and best practices
- File systems, command-line tools, APIs, and system administration

You are helping a developer through voice interface. Respond concisely but comprehensively. Provide specific code examples when relevant. Assume technical competence. Focus on practical solutions.`;

      console.log(
        '[VoiceProvider] Connecting to model: gemini-2.5-flash-native-audio-preview-09-2025'
      );
      console.log('[VoiceProvider] Config:', {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        systemInstructionLength: systemInstruction.length
      });

      this.session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: ['AUDIO'] as any,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          },
          systemInstruction,
          ...TOOLS_CONFIG
        } as any,
        callbacks: {
          onopen: () => {
            console.log('[VoiceProvider] ===== ONOPEN FIRED =====');
            this.handleOpen();
          },
          onmessage: ((msg: any) => this.handleMessage(msg)) as any,
          onclose: (closeEvent?: any) => {
            console.log('[VoiceProvider] ===== ONCLOSE FIRED =====');
            console.log('[VoiceProvider] Close event:', closeEvent);
            if (closeEvent) {
              console.log('[VoiceProvider] Close code:', closeEvent.code);
              console.log('[VoiceProvider] Close reason:', closeEvent.reason);
              console.log('[VoiceProvider] Close wasClean:', closeEvent.wasClean);
            }
            this.handleClose();
          },
          onerror: (err: any) => {
            console.log('[VoiceProvider] ===== ONERROR FIRED =====');
            console.log('[VoiceProvider] Error event:', err);
            this.handleError(err);
          }
        }
      });

      console.log('[VoiceProvider] Session object created:', typeof this.session);
      this.state = { ...this.state, isConnected: true };
      this.notifyStateChange();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to connect';
      console.error('[VoiceProvider] Connection failed:', errorMsg, error);
      this.state = { ...this.state, error: errorMsg };
      this.callbacks.onError?.(errorMsg);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    console.log('[VoiceProvider] disconnect() called');
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
    }
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
    }
    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch (err) {
        console.error('[VoiceProvider] Error closing audio context:', err);
      }
    }
    if (this.session) {
      try {
        console.log('[VoiceProvider] Closing session...');
        await this.session.close();
        console.log('[VoiceProvider] Session closed');
      } catch (err) {
        console.error('[VoiceProvider] Error closing session:', err);
      }
    }
    this.state = {
      isConnected: false,
      isListening: false,
      transcript: '',
      error: null
    };
    this.notifyStateChange();
    console.log('[VoiceProvider] disconnect() complete');
  }

  async startListening(): Promise<void> {
    if (!this.session) {
      await this.connect();
    }

    this.state = { ...this.state, isListening: true, transcript: '' };
    this.notifyStateChange();

    try {
      const audioConstraints: MediaStreamConstraints['audio'] =
        this.deviceId ? { deviceId: { exact: this.deviceId } } : true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      this.mediaStream = stream;

      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContext({ sampleRate: 16000 });

      const source = this.audioContext.createMediaStreamSource(stream);
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.state.isListening || !this.session) {
          return;
        }

        try {
          const inputData = e.inputBuffer.getChannelData(0);

          // Convert Float32 (-1.0 to 1.0) to Int16 PCM (little-endian)
          const int16Array = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }

          // Convert to base64
          const uint8Array = new Uint8Array(int16Array.buffer);
          let binary = '';
          for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }
          const base64Audio = btoa(binary);

          // Send in correct format per Gemini Live API docs
          this.session.sendRealtimeInput({
            audio: {
              data: base64Audio,
              mimeType: 'audio/pcm;rate=16000'
            }
          });

          // Reset silence timer on audio activity
          this.resetSilenceTimer();
        } catch (err) {
          console.error('[VoiceProvider] Error sending audio:', err);
        }
      };

      source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);

      // Start silence detection timer
      this.resetSilenceTimer();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Microphone access denied';
      this.state = { ...this.state, error: errorMsg, isListening: false };
      this.notifyStateChange();
      this.callbacks.onError?.(errorMsg);
    }
  }

  async stopListening(): Promise<void> {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
    }

    // Disconnect audio processing nodes to prevent further sends
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
    }

    this.state = { ...this.state, isListening: false };
    this.notifyStateChange();
  }

  private resetSilenceTimer(): void {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
    }

    // Auto-submit after 2 seconds of silence
    this.silenceTimeout = setTimeout(() => {
      if (this.state.isListening && this.state.transcript.trim()) {
        this.callbacks.onSilenceDetected?.();
        this.stopListening();
      }
    }, 2000);
  }

  private handleOpen(): void {
    console.log('[VoiceProvider] Connected to Gemini Live API');
    this.state = { ...this.state, isConnected: true };
    this.notifyStateChange();
  }

  private handleMessage(message: LiveServerMessage): void {
    console.log('[VoiceProvider] Message received:', {
      hasServerContent: !!message.serverContent,
      hasTextContent: !!message.serverContent?.textContent,
      hasModelTurn: !!message.serverContent?.modelTurn,
      hasToolCall: !!message.toolCall,
      keys: Object.keys(message || {})
    });

    // Handle tool calls
    if (message.toolCall?.functionCalls) {
      console.log('[VoiceProvider] Tool calls received:', message.toolCall.functionCalls.length);
      this.handleToolCalls(message.toolCall.functionCalls);
    }

    // Handle text responses from Zephyr
    const text = message.serverContent?.textContent?.text;
    if (text) {
      console.log('[VoiceProvider] Received text:', text);
      this.state = { ...this.state, transcript: this.state.transcript + text };
      this.notifyStateChange();
      this.callbacks.onAssistantText?.(text);
    }

    // Handle audio response
    const parts = message.serverContent?.modelTurn?.parts || [];
    if (parts.length > 0) {
      console.log('[VoiceProvider] Received audio parts:', parts.length);
    }
    for (const part of parts) {
      if (part.inlineData?.data) {
        console.log('[VoiceProvider] Queueing audio data');
        const rawData = Uint8Array.from(atob(part.inlineData.data), (c) => c.charCodeAt(0));
        this.queueAudioPlayback(rawData.buffer as ArrayBuffer);
        this.callbacks.onResponse?.(rawData.buffer as ArrayBuffer, this.state.transcript);
      }
    }
  }

  private queueAudioPlayback(audioData: ArrayBuffer): void {
    this.audioQueue.push(audioData);
    if (!this.isPlaying) {
      this.playNextAudio();
    }
  }

  private async playNextAudio(): Promise<void> {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const audioData = this.audioQueue.shift()!;

    try {
      // Create playback context if needed (24kHz output from Gemini)
      if (!this.playbackContext) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
        this.nextPlayTime = this.playbackContext.currentTime;
      }

      // Resume if suspended (browser autoplay policy)
      if (this.playbackContext.state === 'suspended') {
        await this.playbackContext.resume();
      }

      // Convert Int16 PCM to Float32 for Web Audio API
      const int16Array = new Int16Array(audioData);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      // Create audio buffer and source
      const audioBuffer = this.playbackContext.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.playbackContext.destination);

      // Schedule seamlessly - no gaps between chunks
      const startTime = Math.max(this.nextPlayTime, this.playbackContext.currentTime);
      source.start(startTime);
      this.nextPlayTime = startTime + audioBuffer.duration;

      // Continue processing queue immediately (don't wait for onended)
      if (this.audioQueue.length > 0) {
        this.playNextAudio();
      } else {
        source.onended = () => {
          this.isPlaying = false;
          // Check if more audio arrived while playing
          if (this.audioQueue.length > 0) {
            this.playNextAudio();
          }
        };
      }
    } catch (err) {
      console.error('[VoiceProvider] Error playing audio:', err);
      this.isPlaying = false;
      // Try next chunk
      this.playNextAudio();
    }
  }

  private async handleToolCalls(
    functionCalls: Array<{ id: string; name: string; args: Record<string, any> }>
  ): Promise<void> {
    for (const call of functionCalls) {
      const { id, name, args } = call;
      console.log(`[VoiceProvider] Handling tool call: ${name}`, args);

      try {
        let response: string;

        switch (name) {
          case 'web_search': {
            response = await this.toolWebSearch(args.query, args.num_results || 5);
            break;
          }
          case 'read_file': {
            response = await this.toolReadFile(args.path);
            break;
          }
          case 'write_file': {
            response = await this.toolWriteFile(args.path, args.content);
            break;
          }
          case 'run_shell_command': {
            response = await this.toolRunShellCommand(args.command);
            break;
          }
          case 'handoff_to_agent': {
            response = await this.toolHandoffToAgent(
              args.agent_type,
              args.context,
              args.task_description,
              args.custom_instructions
            );
            break;
          }
          case 'code_review': {
            response = await this.toolCodeReview(
              args.file_paths,
              args.code_snippet,
              args.focus_areas
            );
            break;
          }
          case 'suggest_code_fixes': {
            response = await this.toolSuggestCodeFixes(args.file_path, args.issue_description);
            break;
          }
          default: {
            response = `Unknown tool: ${name}`;
          }
        }

        // Send tool response back to Gemini
        if (this.session) {
          this.session.sendToolResponse({
            functionResponses: {
              id,
              name,
              response
            }
          });
          console.log(`[VoiceProvider] Sent response for tool: ${name}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[VoiceProvider] Tool error (${name}):`, errorMsg);

        if (this.session) {
          this.session.sendToolResponse({
            functionResponses: {
              id,
              name,
              response: `Error executing tool: ${errorMsg}`
            }
          });
        }
      }
    }
  }

  private async toolWebSearch(query: string, numResults: number): Promise<string> {
    console.log('[VoiceProvider] web_search:', query);
    try {
      const response = await fetch(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        return `Failed to search: HTTP ${response.status}`;
      }
      return `Search results for "${query}" would appear here. Please implement actual web search or use an API like Google Custom Search.`;
    } catch (error) {
      return `Search failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async toolReadFile(path: string): Promise<string> {
    console.log('[VoiceProvider] read_file:', path);
    const electronApi = (window as any).electron;
    if (!electronApi?.files?.read) {
      return 'File operations not available in this context.';
    }
    try {
      const result = await electronApi.files.read(path);
      if (result.success) {
        return `File contents of ${path}:\n\n${result.content}`;
      } else {
        return `Failed to read file: ${result.error}`;
      }
    } catch (error) {
      return `Failed to read file: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async toolWriteFile(path: string, content: string): Promise<string> {
    console.log('[VoiceProvider] write_file:', path);
    const electronApi = (window as any).electron;
    if (!electronApi?.files?.write) {
      return 'File operations not available in this context.';
    }
    try {
      const result = await electronApi.files.write(path, content);
      if (result.success) {
        return `Successfully wrote to ${path}`;
      } else {
        return `Failed to write file: ${result.error}`;
      }
    } catch (error) {
      return `Failed to write file: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async toolRunShellCommand(command: string): Promise<string> {
    console.log('[VoiceProvider] run_shell_command:', command);
    const electronApi = (window as any).electron;
    if (!electronApi?.shell?.execute) {
      return 'Shell commands not available in this context.';
    }
    try {
      const result = await electronApi.shell.execute(command);
      if (result.success) {
        let output = `Command executed successfully:\n\n`;
        if (result.output) {
          output += `Output:\n${result.output}`;
        }
        if (result.stderr) {
          output += `\n\nStderr:\n${result.stderr}`;
        }
        return output || 'Command completed with no output.';
      } else {
        return `Command failed: ${result.error}\n\nOutput: ${result.output || '(none)'}\nStderr: ${result.stderr || '(none)'}`;
      }
    } catch (error) {
      return `Failed to execute command: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async toolHandoffToAgent(
    agentType: string,
    context: string,
    taskDescription: string,
    customInstructions?: string
  ): Promise<string> {
    console.log(`[VoiceProvider] Handing off to ${agentType} agent`);
    const electronApi = (window as any).electron;
    if (!electronApi?.chat?.handoffToAgent) {
      return 'Agent handoff not available in this context.';
    }
    try {
      const result = await electronApi.chat.handoffToAgent({
        agentType,
        context,
        taskDescription,
        customInstructions
      });
      if (result?.success) {
        return (
          result.response ||
          `Successfully handed off to ${agentType} agent. The agent will respond in the main chat.`
        );
      } else {
        return `Handoff failed: ${result?.error || 'Unknown error'}`;
      }
    } catch (error) {
      return `Failed to hand off to agent: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async toolCodeReview(
    filePaths?: string[],
    codeSnippet?: string,
    focusAreas?: string[]
  ): Promise<string> {
    console.log('[VoiceProvider] code_review:', { filePaths, focusAreas });
    const electronApi = (window as any).electron;
    if (!electronApi?.chat?.codeReview) {
      return 'Code review not available in this context.';
    }
    if (!filePaths && !codeSnippet) {
      return 'Error: Must provide either file_paths or code_snippet';
    }
    try {
      const result = await electronApi.chat.codeReview({ filePaths, codeSnippet, focusAreas });
      if (result?.success) {
        return (
          result.response || 'Code review request queued. The review will appear in the main chat.'
        );
      } else {
        return `Code review failed: ${result?.error || 'Unknown error'}`;
      }
    } catch (error) {
      return `Code review failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async toolSuggestCodeFixes(filePath: string, issueDescription: string): Promise<string> {
    console.log('[VoiceProvider] suggest_code_fixes:', { filePath, issueDescription });
    const electronApi = (window as any).electron;
    if (!electronApi?.chat?.suggestCodeFixes) {
      return 'Code fix suggestions not available in this context.';
    }
    try {
      const result = await electronApi.chat.suggestCodeFixes({ filePath, issueDescription });
      if (result?.success) {
        return (
          result.response || 'Code fix request queued. Suggestions will appear in the main chat.'
        );
      } else {
        return `Code fix suggestion failed: ${result?.error || 'Unknown error'}`;
      }
    } catch (error) {
      return `Code fix suggestion failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private handleClose(): void {
    console.log('[VoiceProvider] Connection closed');
    console.log('[VoiceProvider] Was connected:', this.state.isConnected);
    console.log('[VoiceProvider] Was listening:', this.state.isListening);

    // If we were listening and the session closes, it might indicate auth failure or server rejection
    if (this.state.isListening) {
      console.warn(
        '[VoiceProvider] WARNING: Connection closed while listening. This may indicate auth failure or invalid API key.'
      );
    }

    this.state = { ...this.state, isConnected: false, isListening: false };
    // Reset session so reconnection is attempted on next startListening
    this.session = null;
  }

  private handleError(error: any): void {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorCode = error?.code || error?.status || 'unknown';
    const errorType = error?.type || 'unknown';
    const errorDetails: any = {
      message: errorMsg,
      code: errorCode,
      type: errorType
    };

    // Extract additional details if available
    if (error?.statusCode) {
      errorDetails.statusCode = error.statusCode;
    }
    if (error?.reason) {
      errorDetails.reason = error.reason;
    }
    if (error?.data) {
      errorDetails.data = error.data;
    }

    console.error('[VoiceProvider] Error received:', errorDetails);

    // Set error state and notify callbacks
    this.state = { ...this.state, error: errorMsg };
    this.callbacks.onError?.(errorMsg);
  }
}
