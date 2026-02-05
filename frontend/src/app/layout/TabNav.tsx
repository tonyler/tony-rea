type TabType = 'assistant' | 'feed' | 'articles' | 'history' | 'voice';

interface TabNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

interface TabConfig {
  key: TabType;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
}

const tabs: TabConfig[] = [
  {
    key: 'assistant',
    label: 'Assistant',
    shortLabel: 'Assist',
    icon: (
      <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    )
  },
  {
    key: 'feed',
    label: 'Feed',
    shortLabel: 'Feed',
    icon: (
      <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
      </svg>
    )
  },
  {
    key: 'articles',
    label: 'Articles',
    shortLabel: 'Articles',
    icon: (
      <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    )
  },
  {
    key: 'history',
    label: 'History',
    shortLabel: 'History',
    icon: (
      <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    key: 'voice',
    label: 'Voice Analyzer',
    shortLabel: 'Voice',
    icon: (
      <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 100-12 6 6 0 000 12zM12 3v.75m0 16.5V21m9-9h-.75M3.75 12H3m15.45 6.45l-.53-.53m-12.39-12.39l-.53-.53m12.39 0l.53-.53M5.25 18.75l.53-.53" />
      </svg>
    )
  },
];

export default function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <div className="
      fixed bottom-0 left-0 right-0 z-50
      sm:static sm:sticky sm:top-0 sm:z-20
      backdrop-blur-md bg-void-500/95 sm:bg-void-500/80
      border-t sm:border-t-0 sm:border-b border-smoke-400/15
      safe-area-bottom
    ">
      <nav
        className="
          flex justify-around sm:justify-start
          gap-0 sm:gap-1
          overflow-x-auto scrollbar-hide
          max-w-5xl mx-auto px-2 sm:px-6 lg:px-8
        "
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`
                relative flex flex-col sm:flex-row items-center
                gap-1 sm:gap-2
                px-3 sm:px-4 lg:px-5
                py-2 sm:py-3.5
                text-xs sm:text-sm font-medium tracking-wide
                transition-all duration-200 cursor-pointer
                min-w-0 flex-shrink-0
                ${isActive
                  ? 'text-amber-300'
                  : 'text-smoke-100 hover:text-cream-100'
                }
              `}
              role="tab"
              aria-selected={isActive}
            >
              <span className={isActive ? 'text-amber-300' : ''}>{tab.icon}</span>
              {/* Mobile: short label, hidden on very small screens */}
              <span className="hidden xs:inline sm:hidden">{tab.shortLabel}</span>
              {/* Desktop: full label */}
              <span className="hidden sm:inline">{tab.label}</span>

              {/* Active indicator - dot on mobile, line on desktop */}
              <span
                className={`
                  sm:absolute sm:bottom-0 sm:left-1/2 sm:-translate-x-1/2
                  transition-all duration-300 ease-out
                  ${isActive
                    ? 'w-1.5 h-1.5 sm:w-full sm:h-0.5 rounded-full bg-amber-300 sm:bg-gradient-to-r sm:from-transparent sm:via-amber-300 sm:to-transparent'
                    : 'w-0 h-0 sm:w-0 sm:h-0.5 bg-amber-300'
                  }
                `}
              />
            </button>
          );
        })}
      </nav>
    </div>
  );
}
