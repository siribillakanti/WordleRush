import React from 'react';
import { Logo } from './Logo';
import { HelpCircle, BookOpen, Wifi, WifiOff, Sun, Moon } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { useTheme } from '../contexts/ThemeContext';

interface NavbarProps {
  onOpenHowToPlay: () => void;
  onOpenRules: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenHowToPlay, onOpenRules }) => {
  const { screen, setScreen, leaveRoom, isConnected, hasRejoinableSession, reconnectToSavedSession, dismissRejoinSession } = useGame();
  const { theme, toggleTheme } = useTheme();

  const handleLogoClick = () => {
    if (screen === 'GAME') {
      if (confirm('Are you sure you want to return to home? Your progress in this game may be lost.')) {
        leaveRoom();
        setScreen('LANDING');
      }
    } else {
      setScreen('LANDING');
    }
  };

  return (
    <header className="w-full border-b border-slate bg-deepNavy sticky top-0 z-40 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={handleLogoClick}
          className="hover:opacity-90 transition-opacity focus:outline-none"
        >
          <Logo size="md" />
        </button>

        {/* Rejoin Prompt Banner if user refreshed or disconnected */}
        {hasRejoinableSession && screen === 'LANDING' && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-elevatedNavy border border-correctGreen/50 rounded-btn text-xs font-mono">
            <span className="text-secondaryText">Active Room Detected:</span>
            <button
              onClick={reconnectToSavedSession}
              className="text-correctGreen font-bold hover:underline"
            >
              Rejoin
            </button>
            <span className="text-slate">•</span>
            <button
              onClick={dismissRejoinSession}
              className="text-secondaryText hover:text-primaryText"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Nav Links & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenHowToPlay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs sm:text-sm font-medium text-secondaryText hover:text-primaryText hover:bg-elevatedNavy transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-presentYellow" />
            <span className="hidden sm:inline">How to Play</span>
          </button>

          <button
            onClick={onOpenRules}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs sm:text-sm font-medium text-secondaryText hover:text-primaryText hover:bg-elevatedNavy transition-colors"
          >
            <BookOpen className="w-4 h-4 text-secondaryText" />
            <span className="hidden sm:inline">Rules</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-btn bg-elevatedNavy hover:bg-slate border border-slate text-primaryText transition-colors flex items-center justify-center"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-presentYellow" />
            ) : (
              <Moon className="w-4 h-4 text-primaryText" />
            )}
          </button>

          {/* Connection status indicator */}
          <div
            className="flex items-center justify-center p-1.5 rounded-btn text-xs"
            title={isConnected ? 'Connected to game server' : 'Disconnected, reconnecting...'}
          >
            {isConnected ? (
              <Wifi className="w-4 h-4 text-correctGreen" />
            ) : (
              <WifiOff className="w-4 h-4 text-rose-400 animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
