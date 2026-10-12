/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react';

export const SPEECH_LANGUAGES = [
  { value: 'en-IN', label: 'English (India)' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'mr-IN', label: 'Marathi' },
];

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone is blocked. Click the lock icon in the address bar, set Microphone to Allow, then try again.',
  'service-not-allowed': 'Voice typing is blocked in this browser. Please use Google Chrome or Microsoft Edge.',
  'audio-capture': 'No microphone found. Connect a microphone and try again.',
  network: 'Voice typing needs an internet connection.',
  'language-not-supported': 'This language is not supported for voice typing in this browser.',
};

const getRecognition = () =>
  typeof window === 'undefined' ? undefined : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

// Browser speech-to-text. Keeps listening through pauses until stop() is called.
export function useSpeechToText(language: string, onError: (message: string) => void) {
  const supported = Boolean(getRecognition());
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const recognition = useRef<any>(null);
  const wantListening = useRef(false);
  const finalRef = useRef('');
  const interimRef = useRef('');

  useEffect(
    () => () => {
      wantListening.current = false;
      recognition.current?.abort?.();
    },
    [],
  );

  const start = useCallback(async () => {
    const SpeechRecognition = getRecognition();
    if (!SpeechRecognition) {
      onError('Voice typing is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      onError(ERROR_MESSAGES['not-allowed']);
      return false;
    }
    finalRef.current = '';
    interimRef.current = '';
    setText('');
    setInterim('');
    const instance = new SpeechRecognition();
    recognition.current = instance;
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = language;
    instance.onresult = (event: any) => {
      let current = '';
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const words = event.results[index][0].transcript;
        if (event.results[index].isFinal) finalRef.current = `${finalRef.current} ${words}`.replace(/\s+/g, ' ').trim();
        else current += words;
      }
      interimRef.current = current;
      setText(finalRef.current);
      setInterim(current);
    };
    instance.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      wantListening.current = false;
      setListening(false);
      onError(ERROR_MESSAGES[event.error] || `Voice typing stopped (${event.error}).`);
    };
    instance.onend = () => {
      if (!wantListening.current) {
        setListening(false);
        return;
      }
      try {
        instance.start();
      } catch {
        wantListening.current = false;
        setListening(false);
      }
    };
    wantListening.current = true;
    try {
      instance.start();
    } catch {
      wantListening.current = false;
      onError('Voice typing could not start. Please try again.');
      return false;
    }
    setListening(true);
    return true;
  }, [language, onError]);

  const stop = useCallback(() => {
    wantListening.current = false;
    recognition.current?.stop?.();
    setListening(false);
    return `${finalRef.current} ${interimRef.current}`.replace(/\s+/g, ' ').trim();
  }, []);

  const reset = useCallback(() => {
    finalRef.current = '';
    interimRef.current = '';
    setText('');
    setInterim('');
  }, []);

  return { supported, listening, text, interim, start, stop, reset };
}
