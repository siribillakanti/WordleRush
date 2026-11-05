import React, { useState } from 'react';
import { useGame } from './contexts/GameContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './pages/LandingPage';
import { CreateRoomPage } from './pages/CreateRoomPage';
import { JoinRoomPage } from './pages/JoinRoomPage';
import { LobbyPage } from './pages/LobbyPage';
import { GamePage } from './pages/GamePage';
import { ResultsPage } from './pages/ResultsPage';
import { HowToPlayModal } from './components/Modals/HowToPlayModal';
import { RulesModal } from './components/Modals/RulesModal';
import { PrivacyModal } from './components/Modals/PrivacyModal';
import { AlertCircle } from 'lucide-react';

export const AppContent: React.FC = () => {
  const { screen, notification } = useGame();

  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  const renderScreen = () => {
    switch (screen) {
      case 'LANDING':
        return <LandingPage onOpenHowToPlay={() => setIsHowToPlayOpen(true)} />;
      case 'CREATE_ROOM':
        return <CreateRoomPage />;
      case 'JOIN_ROOM':
        return <JoinRoomPage />;
      case 'LOBBY':
        return <LobbyPage />;
      case 'GAME':
        return <GamePage />;
      case 'RESULTS':
        return <ResultsPage />;
      default:
        return <LandingPage onOpenHowToPlay={() => setIsHowToPlayOpen(true)} />;
    }
  };

  return (
    <div className="min-h-screen bg-midnight text-primaryText flex flex-col font-sans selection:bg-slate selection:text-white">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-elevatedNavy border border-slate text-primaryText px-4 py-2.5 rounded-btn shadow-md flex items-center gap-2.5 text-xs font-mono animate-bounceShort">
          <AlertCircle className="w-4 h-4 text-presentYellow shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Navigation */}
      <Navbar
        onOpenHowToPlay={() => setIsHowToPlayOpen(true)}
        onOpenRules={() => setIsRulesOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-start w-full">
        {renderScreen()}
      </main>

      {/* Footer (hidden only during active live gameplay to maximize screen focus) */}
      {screen !== 'GAME' && (
        <Footer
          onOpenHowToPlay={() => setIsHowToPlayOpen(true)}
          onOpenRules={() => setIsRulesOpen(true)}
          onOpenPrivacy={() => setIsPrivacyOpen(true)}
        />
      )}

      {/* Modals */}
      <HowToPlayModal
        isOpen={isHowToPlayOpen}
        onClose={() => setIsHowToPlayOpen(false)}
      />
      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />
      <PrivacyModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
      />
    </div>
  );
};
