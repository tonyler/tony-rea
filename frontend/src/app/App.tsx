import { useState } from 'react';
import { AppLayout } from './layout';
import Assistant from '../pages/Assistant';
import Feed from '../pages/Feed';
import Articles from '../pages/Articles';
import ArticleHistory from '../pages/ArticleHistory';
import VoiceAnalyzer from '../pages/VoiceAnalyzer';
import { Login } from '../pages/Login';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

type TabType = 'assistant' | 'feed' | 'articles' | 'history' | 'voice';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('assistant');
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'assistant' && <Assistant />}
      {activeTab === 'feed' && <Feed />}
      {activeTab === 'articles' && <Articles />}
      {activeTab === 'history' && <ArticleHistory />}
      {activeTab === 'voice' && <VoiceAnalyzer />}
    </AppLayout>
  );
}

export default App;
