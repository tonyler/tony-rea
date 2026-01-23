import { useThreads } from '../features/threads/hooks/useThreads';
import Button from '../components/Button';
import CopyButton from '../components/CopyButton';
import LoadingSpinner from '../components/LoadingSpinner';
import ProjectSelector from '../components/ProjectSelector';
import Card from '../components/Card';

export default function Threads() {
  const threads = useThreads();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-300/20 to-amber-500/20 border border-amber-400/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </div>
          <h2 className="text-xl font-display font-bold text-cream-50">Thread Generator</h2>
        </div>

        {/* Input Form */}
        <form onSubmit={threads.handleGenerate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-smoke-50 mb-2 tracking-wide">
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
            <label className="block text-sm font-medium text-smoke-50 mb-2 tracking-wide">
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
            <p className="text-sm text-smoke-200 mt-1.5">Default: 8 posts</p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => threads.setShowConstraints(!threads.showConstraints)}
              className="text-sm text-amber-300 hover:text-amber-200 transition-colors mb-2 flex items-center gap-1"
            >
              <span className="text-lg leading-none">{threads.showConstraints ? '−' : '+'}</span>
              {threads.showConstraints ? 'Hide' : 'Add'} Constraints
            </button>
            {threads.showConstraints && (
              <textarea
                value={threads.constraints}
                onChange={(e) => threads.setConstraints(e.target.value)}
                placeholder="e.g., 'Include emojis', 'Use hashtags', 'Focus on technical details'"
                className="textarea animate-slide-down"
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
        <Card className="!border-coral-500/30 !bg-coral-500/5">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-coral-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-coral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-coral-400 text-sm">
              <strong className="font-semibold">Error:</strong> {threads.error}
            </p>
          </div>
        </Card>
      )}

      {/* Thread Result */}
      {threads.thread && (
        <>
          <Card>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-display font-semibold text-cream-50">Generated Thread</h3>
              <Button variant="secondary" onClick={threads.copyAllPosts}>
                Copy All
              </Button>
            </div>

            {/* Compliance Warning */}
            {!threads.thread.compliance.all_under_280 && (
              <div className="mb-5 alert-danger">
                <div className="flex items-start gap-3">
                  <svg className="w-4 h-4 text-coral-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-cream-100 mb-2">
                      Some posts exceed 280 characters
                    </p>
                    <ul className="text-sm text-cream-200 list-disc list-inside">
                      {threads.thread.compliance.violations?.map((v) => (
                        <li key={v.post_index}>
                          Post {v.post_index + 1}: {v.char_count} characters
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
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
                    className={`border rounded-lg p-5 transition-all duration-200 ${
                      isViolation
                        ? 'border-coral-500/40 bg-coral-500/5'
                        : 'border-smoke-400/30 bg-void-400/30 hover:border-smoke-300/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-smoke-50">Post {index + 1}</span>
                      <div className="flex items-center gap-4">
                        <span
                          className={`text-sm font-medium tabular-nums ${
                            isViolation
                              ? 'text-coral-400'
                              : charCount > 260
                              ? 'text-honey-400'
                              : 'text-jade-400'
                          }`}
                        >
                          {charCount}/280
                        </span>
                        <CopyButton text={post} label="Copy" />
                      </div>
                    </div>
                    <p className={`leading-relaxed ${isViolation ? 'text-coral-300' : 'text-cream-100'}`}>
                      {post}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Metadata */}
            {(threads.thread.title || (threads.thread.sources && threads.thread.sources.length > 0)) && (
              <div className="mt-6 pt-5 border-t border-smoke-400/30">
                {threads.thread.title && (
                  <div className="mb-2">
                    <span className="text-sm font-medium text-smoke-50">Title: </span>
                    <span className="text-sm text-cream-200">{threads.thread.title}</span>
                  </div>
                )}
                {threads.thread.sources && threads.thread.sources.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-smoke-50">Sources: </span>
                    <div className="mt-1.5 space-y-1">
                      {threads.thread.sources.map((source, i) => (
                        <a
                          key={i}
                          href={source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block link text-sm"
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
            <h3 className="text-lg font-display font-semibold text-cream-50 mb-5">Save Thread</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-smoke-50 mb-2 tracking-wide">
                  Project
                </label>
                <ProjectSelector value={threads.projectId} onChange={threads.setProjectId} />
              </div>

              <div>
                <label className="block text-sm font-medium text-smoke-50 mb-2 tracking-wide">
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
