import React, { useState } from 'react';
import {
  Copy,
  Check,
  Crown,
  Play,
  LogOut,
  UserX,
  Lock,
  Loader2,
  CheckCircle2,
  Clock,
  Share2,
} from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { getAvatarById } from '../components/AvatarPicker';

export const LobbyPage: React.FC = () => {
  const {
    room,
    playerId,
    submittedWord,
    submitSecretWord,
    isReady,
    toggleReady,
    startGame,
    leaveRoom,
    kickPlayer,
    showNotification,
  } = useGame();

  const [inputWord, setInputWord] = useState(submittedWord || '');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [submittingWord, setSubmittingWord] = useState(false);
  const [wordError, setWordError] = useState<string | null>(null);
  const [startingGame, setStartingGame] = useState(false);

  if (!room) return null;

  const currentPlayer = room.members.find((m) => m.playerId === playerId);
  const isHost = currentPlayer?.isHost || false;
  const totalPlayers = room.members.length;

  const allWordsSubmitted = room.members.every((m) => m.hasSubmittedWord);
  const allReady = room.members.every((m) => m.isReady);
  const hasMinimumPlayers = totalPlayers >= room.minPlayers;
  const canStartGame = isHost && hasMinimumPlayers && allWordsSubmitted && allReady;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.roomCode);
    setCopiedCode(true);
    showNotification(`Room code ${room.roomCode} copied to clipboard!`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}?room=${room.roomCode}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    showNotification('Invitation link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleWordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputWord.trim().toUpperCase();
    if (clean.length !== 5) {
      setWordError('Your word must contain exactly five letters.');
      return;
    }

    setSubmittingWord(true);
    setWordError(null);

    const res = await submitSecretWord(clean);
    setSubmittingWord(false);

    if (!res.success) {
      setWordError(res.error || 'Invalid secret word');
    }
  };

  const handleStartGame = async () => {
    if (!canStartGame) return;
    setStartingGame(true);
    const res = await startGame();
    if (!res.success) {
      showNotification(res.error || 'Failed to start game');
      setStartingGame(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 flex flex-col gap-8">
      {/* Lobby Header Card */}
      <div className="bg-deepNavy border border-slate/60 rounded-card p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-secondaryText mb-1">
            <span className="w-2 h-2 rounded-full bg-correctGreen animate-pulse"></span>
            <span>Room Lobby • {totalPlayers}/{room.maxPlayers} Players</span>
          </div>
          <h1 className="text-2xl font-bold text-primaryText tracking-tight">
            Preparing the Race
          </h1>
          <p className="text-xs text-secondaryText mt-0.5">
            Submit your secret word and get ready to challenge your opponents.
          </p>
        </div>

        {/* Room Code & Copy Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-btn bg-midnight border border-slate/60 shadow-inner">
            <span className="text-xs font-mono text-secondaryText uppercase tracking-wider">
              Room
            </span>
            <span className="font-mono font-bold text-lg text-primaryText tracking-widest">
              {room.roomCode}
            </span>
            <button
              onClick={handleCopyCode}
              className="p-1.5 text-secondaryText hover:text-primaryText rounded-btn hover:bg-elevatedNavy transition-colors"
              title="Copy Room Code"
            >
              {copiedCode ? <Check className="w-4 h-4 text-correctGreen" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-elevatedNavy hover:bg-slate border border-slate/60 text-secondaryText hover:text-primaryText font-mono text-xs font-semibold rounded-btn transition-colors"
            title="Copy Invite Link"
          >
            {copiedLink ? <Check className="w-4 h-4 text-correctGreen" /> : <Share2 className="w-4 h-4" />}
            <span className="hidden sm:inline">Invite</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Secret Word Submission Card */}
        <div className="md:col-span-1 flex flex-col gap-4">
          <div className="bg-deepNavy border border-slate/60 rounded-card p-5 shadow-xl flex flex-col">
            <div className="flex items-center gap-2 text-primaryText font-bold text-base mb-1">
              <Lock className="w-4 h-4 text-presentYellow" />
              <span>Your Secret Word</span>
            </div>
            <p className="text-xs text-secondaryText leading-relaxed mb-4">
              Enter ONE familiar five-letter English word. All opponents will race to solve this word.
            </p>

            <form onSubmit={handleWordSubmit} className="flex flex-col gap-3">
              <input
                type="text"
                maxLength={5}
                value={inputWord}
                onChange={(e) => {
                  setInputWord(e.target.value.toUpperCase());
                  setWordError(null);
                }}
                placeholder="e.g. APPLE"
                className="w-full px-3 py-2.5 rounded-btn bg-midnight border border-slate/60 text-primaryText font-mono font-bold text-center tracking-widest text-lg uppercase focus:border-correctGreen focus:outline-none transition-colors"
              />

              {wordError && (
                <div className="text-[11px] text-rose-400 bg-rose-950/40 p-2 rounded-btn border border-rose-500/30">
                  {wordError}
                </div>
              )}

              {submittedWord && !wordError && (
                <div className="text-[11px] text-correctGreen flex items-center justify-center gap-1.5 font-mono py-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Submitted: {submittedWord}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submittingWord || inputWord.trim().length !== 5}
                className="w-full py-2.5 bg-elevatedNavy hover:bg-slate border border-slate/60 text-primaryText font-semibold text-xs font-mono uppercase tracking-wider rounded-btn transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submittingWord ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>{submittedWord ? 'Update Secret Word' : 'Lock In Word'}</span>
                )}
              </button>
            </form>

            {/* Ready Toggle */}
            <div className="mt-5 pt-4 border-t border-slate/40 flex flex-col gap-2">
              <button
                type="button"
                onClick={toggleReady}
                disabled={!submittedWord}
                className={`w-full py-2.5 rounded-btn font-semibold text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  isReady
                    ? 'bg-correctGreen text-primaryText shadow-md'
                    : 'bg-midnight/60 hover:bg-elevatedNavy border border-slate/60 text-secondaryText'
                } disabled:opacity-40 disabled:pointer-events-none`}
              >
                {isReady ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-primaryText" />
                    <span>You are Ready</span>
                  </>
                ) : (
                  <span>Click when Ready</span>
                )}
              </button>
              {!submittedWord && (
                <span className="text-[10px] text-secondaryText text-center font-mono">
                  (Submit secret word to mark ready)
                </span>
              )}
            </div>
          </div>

          {/* Leave Room Button */}
          <button
            onClick={leaveRoom}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-btn border border-slate/40 hover:border-rose-500/40 hover:bg-rose-950/20 text-secondaryText hover:text-rose-300 font-mono text-xs transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave Room</span>
          </button>
        </div>

        {/* Right Column: Player Roster & Host Action Bar */}
        <div className="md:col-span-2 flex flex-col gap-4">
          <div className="bg-deepNavy border border-slate/60 rounded-card p-6 shadow-xl flex flex-col flex-1">
            <div className="flex items-center justify-between border-b border-slate/40 pb-3 mb-4">
              <span className="text-xs uppercase tracking-wider text-secondaryText font-mono font-semibold">
                Connected Players ({totalPlayers}/{room.maxPlayers})
              </span>
              <span className="text-xs font-mono text-secondaryText">
                Min. {room.minPlayers} required
              </span>
            </div>

            {/* Player List */}
            <div className="flex flex-col gap-2.5 flex-1">
              {room.members.map((member) => {
                const avatar = getAvatarById(member.avatar);
                const isYou = member.playerId === playerId;
                const isDisconnected = member.connectionStatus === 'DISCONNECTED';

                return (
                  <div
                    key={member.playerId}
                    className={`flex items-center justify-between p-3 rounded-btn border transition-all ${
                      isYou
                        ? 'bg-elevatedNavy/80 border-slate/80 shadow-sm'
                        : 'bg-midnight/40 border-slate/30'
                    } ${isDisconnected ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-btn flex items-center justify-center text-lg border ${avatar.bg}`}>
                        {avatar.emoji}
                      </div>

                      {/* Name & Indicators */}
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-primaryText truncate">
                            {member.displayName}
                          </span>
                          {member.isHost && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-presentYellow/20 text-presentYellow font-mono font-bold border border-presentYellow/30">
                              <Crown className="w-3 h-3" />
                              HOST
                            </span>
                          )}
                          {isYou && (
                            <span className="text-xs text-correctGreen font-mono">
                              (You)
                            </span>
                          )}
                        </div>

                        {/* Word Status Description */}
                        <div className="flex items-center gap-2 text-xs font-mono mt-0.5">
                          {member.hasSubmittedWord ? (
                            <span className="text-correctGreen flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Word submitted
                            </span>
                          ) : (
                            <span className="text-secondaryText/70 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Waiting for word...
                            </span>
                          )}

                          {isDisconnected && (
                            <span className="text-rose-400 text-[10px]">
                              • Disconnected
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side status / kick */}
                    <div className="flex items-center gap-3">
                      {member.isReady ? (
                        <span className="px-2.5 py-1 rounded bg-correctGreen/20 text-correctGreen font-mono font-bold text-xs border border-correctGreen/30">
                          READY
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded bg-slate/30 text-secondaryText font-mono text-xs">
                          NOT READY
                        </span>
                      )}

                      {/* Host Kick Option for other players */}
                      {isHost && !member.isHost && (
                        <button
                          onClick={() => kickPlayer(member.playerId)}
                          className="p-1.5 text-secondaryText/60 hover:text-rose-400 rounded hover:bg-midnight transition-colors"
                          title="Remove player"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Host Start Game Controls */}
            {isHost ? (
              <div className="mt-6 pt-4 border-t border-slate/40 flex flex-col gap-2">
                <button
                  onClick={handleStartGame}
                  disabled={!canStartGame || startingGame}
                  className="w-full py-4 bg-correctGreen hover:bg-correctGreen/90 text-primaryText font-bold text-base rounded-btn transition-all shadow-xl disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 active:scale-98"
                >
                  {startingGame ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Starting Race...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 fill-current" />
                      <span>Start Game</span>
                    </>
                  )}
                </button>

                {!canStartGame && (
                  <p className="text-xs text-secondaryText text-center font-mono">
                    {!hasMinimumPlayers
                      ? `Waiting for at least ${room.minPlayers} players to join.`
                      : !allWordsSubmitted
                      ? 'Waiting for all players to submit their secret word.'
                      : 'Waiting for all players to click Ready.'}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-6 pt-4 border-t border-slate/40 text-center">
                <div className="inline-flex items-center gap-2 text-xs font-mono text-secondaryText">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-presentYellow" />
                  <span>Waiting for the host to start the game...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
