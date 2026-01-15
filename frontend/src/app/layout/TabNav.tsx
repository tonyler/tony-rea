type TabType = 'assistant' | 'feed' | 'threads';

interface TabNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export default function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <div className="bg-paper-100/80 border-b-2 border-ink-100/20 sticky top-0 z-10 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-1">
          <button
            onClick={() => onTabChange('assistant')}
            className={activeTab === 'assistant' ? 'tab-active' : 'tab'}
          >
            🤖 Assistant
          </button>
          <button
            onClick={() => onTabChange('feed')}
            className={activeTab === 'feed' ? 'tab-active' : 'tab'}
          >
            📚 Feed
          </button>
          <button
            onClick={() => onTabChange('threads')}
            className={activeTab === 'threads' ? 'tab-active' : 'tab'}
          >
            🧵 Threads
          </button>
        </nav>
      </div>
    </div>
  );
}
