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
    <div className="max-w-5xl mx-auto space-y-6">
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-3xl font-hand font-bold text-ink-200">Assistant</h2>
          <svg className="w-8 h-8 text-accent-orange transform rotate-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>

        {/* Mode Selector */}
        <div className="mb-6">
          <label className="block text-lg font-hand font-semibold text-ink-100 mb-3">Pick a mode →</label>
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
            <label className="block text-lg font-hand font-semibold text-ink-100 mb-3">
              📁 Project (Optional)
            </label>
            <ProjectSelector value={assistant.projectId} onChange={assistant.setProjectId} allowNone />
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={assistant.handleSubmit} className="space-y-4">
          <div>
            <label className="block text-lg font-hand font-semibold text-ink-100 mb-3">
              {assistant.mode === 'grammar' ? '✍️ Text' : '💬 Input'}
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
                className="text-sm text-primary-600 hover:text-primary-700 mb-2"
              >
                {assistant.showContext ? '− Hide' : '+ Add'} Context
              </button>
              {assistant.showContext && (
                <textarea
                  value={assistant.context}
                  onChange={(e) => assistant.setContext(e.target.value)}
                  placeholder="Add additional context or information..."
                  className="textarea"
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
        <Card className="border-red-300 bg-red-50">
          <p className="text-red-800">
            <strong>Error:</strong> {assistant.error}
          </p>
        </Card>
      )}

      {/* Result Display */}
      {assistant.result && assistant.mode === 'mod' && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-2xl font-hand font-bold text-ink-200 sketch-underline">Moderator Reply</h3>
              <CopyButton text={(assistant.result as AssistantResponse).reply} />
            </div>

            <div className="prose max-w-none bg-gray-50 p-4 rounded-lg">
              {(assistant.result as AssistantResponse).reply}
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Confidence:</span>
              <span className={`font-medium ${
                (assistant.result as AssistantResponse).confidence === 'high'
                  ? 'text-green-600'
                  : (assistant.result as AssistantResponse).confidence === 'medium'
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`}>
                {(assistant.result as AssistantResponse).confidence}
              </span>
            </div>

            {(assistant.result as AssistantResponse).used_sources && (assistant.result as AssistantResponse).used_sources!.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Sources:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                  {(assistant.result as AssistantResponse).used_sources!.map((source, i) => (
                    <li key={i}>
                      <a href={source} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                        {source}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(assistant.result as AssistantResponse).assumptions && (assistant.result as AssistantResponse).assumptions!.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
                <h4 className="font-medium text-yellow-900 mb-1">Assumptions:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800">
                  {(assistant.result as AssistantResponse).assumptions!.map((assumption, i) => (
                    <li key={i}>{assumption}</li>
                  ))}
                </ul>
              </div>
            )}

            {(assistant.result as AssistantResponse).follow_up_question && (
              <div className="bg-blue-50 border border-blue-200 p-3 rounded">
                <h4 className="font-medium text-blue-900 mb-1">Follow-up Question:</h4>
                <p className="text-sm text-blue-800">{(assistant.result as AssistantResponse).follow_up_question}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {assistant.result && assistant.mode === 'education' && (
        <Card variant="blue">
          <h3 className="text-2xl font-hand font-bold text-ink-200 sketch-underline mb-6">📚 Education Mode</h3>

          <div className="space-y-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
              <p className="text-gray-700">{(assistant.result as EducationResponse).summary}</p>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Key Concepts</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {(assistant.result as EducationResponse).key_concepts.map((concept, i) => (
                  <li key={i}>{concept}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Recommended Answer Structure</h4>
              <p className="text-gray-700">{(assistant.result as EducationResponse).recommended_answer_structure}</p>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">What to Verify</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {(assistant.result as EducationResponse).what_to_verify.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Common Pitfalls</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {(assistant.result as EducationResponse).common_pitfalls.map((pitfall, i) => (
                  <li key={i}>{pitfall}</li>
                ))}
              </ul>
            </div>

            {(assistant.result as EducationResponse).open_questions && (assistant.result as EducationResponse).open_questions!.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Open Questions</h4>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  {(assistant.result as EducationResponse).open_questions!.map((question, i) => (
                    <li key={i}>{question}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {assistant.result && assistant.mode === 'grammar' && (
        <Card variant="green">
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-2xl font-hand font-bold text-ink-200 sketch-underline">✨ Corrected Text</h3>
              <CopyButton text={(assistant.result as GrammarResponse).corrected_text} />
            </div>

            <div className="prose max-w-none bg-gray-50 p-4 rounded-lg">
              {(assistant.result as GrammarResponse).corrected_text}
            </div>

            {(assistant.result as GrammarResponse).changes_made && (assistant.result as GrammarResponse).changes_made!.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Changes Made:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                  {(assistant.result as GrammarResponse).changes_made!.map((change, i) => (
                    <li key={i}>{change}</li>
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
