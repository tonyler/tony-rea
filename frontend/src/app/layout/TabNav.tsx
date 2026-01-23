type TabType = 'assistant' | 'feed' | 'threads';

interface TabNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
  {
    key: 'assistant',
    label: 'Assistant',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    )
  },
  {
    key: 'feed',
    label: 'Feed',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
      </svg>
    )
  },
  {
    key: 'threads',
    label: 'Threads',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    )
  },
];

export default function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <div className="sticky top-0 z-20 backdrop-blur-md bg-void-500/80 border-b border-smoke-400/15">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <nav className="flex gap-1" role="tablist">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`
                  relative flex items-center gap-2 px-5 py-3.5
                  text-sm font-medium tracking-wide
                  transition-all duration-200 cursor-pointer
                  ${isActive
                    ? 'text-amber-300'
                    : 'text-smoke-100 hover:text-cream-100'
                  }
                `}
                role="tab"
                aria-selected={isActive}
              >
                <span className={isActive ? 'text-amber-300' : ''}>{tab.icon}</span>
                {tab.label}

                {/* Active indicator line */}
                <span
                  className={`
                    absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full
                    transition-all duration-300 ease-out
                    ${isActive
                      ? 'w-full bg-gradient-to-r from-transparent via-amber-300 to-transparent'
                      : 'w-0 bg-amber-300'
                    }
                  `}
                />
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
