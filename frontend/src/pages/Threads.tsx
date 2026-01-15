import { useThreads } from '../features/threads/hooks/useThreads';
import Button from '../components/Button';
import CopyButton from '../components/CopyButton';
import LoadingSpinner from '../components/LoadingSpinner';
import ProjectSelector from '../components/ProjectSelector';
import Card from '../components/Card';

export default function Threads() {
  const threads = useThreads();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Card>
        <h2 className="text-2xl font-serif font-semibold mb-6">Thread Generator</h2>

        {/* Input Form */}
        <form onSubmit={threads.handleGenerate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content
            </label>
            <textarea
              value={threads.content}
              onChange={(e) => threads.setContent(e.target.value)}
              placeholder="Enter content to turn into a thread..."
              className="textarea"
              rows={8}
              disabled={threads.generating}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Posts
            </label>
            <input
              type="number"
              value={threads.postCount}
              onChange={(e) => threads.setPostCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 8)))}
              min="1"
              max="50"
              className="input w-32"
              disabled={threads.generating}
            />
            <p className="text-sm text-gray-500 mt-1">Default: 8 posts</p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => threads.setShowConstraints(!threads.showConstraints)}
              className="text-sm text-primary-600 hover:text-primary-700 mb-2"
            >
              {threads.showConstraints ? '− Hide' : '+ Add'} Constraints
            </button>
            {threads.showConstraints && (
              <textarea
                value={threads.constraints}
                onChange={(e) => threads.setConstraints(e.target.value)}
                placeholder="e.g., 'Include emojis', 'Use hashtags', 'Focus on technical details'"
                className="textarea"
                rows={3}
                disabled={threads.generating}
              />
            )}
          </div>

          <Button type="submit" disabled={threads.generating || !threads.content.trim()}>
            {threads.generating ? 'Generating...' : 'Generate Thread'}
          </Button>
        </form>
      </Card>

      {/* Loading State */}
      {threads.generating && (
        <Card>
          <LoadingSpinner message="Generating thread..." />
        </Card>
      )}

      {/* Error State */}
      {threads.error && (
        <Card className="border-red-300 bg-red-50">
          <p className="text-red-800">
            <strong>Error:</strong> {threads.error}
          </p>
        </Card>
      )}

      {/* Thread Result */}
      {threads.thread && (
        <>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Generated Thread</h3>
              <Button variant="secondary" onClick={threads.copyAllPosts}>
                Copy All
              </Button>
            </div>

            {/* Compliance Warning */}
            {!threads.thread.compliance.all_under_280 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-sm font-medium text-red-900 mb-1">
                  ⚠️ Some posts exceed 280 characters!
                </p>
                <ul className="text-sm text-red-800 list-disc list-inside">
                  {threads.thread.compliance.violations?.map((v) => (
                    <li key={v.post_index}>
                      Post {v.post_index + 1}: {v.char_count} characters
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Posts */}
            <div className="space-y-4">
              {threads.thread.posts.map((post, index) => {
                const charCount = post.length;
                const isViolation = charCount > 280;

                return (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 ${
                      isViolation ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Post {index + 1}</span>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-sm font-medium ${
                            isViolation
                              ? 'text-red-600'
                              : charCount > 260
                              ? 'text-yellow-600'
                              : 'text-green-600'
                          }`}
                        >
                          {charCount}/280
                        </span>
                        <CopyButton text={post} label="Copy" />
                      </div>
                    </div>
                    <p className={isViolation ? 'text-red-900' : 'text-gray-900'}>{post}</p>
                  </div>
                );
              })}
            </div>

            {/* Metadata */}
            {(threads.thread.title || (threads.thread.sources && threads.thread.sources.length > 0)) && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                {threads.thread.title && (
                  <div className="mb-2">
                    <span className="text-sm font-medium text-gray-700">Title: </span>
                    <span className="text-sm text-gray-600">{threads.thread.title}</span>
                  </div>
                )}
                {threads.thread.sources && threads.thread.sources.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Sources: </span>
                    <div className="mt-1 space-y-1">
                      {threads.thread.sources.map((source, i) => (
                        <a
                          key={i}
                          href={source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm text-primary-600 hover:underline"
                        >
                          {source}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Save Thread */}
          <Card>
            <h3 className="text-lg font-semibold mb-4">Save Thread</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project
                </label>
                <ProjectSelector value={threads.projectId} onChange={threads.setProjectId} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={threads.saveTitle}
                  onChange={(e) => threads.setSaveTitle(e.target.value)}
                  placeholder="Thread title..."
                  className="input"
                  disabled={threads.saving}
                />
              </div>

              <Button
                onClick={threads.handleSave}
                disabled={threads.saving || !threads.projectId || !threads.saveTitle.trim()}
              >
                {threads.saving ? 'Saving...' : 'Save Thread'}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
