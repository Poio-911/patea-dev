# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pateá** is a Next.js 14 application for managing amateur football groups. It combines Firebase backend services with Google Gemini AI to provide intelligent player management, match organization, and performance analytics.

**Tech Stack:**
- Next.js 14 (App Router) + React 18
- Firebase (Firestore, Auth, Storage, App Hosting)
- Google Gemini AI via Genkit framework
- TypeScript, Tailwind CSS, shadcn/ui
- Google Fit API, Google Maps API

## Development Commands

```bash
# Development
npm run dev                    # Start Next.js dev server on port 3000
npm run genkit:dev            # Start Genkit dev server (AI flows)
npm run genkit:watch          # Start Genkit dev server with watch mode

# Build & Deploy
npm run build                 # Build for production
npm run typecheck             # Run TypeScript type checking
npm run lint                  # Run ESLint

# Testing
npm test                      # Run Playwright tests
npm test:ui                   # Run tests with Playwright UI
npm test:headed               # Run tests in headed mode
npm test:debug                # Debug tests

# Database Scripts
npm run migrate:cups          # Migrate cup bracket structure
npm run init:packages         # Initialize credit packages
```

## Critical Architecture Patterns

### 1. Real-Time Data Synchronization

**Always use `useDoc` hook for real-time Firestore data:**

```typescript
// src/firebase/firestore/use-doc.tsx
const { data, loading, error } = useDoc<Player>(playerRef);
```

- Uses `onSnapshot` for automatic updates
- Do NOT manually update state after Firestore writes
- The hook will automatically detect changes and re-render
- Handles permission errors via `errorEmitter`

### 2. Server Actions Architecture

All server-side mutations are organized in `src/lib/actions/`:

- **`server-actions.ts`**: Core actions (players, matches, groups, team challenges)
- **`image-generation.ts`**: AI image generation (uses credits)
- **`social-actions.ts`**: Follow system, activity feed
- **`google-fit-actions.ts`**: Health data integration
- **`notification-actions.ts`**: Push notifications
- **`payment-actions.ts`**: Mercadopago integration, credit purchases
- **`venue-actions.ts`**: Venue/location management, ratings
- **`match-invitation-actions.ts`**: RSVP system for matches

**Important:** Server actions must be marked with `'use server'` directive.

### 3. Image Handling Flow

**Player photos are synchronized across three collections:**
- `users/{uid}` → `photoURL`
- `players/{id}` → `photoUrl`
- `availablePlayers/{uid}` → `photoUrl`

**Image crop data is stored in Firestore:**
- `cropPosition: { x: number, y: number }` (percentage 0-100)
- `cropZoom: number` (scale factor)

**Two ways to update photos:**
1. **AI Generation**: `generatePlayerCardImageAction()` - consumes credits, auto-resets crop
2. **Manual Crop**: `ImageCropperDialog` component - user-controlled cropping

### 4. AI Flows (Genkit)

All AI flows are in `src/ai/flows/`. **Critical constraint:**

- Genkit is configured for **production mode only** (`GENKIT_ENV=prod`)
- Genkit cannot run client-side - webpack excludes it from client bundle
- Flows must be called from server actions only
- Never import `ai` object in client components

**12 Available flows:**
- Player analysis: `suggest-player-improvements`, `analyze-player-progression`, `detect-player-patterns`
- Match support: `generate-balanced-teams`, `get-match-day-forecast`, `generate-match-chronicle`
- Image generation: `generate-player-card-image`, `generate-duo-image`
- Assistance: `coach-conversation`, `get-app-help`, `find-best-fit-player`, `generate-group-summary`

### 5. Firebase Configuration

**Client SDK:** `src/firebase/index.ts` exports initialized `auth`, `db`, `storage`

**Admin SDK:** `src/firebase/admin-init.ts` - uses service account key

**Environment variables pattern:**
- `NEXT_PUBLIC_*` for client-side Firebase config
- Plain vars for server-side (Admin SDK, API keys)

### 6. TypeScript Types System

**Central types file:** `src/lib/types.ts`

**Key type patterns:**
- `Player`: Full player document with stats and attributes
- `DetailedTeamPlayer`: Extends Player with team number and status
- `Match`: Has discriminated union for `type` and `size`
- `MatchStatus`: Lifecycle states (`upcoming` → `active` → `completed` → `evaluated`)
- `Jersey`: Team jersey configuration with colors and patterns

### 7. UI Animation System

**Card animations are rarity-based:**

```typescript
// src/lib/animation-utils.ts
getAnimationByRarity(ovr: number): CardAnimationType
```

- **Elite (OVR ≥ 86)**: 3D flip animation
- **Gold (OVR ≥ 76)**: 2D rotate animation
- **Silver (OVR ≥ 65)**: Zoom animation
- **Bronze (< 65)**: Slide animation

**Usage pattern:**
```typescript
import { AnimatedCardWrapper } from '@/components/animated-card-wrapper';
import { getAnimationByRarity, getStaggerDelay } from '@/lib/animation-utils';

<AnimatedCardWrapper
  animation={getAnimationByRarity(player.ovr)}
  delay={getStaggerDelay(index, 3)}
>
  {children}
</AnimatedCardWrapper>
```

- Uses `framer-motion` with `useInView` hook for scroll-triggered animations
- Stagger delays create cascading effect in grids
- All animations use spring physics for natural feel

## Firestore Data Model

```
users/{uid}
  - photoURL, displayName, email
  - players/ (subcollection)
  - groups/ (subcollection)

players/{playerId}
  - name, position, ovr
  - pac, sho, pas, dri, def, phy (attributes)
  - photoUrl, cropPosition, cropZoom
  - cardGenerationCredits (monthly free + purchased)
  - ownerUid, groupId
  - stats: { matchesPlayed, goals, assists, averageRating }

matches/{matchId}
  - type, status, date, location
  - teamA, teamB (arrays of player IDs)
  - playerPerformance/ (subcollection - evaluations)

groups/{groupId}
  - name, members, settings
  - players/ (subcollection)
  - matches/ (subcollection)

leagues/{leagueId}
cups/{cupId}
socialActivities/{activityId}
follows/{followId}
notifications/{notificationId}
```

## Key Workflows

### Player Photo Update (AI)

1. User clicks "Generar Foto IA" button
2. `generatePlayerCardImageAction(playerId)` server action
3. Downloads current photo → sends to Gemini → generates new image
4. Uploads to Firebase Storage → updates Firestore
5. Updates: `photoUrl`, resets `cropPosition: {x:50, y:50}`, `cropZoom: 1`
6. Consumes 1 credit from `cardGenerationCredits`
7. `useDoc` hook automatically updates UI

### Match Evaluation Flow

1. Match status: `upcoming` → `active` (when started)
2. Record goals, cards during match
3. Complete match → status: `completed`
4. Evaluate players (rating 1-10, tags) → writes to `playerPerformance/`
5. Calculate attribute changes → update player OVR
6. Status: `evaluated` → creates `socialActivities` entry
7. Update player stats (goals, assists, matches played)

### Real-Time Updates Pattern

```typescript
// CORRECT - Auto-updates via useDoc
const playerRef = doc(db, 'players', playerId);
const { data: player } = useDoc<Player>(playerRef);

// After mutation:
await updateDoc(playerRef, { ovr: newOvr });
// UI updates automatically - DO NOT set state manually
```

## Documentation Structure

**Always consult `/docs/` before editing major features:**

- `/docs/README.md` - Master index
- `/docs/sections/*.md` - 8 functional sections (players, matches, competitions, etc.)
- `/docs/ai-flows/*.md` - 12 AI flow specifications with schemas

**Most critical:** `/docs/sections/02-players.md` (400+ lines covering player system)

## Next.js Configuration

**Key settings in `next.config.mjs`:**

- **Output mode**: `standalone` (for Firebase App Hosting)
- **Server Actions**: 10mb body size limit for image uploads
- **Webpack exclusions**: Genkit packages excluded from client bundle to prevent build errors
- **PWA**: Configured via `@ducanh2912/next-pwa`, disabled in development
- **Image domains**: Allows Google user photos and Firebase Storage
- **Source maps**: Disabled in production for security

**Critical webpack rule:**
```javascript
// Genkit MUST be excluded from client bundle
if (!isServer) {
  config.resolve.alias['genkit'] = false;
  config.resolve.alias['@genkit-ai/core'] = false;
}
```

## Deployment

- **Hosting:** Firebase App Hosting (standalone output mode)
- **Region:** us-central1
- **PWA:** Enabled in production (disabled in dev)

Firebase config in `firebase.json` includes Firestore rules/indexes and storage rules.

## Common Pitfalls

1. **Don't manually update state after Firestore writes** - trust `useDoc` hook for automatic updates
2. **Never import Genkit in client components** - causes build errors (webpack excludes it)
3. **Synchronize photos across 3 locations** - users, players, availablePlayers
4. **Server actions need `'use server'`** - or they'll be treated as client code
5. **Credit system**: Free monthly credits reset, purchased credits don't expire
6. **Match type affects evaluation logic** - league matches have different OVR impact
7. **Team challenges**: Post status must update when challenge accepted/rejected
8. **Venue ratings**: Only users who played match at venue can rate it
9. **Payment webhooks**: Always verify MercadoPago signature for security
10. **PWA updates**: Service Worker needs skipWaiting for immediate updates
11. **Animation performance**: Use `AnimatedCardWrapper` with proper stagger delays to avoid jank
12. **Jersey watermarks**: Always check if jersey exists before rendering watermark component

## Path Aliases

- `@/*` maps to `src/*`
- Example: `import { Player } from '@/lib/types'`

## Component Architecture Patterns

### Jersey System
- `JerseyWatermark`: Decorative jersey background overlay with configurable opacity and position
- `JerseyPreview`: Renders actual jersey design from configuration
- Used in team cards, match details, and profile views

### Player Card System
- Player cards use OVR-based styling (see `src/components/player-styles.tsx`)
- Card rarity determines border colors, gradients, and animations
- `getPlayerRarityStyle()` centralizes visual styling by OVR tier

### Client Providers
- `ClientProviders` component in `components/client-providers.tsx` wraps app with necessary context
- Includes theme provider, toast notifications, and Firebase auth state

### Navigation Structure
- Main navigation is in `src/app/main-nav.tsx` (horizontal top navigation bar)
- Navigation was recently refactored from desktop sidebar to horizontal layout
- Mobile navigation uses responsive menu drawer
- Navigation items are route-aware and highlight active pages
