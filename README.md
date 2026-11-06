# WordleRush

> **Think Fast. Guess Faster.**

A real-time multiplayer word guessing game where everyone becomes both the challenger and the solver.

WordleRush takes the familiar mechanics of Wordle and turns them into a competitive multiplayer experience. Players create private rooms, submit their own secret five-letter words, and compete to solve everyone else's words before the shared timer runs out.

Every player gets the same amount of time, the same number of attempts, and the same opportunity to climb the leaderboard.

**Live Application:** [Play WordleRush](https://wordle-rush-neon.vercel.app)

---

## The Idea

Traditional Wordle is a single-player experience. I wanted to explore how its core mechanics could be transformed into a real-time multiplayer game.

The central idea behind WordleRush is simple:

**Every player creates a challenge, and every player has to solve the challenges created by everyone else.**

Instead of competing against a predefined word, players compete against each other's vocabulary, strategy, and speed.

This creates a game where the difficulty changes with every round because the challenges come directly from the people playing.

## How It Works

### 1. Create a Room

A player creates a private room and becomes its host. Other players join using a unique six-character room code.

- Supports 2–8 players.
- Rooms are private and accessible through their room codes.
- The host controls when the game starts.

### 2. Submit Secret Words

Each player submits exactly one five-letter word.

The game waits until all players have submitted their words and are ready before the host can start the round.

### 3. Solve Everyone Else's Words

Once the round begins, each player receives the secret words submitted by every other player, excluding their own.

For example, in a four-player room:

- Player A solves B, C and D.
- Player B solves A, C and D.
- Player C solves A, B and D.
- Player D solves A, B and C.

All challenges are played simultaneously.

Each challenge provides:
- Six attempts to find the correct word.
- Wordle-style colour feedback.
- A shared server-controlled countdown of 180 seconds.

### 4. Compete for the Highest Score

Players earn points based on the number of words they solve and how efficiently they solve them.

| Achievement | Points |
|---|---:|
| Correctly solve a word | 100 |
| Solve in 1–2 attempts | +30 |
| Solve in 3–4 attempts | +20 |
| Solve in 5–6 attempts | +10 |
| Skip or fail to solve | 0 |

The leaderboard uses the following tie-breakers:

1. Total score
2. Number of words solved
3. Lowest total number of attempts
4. Earliest completion time

### 5. Play Multiple Rounds

WordleRush supports multiple rounds within the same room.

At the beginning of every round, players submit new secret words. Scores accumulate across rounds, allowing the leaderboard to reflect overall performance rather than just one successful game.

---

## Engineering & Architecture

One of the main challenges in building WordleRush was making multiplayer gameplay consistent across multiple clients.

A multiplayer game cannot rely on each browser independently deciding what is happening. Players need to see the same game state, follow the same timer, and receive consistent scoring.

To address this, WordleRush follows a client-server architecture with the backend acting as the authoritative source of game state.

### System Architecture

```text
                 ┌──────────────────────┐
                 │     React Frontend   │
                 │                      │
                 │  Game UI             │
                 │  Word Input          │
                 │  Timer Display       │
                 │  Leaderboard         │
                 └──────────┬───────────┘
                            │
                     HTTP / Socket.IO
                            │
                 ┌──────────▼───────────┐
                 │    Express Backend  │
                 │                      │
                 │  Room Management     │
                 │  Player Sessions     │
                 │  Game State          │
                 │  Guess Validation    │
                 │  Scoring Engine      │
                 │  Timer Management    │
                 └──────────┬───────────┘
                            │
                       Prisma ORM
                            │
                 ┌──────────▼───────────┐
                 │  PostgreSQL Database │
                 │                      │
                 │  Persistent Data     │
                 │  Game Records        │
                 │  Room Information    │
                 └──────────────────────┘
```

### Real-Time Communication

WordleRush uses Socket.IO for bidirectional communication between the frontend and backend.

This allows the server to communicate game events to connected players without requiring continuous page refreshes.

The real-time layer handles operations such as:

- Creating and joining rooms.
- Updating player readiness.
- Submitting secret words.
- Starting rounds.
- Distributing challenges.
- Processing guesses.
- Updating leaderboard information.
- Handling player disconnections and reconnections.

### Server-Authoritative Gameplay

A critical design decision was keeping important game logic on the backend.

The server is responsible for:
- Validating guesses.
- Managing the game phase and round state.
- Controlling the official game deadline.
- Calculating scores.
- Managing challenge completion.
- Preventing players from accessing their own challenges.
- Keeping room data isolated.

The frontend displays the remaining time using the server-provided deadline rather than independently determining when the game ends.

This helps prevent timing differences between players from affecting the outcome.

Secret words and active guesses are also kept away from competing players during live gameplay.

### Reconnection and State Recovery

Temporary disconnections should not automatically mean losing an entire game.

WordleRush includes reconnection handling so players can reconnect and recover their game state rather than restarting the room.

Room isolation is also important: activity in one room should not expose or interfere with another room's game.

---

## Word Validation & Wordle Logic

WordleRush maintains two separate word collections:

- **Answer words:** Words that players can submit as secret challenges.
- **Allowed guesses:** Words that players can enter while solving challenges.

This separation allows the game to maintain a controlled answer vocabulary while supporting a broader range of guesses.

### Duplicate Letter Handling

One of the less obvious challenges in implementing Wordle-style feedback is handling repeated letters correctly.

Consider a target word such as `APPLE` and a guess such as `ALLEY`.

A simple character-by-character comparison is insufficient because it can incorrectly mark more letters yellow than the target actually contains.

The feedback algorithm therefore needs to account for letter frequencies:

1. Identify letters in their correct positions.
2. Count the remaining unmatched letters in the target.
3. Evaluate misplaced letters against those remaining counts.
4. Mark letters grey when no matching occurrence remains.

This ensures that repeated letters receive consistent Wordle-style feedback.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Real-time communication | Socket.IO |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Testing | Vitest |
| Frontend deployment | Vercel |
| Backend deployment | Render |
| Database hosting | Supabase |

---

## Design & User Experience

The interface was designed to keep attention on the actual gameplay rather than unnecessary visual effects.

Some of the design decisions include:

- A clean, minimal interface with a warm light theme and a contrasting dark theme.
- Persistent theme selection.
- Animated tile reveals inspired by traditional Wordle interactions.
- Clear visual feedback for correct, misplaced and incorrect letters.
- Responsive layouts for different screen sizes.
- Reduced-motion support for accessibility.

The goal was to make the interface feel like a finished game rather than a generic dashboard.

---

## Testing & Reliability

Testing was important because multiplayer applications introduce problems that are difficult to identify through individual frontend testing alone.

The project includes tests covering:

- Word validation and dictionary restrictions.
- Correct and repeated-letter feedback.
- Scoring calculations and tie-breakers.
- Multiplayer room interactions.
- Challenge distribution.
- Player reconnection.
- Room isolation.

The reported development test results included **75 passing backend tests**, along with a successful frontend production build.

---

## Running Locally

### Prerequisites

- Node.js
- npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/siribillakanti/WordleRush.git
cd WordleRush
```

### 2. Install dependencies

```bash
npm --prefix backend install
npm --prefix frontend install
```

### 3. Configure environment variables

Create `backend/.env`:

```env
PORT=4000
CLIENT_URL=http://localhost:5173
NODE_ENV=development

GAME_DURATION_SECONDS=180
MAX_ATTEMPTS=6
MAX_PLAYERS=8
MIN_PLAYERS=2

DATABASE_URL="your_postgresql_connection_string"
```

Create `frontend/.env`:

```env
VITE_BACKEND_URL=http://localhost:4000
```

Use your own PostgreSQL connection string. Never commit actual environment files or credentials.

### 4. Start the backend

In the first terminal:

```bash
cd backend
npm run dev
```

### 5. Start the frontend

In a second terminal:

```bash
cd frontend
npm run dev
```

Open:

```text
http://localhost:5173
```

---

## Deployment

WordleRush is deployed using free-tier hosting services.

| Component | Service |
|---|---|
| Frontend | Vercel |
| Backend | Render |
| PostgreSQL Database | Supabase |

The frontend communicates with the deployed backend through the `VITE_BACKEND_URL` environment variable.

The backend connects to Supabase PostgreSQL through Prisma.

**Deployment consideration:** Free-tier hosting has resource and availability limitations. Render may put an inactive service to sleep, resulting in a delay when it starts again. Supabase Free also has inactivity-related project limitations.

---

## What I Learned

Building WordleRush involved more than implementing a word guessing algorithm.

Some of the most valuable engineering concepts I worked with were:

- Designing a real-time client-server application.
- Managing shared state across multiple connected clients.
- Using Socket.IO events for multiplayer communication.
- Implementing server-authoritative game logic.
- Handling timers and synchronization across clients.
- Designing room isolation and player session recovery.
- Working with PostgreSQL and Prisma for persistent data.
- Testing multiplayer workflows and edge cases.
- Deploying a full-stack application across multiple hosting platforms.

The project helped me understand how individual frontend interactions, backend state management, database persistence, and real-time communication come together to form a complete application.

---

## Author

**Siri Billakanti**  
Computer Science & Engineering

[LinkedIn](https://www.linkedin.com/in/siri-billakanti-0b798a384/)

---

**WordleRush — Think Fast. Guess Faster.**
