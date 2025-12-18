# @voice-provider/core

Complete voice input/output system for Claude Agent Desktop using Gemini Live API.

## Features

- 🎤 Real-time speech-to-text transcription
- 🔊 Voice response audio output
- ⏱️ Automatic silence detection (2s) and message submission
- 🎯 Concurrent text input while voice is active
- 📝 Persistent voice settings (localStorage)
- 🔌 Pluggable provider architecture (Gemini default, OpenAI/Local planned)

## Usage

### Basic Setup

```typescript
import { useVoiceProvider, useVoiceSettings } from '@voice-provider/core';

function ChatComponent() {
  const { settings } = useVoiceSettings();
  const voice = useVoiceProvider(settings.geminiApiKey);

  return (
    <div>
      <button onClick={() => voice.startListening()}>
        {voice.state.isListening ? 'Listening...' : 'Start Voice'}
      </button>

      {voice.state.transcript && (
        <p>Transcription: {voice.state.transcript}</p>
      )}

      {voice.state.error && (
        <p style={{ color: 'red' }}>Error: {voice.state.error}</p>
      )}
    </div>
  );
}
```

### Registering Callbacks

```typescript
useEffect(() => {
  voice.registerCallbacks({
    onTranscript: (text) => {
      console.log('New text:', text);
      // Update message input in real-time
    },
    onResponse: (audio, text) => {
      console.log('Agent responded:', text);
      // Play audio + display text response
    },
    onSilenceDetected: () => {
      console.log('Silence detected - auto-submitting');
      // Submit the message
    },
    onError: (error) => {
      console.error('Voice error:', error);
    }
  });
}, [voice]);
```

### Voice Settings

```typescript
function VoiceSettingsPanel() {
  const { settings, updateSettings } = useVoiceSettings();

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={settings.autoSubmit}
          onChange={(e) => updateSettings({ autoSubmit: e.target.checked })}
        />
        Auto-submit on silence
      </label>

      <label>
        Voice:
        <select
          value={settings.voice}
          onChange={(e) => updateSettings({ voice: e.target.value })}
        >
          <option>Zephyr</option>
          <option>Breeze</option>
          <option>Luna</option>
        </select>
      </label>
    </div>
  );
}
```

## Architecture

```
packages/voice-provider/
├── src/
│   ├── types.ts                 # TypeScript interfaces
│   ├── providers/
│   │   └── GeminiLiveProvider.ts  # Gemini Live API implementation
│   ├── hooks/
│   │   ├── useVoiceProvider.ts    # React hook for provider
│   │   └── useVoiceSettings.ts    # Settings management
│   └── index.ts                 # Public API
├── package.json
├── tsconfig.json
└── README.md
```

## Provider Interface

All providers implement `IVoiceProvider`:

```typescript
interface IVoiceProvider {
  state: VoiceStreamState;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  registerCallbacks(callbacks: VoiceProviderCallbacks): void;
}
```

## Building

```bash
# Build the package
bun run --cwd packages/voice-provider build

# Watch for changes
bun run --cwd packages/voice-provider watch

# Clean
bun run --cwd packages/voice-provider clean
```

## Integration with Main App

Add to `packages.json` dependencies:

```json
{
  "dependencies": {
    "@voice-provider/core": "workspace:*"
  }
}
```

Then import and use in your components:

```typescript
import { useVoiceProvider, useVoiceSettings } from '@voice-provider/core';
```

## API Keys

### Gemini

Set your API key in voice settings:

```typescript
const { settings, updateSettings } = useVoiceSettings();
updateSettings({
  geminiApiKey: 'your-api-key-here'
});
```

Default key is pre-configured for development.

### Future Providers

- **OpenAI**: Whisper (STT) + TTS API
- **Local**: Browser Web Speech API (offline)

## State Management

Voice state includes:

- `isConnected`: Connected to voice service
- `isListening`: Currently recording audio
- `transcript`: Real-time transcript
- `error`: Latest error message

Update listeners automatically track state changes.

## License

MIT
