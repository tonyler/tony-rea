import { useState } from 'react';
import type { AssistantMode, AssistantResponse, EducationResponse, GrammarResponse } from '../types';
import { assistantApi } from '../../../services/api';

export function useAssistant() {
  const [mode, setMode] = useState<AssistantMode>('mod');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [context, setContext] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssistantResponse | EducationResponse | GrammarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let response;
      if (mode === 'mod') {
        response = await assistantApi.mod(userInput, context || undefined, projectId || undefined);
      } else if (mode === 'education') {
        response = await assistantApi.education(userInput, context || undefined, projectId || undefined);
      } else {
        response = await assistantApi.grammar(userInput);
      }
      setResult(response.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return {
    mode,
    setMode,
    projectId,
    setProjectId,
    userInput,
    setUserInput,
    context,
    setContext,
    showContext,
    setShowContext,
    loading,
    result,
    error,
    handleSubmit,
  };
}
