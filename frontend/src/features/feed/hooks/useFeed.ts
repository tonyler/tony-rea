import { useState, useEffect } from 'react';
import type { Entry } from '../types';
import { feedApi, type MCPResource, type MCPIngestResult } from '../../../services/api';

export type FeedView = 'ingest' | 'entries' | 'kb' | 'mcp';

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

  // MCP state
  const [mcpUrl, setMcpUrl] = useState('');
  const [mcpResources, setMcpResources] = useState<MCPResource[]>([]);
  const [mcpSelectedResources, setMcpSelectedResources] = useState<string[]>([]);
  const [mcpExploring, setMcpExploring] = useState(false);
  const [mcpIngesting, setMcpIngesting] = useState(false);
  const [mcpIngestResults, setMcpIngestResults] = useState<{
    summary: { total: number; success: number; failed: number };
    results: MCPIngestResult[];
  } | null>(null);

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

  // MCP handlers
  const handleMcpExplore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mcpUrl.trim()) return;

    setMcpExploring(true);
    setError(null);
    setMcpResources([]);
    setMcpSelectedResources([]);
    setMcpIngestResults(null);

    try {
      const { resources } = await feedApi.mcpExplore(mcpUrl);
      setMcpResources(resources);
      // Select all by default
      setMcpSelectedResources(resources.map(r => r.uri));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to MCP server');
    } finally {
      setMcpExploring(false);
    }
  };

  const handleMcpIngest = async () => {
    if (!projectId || !mcpUrl.trim() || mcpSelectedResources.length === 0) return;

    setMcpIngesting(true);
    setError(null);
    setMcpIngestResults(null);

    try {
      const result = await feedApi.mcpIngest(mcpUrl, projectId, mcpSelectedResources);
      setMcpIngestResults(result);

      // Reload entries
      loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MCP ingestion failed');
    } finally {
      setMcpIngesting(false);
    }
  };

  const toggleMcpResource = (uri: string) => {
    setMcpSelectedResources(prev =>
      prev.includes(uri) ? prev.filter(u => u !== uri) : [...prev, uri]
    );
  };

  const selectAllMcpResources = () => {
    setMcpSelectedResources(mcpResources.map(r => r.uri));
  };

  const deselectAllMcpResources = () => {
    setMcpSelectedResources([]);
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
    // MCP
    mcpUrl,
    setMcpUrl,
    mcpResources,
    mcpSelectedResources,
    mcpExploring,
    mcpIngesting,
    mcpIngestResults,
    handleMcpExplore,
    handleMcpIngest,
    toggleMcpResource,
    selectAllMcpResources,
    deselectAllMcpResources,
  };
}
