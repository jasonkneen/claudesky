import { useCallback, useEffect, useRef, useState } from 'react';

import { GeminiLiveProvider } from '../providers/GeminiLiveProvider';
import type { VoiceProviderCallbacks, VoiceStreamState } from '../types';

export function useVoiceProvider(apiKey: string) {
  const [state, setState] = useState<VoiceStreamState>({
    isConnected: false,
    isListening: false,
    transcript: '',
    error: null
  });

  const providerRef = useRef<GeminiLiveProvider | null>(null);
  const callbacksRef = useRef<VoiceProviderCallbacks>({});

  // Initialize provider and register state change callback
  useEffect(() => {
    const provider = new GeminiLiveProvider(apiKey);
    providerRef.current = provider;

    // Register state change callback for immediate updates
    provider.setStateChangeCallback((newState) => {
      console.log('[useVoiceProvider] State changed:', newState);
      setState({ ...newState });
    });

    return () => {
      provider.disconnect();
    };
  }, [apiKey]);

  const connect = useCallback(async () => {
    try {
      if (providerRef.current) {
        await providerRef.current.connect();
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to connect';
      setState((prev) => ({ ...prev, error: errorMsg }));
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (providerRef.current) {
      await providerRef.current.disconnect();
    }
  }, []);

  const startListening = useCallback(async () => {
    try {
      if (providerRef.current) {
        await providerRef.current.startListening();
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to start listening';
      setState((prev) => ({ ...prev, error: errorMsg }));
    }
  }, []);

  const stopListening = useCallback(async () => {
    if (providerRef.current) {
      await providerRef.current.stopListening();
    }
  }, []);

  const registerCallbacks = useCallback((callbacks: VoiceProviderCallbacks) => {
    callbacksRef.current = callbacks;
    if (providerRef.current) {
      providerRef.current.registerCallbacks(callbacks);
    }
  }, []);

  const setMicrophoneDevice = useCallback((deviceId: string | undefined) => {
    if (providerRef.current) {
      providerRef.current.setMicrophoneDevice(deviceId);
    }
  }, []);

  const enumerateAudioDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === 'audioinput');
    } catch (error) {
      console.error('[VoiceProvider] Failed to enumerate audio devices:', error);
      return [];
    }
  }, []);

  return {
    state,
    connect,
    disconnect,
    startListening,
    stopListening,
    registerCallbacks,
    setMicrophoneDevice,
    enumerateAudioDevices
  };
}
