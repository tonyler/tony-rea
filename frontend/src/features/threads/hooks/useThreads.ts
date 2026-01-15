import { useState } from 'react';
import type { ThreadResult } from '../types';
import { threadsApi } from '../../../services/api';

export function useThreads() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [postCount, setPostCount] = useState(8);
  const [constraints, setConstraints] = useState('');
  const [showConstraints, setShowConstraints] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [thread, setThread] = useState<ThreadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveTitle, setSaveTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setGenerating(true);
    setError(null);
    setThread(null);

    try {
      const { thread } = await threadsApi.generate(
        content,
        postCount,
        constraints || undefined
      );
      setThread(thread);

      // Pre-fill save title if available
      if (thread.title) {
        setSaveTitle(thread.title);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thread generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!projectId || !thread || !saveTitle.trim()) return;

    setSaving(true);
    try {
      await threadsApi.save(projectId, saveTitle, thread.posts, {
        sources: thread.sources,
        compliance: thread.compliance,
      });
      alert('Thread saved successfully!');
      setSaveTitle('');
    } catch (err) {
      alert('Failed to save thread: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const copyAllPosts = () => {
    const allText = thread?.posts.join('\n\n') || '';
    navigator.clipboard.writeText(allText);
  };

  return {
    projectId,
    setProjectId,
    content,
    setContent,
    postCount,
    setPostCount,
    constraints,
    setConstraints,
    showConstraints,
    setShowConstraints,
    generating,
    thread,
    error,
    saveTitle,
    setSaveTitle,
    saving,
    handleGenerate,
    handleSave,
    copyAllPosts,
  };
}
