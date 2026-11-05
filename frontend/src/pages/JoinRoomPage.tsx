import React, { useState, useEffect } from 'react';
import { ArrowLeft, KeyRound, Loader2 } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { AvatarPicker } from '../components/AvatarPicker';

export const JoinRoomPage: React.FC = () => {
  const { setScreen, joinRoom, showNotification } = useGame();
  const [roomCode, setRoomCode] = useState('');
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('avatar-2');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check URL query parameters for pre-filled room code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('room');
    if (codeParam) {
      setRoomCode(codeParam.trim().toUpperCase());
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = roomCode.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanCode || cleanCode.length !== 6) {
      setError('Please enter a valid 6-character room code');
      return;
    }
    if (!cleanName) {
      setError('Please enter your display name');
      return;
    }

    setLoading(true);
    setError(null);

    const res = await joinRoom(cleanCode, cleanName, selectedAvatar);
    if (!res.success) {
      setError(res.error || 'Failed to join room');
      showNotification(res.error || 'Failed to join room');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-10 flex flex-col">
      <button
        onClick={() => setScreen('LANDING')}
        className="inline-flex items-center gap-1.5 text-xs text-secondaryText hover:text-primaryText font-mono mb-6 self-start transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Home</span>
      </button>

      <div className="bg-deepNavy border border-slate/60 rounded-card p-6 sm:p-8 shadow-2xl">
        <h2 className="text-2xl font-bold text-primaryText tracking-tight mb-1 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-presentYellow" />
          <span>Join a Room</span>
        </h2>
        <p className="text-xs text-secondaryText font-mono uppercase tracking-wider mb-6">
          Enter code to enter the arena
        </p>

        {error && (
          <div className="mb-5 p-3 rounded-btn bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Room Code */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-secondaryText font-mono font-semibold">
              6-Character Room Code
            </label>
            <input
              type="text"
              autoFocus
              maxLength={6}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="e.g. 7X9K2M"
              className="w-full px-4 py-3 rounded-btn bg-midnight border border-slate/60 text-primaryText placeholder-secondaryText/30 focus:border-presentYellow focus:outline-none transition-colors font-mono font-bold text-base tracking-widest uppercase text-center"
            />
          </div>

          {/* Display Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-secondaryText font-mono font-semibold">
              Your Display Name
            </label>
            <input
              type="text"
              maxLength={16}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. WordMaster"
              className="w-full px-4 py-3 rounded-btn bg-midnight border border-slate/60 text-primaryText placeholder-secondaryText/40 focus:border-correctGreen focus:outline-none transition-colors font-sans text-sm"
            />
          </div>

          {/* Avatar Selection */}
          <AvatarPicker selectedId={selectedAvatar} onSelect={setSelectedAvatar} />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-correctGreen hover:bg-correctGreen/90 text-primaryText font-semibold text-sm rounded-btn transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Joining Room...</span>
              </>
            ) : (
              <span>Join Game Room</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
