import { useState, useEffect } from 'react';
import type { Entry } from '../types';
import { feedApi } from '../../../services/api';

export type FeedView = 'ingest' | 'entries' | 'kb';

export function useFeed() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [view, setView] = useState<FeedView>('ingest');

  // Ingest state
  const [content, setContent] = useState('');
  const [sources, setSources] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<any>(null);

  // Entries state
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);

  // KB state
  const [kb, setKb] = useState('');
  const [loadingKb, setLoadingKb] = useState(false);

  // Update state
  const [updateInstruction, setUpdateInstruction] = useState('');
  const [updating, setUpdating] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const loadEntries = async () => {
    if (!projectId) return;

    setLoadingEntries(true);
    setError(null);
    try {
      const { entries } = await feedApi.listEntries(projectId);
      setEntries(entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entries');
    } finally {
      setLoadingEntries(false);
    }
  };

  const loadKb = async () => {
    if (!projectId) return;

    setLoadingKb(true);
    setError(null);
    try {
      const { kb } = await feedApi.getKB(projectId);
      setKb(kb);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load KB');
    } finally {
      setLoadingKb(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      if (view === 'entries') {
        loadEntries();
      } else if (view === 'kb') {
        loadKb();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, view]);

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !content.trim()) return;

    setIngesting(true);
    setError(null);
    setIngestResult(null);

    try {
      const sourceList = sources
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const result = await feedApi.ingest(projectId, content, sourceList.length > 0 ? sourceList : undefined);
      setIngestResult(result);
      setContent('');
      setSources('');

      // Reload entries if viewing them
      if (view === 'entries') {
        loadEntries();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ingest failed');
    } finally {
      setIngesting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !updateInstruction.trim()) return;

    setUpdating(true);
    setError(null);

    try {
      const targetIds = selectedEntry ? [selectedEntry.id] : undefined;
      await feedApi.update(projectId, updateInstruction, targetIds);
      setUpdateInstruction('');
      setSelectedEntry(null);
      alert('Update successful!');

      // Reload entries
      loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (entryId: string, hard: boolean = false) => {
    if (!projectId) return;

    const action = hard ? 'hard delete' : 'deprecate';
    if (!confirm(`Are you sure you want to ${action} this entry?`)) return;

    try {
      await feedApi.delete(projectId, [entryId], hard);
      alert(`Entry ${action}d successfully!`);
      loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return {
    projectId,
    setProjectId,
    view,
    setView,
    content,
    setContent,
    sources,
    setSources,
    ingesting,
    ingestResult,
    entries,
    loadingEntries,
    selectedEntry,
    setSelectedEntry,
    kb,
    loadingKb,
    updateInstruction,
    setUpdateInstruction,
    updating,
    error,
    handleIngest,
    handleUpdate,
    handleDelete,
    loadEntries,
    loadKb,
  };
}
