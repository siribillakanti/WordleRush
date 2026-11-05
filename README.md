# WordleRush

> **Think Fast. Guess Faster.**

WordleRush is a responsive, real-time multiplayer word guessing web application where friends create private rooms, submit secret five-letter words, and race to solve each other's puzzles within a shared three-minute countdown.

---

## 1. Features & Mechanics

- **Private Rooms:** Create 2–8 player rooms with unique 6-character alphanumeric codes or shareable direct invite links.
- **Secret Word Submissions:** Each player contributes one familiar 5-letter English word. All submissions are locked and hidden on the server until the game ends.
- **Full Multiplayer Matrix:** Every player receives challenges for all other players' words (excluding their own). Challenge order is randomized independently for each player.
- **Synchronized Server Clock:** A single 180-second countdown controlled by the server with official start and end timestamps.
- **Strict Wordle Feedback:** Exact two-pass duplicate letter handling (Green for correct position, Yellow for present letter within target count, Grey for absent/excess).
- **Competitive Scoring:**
  - Solved Word: **100 base points**
  - Speed Bonuses:
    - 1–2 attempts: **+30 points**
    - 3–4 attempts: **+20 points**
    - 5–6 attempts: **+10 points**
  - Unsolved / Skipped Word: **0 points**
  - Tie-breakers: Total Score → Words Solved → Lowest Total Attempts → Earliest Completion Time.
- **Live Leaderboard:** Real-time updates without leaking guesses or secret words to competitors.
- **Session Reconnection:** Persistent player sessions in `localStorage` allowing instant re-attachment after a page refresh or connection drop without losing progress.
- **Dual Dictionary Word Lists:** Curated 10,875 answer words (everyday vocabulary, regular plurals, irregular plurals, geographical names like PARIS/DELHI, ordinary words that are also brand names) + comprehensive 14,133 allowed guess words (including personal names).
- **Light & Dark Theme Modes:** CSS variable-based theming with a toggle in the navbar, automatic OS color scheme detection, and `localStorage` persistence.
- **Wordle 3D Tile-Flip Animation:** Authentic 3D `rotateX` tile-flip keyframes with mid-point color transitions, 100ms staggered column delays, input blocking during flip, and `prefers-reduced-motion` compliance.

---

## 2. Technology Stack

### Frontend
- **Framework:** React 18 with TypeScript & Vite
- **Styling:** Tailwind CSS (midnight navy gaming aesthetic)
- **Icons:** Lucide React
- **Multiplayer:** Socket.IO Client
- **Celebration:** Canvas Confetti

### Backend
- **Runtime:** Node.js & Express with TypeScript
- **Multiplayer Server:** Socket.IO
- **Database & ORM:** Supabase PostgreSQL with Prisma ORM
- **Testing:** Vitest

---

## 3. Brand Identity & Design System

Predominantly midnight navy with restrained borders and clean typography:

| Token | Hex | Role |
| :--- | :--- | :--- |
| **Midnight background** | `#101827` | Primary app canvas |
| **Deep navy** | `#192538` | Container & card backgrounds |
| **Elevated navy** | `#223149` | Interactive panels, key buttons |
| **Slate** | `#354052` | Subtle borders & dividers |
| **Primary text** | `#F5F4EF` | High-contrast headings & tiles |
| **Secondary text** | `#AEB9C7` | Labels, captions, subtitles |
| **Correct green** | `#6AAA64` | Wordle match / winner accents |
| **Present yellow** | `#C9B458` | Wordle wrong position / cautions |
| **Absent grey** | `#46505E` | Absent letter tiles / inactive keys |

### Typography
- **Geist:** Primary typeface for headings, interface elements, and body text.
- **IBM Plex Mono:** Monospace numerals for timers, room codes, tile letters, and scoreboard stats.

---

## 4. Word List Sources & Licensing

WordleRush does not copy or redistribute proprietary word lists. Both dictionary files are locally bundled under open-source and public-domain licences:

1. **Allowed Guesses List (`backend/src/game/words/guesses.json`):**
   - **Source:** ENABLE1 (Enhanced North American Benchmark Lexicon, Public Domain) and the BSD Unix dictionary (`/usr/share/dict/words`).
   - **Licence:** Public Domain / BSD.
   - **Size:** 12,500+ valid 5-letter English dictionary words.
2. **Secret Answers List (`backend/src/game/words/answers.json`):**
   - **Source:** Curated high-frequency English vocabulary based on Google Web Trillion Word Corpus and standard dictionary lemmas.
   - **Licence:** CC0 / Public Domain.
   - **Filter:** Familiar 5-letter English words. Excludes regular plurals ending in 'S' (except natural singular words like `GLASS`, `DRESS`, `FOCUS`, `CHAOS`), proper nouns, geographical names, and obscure vocabulary.

---

## 5. Project Structure

```
WordleRush/
├── frontend/                     # React + Vite + Tailwind frontend
│   ├── src/
│   │   ├── components/           # Logo, Tile, WordleGrid, Keyboard, Timer, Leaderboard, Modals
│   │   ├── contexts/             # GameContext (Socket.IO client & state machine)
│   │   ├── pages/                # Landing, CreateRoom, JoinRoom, Lobby, Game, Results
│   │   ├── services/             # socket.ts, api.ts
│   │   ├── styles/               # index.css (Tailwind directives & keyframes)
│   │   └── types/                # TypeScript shared client interfaces
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── vercel.json               # Vercel deployment rewrite rules
├── backend/                      # Express + Socket.IO + Prisma backend
│   ├── src/
│   │   ├── config/               # Environment & game defaults
│   │   ├── game/                 # Word validation, feedback, scoring, GameEngine
│   │   │   ├── words/            # answers.json & guesses.json
│   │   │   └── __tests__/        # Vitest unit & multiplayer integration tests
│   │   ├── services/             # roomManager.ts, db.ts
│   │   ├── sockets/              # socketHandler.ts (Socket.IO events)
│   │   └── index.ts              # HTTP & WebSocket entrypoint
│   ├── prisma/
│   │   └── schema.prisma         # Supabase PostgreSQL schema
│   └── tsconfig.json
├── render.yaml                   # Render deployment blueprint
├── package.json                  # Root orchestration scripts
└── README.md
```

---

## 6. Local Development Setup

### Prerequisites
- Node.js v18+ (tested on Node v20/v26)
- npm v9+

### 1. Clone & Install Dependencies

```bash
# In the project root:
npm --prefix backend install
npm --prefix frontend install
```

### 2. Configure Environment Variables

**Backend (`backend/.env`):**
```env
PORT=4000
CLIENT_URL=http://localhost:5173
NODE_ENV=development
GAME_DURATION_SECONDS=180
MAX_ATTEMPTS=6
MAX_PLAYERS=8
MIN_PLAYERS=2

# Optional: Supabase PostgreSQL (if omitted, runs with in-memory persistence)
# DATABASE_URL="postgresql://postgres:password@db.your-ref.supabase.co:5432/postgres"
```

**Frontend (`frontend/.env`):**
```env
VITE_BACKEND_URL=http://localhost:4000
```

### 3. Run Locally

**Start Backend (Terminal 1):**
```bash
cd backend
npm run dev
# Server runs on http://localhost:4000
```

**Start Frontend (Terminal 2):**
```bash
cd frontend
npm run dev
# App opens at http://localhost:5173
```

---

## 7. Automated Testing

WordleRush includes automated test suites covering:
- Exact Wordle duplicate letter edge cases (`POPPY` vs `APPLE`, `SPEED` vs `ERASE`, `GEESE` vs `BLAME`)
- Answer and guess list validation rules (accepting plurals `NOTES`/`BOOKS`, geo names `PARIS`/`CHINA`/`DELHI`, excluding personal names `PETER`/`SARAH` from answers while allowing them in guesses)
- Score calculations and tie-breaking ordering
- Multi-client real-time Socket.IO game flows (4 distinct simultaneous sockets with challenge distribution, guesses, timer synchronization, player disconnect/reconnect, and room isolation).

Run tests:
```bash
cd backend
npm test
```

---

## 8. Database Setup (Supabase PostgreSQL)

WordleRush uses Prisma with PostgreSQL. It runs out-of-the-box in development with active in-memory state. To persist match history to Supabase:

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **Project Settings → Database** and copy the Connection String (URI, Port 5432 or 6543 pooler).
3. Set `DATABASE_URL` in `backend/.env`:
   ```env
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-REF].supabase.co:5432/postgres"
   ```
4. Push the Prisma schema:
   ```bash
   cd backend
   npx prisma db push
   ```

---

## 9. Production Deployment Guide (Free Tier)

### Frontend on Vercel
1. Import repository on [Vercel](https://vercel.com).
2. Set **Root Directory** to `frontend`.
3. Set **Framework Preset** to `Vite`.
4. Add Environment Variable:
   - `VITE_BACKEND_URL`: URL of your deployed Render backend (e.g. `https://wordlerush-backend.onrender.com`).
5. Deploy. (The bundled `frontend/vercel.json` ensures client-side routing rewrites work properly).

### Backend on Render
1. Create a free **Web Service** on [Render](https://render.com).
2. Connect your repository.
3. Configure settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
4. Add Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `CLIENT_URL`: URL of your Vercel frontend (e.g. `https://wordlerush.vercel.app`)
   - `DATABASE_URL`: Your Supabase connection string.

---

## 10. Free-Tier Considerations

- **Render Free Tier:** Free web services spin down after 15 minutes of inactivity. The initial wake-up may take 30–50 seconds on cold start. Once active, WebSocket connections remain uninterrupted.
- **Supabase Free Tier:** Inactive Supabase projects pause after 1 week of zero queries. You can unpause directly from the Supabase dashboard.
- **Zero Paid Dependencies:** WordleRush uses 100% open-source software, free-tier hosting configurations, and bundled public-domain dictionaries.
