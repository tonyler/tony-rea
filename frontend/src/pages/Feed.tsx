import { useFeed } from '../features/feed/hooks/useFeed';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import ProjectSelector from '../components/ProjectSelector';
import Card from '../components/Card';

export default function Feed() {
  const feed = useFeed();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Card>
        <h2 className="text-2xl font-serif font-semibold mb-6">Feed</h2>

        {/* Project Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
          <ProjectSelector value={feed.projectId} onChange={feed.setProjectId} />
        </div>

        {/* View Selector */}
        {feed.projectId && (
          <div className="flex gap-2 mb-6">
            <Button
              variant={feed.view === 'ingest' ? 'primary' : 'secondary'}
              onClick={() => feed.setView('ingest')}
            >
              Ingest
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
        <Card className="border-red-300 bg-red-50">
          <p className="text-red-800">
            <strong>Error:</strong> {feed.error}
          </p>
        </Card>
      )}

      {/* Ingest View */}
      {feed.view === 'ingest' && feed.projectId && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Ingest Knowledge</h3>

          <form onSubmit={feed.handleIngest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">Successfully ingested!</h4>
              <p className="text-sm text-green-800">Entry ID: {feed.ingestResult.entry.id}</p>
              <p className="text-sm text-green-800 mt-1">Title: {feed.ingestResult.extracted.title}</p>
              <p className="text-sm text-green-800 mt-1">
                Facts extracted: {feed.ingestResult.extracted.extracted_facts.length}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Entries View */}
      {feed.view === 'entries' && feed.projectId && (
        <>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Entries</h3>
              <Button variant="secondary" onClick={feed.loadEntries} disabled={feed.loadingEntries}>
                {feed.loadingEntries ? 'Loading...' : 'Refresh'}
              </Button>
            </div>

            {feed.loadingEntries ? (
              <LoadingSpinner message="Loading entries..." />
            ) : feed.entries.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No entries yet. Ingest some knowledge!</p>
            ) : (
              <div className="space-y-4">
                {feed.entries.map((entry) => (
                  <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{entry.data.title}</h4>
                      <div className="flex gap-2">
                        <button
                          onClick={() => feed.setSelectedEntry(entry)}
                          className="text-sm text-primary-600 hover:text-primary-700"
                        >
                          Update
                        </button>
                        <button
                          onClick={() => feed.handleDelete(entry.id, false)}
                          className="text-sm text-yellow-600 hover:text-yellow-700"
                        >
                          Deprecate
                        </button>
                        <button
                          onClick={() => feed.handleDelete(entry.id, true)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Facts:</span> {entry.data.extracted_facts.length}
                      {entry.data.tags && entry.data.tags.length > 0 && (
                        <span className="ml-4">
                          <span className="font-medium">Tags:</span> {entry.data.tags.join(', ')}
                        </span>
                      )}
                    </div>

                    {entry.data.date_detected && (
                      <div className="text-sm text-gray-500">Date: {entry.data.date_detected}</div>
                    )}

                    <div className="text-xs text-gray-400 mt-2">ID: {entry.id}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {feed.selectedEntry && (
            <Card>
              <h3 className="text-lg font-semibold mb-4">Update Entry: {feed.selectedEntry.data.title}</h3>

              <form onSubmit={feed.handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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

      {/* KB View */}
      {feed.view === 'kb' && feed.projectId && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Knowledge Base</h3>
            <Button variant="secondary" onClick={feed.loadKb} disabled={feed.loadingKb}>
              {feed.loadingKb ? 'Loading...' : 'Refresh'}
            </Button>
          </div>

          {feed.loadingKb ? (
            <LoadingSpinner message="Loading knowledge base..." />
          ) : (
            <div className="prose max-w-none bg-gray-50 p-6 rounded-lg overflow-auto max-h-[600px]">
              <pre className="whitespace-pre-wrap font-mono text-sm">{feed.kb || 'No knowledge base yet.'}</pre>
            </div>
          )}
        </Card>
      )}

      {!feed.projectId && (
        <Card>
          <p className="text-center text-gray-500 py-8">Select or create a project to get started.</p>
        </Card>
      )}
    </div>
  );
}
