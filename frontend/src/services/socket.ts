import { io, Socket } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:4000' : window.location.origin);

export const socket: Socket = io(BACKEND_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling'],
});

// Session ID persistence in LocalStorage
const SESSION_KEY = 'wordlerush_session_id';
const ROOM_KEY = 'wordlerush_room_code';
const PLAYER_ID_KEY = 'wordlerush_player_id';
const DISPLAY_NAME_KEY = 'wordlerush_display_name';
const AVATAR_KEY = 'wordlerush_avatar';

export function saveSession(sessionId: string, roomCode: string, playerId: string, displayName: string, avatar: string) {
  try {
    localStorage.setItem(SESSION_KEY, sessionId);
    localStorage.setItem(ROOM_KEY, roomCode);
    localStorage.setItem(PLAYER_ID_KEY, playerId);
    localStorage.setItem(DISPLAY_NAME_KEY, displayName);
    localStorage.setItem(AVATAR_KEY, avatar);
  } catch (e) {
    console.warn('Failed to save session to localStorage:', e);
  }
}

export function getSavedSession() {
  try {
    const sessionId = localStorage.getItem(SESSION_KEY);
    const roomCode = localStorage.getItem(ROOM_KEY);
    const playerId = localStorage.getItem(PLAYER_ID_KEY);
    const displayName = localStorage.getItem(DISPLAY_NAME_KEY);
    const avatar = localStorage.getItem(AVATAR_KEY);

    if (sessionId && roomCode && playerId) {
      return { sessionId, roomCode, playerId, displayName: displayName || '', avatar: avatar || 'avatar-1' };
    }
  } catch (e) {
    console.warn('Failed to read session from localStorage:', e);
  }
  return null;
}

export function clearSavedSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ROOM_KEY);
    localStorage.removeItem(PLAYER_ID_KEY);
  } catch (e) {
    console.warn('Failed to clear session from localStorage:', e);
  }
}
