import React, { useState } from 'react';
import { ArrowLeft, Clock, Grid3X3, Users, Sparkles, Loader2 } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { AvatarPicker } from '../components/AvatarPicker';

export const CreateRoomPage: React.FC = () => {
  const { setScreen, createRoom, showNotification } = useGame();
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('avatar-1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a display name');
      return;
    }

    setLoading(true);
    setError(null);

    const res = await createRoom(name.trim(), selectedAvatar);
    if (!res.success) {
      setError(res.error || 'Failed to create room');
      showNotification(res.error || 'Failed to create room');
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
          <Sparkles className="w-5 h-5 text-correctGreen" />
          <span>Create a Room</span>
        </h2>
        <p className="text-xs text-secondaryText font-mono uppercase tracking-wider mb-6">
          Host a private WordleRush battle
        </p>

        {error && (
          <div className="mb-5 p-3 rounded-btn bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Display Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-secondaryText font-mono font-semibold">
              Your Display Name
            </label>
            <input
              type="text"
              autoFocus
              maxLength={16}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. WordMaster"
              className="w-full px-4 py-3 rounded-btn bg-midnight border border-slate/60 text-primaryText placeholder-secondaryText/40 focus:border-correctGreen focus:outline-none transition-colors font-sans text-sm"
            />
          </div>

          {/* Avatar Selection */}
          <AvatarPicker selectedId={selectedAvatar} onSelect={setSelectedAvatar} />

          {/* Game Settings Preview */}
          <div className="p-4 rounded-btn bg-midnight/60 border border-slate/40 flex flex-col gap-2.5">
            <span className="text-[11px] uppercase tracking-wider text-secondaryText/80 font-mono font-semibold">
              Game Specifications
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs text-secondaryText">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-presentYellow" />
                <span>3-Minute Timer</span>
              </div>
              <div className="flex items-center gap-2">
                <Grid3X3 className="w-3.5 h-3.5 text-correctGreen" />
                <span>5-Letter Words</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>6 Max Attempts</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-purple-400" />
                <span>2 – 8 Players</span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-correctGreen hover:bg-correctGreen/90 text-primaryText font-semibold text-sm rounded-btn transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Room...</span>
              </>
            ) : (
              <span>Create Private Room</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
