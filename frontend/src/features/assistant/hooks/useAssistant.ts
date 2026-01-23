import { useState, useCallback } from 'react';
import type { AssistantMode, AssistantResponse, EducationResponse, GrammarResponse } from '../types';
import { assistantApi, type RetrievalInfo } from '../../../services/api';

export function useAssistant() {
  const [mode, setModeInternal] = useState<AssistantMode>('mod');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [context, setContext] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssistantResponse | EducationResponse | GrammarResponse | null>(null);
  const [retrieval, setRetrieval] = useState<RetrievalInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Clear result when switching modes to prevent type mismatch crashes
  const setMode = useCallback((newMode: AssistantMode) => {
    setModeInternal(newMode);
    setResult(null);
    setRetrieval(null);
    setError(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setRetrieval(null);

    try {
      if (mode === 'mod') {
        const response = await assistantApi.mod(userInput, context || undefined, projectId || undefined);
        setResult(response.result);
        if (response.retrieval) {
          setRetrieval(response.retrieval);
        }
      } else if (mode === 'education') {
        const response = await assistantApi.education(userInput, context || undefined, projectId || undefined);
        setResult(response.result);
        if (response.retrieval) {
          setRetrieval(response.retrieval);
        }
      } else {
        const response = await assistantApi.grammar(userInput);
        setResult(response.result);
      }
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
    retrieval,
    error,
    handleSubmit,
  };
}
