const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:4000' : window.location.origin);

export async function checkRoomExists(roomCode: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/rooms/${roomCode.toUpperCase()}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { exists: false, error: data.error || 'Room not found' };
    }
    const data = await res.json();
    return { exists: true, room: data.room };
  } catch (err: any) {
    return { exists: false, error: err.message || 'Network error checking room' };
  }
}

export async function validateSecretWordApi(word: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/words/validate-secret`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word }),
    });
    return await res.json();
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}
