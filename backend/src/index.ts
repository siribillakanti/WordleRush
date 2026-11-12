import express, { Request, Response } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { config } from './config';
import { setupSocketHandlers } from './sockets/socketHandler';
import { roomManager } from './services/roomManager';
import { validateSecretWord, validateGuess, getAnswersCount, getGuessesCount } from './game/wordValidator';
import './services/db'; // Initializes DB connection

const app = express();
const server = http.createServer(app);

// Explicit allowed origins for REST and WebSockets (no wildcard subdomains)
const allowedOrigins = [
  'https://wordle-rush-neon.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(config.clientUrl && !['http://localhost:5173', 'http://127.0.0.1:5173', 'https://wordle-rush-neon.vercel.app'].includes(config.clientUrl) ? [config.clientUrl] : []),
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server tests) or explicit matched origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());

// ----------------------------------------------------
// REST API Routes
// ----------------------------------------------------

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'WordleRush Backend',
    timestamp: new Date().toISOString(),
    dictionary: {
      answersCount: getAnswersCount(),
      guessesCount: getGuessesCount(),
    },
  });
});

// Check room existence and state before joining
app.get('/api/rooms/:roomCode', (req: Request, res: Response) => {
  const roomCode = req.params.roomCode.toUpperCase();
  const room = roomManager.getPublicRoomState(roomCode);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({ room });
});

// Validate word endpoint (helpful for pre-flight check)
app.post('/api/words/validate-secret', (req: Request, res: Response) => {
  const { word } = req.body;
  const result = validateSecretWord(word);
  res.json(result);
});

app.post('/api/words/validate-guess', (req: Request, res: Response) => {
  const { guess } = req.body;
  const result = validateGuess(guess);
  res.json(result);
});

// ----------------------------------------------------
// Socket.IO Setup
// ----------------------------------------------------
const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 20000,
  pingInterval: 10000,
});

setupSocketHandlers(io);

// Start server
server.listen(config.port, () => {
  console.log(`🚀 WordleRush server running on port ${config.port}`);
  console.log(`🌐 Client URL: ${config.clientUrl}`);
  console.log(`📚 Word dictionary loaded: ${getAnswersCount()} answers, ${getGuessesCount()} allowed guesses`);
});

export { app, server, io };
