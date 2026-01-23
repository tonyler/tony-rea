import { useState } from 'react';
import { useFeed } from '../features/feed/hooks/useFeed';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import ProjectSelector from '../components/ProjectSelector';
import Card from '../components/Card';
import type { Entry } from '../features/feed/types';

export default function Feed() {
  const feed = useFeed();
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  const toggleEntry = (entryId: string) => {
    setExpandedEntryId(expandedEntryId === entryId ? null : entryId);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-300/20 to-amber-500/20 border border-amber-400/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
            </svg>
          </div>
          <h2 className="text-xl font-display font-bold text-cream-50">Feed</h2>
        </div>

        {/* Project Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-smoke-50 mb-2 tracking-wide">Project</label>
          <ProjectSelector value={feed.projectId} onChange={feed.setProjectId} />
        </div>

        {/* View Selector */}
        {feed.projectId && (
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={feed.view === 'ingest' ? 'primary' : 'secondary'}
              onClick={() => feed.setView('ingest')}
            >
              Ingest
            </Button>
            <Button
              variant={feed.view === 'mcp' ? 'primary' : 'secondary'}
              onClick={() => feed.setView('mcp')}
            >
              MCP Import
            </Button>
            <Button
              variant={feed.view === 'entries' ? 'primary' : 'secondary'}
              onClick={() => feed.setView('entries')}
            >
              Entries
            </Button>
            <Button variant={feed.view === 'kb' ? 'primary' : 'secondary'} onClick={() => feed.setView('kb')}>
              KB
            </Button>
          </div>
        )}
      </Card>

      {/* Error Display */}
      {feed.error && (
        <Card className="!border-coral-500/30 !bg-coral-500/5">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-coral-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-coral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-coral-400 text-sm">
              <strong className="font-semibold">Error:</strong> {feed.error}
            </p>
          </div>
        </Card>
      )}

      {/* Ingest View */}
      {feed.view === 'ingest' && feed.projectId && (
        <Card>
          <h3 className="text-lg font-display font-semibold text-cream-50 mb-5">Ingest Knowledge</h3>

          <form onSubmit={feed.handleIngest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-smoke-50 mb-2 tracking-wide">Content</label>
              <textarea
                value={feed.content}
                onChange={(e) => feed.setContent(e.target.value)}
                placeholder="Paste content to extract knowledge from..."
                className="textarea"
                rows={8}
                disabled={feed.ingesting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-smoke-50 mb-2 tracking-wide">
                Sources (one per line, optional)
              </label>
              <textarea
                value={feed.sources}
                onChange={(e) => feed.setSources(e.target.value)}
                placeholder="https://example.com/source1"
                className="textarea"
                rows={4}
                disabled={feed.ingesting}
              />
            </div>

            <Button type="submit" disabled={feed.ingesting || !feed.content.trim()}>
              {feed.ingesting ? 'Ingesting...' : 'Ingest'}
            </Button>
          </form>

          {feed.ingesting && <LoadingSpinner message="Extracting knowledge..." />}

          {feed.ingestResult && (
            <div className="mt-6 alert-success">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-jade-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-jade-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-cream-100 mb-2">
                    Successfully ingested {feed.ingestResult.count} {feed.ingestResult.count === 1 ? 'entry' : 'entries'}
                  </h4>
                  {feed.ingestResult.entries?.map((entry: Entry, idx: number) => (
                    <div key={entry.id} className={idx > 0 ? 'mt-2 pt-2 border-t border-jade-500/20' : ''}>
                      <p className="text-sm text-cream-200">
                        <span className="font-mono text-jade-300">{entry.id}</span>: {entry.data.title}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* MCP Import View */}
      {feed.view === 'mcp' && feed.projectId && (
        <Card>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-6 h-6 rounded bg-amber-400/20 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
            </div>
            <h3 className="text-lg font-display font-semibold text-cream-50">MCP Import</h3>
          </div>

          <p className="text-sm text-smoke-100 mb-5">
            Connect to an MCP server to import documentation directly. Enter the MCP server URL below.
          </p>

          <form onSubmit={feed.handleMcpExplore} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-smoke-50 mb-2 tracking-wide">MCP Server URL</label>
              <input
                type="url"
                value={feed.mcpUrl}
                onChange={(e) => feed.setMcpUrl(e.target.value)}
                placeholder="https://docs.example.com/~gitbook/mcp"
                className="input"
                disabled={feed.mcpExploring || feed.mcpIngesting}
              />
            </div>

            <Button type="submit" disabled={feed.mcpExploring || !feed.mcpUrl.trim()}>
              {feed.mcpExploring ? 'Connecting...' : 'Connect & Explore'}
            </Button>
          </form>

          {feed.mcpExploring && <LoadingSpinner message="Connecting to MCP server..." />}

          {/* Resource List */}
          {feed.mcpResources.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-cream-100">
                  Available Resources ({feed.mcpResources.length})
                </h4>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={feed.selectAllMcpResources}
                    className="text-sm text-amber-300 hover:text-amber-200 transition-colors"
                  >
                    Select All
                  </button>
                  <span className="text-smoke-300">|</span>
                  <button
                    type="button"
                    onClick={feed.deselectAllMcpResources}
                    className="text-sm text-smoke-100 hover:text-cream-100 transition-colors"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2 border border-smoke-400/30 rounded-lg p-3 bg-void-400/30">
                {feed.mcpResources.map((resource) => {
                  const isSelected = feed.mcpSelectedResources.includes(resource.uri);
                  return (
                    <label
                      key={resource.uri}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-amber-400/10 border border-amber-400/30'
                          : 'bg-void-300/30 border border-transparent hover:border-smoke-400/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => feed.toggleMcpResource(resource.uri)}
                        className="mt-1 w-4 h-4 rounded border-smoke-400 bg-void-300 text-amber-400 focus:ring-amber-400/30"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-cream-100 truncate">{resource.name}</p>
                        {resource.description && (
                          <p className="text-xs text-smoke-100 mt-0.5 line-clamp-2">{resource.description}</p>
                        )}
                        <p className="text-xs text-smoke-200/60 mt-1 font-mono truncate">{resource.uri}</p>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-smoke-100">
                  {feed.mcpSelectedResources.length} of {feed.mcpResources.length} selected
                </p>
                <Button
                  onClick={feed.handleMcpIngest}
                  disabled={feed.mcpIngesting || feed.mcpSelectedResources.length === 0}
                >
                  {feed.mcpIngesting ? 'Ingesting...' : `Ingest ${feed.mcpSelectedResources.length} Resources`}
                </Button>
              </div>
            </div>
          )}

          {feed.mcpIngesting && <LoadingSpinner message="Ingesting resources from MCP server..." />}

          {/* Ingest Results */}
          {feed.mcpIngestResults && (
            <div className="mt-6">
              <div className={`alert-${feed.mcpIngestResults.summary.failed === 0 ? 'success' : 'warning'} mb-4`}>
                <h4 className="font-medium text-cream-100 mb-2">Import Complete</h4>
                <div className="flex gap-4 text-sm">
                  <span className="text-jade-400">
                    {feed.mcpIngestResults.summary.success} succeeded
                  </span>
                  {feed.mcpIngestResults.summary.failed > 0 && (
                    <span className="text-coral-400">
                      {feed.mcpIngestResults.summary.failed} failed
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {feed.mcpIngestResults.results.map((result, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border text-sm ${
                      result.success
                        ? 'bg-jade-500/5 border-jade-500/20'
                        : 'bg-coral-500/5 border-coral-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <svg className="w-4 h-4 text-jade-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-coral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      <span className={result.success ? 'text-cream-100' : 'text-coral-300'}>
                        {result.uri}
                      </span>
                    </div>
                    {result.error && (
                      <p className="text-coral-400 text-xs mt-1 ml-6">{result.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Entries View */}
      {feed.view === 'entries' && feed.projectId && (
        <>
          <Card>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-display font-semibold text-cream-50">Entries</h3>
              <Button variant="secondary" onClick={feed.loadEntries} disabled={feed.loadingEntries}>
                {feed.loadingEntries ? 'Loading...' : 'Refresh'}
              </Button>
            </div>

            {feed.loadingEntries ? (
              <LoadingSpinner message="Loading entries..." />
            ) : feed.entries.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 rounded-full bg-smoke-400/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-smoke-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <p className="text-smoke-100">No entries yet. Ingest some knowledge.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-smoke-200 mb-2">{feed.entries.length} entries</p>
                {feed.entries.map((entry) => {
                  const isExpanded = expandedEntryId === entry.id;
                  return (
                    <div
                      key={entry.id}
                      className={`border rounded-lg transition-all duration-200 bg-void-400/30 ${
                        isExpanded ? 'border-amber-400/50' : 'border-smoke-400/30 hover:border-smoke-300/50'
                      }`}
                    >
                      {/* Clickable header */}
                      <button
                        onClick={() => toggleEntry(entry.id)}
                        className="w-full text-left p-4 flex items-center justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-cream-100 truncate">{entry.data.title}</h4>
                          <div className="flex items-center gap-3 mt-1 text-xs text-smoke-200">
                            <span className="font-mono">{entry.id}</span>
                            {entry.data.date_detected && (
                              <span>{entry.data.date_detected}</span>
                            )}
                            {entry.data.tags && entry.data.tags.length > 0 && (
                              <span className="text-amber-300/70">{entry.data.tags.join(', ')}</span>
                            )}
                          </div>
                        </div>
                        <svg
                          className={`w-5 h-5 text-smoke-200 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-smoke-400/20">
                          {/* Full content */}
                          <div className="mt-4">
                            <h5 className="text-xs font-medium text-smoke-50 uppercase tracking-wider mb-2">Content</h5>
                            <div className="bg-void-300/50 rounded-lg p-4 max-h-80 overflow-y-auto">
                              <pre className="text-sm text-cream-200 whitespace-pre-wrap font-sans leading-relaxed">
                                {entry.data.full_content || '(No content)'}
                              </pre>
                            </div>
                          </div>

                          {/* Sources */}
                          {entry.data.sources && entry.data.sources.length > 0 && (
                            <div className="mt-4">
                              <h5 className="text-xs font-medium text-smoke-50 uppercase tracking-wider mb-2">Sources</h5>
                              <div className="space-y-1">
                                {entry.data.sources.map((source, idx) => (
                                  <a
                                    key={idx}
                                    href={source}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-sm text-amber-300 hover:text-amber-200 transition-colors group"
                                  >
                                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                    <span className="truncate group-hover:underline">{source}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="mt-4 pt-4 border-t border-smoke-400/20 flex gap-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                feed.setSelectedEntry(entry);
                              }}
                              className="text-sm text-amber-300 hover:text-amber-200 transition-colors"
                            >
                              Update
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                feed.handleDelete(entry.id, false);
                              }}
                              className="text-sm text-honey-400 hover:text-honey-300 transition-colors"
                            >
                              Deprecate
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                feed.handleDelete(entry.id, true);
                              }}
                              className="text-sm text-coral-400 hover:text-coral-300 transition-colors"
                            >
                              Delete
                            </button>
                          </div>

                          {/* Metadata */}
                          <div className="mt-3 text-xs text-smoke-200/60">
                            Created: {new Date(entry.created_at).toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {feed.selectedEntry && (
            <Card>
              <h3 className="text-lg font-display font-semibold text-cream-50 mb-5">
                Update Entry: {feed.selectedEntry.data.title}
              </h3>

              <form onSubmit={feed.handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-smoke-50 mb-2 tracking-wide">
                    Update Instruction
                  </label>
                  <textarea
                    value={feed.updateInstruction}
                    onChange={(e) => feed.setUpdateInstruction(e.target.value)}
                    placeholder="Describe how to update this entry..."
                    className="textarea"
                    rows={4}
                    disabled={feed.updating}
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={feed.updating || !feed.updateInstruction.trim()}>
                    {feed.updating ? 'Updating...' : 'Update'}
                  </Button>
                  <Button variant="secondary" onClick={() => feed.setSelectedEntry(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </>
      )}

      {/* KB View - Shows kb-index.md */}
      {feed.view === 'kb' && feed.projectId && (
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-display font-semibold text-cream-50">KB Index</h3>
              <p className="text-sm text-smoke-200 mt-1">
                Entry index used by RAG retrieval (kb-index.md)
              </p>
            </div>
            <Button variant="secondary" onClick={feed.loadKb} disabled={feed.loadingKb}>
              {feed.loadingKb ? 'Loading...' : 'Refresh'}
            </Button>
          </div>

          {feed.loadingKb ? (
            <LoadingSpinner message="Loading KB index..." />
          ) : (
            <div className="bg-void-300/50 rounded-lg p-4 max-h-[500px] overflow-y-auto">
              {feed.kb && feed.kb !== 'No entries yet.' ? (
                <div className="space-y-1">
                  {feed.kb.split('\n').filter(line => line.trim()).map((line, idx) => {
                    const [id, ...titleParts] = line.split(': ');
                    const title = titleParts.join(': ');
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-3 py-2 px-3 rounded hover:bg-void-400/50 transition-colors"
                      >
                        <code className="text-xs text-amber-300/80 font-mono bg-void-400/50 px-2 py-0.5 rounded">
                          {id}
                        </code>
                        <span className="text-sm text-cream-200">{title}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-smoke-200 text-center py-8">No entries yet. Ingest some knowledge.</p>
              )}
            </div>
          )}

          <p className="text-xs text-smoke-300 mt-3">
            The LLM uses this index to select which entries to read when answering questions.
          </p>
        </Card>
      )}

      {!feed.projectId && (
        <Card>
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-smoke-400/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-smoke-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
            </div>
            <p className="text-smoke-100">Select or create a project to get started.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
