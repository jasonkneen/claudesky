import { useVoiceProvider, useVoiceSettings } from '@voice-provider/core';
import { useEffect, useState } from 'react';

export default function VoiceSettings() {
  const { settings, updateSettings } = useVoiceSettings();
  const voice = useVoiceProvider(settings.geminiApiKey || '');
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);

  // Load available audio input devices
  useEffect(() => {
    const loadDevices = async () => {
      const devices = await voice.enumerateAudioDevices();
      setAudioDevices(devices);
    };
    loadDevices();
  }, [voice]);

  const handleMicrophoneChange = (deviceId: string) => {
    updateSettings({ microphoneDeviceId: deviceId });
    voice.setMicrophoneDevice(deviceId || undefined);
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          Voice Settings
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Configure voice input options and provider settings.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-neutral-200/80 bg-neutral-50/30 p-4 dark:border-neutral-800 dark:bg-neutral-900/20">
        {/* Voice Provider Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Voice Provider
          </label>
          <select
            value={settings.provider}
            onChange={(e) =>
              updateSettings({ provider: e.target.value as 'gemini' | 'openai' | 'local' })
            }
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-100 dark:focus:border-neutral-300"
          >
            <option value="gemini">Gemini Live API (Default)</option>
            <option value="openai" disabled>
              OpenAI Whisper (Coming soon)
            </option>
            <option value="local" disabled>
              Local Web Speech API (Coming soon)
            </option>
          </select>
        </div>

        {/* Voice Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Voice
          </label>
          <select
            value={settings.voice}
            onChange={(e) => updateSettings({ voice: e.target.value })}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-100 dark:focus:border-neutral-300"
          >
            <option value="Zephyr">Zephyr</option>
            <option value="Breeze">Breeze</option>
            <option value="Luna">Luna</option>
          </select>
        </div>

        {/* Microphone Selection */}
        {audioDevices.length > 0 && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Microphone
            </label>
            <select
              value={settings.microphoneDeviceId || ''}
              onChange={(e) => handleMicrophoneChange(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-100 dark:focus:border-neutral-300"
            >
              <option value="">Default Microphone</option>
              {audioDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Audio Input ${audioDevices.indexOf(device) + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Gemini API Key */}
        {settings.provider === 'gemini' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Gemini API Key
            </label>
            <input
              type="password"
              value={settings.geminiApiKey || ''}
              onChange={(e) => updateSettings({ geminiApiKey: e.target.value })}
              placeholder="Enter your Gemini API key"
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 font-mono text-sm text-neutral-900 placeholder-neutral-400 transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-100 dark:placeholder-neutral-500 dark:focus:border-neutral-300"
            />
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Get your API key from{' '}
              <a
                href="https://ai.google.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                Google AI Studio
              </a>
            </p>
          </div>
        )}

        {/* Auto-Submit on Silence */}
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Auto-submit on silence
            </label>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Automatically send message after 2 seconds of silence
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={settings.autoSubmit}
              onChange={(e) => updateSettings({ autoSubmit: e.target.checked })}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-900 peer-focus:ring-2 peer-focus:ring-neutral-900/20 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-neutral-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white dark:border-neutral-600 dark:bg-neutral-700 dark:peer-checked:bg-neutral-300" />
          </label>
        </div>

        {/* Voice Enabled */}
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Voice input enabled
            </label>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Enable/disable voice input functionality
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => updateSettings({ enabled: e.target.checked })}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-900 peer-focus:ring-2 peer-focus:ring-neutral-900/20 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-neutral-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white dark:border-neutral-600 dark:bg-neutral-700 dark:peer-checked:bg-neutral-300" />
          </label>
        </div>

        {/* Status */}
        <div className="rounded-lg border border-neutral-200/50 bg-white px-3 py-2 text-xs text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
          <p>
            <span className="font-semibold">Provider:</span>{' '}
            {settings.provider === 'gemini' ? 'Gemini Live API' : settings.provider}
          </p>
          <p>
            <span className="font-semibold">Voice:</span> {settings.voice}
          </p>
          <p>
            <span className="font-semibold">Auto-submit:</span>{' '}
            {settings.autoSubmit ? 'Enabled' : 'Disabled'}
          </p>
        </div>
      </div>
    </section>
  );
}
