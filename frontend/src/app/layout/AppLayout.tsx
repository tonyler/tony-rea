import Header from './Header';
import TabNav from './TabNav';

type TabType = 'assistant' | 'feed' | 'articles' | 'history' | 'voice';

interface AppLayoutProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  children: React.ReactNode;
}

export default function AppLayout({ activeTab, onTabChange, children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-void-500 relative">
      {/* Ambient background gradient */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(249, 216, 115, 0.04) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 100% 0%, rgba(249, 150, 80, 0.03) 0%, transparent 40%)
          `
        }}
      />

      <div className="relative z-10">
        <Header />
        <TabNav activeTab={activeTab} onTabChange={onTabChange} />

        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 pb-20 sm:pb-10">
          <div className="animate-slide-up">
            {children}
          </div>
        </main>

        {/* Minimal footer */}
        <footer className="mt-auto py-8 text-center">
          <p className="text-xs text-smoke-200/50 tracking-widest uppercase">
            Tony & Rea
          </p>
        </footer>
      </div>
    </div>
  );
}
