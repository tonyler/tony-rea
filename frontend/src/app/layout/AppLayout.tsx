import Header from './Header';
import TabNav from './TabNav';

type TabType = 'assistant' | 'feed' | 'threads';

interface AppLayoutProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  children: React.ReactNode;
}

export default function AppLayout({ activeTab, onTabChange, children }: AppLayoutProps) {
  return (
    <div className="min-h-screen">
      <Header />
      <TabNav activeTab={activeTab} onTabChange={onTabChange} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {children}
      </main>

      {/* Decorative doodles */}
      <div className="fixed bottom-8 right-8 pointer-events-none opacity-20">
        <svg className="w-24 h-24 text-accent-blue transform rotate-12" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="5,5" />
          <path d="M 30 30 L 50 50 M 50 50 L 70 30" stroke="currentColor" strokeWidth="3" fill="none" />
        </svg>
      </div>
    </div>
  );
}
