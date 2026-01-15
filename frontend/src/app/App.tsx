import { useState } from 'react';
import { AppLayout } from './layout';
import Assistant from '../pages/Assistant';
import Feed from '../pages/Feed';
import Threads from '../pages/Threads';

type TabType = 'assistant' | 'feed' | 'threads';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('assistant');

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'assistant' && <Assistant />}
      {activeTab === 'feed' && <Feed />}
      {activeTab === 'threads' && <Threads />}
    </AppLayout>
  );
}

export default App;
