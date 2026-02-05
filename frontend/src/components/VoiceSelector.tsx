import { useEffect, useState } from 'react';
import { voicesApi } from '../services/api';
import { voicesStorage } from '../services/localStorage';
import type { VoiceSummary } from '../features/articles/types';

interface VoiceSelectorProps {
  value: string | null;
  onChange: (handle: string | null) => void;
  allowNone?: boolean;
}

export default function VoiceSelector({ value, onChange, allowNone = false }: VoiceSelectorProps) {
  const [voices, setVoices] = useState<VoiceSummary[]>(() => voicesStorage.getVoices());
  const [loading, setLoading] = useState(() => voicesStorage.getVoices().length === 0);

  useEffect(() => {
    const cached = voicesStorage.getVoices();
    if (cached.length > 0 && !value) {
      onChange(cached[0].handle);
    }
    loadVoices();
  }, []);

  const loadVoices = async () => {
    try {
      const { voices } = await voicesApi.list();
      setVoices(voices);
      voicesStorage.setVoices(voices);

      if (!value && voices.length > 0) {
        onChange(voices[0].handle);
      }
    } catch (error) {
      console.error('Failed to load voices:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-sm text-smoke-100">
        <div className="w-4 h-4 border-2 border-smoke-400/50 border-t-amber-300 rounded-full animate-spin" />
        Loading voices...
      </div>
    );
  }

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="input w-full"
    >
      {allowNone && <option value="">None</option>}
      <option value="" disabled>
        Select a voice
      </option>
      {voices.map((voice) => (
        <option key={voice.handle} value={voice.handle}>
          @{voice.handle}
        </option>
      ))}
    </select>
  );
}
