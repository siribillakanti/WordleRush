import React from 'react';
import { Users, KeyRound, Timer, ArrowRight, Trophy } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { Tile } from '../components/Tile';

interface LandingPageProps {
  onOpenHowToPlay: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenHowToPlay }) => {
  const { setScreen } = useGame();

  return (
    <div className="flex flex-col items-center w-full">
      {/* Hero Section */}
      <section className="w-full max-w-4xl mx-auto px-4 pt-12 pb-16 text-center flex flex-col items-center">
        {/* Top Tagline Label */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-elevatedNavy border border-slate/60 text-secondaryText text-xs font-mono tracking-wider uppercase mb-8 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-correctGreen animate-pulse"></span>
          The Ultimate Word Battle
        </div>

        {/* Main Heading */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-primaryText tracking-tight mb-5 leading-[1.15]">
          Your friends. Your words.{' '}
          <span className="text-correctGreen">
            Your race.
          </span>
        </h1>

        {/* Subheading */}
        <p className="text-base sm:text-lg text-secondaryText max-w-2xl mb-10 leading-relaxed">
          Challenge your friends, solve their secret words and see who can crack the most puzzles before time runs out.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mb-14">
          <button
            onClick={() => setScreen('CREATE_ROOM')}
            className="w-full sm:w-auto px-8 py-3.5 bg-correctGreen hover:bg-correctGreen/90 text-white font-semibold text-base rounded-btn transition-colors flex items-center justify-center gap-2 active:scale-98"
          >
            <span>Create a Room</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => setScreen('JOIN_ROOM')}
            className="w-full sm:w-auto px-8 py-3.5 bg-elevatedNavy hover:bg-slate border border-slate text-primaryText font-semibold text-base rounded-btn transition-colors flex items-center justify-center gap-2 active:scale-98"
          >
            <span>Join a Room</span>
          </button>
        </div>

        {/* Wordle Tiles Visual Preview */}
        <div className="bg-deepNavy border border-slate rounded-card p-4 sm:p-6 flex flex-col items-center gap-3">
          <div className="flex gap-2 sm:gap-3">
            <Tile letter="R" status="correct" index={0} />
            <Tile letter="A" status="correct" index={1} />
            <Tile letter="C" status="present" index={2} />
            <Tile letter="E" status="absent" index={3} />
            <Tile letter="R" status="correct" index={4} />
          </div>
          <span className="text-xs text-secondaryText font-mono">
            3-Minute Shared Countdown • Independent Challenge Grids
          </span>
        </div>
      </section>

      {/* 3-Step How It Works Section */}
      <section className="w-full max-w-5xl mx-auto px-4 py-16 border-t border-slate/30">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-primaryText tracking-tight mb-2">
            How It Works
          </h2>
          <p className="text-sm text-secondaryText">
            Simple to pick up. Pure competitive adrenaline to master.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="bg-deepNavy/60 border border-slate/40 rounded-card p-6 flex flex-col items-start text-left relative overflow-hidden group hover:border-slate/80 transition-all">
            <span className="text-4xl font-mono font-bold text-slate/40 absolute top-4 right-4 select-none">
              01
            </span>
            <div className="w-10 h-10 rounded-btn bg-elevatedNavy flex items-center justify-center text-correctGreen mb-4 border border-slate/40">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-primaryText mb-2">
              Gather your friends.
            </h3>
            <p className="text-sm text-secondaryText leading-relaxed">
              Create a private room in seconds and share the 6-character room code. Supports 2 to 8 players.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-deepNavy/60 border border-slate/40 rounded-card p-6 flex flex-col items-start text-left relative overflow-hidden group hover:border-slate/80 transition-all">
            <span className="text-4xl font-mono font-bold text-slate/40 absolute top-4 right-4 select-none">
              02
            </span>
            <div className="w-10 h-10 rounded-btn bg-elevatedNavy flex items-center justify-center text-presentYellow mb-4 border border-slate/40">
              <KeyRound className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-primaryText mb-2">
              Set your words.
            </h3>
            <p className="text-sm text-secondaryText leading-relaxed">
              Each player contributes one secret five-letter English word. Kept strictly locked and hidden until round end.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-deepNavy/60 border border-slate/40 rounded-card p-6 flex flex-col items-start text-left relative overflow-hidden group hover:border-slate/80 transition-all">
            <span className="text-4xl font-mono font-bold text-slate/40 absolute top-4 right-4 select-none">
              03
            </span>
            <div className="w-10 h-10 rounded-btn bg-elevatedNavy flex items-center justify-center text-rose-400 mb-4 border border-slate/40">
              <Timer className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-primaryText mb-2">
              Beat the clock.
            </h3>
            <p className="text-sm text-secondaryText leading-relaxed">
              Everyone races to solve all opponents' words before the shared 3-minute timer reaches zero.
            </p>
          </div>
        </div>
      </section>

      {/* Leaderboard Preview Section */}
      <section className="w-full max-w-4xl mx-auto px-4 py-14 border-t border-slate/30 mb-10">
        <div className="bg-deepNavy border border-slate/50 rounded-card p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
          <div className="flex flex-col items-start text-left max-w-md">
            <div className="flex items-center gap-2 text-presentYellow font-semibold text-xs uppercase tracking-wider font-mono mb-2">
              <Trophy className="w-4 h-4" />
              Live Racing Experience
            </div>
            <h3 className="text-2xl font-bold text-primaryText mb-3">
              Real-time leaderboard & score tie-breakers
            </h3>
            <p className="text-sm text-secondaryText mb-6">
              Track opponents' progress live without leaking their guesses. Score points based on accuracy and speed.
            </p>
            <button
              onClick={onOpenHowToPlay}
              className="text-xs font-mono font-bold text-correctGreen hover:underline flex items-center gap-1.5"
            >
              <span>Learn scoring rules</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mini preview card */}
          <div className="w-full md:w-72 bg-midnight/80 border border-slate/60 rounded-card p-3.5 flex flex-col gap-2 font-mono text-xs">
            <div className="flex items-center justify-between text-secondaryText pb-1.5 border-b border-slate/40 text-[11px]">
              <span>PLAYER</span>
              <span>SOLVED / SCORE</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-elevatedNavy border border-correctGreen/40">
              <span className="font-sans font-medium text-primaryText">🥇 Siri</span>
              <span className="font-bold text-correctGreen">4/4 • 490 pts</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-midnight border border-slate/30">
              <span className="font-sans font-medium text-primaryText">🥈 Alex</span>
              <span className="text-secondaryText">3/4 • 360 pts</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-midnight border border-slate/30">
              <span className="font-sans font-medium text-primaryText">🥉 Sam</span>
              <span className="text-secondaryText">2/4 • 240 pts</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
