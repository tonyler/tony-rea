import type { AssistantResponse, EducationResponse, GrammarResponse } from '../features/assistant/types';
import { useAssistant } from '../features/assistant/hooks/useAssistant';
import Button from '../components/Button';
import CopyButton from '../components/CopyButton';
import LoadingSpinner from '../components/LoadingSpinner';
import ProjectSelector from '../components/ProjectSelector';
import Card from '../components/Card';

export default function Assistant() {
  const assistant = useAssistant();

  const getModeLabel = () => {
    switch (assistant.mode) {
      case 'mod':
        return 'Moderator Reply';
      case 'education':
        return 'Education';
      case 'grammar':
        return 'Grammar Check';
    }
  };

  const getInputPlaceholder = () => {
    switch (assistant.mode) {
      case 'mod':
        return 'Enter the user question or message...';
      case 'education':
        return 'What topic do you want to teach?';
      case 'grammar':
        return 'Enter text to check for grammar and spelling...';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-300/20 to-amber-500/20 border border-amber-400/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <h2 className="text-xl font-display font-bold text-cream-50">Assistant</h2>
        </div>

        {/* Mode Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-smoke-50 mb-3 tracking-wide">Mode</label>
          <div className="flex gap-2">
            <Button
              variant={assistant.mode === 'mod' ? 'primary' : 'secondary'}
              onClick={() => assistant.setMode('mod')}
            >
              Mod
            </Button>
            <Button
              variant={assistant.mode === 'education' ? 'primary' : 'secondary'}
              onClick={() => assistant.setMode('education')}
            >
              Education
            </Button>
            <Button
              variant={assistant.mode === 'grammar' ? 'primary' : 'secondary'}
              onClick={() => assistant.setMode('grammar')}
            >
              Grammar
            </Button>
          </div>
        </div>

        {/* Project Selector (not for grammar mode) */}
        {assistant.mode !== 'grammar' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-smoke-50 mb-2 tracking-wide">
              Project (Optional)
            </label>
            <ProjectSelector value={assistant.projectId} onChange={assistant.setProjectId} />
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={assistant.handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-smoke-50 mb-2 tracking-wide">
              {assistant.mode === 'grammar' ? 'Text' : 'Input'}
            </label>
            <textarea
              value={assistant.userInput}
              onChange={(e) => assistant.setUserInput(e.target.value)}
              placeholder={getInputPlaceholder()}
              className="textarea"
              rows={6}
              disabled={assistant.loading}
            />
          </div>

          {/* Context (not for grammar mode) */}
          {assistant.mode !== 'grammar' && (
            <div>
              <button
                type="button"
                onClick={() => assistant.setShowContext(!assistant.showContext)}
                className="text-sm text-amber-300 hover:text-amber-200 transition-colors mb-2 flex items-center gap-1"
              >
                <span className="text-lg leading-none">{assistant.showContext ? '−' : '+'}</span>
                {assistant.showContext ? 'Hide' : 'Add'} Context
              </button>
              {assistant.showContext && (
                <textarea
                  value={assistant.context}
                  onChange={(e) => assistant.setContext(e.target.value)}
                  placeholder="Add additional context or information..."
                  className="textarea animate-slide-down"
                  rows={4}
                  disabled={assistant.loading}
                />
              )}
            </div>
          )}

          <Button type="submit" disabled={assistant.loading || !assistant.userInput.trim()}>
            {assistant.loading ? 'Processing...' : 'Submit'}
          </Button>
        </form>
      </Card>

      {/* Loading State */}
      {assistant.loading && (
        <Card>
          <LoadingSpinner message={`Generating ${getModeLabel().toLowerCase()}...`} />
        </Card>
      )}

      {/* Error State */}
      {assistant.error && (
        <Card className="!border-coral-500/30 !bg-coral-500/5">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-coral-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-coral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-coral-400 text-sm">
              <strong className="font-semibold">Error:</strong> {assistant.error}
            </p>
          </div>
        </Card>
      )}

      {/* Result Display - Mod Mode */}
      {assistant.result && assistant.mode === 'mod' && (
        <Card>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-display font-semibold text-cream-50">Moderator Reply</h3>
              <CopyButton text={(assistant.result as AssistantResponse).reply} />
            </div>

            <div className="result-box">
              {(assistant.result as AssistantResponse).reply}
            </div>

            {/* Sources from retrieved entries */}
            {assistant.retrieval?.sources && assistant.retrieval.sources.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-smoke-200">Source:</span>
                {assistant.retrieval.sources.map((source, i) => (
                  <a
                    key={i}
                    href={source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-300 hover:text-amber-200 hover:underline transition-colors truncate max-w-md"
                  >
                    {source.includes('discord.com') ? 'Discord' : new URL(source).hostname}
                  </a>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 text-sm">
              <span className="text-smoke-100">Confidence:</span>
              <span className={`font-medium ${
                (assistant.result as AssistantResponse).confidence === 'high'
                  ? 'badge-success'
                  : (assistant.result as AssistantResponse).confidence === 'medium'
                  ? 'badge-warning'
                  : 'badge-danger'
              }`}>
                {(assistant.result as AssistantResponse).confidence}
              </span>
            </div>


            {(assistant.result as AssistantResponse).assumptions && (assistant.result as AssistantResponse).assumptions!.length > 0 && (
              <div className="alert-warning">
                <h4 className="font-medium text-cream-100 mb-2">Assumptions</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-cream-200">
                  {(assistant.result as AssistantResponse).assumptions!.map((assumption, i) => (
                    <li key={i}>{assumption}</li>
                  ))}
                </ul>
              </div>
            )}

            {(assistant.result as AssistantResponse).follow_up_question && (
              <div className="alert-info">
                <h4 className="font-medium text-cream-100 mb-2">Follow-up Question</h4>
                <p className="text-sm text-cream-200">{(assistant.result as AssistantResponse).follow_up_question}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Result Display - Education Mode */}
      {assistant.result && assistant.mode === 'education' && (() => {
        const edu = assistant.result as EducationResponse;
        return (
          <Card>
            <h3 className="text-lg font-display font-semibold text-cream-50 mb-6">Education Mode</h3>

            <div className="space-y-6">
              {edu.summary && (
                <div>
                  <h4 className="font-medium text-cream-100 mb-2">Summary</h4>
                  <p className="text-cream-200 leading-relaxed">{edu.summary}</p>
                </div>
              )}

              {edu.key_concepts && edu.key_concepts.length > 0 && (
                <>
                  <div className="divider" />
                  <div>
                    <h4 className="font-medium text-cream-100 mb-2">Key Concepts</h4>
                    <ul className="list-disc list-inside space-y-1.5 text-cream-200">
                      {edu.key_concepts.map((concept, i) => (
                        <li key={i}>{concept}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {edu.recommended_answer_structure && (
                <>
                  <div className="divider" />
                  <div>
                    <h4 className="font-medium text-cream-100 mb-2">Recommended Answer Structure</h4>
                    <p className="text-cream-200 leading-relaxed">{edu.recommended_answer_structure}</p>
                  </div>
                </>
              )}

              {edu.what_to_verify && edu.what_to_verify.length > 0 && (
                <>
                  <div className="divider" />
                  <div>
                    <h4 className="font-medium text-cream-100 mb-2">What to Verify</h4>
                    <ul className="list-disc list-inside space-y-1.5 text-cream-200">
                      {edu.what_to_verify.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {edu.common_pitfalls && edu.common_pitfalls.length > 0 && (
                <>
                  <div className="divider" />
                  <div>
                    <h4 className="font-medium text-cream-100 mb-2">Common Pitfalls</h4>
                    <ul className="list-disc list-inside space-y-1.5 text-cream-200">
                      {edu.common_pitfalls.map((pitfall, i) => (
                        <li key={i}>{pitfall}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {edu.open_questions && edu.open_questions.length > 0 && (
                <>
                  <div className="divider" />
                  <div>
                    <h4 className="font-medium text-cream-100 mb-2">Open Questions</h4>
                    <ul className="list-disc list-inside space-y-1.5 text-cream-200">
                      {edu.open_questions.map((question, i) => (
                        <li key={i}>{question}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {/* Sources from retrieved entries */}
              {assistant.retrieval?.sources && assistant.retrieval.sources.length > 0 && (
                <>
                  <div className="divider" />
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-smoke-200">Source:</span>
                    {assistant.retrieval.sources.map((source, i) => (
                      <a
                        key={i}
                        href={source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-300 hover:text-amber-200 hover:underline transition-colors truncate max-w-md"
                      >
                        {source.includes('discord.com') ? 'Discord' : new URL(source).hostname}
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Card>
        );
      })()}

      {/* Result Display - Grammar Mode */}
      {assistant.result && assistant.mode === 'grammar' && (
        <Card>
          <div className="space-y-5 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              <h3 className="text-lg font-display font-semibold text-cream-50">Corrected Text</h3>
              <CopyButton text={(assistant.result as GrammarResponse).corrected_text} />
            </div>

            <div className="result-box whitespace-pre-wrap">
              {(assistant.result as GrammarResponse).corrected_text}
            </div>

            {(assistant.result as GrammarResponse).changes_made && (assistant.result as GrammarResponse).changes_made!.length > 0 && (
              <div className="min-w-0">
                <h4 className="font-medium text-cream-100 mb-2">Changes Made</h4>
                <ul className="list-disc list-inside space-y-1.5 text-sm text-cream-200 break-words">
                  {(assistant.result as GrammarResponse).changes_made!.map((change, i) => (
                    <li key={i} className="break-words">{change}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
