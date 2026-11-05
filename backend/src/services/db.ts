import { PrismaClient } from '@prisma/client';
import { config } from '../config';

let prisma: PrismaClient | null = null;
let isDbConnected = false;

if (config.databaseUrl) {
  try {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: config.databaseUrl,
        },
      },
    });

    // Test connection
    prisma.$connect()
      .then(() => {
        isDbConnected = true;
        console.log('✅ Connected to Supabase PostgreSQL database via Prisma');
      })
      .catch((err) => {
        isDbConnected = false;
        console.warn('⚠️ PostgreSQL connection failed, operating with in-memory persistence:', err.message);
      });
  } catch (error: any) {
    console.warn('⚠️ Prisma initialization error:', error?.message);
    prisma = null;
  }
} else {
  console.log('ℹ️ DATABASE_URL not set: WordleRush is running with in-memory persistence. To persist to Supabase PostgreSQL, set DATABASE_URL in backend/.env');
}

export { prisma, isDbConnected };

/**
 * Helper to safely record game completion to Prisma if DB is connected.
 */
export async function persistGameResults(results: {
  gameId: string;
  roomCode: string;
  rankings: Array<{
    playerId: string;
    displayName: string;
    avatar: string;
    wordsSolved: number;
    totalAttempts: number;
    totalScore: number;
    submittedWord: string;
  }>;
}) {
  if (!prisma || !isDbConnected) return;

  try {
    // Record in database asynchronously without blocking real-time loop
    const room = await prisma.room.findUnique({
      where: { roomCode: results.roomCode },
    });

    if (room) {
      await prisma.room.update({
        where: { id: room.id },
        data: { status: 'FINISHED', endedAt: new Date() },
      });

      // Update or create game record
      const game = await prisma.game.create({
        data: {
          id: results.gameId,
          roomId: room.id,
          status: 'COMPLETED',
          startTime: new Date(Date.now() - config.game.durationSeconds * 1000),
          endTime: new Date(),
        },
      });

      for (const p of results.rankings) {
        await prisma.playerProgress.create({
          data: {
            gameId: game.id,
            playerId: p.playerId,
            wordsSolved: p.wordsSolved,
            totalAttempts: p.totalAttempts,
            totalScore: p.totalScore,
            completedAt: new Date(),
          },
        }).catch(() => {});
      }
    }
  } catch (err: any) {
    console.error('Failed to persist game results to database:', err.message);
  }
}
