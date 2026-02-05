import { useState } from 'react';
import { useArticles } from '../features/articles/hooks/useArticles';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import VoiceSelector from '../components/VoiceSelector';
import ProjectSelector from '../components/ProjectSelector';
import Card from '../components/Card';
import { DebateViewer } from '../components/DebateViewer';
import { ArticleChat } from '../components/ArticleChat';
import { DiffModal } from '../components/DiffModal';
import { LLMConfigPanel, estimateCost } from '../components/LLMConfigPanel';

export default function Articles() {
  const articles = useArticles();
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [showLLMConfig, setShowLLMConfig] = useState(false);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Card */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-300/20 to-violet-500/20 border border-violet-400/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h2 className="text-xl font-display font-bold text-cream-50">Articles</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-smoke-50 mb-2 tracking-wide">Voice</label>
            <VoiceSelector value={articles.voiceHandle} onChange={articles.setVoiceHandle} />
          </div>
          <div>
            <label className="block text-sm font-medium text-smoke-50 mb-2 tracking-wide">Project (KB)</label>
            <ProjectSelector value={articles.projectId} onChange={articles.setProjectId} allowNone />
          </div>
        </div>

        <p className="text-sm text-smoke-100">
          Generate long-form articles with {articles.llmConfig.draftModel}, evaluated by a council of judges.
          {articles.projectId && ' Facts will be verified against the project knowledge base.'}
        </p>

        {/* LLM Config Toggle */}
        <button
          onClick={() => setShowLLMConfig(!showLLMConfig)}
          className="mt-4 flex items-center gap-2 text-xs text-smoke-100 hover:text-amber-300 transition-colors"
        >
          <svg
            className={`w-3 h-3 transition-transform ${showLLMConfig ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          LLM Configuration {showLLMConfig ? '' : '(defaults)'}
        </button>

        {showLLMConfig && (
          <LLMConfigPanel config={articles.llmConfig} onChange={articles.setLLMConfig} />
        )}
      </Card>

      {/* Error Display */}
      {articles.error && (
        <Card className="!border-coral-500/30 !bg-coral-500/5">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-coral-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-coral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-coral-400 text-sm">
              <strong className="font-semibold">Error:</strong> {articles.error}
            </p>
          </div>
        </Card>
      )}

      {/* Generation Form */}
      {articles.voiceHandle && !articles.article && (
        <Card>
          <h3 className="text-lg font-display font-semibold text-cream-50 mb-5">Generate Article</h3>

          <form onSubmit={articles.handleGenerate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-smoke-50 mb-2 tracking-wide">Topic / Content</label>
              <textarea
                value={articles.content}
                onChange={(e) => articles.setContent(e.target.value)}
                placeholder="What should the article be about? e.g., 'Why most Cosmos airdrop farmers lose money'"
                className="textarea"
                rows={4}
                disabled={articles.generating}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-smoke-50 mb-2 tracking-wide">Word Count</label>
                <input
                  type="number"
                  value={articles.wordCount}
                  onChange={(e) => articles.setWordCount(Number(e.target.value))}
                  min={100}
                  max={5000}
                  step={100}
                  className="input"
                  disabled={articles.generating}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-smoke-50 mb-2 tracking-wide">Constraints (optional)</label>
                <input
                  type="text"
                  value={articles.constraints}
                  onChange={(e) => articles.setConstraints(e.target.value)}
                  placeholder="e.g., Keep it edgy, use degen slang"
                  className="input"
                  disabled={articles.generating}
                />
              </div>
            </div>

            <Button type="submit" disabled={articles.generating || !articles.content.trim()}>
              {articles.generating ? 'Generating...' : `Generate Article (~$${estimateCost(articles.llmConfig).toFixed(2)})`}
            </Button>
          </form>

          {articles.generating && (
            <div className="mt-6">
              <LoadingSpinner message={`Generating article with ${articles.llmConfig.draftModel}...`} />
              <p className="text-xs text-smoke-200 text-center mt-2">
                This may take 30-60 seconds. The council will evaluate the article.
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Generated Article */}
      {articles.article && (
        <>
          {/* Article Content */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-display font-semibold text-cream-50">{articles.article.title}</h3>
                {articles.article.initialDraft && (
                  <button
                    onClick={() => setShowDiffModal(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25 hover:border-violet-400/50 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                    View Changes
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-smoke-200">
                <span>{articles.article.wordCount} words</span>
                <span>•</span>
                <span>${articles.article.budget.total.toFixed(4)} spent</span>
              </div>
            </div>

            <div className="prose prose-invert prose-sm max-w-none bg-void-400/30 rounded-lg p-4 max-h-96 overflow-y-auto">
              <div className="whitespace-pre-wrap text-cream-200 text-sm leading-relaxed">
                {articles.article.content}
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex gap-3">
                <Button variant="secondary" onClick={articles.clearArticle}>
                  New Article
                </Button>
                <button
                  onClick={() => navigator.clipboard.writeText(articles.article!.content)}
                  className="text-sm text-amber-300 hover:text-amber-200 transition-colors"
                >
                  Copy to Clipboard
                </button>
              </div>
            </div>
          </Card>

          {/* Debate Results */}
          <Card>
            <h3 className="text-lg font-display font-semibold text-cream-50 mb-4">Council Evaluation</h3>
            <DebateViewer
              r1={articles.article.debate.r1}
              r2={articles.article.debate.r2}
              budget={articles.article.budget}
              earlyStop={!articles.article.debate.r2}
            />
          </Card>

          {/* Revision Chat */}
          <Card>
            <h3 className="text-lg font-display font-semibold text-cream-50 mb-4">Revise Article</h3>
            <ArticleChat
              instruction={articles.reviseInstruction}
              onInstructionChange={articles.setReviseInstruction}
              onQuickEdit={articles.handleQuickRevise}
              onReCouncil={articles.handleFullReCouncil}
              revising={articles.revising}
            />
          </Card>

          {/* Diff Modal */}
          {articles.article.initialDraft && (
            <DiffModal
              isOpen={showDiffModal}
              onClose={() => setShowDiffModal(false)}
              initialDraft={articles.article.initialDraft}
              finalArticle={{ title: articles.article.title, content: articles.article.content }}
            />
          )}

          {/* Example Articles Used */}
          {articles.article.exampleArticles && articles.article.exampleArticles.length > 0 && (
            <Card>
              <h3 className="text-lg font-display font-semibold text-cream-50 mb-4">
                Voice Reference ({articles.article.exampleArticles.length} articles)
              </h3>
              <p className="text-xs text-smoke-200 mb-3">
                These articles were used as examples to match the writing style.
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {articles.article.exampleArticles.slice(0, 5).map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border border-smoke-400/20 rounded p-2">
                    <span className="text-cream-100 truncate flex-1 mr-3">{a.title || 'Untitled'}</span>
                    <div className="flex items-center gap-3 text-xs text-smoke-300 flex-shrink-0">
                      <span>{a.views.toLocaleString()} views</span>
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300">
                        View
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* No Project Selected */}
      {!articles.voiceHandle && (
        <Card>
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-smoke-400/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-smoke-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
            </div>
            <p className="text-smoke-100">Select a voice to generate articles.</p>
            <p className="text-xs text-smoke-200 mt-2">
              Voices are created in the Voice Analyzer tab.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
