import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  game: {
    durationSeconds: parseInt(process.env.GAME_DURATION_SECONDS || '180', 10), // 3 minutes
    maxAttempts: parseInt(process.env.MAX_ATTEMPTS || '6', 10),
    maxPlayers: parseInt(process.env.MAX_PLAYERS || '8', 10),
    minPlayers: parseInt(process.env.MIN_PLAYERS || '2', 10),
  },
};
