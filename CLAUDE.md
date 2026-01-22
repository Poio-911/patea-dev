# CLAUDE.md - AI Assistant Guide for Pateá (AFM)

> **Purpose**: This document provides AI assistants with comprehensive context about the Pateá codebase structure, conventions, and workflows to enable effective collaboration on this project.

**Last Updated**: 2026-01-22
**Project**: Amateur Football Manager (Pateá)
**Language**: Spanish (UI), English (Code/Docs)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Directory Structure](#directory-structure)
4. [Core Concepts](#core-concepts)
5. [Development Workflow](#development-workflow)
6. [Code Conventions](#code-conventions)
7. [Component Architecture](#component-architecture)
8. [Data Layer](#data-layer)
9. [AI Integration](#ai-integration)
10. [Security Practices](#security-practices)
11. [Common Tasks](#common-tasks)
12. [Testing](#testing)
13. [Deployment](#deployment)

---

## Project Overview

**Pateá** is a full-featured web application for managing amateur football teams, matches, and player performance. It helps organizers create balanced teams using AI, manage match schedules, and track player statistics through peer-based evaluation systems.

### Key Features
- **Team Management**: Create groups, manage players, switch between multiple groups
- **AI-Balanced Teams**: Automatic team generation using Google Gemini AI
- **Peer Evaluation System**: Players evaluate each other post-match to calculate performance ratings
- **Real-time Updates**: Live match data, notifications, and player statistics
- **Performance Tracking**: Player OVR (Overall Rating) history with detailed analytics
- **AI Coaching**: Personalized improvement suggestions and pattern detection
- **Weather Integration**: Match day forecasts for scheduled games
- **Social Features**: Match chat, group invitations, player discovery

### Project Stats
- **Source Files**: 182 TypeScript/TSX files
- **Codebase Size**: 1.2MB
- **Components**: 37 shadcn/ui base + 50+ custom components
- **AI Flows**: 9 Genkit-powered features
- **Database Collections**: 8+ Firestore collections

---

## Technology Stack

### Core Framework
- **Next.js 14.2.5** - App Router with React Server Components
- **React 18.3.1** - UI library
- **TypeScript 5** - Strict mode enabled

### Backend & Database
- **Firebase/Firestore** - NoSQL real-time database
- **Firebase Authentication** - Email/password + Google OAuth
- **Firebase Storage** - Image storage
- **Firebase Admin SDK** - Server-side operations
- **Firebase App Hosting** - Production deployment

### AI & ML
- **Google Genkit 1.21.0** - AI framework
- **Google Gemini 2.5 Flash** - LLM via @genkit-ai/google-genai

### UI & Styling
- **Tailwind CSS 3.4.1** - Utility-first CSS with dark mode
- **shadcn/ui** - 37 pre-built accessible components
- **Radix UI** - 18+ primitive component packages
- **Lucide React** - Icon library
- **Framer Motion** - Animations
- **class-variance-authority** - Component variants

### Forms & Validation
- **React Hook Form 7.65.0** - Form state management
- **Zod 3.23.8** - Schema validation

### Data Visualization
- **recharts 2.15.1** - Charts for player stats
- **@react-google-maps/api** - Google Maps integration

### Interactions
- **@dnd-kit** - Drag and drop functionality
- **embla-carousel-react** - Carousels
- **react-image-crop** - Image cropping
- **canvas-confetti** - Celebration animations

### Development
- **Playwright 1.56.1** - E2E testing
- **ESLint** - Code linting (Next.js config)
- **PostCSS** - CSS processing

---

## Directory Structure

```
/home/user/patea-dev/
│
├── src/
│   ├── app/                          # Next.js App Router (pages)
│   │   ├── layout.tsx                # Root layout with providers
│   │   ├── globals.css               # Global styles & CSS variables
│   │   ├── page.tsx                  # Landing/login redirect
│   │   ├── login/                    # Authentication pages
│   │   ├── register/
│   │   ├── forgot-password/
│   │   ├── dashboard/                # Main dashboard
│   │   ├── profile/                  # User profile
│   │   ├── groups/                   # Group management
│   │   ├── players/                  # Player gallery & details
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # Player detail page
│   │   │       └── analysis/         # Player analysis
│   │   ├── matches/                  # Match management
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # Match details
│   │   │       └── evaluate/         # Organizer evaluation panel
│   │   ├── evaluations/              # Peer evaluation inbox
│   │   │   └── [matchId]/            # Evaluation form
│   │   └── find-match/               # Match discovery
│   │
│   ├── components/                   # React components
│   │   ├── ui/                       # shadcn/ui base components (37)
│   │   ├── icons/                    # Custom icons
│   │   ├── groups/                   # Group-related components
│   │   ├── match-details/            # Match sub-components
│   │   ├── team-builder/             # Team building UI
│   │   ├── add-match-dialog.tsx      # Feature dialogs
│   │   ├── add-player-dialog.tsx
│   │   ├── edit-player-dialog.tsx
│   │   ├── player-card.tsx           # Player stat cards
│   │   ├── match-card.tsx
│   │   ├── coach-chat-view.tsx       # AI chat interface
│   │   └── [50+ more components]
│   │
│   ├── firebase/                     # Firebase integration
│   │   ├── admin-init.ts             # Admin SDK initialization
│   │   ├── config.ts                 # Firebase client config
│   │   ├── auth/
│   │   │   └── use-user.tsx          # User context & hooks
│   │   ├── firestore/
│   │   │   ├── use-collection.tsx    # Collection query hook
│   │   │   └── use-doc.tsx           # Document query hook
│   │   └── provider.tsx              # Root Firebase provider
│   │
│   ├── hooks/                        # Custom React hooks
│   │   ├── use-match-actions.ts      # Match CRUD operations
│   │   ├── use-match-permissions.ts  # Access control
│   │   ├── use-fcm.ts                # Push notifications
│   │   ├── use-toast.ts              # Toast notifications
│   │   └── use-mobile.tsx            # Mobile detection
│   │
│   ├── lib/                          # Utilities & business logic
│   │   ├── types.ts                  # TypeScript interfaces (SINGLE SOURCE OF TRUTH)
│   │   ├── data.ts                   # Static data & constants
│   │   ├── errors.ts                 # Centralized error handling
│   │   ├── logger.ts                 # Logging utility
│   │   ├── auth-helpers.ts           # Auth validation helpers
│   │   ├── utils.ts                  # General utilities
│   │   ├── animations.ts             # Animation effects
│   │   ├── performance-tags.ts       # Player evaluation tags
│   │   ├── jersey-templates.ts       # Team jersey designs
│   │   ├── actions/
│   │   │   ├── server-actions.ts     # ALL Firestore & AI actions
│   │   │   └── image-generation.ts   # Image generation actions
│   │   └── placeholder-images.json   # Mock data
│   │
│   ├── ai/                           # AI flows & Genkit setup
│   │   ├── dev.ts                    # Development entry point
│   │   ├── genkit.ts                 # Genkit instance config
│   │   └── flows/                    # AI workflow definitions (9 flows)
│   │       ├── generate-balanced-teams.ts
│   │       ├── suggest-player-improvements.ts
│   │       ├── get-match-day-forecast.ts
│   │       ├── find-best-fit-player.ts
│   │       ├── coach-conversation.ts
│   │       ├── detect-player-patterns.ts
│   │       ├── generate-group-summary.ts
│   │       ├── generate-player-card-image.ts
│   │       └── get-app-help.ts
│   │
│   └── docs/
│       └── backend.json              # Database schema blueprint
│
├── public/                           # Static assets (manifest, icons)
├── docs/                             # Project documentation
│
├── Configuration Files:
│   ├── package.json                  # Dependencies & scripts
│   ├── tsconfig.json                 # TypeScript config (strict mode)
│   ├── tailwind.config.ts            # Tailwind theme customization
│   ├── next.config.mjs               # Next.js configuration
│   ├── postcss.config.mjs            # PostCSS plugins
│   ├── components.json               # shadcn/ui configuration
│   ├── apphosting.yaml               # Firebase deployment config
│   ├── firestore.rules               # Firestore security rules
│   └── .env.example                  # Environment template
│
└── Documentation:
    ├── README.md                     # Quick start guide
    ├── PROJECT_DOCUMENTATION.md      # Comprehensive feature docs
    ├── FIREBASE_ENV_SETUP.md         # Environment setup
    ├── SECURITY_SETUP.md             # Security best practices
    ├── CHANGELOG.md                  # Version history
    └── RESUMEN_FIXES_API.md          # API fixes summary
```

---

## Core Concepts

### 1. Player Rating System (OVR)

Players have 6 core attributes that determine their Overall Rating (OVR):
- **PAC** (Pace) - Speed and acceleration
- **SHO** (Shooting) - Goal scoring ability
- **PAS** (Passing) - Pass accuracy and vision
- **DRI** (Dribbling) - Ball control and dribbling
- **DEF** (Defense) - Defensive skills
- **PHY** (Physical) - Strength and stamina

**Positions**: DEL (Forward), MED (Midfielder), DEF (Defender), POR (Goalkeeper)

**Specialties**: Elite players (>85 in attribute) earn badges:
- El Rayo (Speed), El Matador (Shooting), El Maestro (Passing), etc.

### 2. Peer Evaluation System

After matches, players evaluate their teammates:
1. **Assignment**: Organizer finalizes match → System assigns ~2 evaluations per player
2. **Evaluation Modes**:
   - **Points**: Rating 1-10 + goals scored
   - **Tags**: Select from 60+ performance tags (e.g., "Fast Attack" → +2 PAC)
3. **Calculation**: Server-side OVR recalculation based on evaluation data
4. **History**: All OVR changes tracked in `ovrHistory` subcollection

### 3. Match Lifecycle

```
Create → Upcoming → Active → Completed → Evaluated
```

**Match Types**:
- **Manual**: Organizer assigns players to teams
- **Collaborative**: Players sign up, AI generates balanced teams
- **By Teams**: Pre-defined group teams compete

**Match Sizes**: 10 (5v5), 14 (7v7), 22 (11v11)

### 4. Group System

- Users can create/join multiple groups via invite codes
- One active group at a time per user
- Group-scoped players, matches, and teams
- Group ownership determines admin permissions

### 5. AI Integration

All AI features use **Google Gemini 2.5 Flash** via Genkit:
- Team balancing with fairness metrics
- Weather forecasting for match dates
- Personalized coaching suggestions
- Pattern detection in player performance
- Multi-turn coach conversation
- AI-generated player card artwork (credit-based)

---

## Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Start Next.js dev server (http://localhost:3000)
npm run dev

# Start Genkit AI UI for testing flows (http://localhost:4000)
npm run genkit:dev

# Or watch mode for auto-reload
npm run genkit:watch
```

### Type Checking & Linting

```bash
# Type check (ALWAYS run before committing)
npm run typecheck

# Lint code
npm run lint
```

### Testing

```bash
# Run E2E tests (Playwright)
npm run test

# Interactive UI mode
npm run test:ui

# Browser visible
npm run test:headed

# Debug mode
npm run test:debug
```

### Building & Deploying

```bash
# Production build
npm run build

# Start production server locally
npm run start

# Deploy to Firebase App Hosting
# (Automatic on git push to configured branch)
```

### Environment Setup

1. Copy `.env.example` to `.env.local`
2. Fill in Firebase credentials (see `FIREBASE_ENV_SETUP.md`)
3. Set up Google AI Studio API key for Genkit
4. Configure Firebase App Hosting environment variables (15 total)

**Required Environment Variables**:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `GOOGLE_GENAI_API_KEY` (server-only)
- Firebase Admin SDK credentials (server-only)

---

## Code Conventions

### File Naming
- **Components**: `kebab-case.tsx` (e.g., `player-card.tsx`)
- **Hooks**: `use-kebab-case.ts` (e.g., `use-match-actions.ts`)
- **Types**: `types.ts` (single file, PascalCase interfaces)
- **Pages**: `page.tsx` (Next.js App Router convention)
- **Actions**: `kebab-case.ts` in `/lib/actions/`

### Code Naming
- **Components**: `PascalCase` (e.g., `PlayerCard`)
- **Functions**: `camelCase` (e.g., `generateTeamsAction`)
- **Hooks**: `camelCase` with `use` prefix (e.g., `useMatchActions`)
- **Types/Interfaces**: `PascalCase` (e.g., `Player`, `Match`)
- **Constants**: `UPPER_SNAKE_CASE` or `camelCase`

### Client vs Server

**Client Components** (`'use client'` directive):
- All interactive components (forms, buttons, animations)
- All hooks and context providers
- Components using browser APIs

**Server Components** (default):
- Page layouts and static content
- Initial data fetching
- SEO-optimized pages

**Server Actions** (`'use server'` directive):
- Firebase Admin SDK operations in `/lib/actions/server-actions.ts`
- AI flow invocations
- Sensitive operations requiring server-side auth validation

### Import Patterns

```typescript
// Path alias (configured in tsconfig.json)
import { Player } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { useUser } from '@/firebase/auth/use-user'

// Relative imports for same directory
import { ComponentChild } from './component-child'
```

### Error Handling

```typescript
import { createError, ErrorCodes, handleServerActionError } from '@/lib/errors'

// In server actions
try {
  // operation
} catch (error) {
  return handleServerActionError(error, {
    userMessage: 'No se pudo crear el partido',
    errorCode: ErrorCodes.DATA_CREATE_FAILED,
    context: { matchData }
  })
}

// Create typed errors
throw createError(
  ErrorCodes.VAL_INVALID_INPUT,
  'Invalid player data',
  'Los datos del jugador no son válidos',
  { playerId }
)
```

**Error Code Categories**:
- `AUTH_*` - Authentication errors
- `VAL_*` - Validation errors
- `AI_*` - AI operation errors
- `DATA_*` - Database operation errors
- `RES_*` - Resource errors
- `SYS_*` - System errors

### Type Safety

```typescript
// ALWAYS import types from single source of truth
import { Player, Match, Team, UserProfile } from '@/lib/types'

// Use Zod for runtime validation (especially in AI flows)
import { z } from 'zod'

const playerSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  position: z.enum(['DEL', 'MED', 'DEF', 'POR']),
  ovr: z.number().min(40).max(99)
})

// Validate before processing
const validatedData = playerSchema.parse(inputData)
```

### Styling Conventions

```typescript
// Use Tailwind utility classes
<div className="flex items-center gap-4 rounded-lg bg-card p-4">

// Use cn() utility for conditional classes
import { cn } from '@/lib/utils'

<div className={cn(
  "base-classes",
  isActive && "active-classes",
  className // Allow prop override
)}>

// Use CSS variables for theming
<div className="bg-background text-foreground">

// Dark mode support
<div className="bg-white dark:bg-gray-900">
```

---

## Component Architecture

### Base Components (shadcn/ui)

Located in `/components/ui/`, these are pre-built, customizable components:
- Forms: `button`, `input`, `textarea`, `select`, `checkbox`, `radio-group`, `label`
- Dialogs: `dialog`, `alert-dialog`, `sheet`, `popover`, `dropdown-menu`
- Feedback: `toast`, `alert`, `badge`, `skeleton`, `progress`
- Layout: `card`, `separator`, `scroll-area`, `tabs`, `accordion`
- Navigation: `navigation-menu`, `breadcrumb`, `pagination`
- Data: `table`, `avatar`, `tooltip`, `command`

**Usage Pattern**:
```typescript
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

<Button variant="default" size="lg" onClick={handleClick}>
  Click Me
</Button>
```

### Custom Components

Located in `/components/`, organized by feature:

**Dialog Components**: Full-screen or modal workflows
- `add-match-dialog.tsx` - Match creation
- `add-player-dialog.tsx` - Player addition
- `edit-player-dialog.tsx` - Player editing
- `ai-suggestion-dialog.tsx` - AI coaching suggestions

**Card Components**: Reusable display cards
- `player-card.tsx` - Player stat card with attributes
- `match-card.tsx` - Match preview card
- `team-detail-card.tsx` - Team composition display

**View Components**: Full-page or section views
- `player-profile-view.tsx` - Player detail page content
- `match-detail-view.tsx` - Match detail page content
- `perform-evaluation-view.tsx` - Evaluation form
- `coach-chat-view.tsx` - AI coach chat interface

### Component Composition Pattern

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

interface MyComponentProps {
  data: SomeType
  onAction?: () => void
  className?: string // Allow style override
}

export function MyComponent({ data, onAction, className }: MyComponentProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleAction = async () => {
    setIsLoading(true)
    try {
      // Call server action
      const result = await someServerAction(data)
      toast({ title: 'Éxito', description: 'Operación completada' })
      onAction?.()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo completar la operación'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{data.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={handleAction} disabled={isLoading}>
          {isLoading ? 'Cargando...' : 'Acción'}
        </Button>
      </CardContent>
    </Card>
  )
}
```

---

## Data Layer

### Firestore Collections

```typescript
// Collection structure (see /lib/types.ts for full schemas)

users/{userId} → UserProfile
  - uid, email, displayName, photoURL
  - groups: string[]
  - activeGroupId: string
  - createdAt: Timestamp

players/{playerId} → Player
  - id, name, position, ovr
  - pac, sho, pas, dri, def, phy (attributes)
  - photoUrl, stats, ownerUid, groupId
  - cardGenerationCredits, lastCreditReset
  - cropPosition, cropZoom

  └── ovrHistory/{historyId} → OvrHistory
      - date, oldOVR, newOVR, change
      - matchId, attributeChanges

groups/{groupId} → Group
  - id, name, ownerUid, inviteCode
  - members: string[]

matches/{matchId} → Match
  - id, title, date, time, location
  - type: 'manual' | 'collaborative' | 'by_teams'
  - matchSize: 10 | 14 | 22
  - players: string[], teams: Team[]
  - status: 'upcoming' | 'active' | 'completed' | 'evaluated'
  - ownerUid, groupId, weather, chronicle

  └── assignments/{assignmentId} → EvaluationAssignment
      - evaluatorId, subjectId, status, evaluationId

evaluations/{evaluationId} → Evaluation
  - assignmentId, playerId, evaluatorId
  - matchId, rating, goals
  - performanceTags: PerformanceTag[]
  - evaluatedAt: Timestamp

notifications/{notificationId}
invitations/{invitationId}
groupTeams/{teamId}
chatMessages/{messageId}
```

### Firebase Hooks

```typescript
import { useCollection } from '@/firebase/firestore/use-collection'
import { useDoc } from '@/firebase/firestore/use-doc'

// Query collection with real-time updates
const { data: players, loading, error } = useCollection<Player>('players', [
  where('groupId', '==', activeGroupId),
  where('ownerUid', '==', user.uid)
])

// Query single document
const { data: match, loading } = useDoc<Match>('matches', matchId)
```

### Server Actions

**IMPORTANT**: All Firebase Admin SDK operations and AI flows MUST be called via server actions in `/lib/actions/server-actions.ts`.

```typescript
'use server'

import { validateUser } from '@/lib/auth-helpers'
import { createError, ErrorCodes } from '@/lib/errors'
import { getFirebaseAdmin } from '@/firebase/admin-init'

export async function createPlayerAction(
  playerData: Partial<Player>
): Promise<{ success: boolean; playerId?: string; error?: string }> {
  try {
    // ALWAYS validate user server-side
    const user = await validateUser()

    const { adminDb } = getFirebaseAdmin()

    const newPlayer = {
      ...playerData,
      id: adminDb.collection('players').doc().id,
      ownerUid: user.uid,
      createdAt: new Date()
    }

    await adminDb.collection('players').doc(newPlayer.id).set(newPlayer)

    return { success: true, playerId: newPlayer.id }
  } catch (error) {
    return handleServerActionError(error, {
      userMessage: 'No se pudo crear el jugador',
      errorCode: ErrorCodes.DATA_CREATE_FAILED
    })
  }
}
```

### Auth Helpers

Use these to validate permissions server-side:

```typescript
import {
  validateUser,
  validatePlayerOwnership,
  validateMatchOwnership,
  validateGroupAdmin,
  validatePlayerInGroup
} from '@/lib/auth-helpers'

// In server actions
const user = await validateUser() // Throws if not authenticated
await validatePlayerOwnership(playerId, user.uid) // Throws if not owner
await validateMatchOwnership(matchId, user.uid) // Throws if not organizer
```

---

## AI Integration

### Genkit Flow Pattern

All AI flows follow this standardized pattern:

```typescript
// Location: /src/ai/flows/my-new-flow.ts
import { z } from 'zod'
import { ai } from '../genkit'

// Define input/output schemas
const MyFlowInputSchema = z.object({
  data: z.string(),
  context: z.string().optional()
})

const MyFlowOutputSchema = z.object({
  result: z.string(),
  confidence: z.number()
})

export const myFlow = ai.defineFlow(
  {
    name: 'myFlow',
    inputSchema: MyFlowInputSchema,
    outputSchema: MyFlowOutputSchema
  },
  async (input) => {
    const { data, context } = input

    const result = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      prompt: `Tu eres un asistente de fútbol amateur.

      Contexto: ${context || 'No disponible'}
      Datos: ${data}

      Proporciona tu análisis en español.`,
      config: {
        temperature: 0.7
      }
    })

    return {
      result: result.text,
      confidence: 0.85
    }
  }
)
```

### Calling AI Flows from Server Actions

```typescript
'use server'

import { myFlow } from '@/ai/flows/my-new-flow'

export async function callAIFlowAction(data: string) {
  try {
    const result = await myFlow({ data })
    return { success: true, result }
  } catch (error) {
    return handleServerActionError(error, {
      userMessage: 'No se pudo procesar la solicitud de IA',
      errorCode: ErrorCodes.AI_GENERATION_FAILED
    })
  }
}
```

### Existing AI Flows

| Flow Name | Purpose | Input | Output |
|-----------|---------|-------|--------|
| `generateBalancedTeams` | Create balanced teams by OVR & position | Players list | 2 teams with metrics |
| `suggestPlayerImprovements` | Coaching suggestions | Player + history | 2-3 tips in Spanish |
| `getMatchDayForecast` | Weather prediction | Date + location | Weather icon + description |
| `findBestFitPlayer` | Recommend player | Group + position | Best fit with reasoning |
| `coachConversation` | Multi-turn chat | Message + history | Coach response |
| `detectPlayerPatterns` | Performance trends | Evaluation history | Pattern insights |
| `generateGroupSummary` | Group analytics | Group data | Summary stats |
| `generatePlayerCardImage` | AI artwork | Player + crop | Image URL (costs credits) |
| `getAppHelp` | App questions | Query + context | Help response |

### Testing AI Flows

```bash
# Start Genkit UI (http://localhost:4000)
npm run genkit:dev

# Test flows interactively in browser
# - Select flow from dropdown
# - Provide input JSON
# - View output and latency
```

---

## Security Practices

### Firestore Security Rules

Located in `firestore.rules`, enforced server-side:

```javascript
// Example patterns
match /users/{userId} {
  allow read: if request.auth != null;
  allow write: if request.auth.uid == userId;
}

match /players/{playerId} {
  allow read: if request.auth != null;
  allow create, update, delete: if request.auth.uid == resource.data.ownerUid;
}

match /matches/{matchId} {
  allow read: if request.auth != null;
  allow write: if request.auth.uid == resource.data.ownerUid;
}

match /evaluations/{evalId} {
  allow read: if request.auth != null;
  allow write: if false; // Server-side only
}
```

### Server-Side Validation

**ALWAYS** validate on server before database operations:

```typescript
'use server'

import { validateUser, validatePlayerOwnership } from '@/lib/auth-helpers'

export async function updatePlayerAction(playerId: string, data: Partial<Player>) {
  // 1. Validate authentication
  const user = await validateUser()

  // 2. Validate ownership
  await validatePlayerOwnership(playerId, user.uid)

  // 3. Validate input data
  const validatedData = playerUpdateSchema.parse(data)

  // 4. Perform operation
  // ...
}
```

### Environment Variables

**Public** (accessible in browser, prefix with `NEXT_PUBLIC_`):
- Firebase config (API key, auth domain, etc.)
- Google Maps API key

**Secret** (server-only, NO prefix):
- Google AI API key
- Firebase Admin SDK credentials
- Service account keys

**Security Notes**:
- API keys in `apphosting.yaml` are publicly visible (documented in SECURITY_SETUP.md)
- Rotate keys periodically (every 3-6 months)
- Use Google Cloud Console domain restrictions for public keys

---

## Common Tasks

### Adding a New Page

```typescript
// 1. Create page file in /src/app/
// Example: /src/app/my-feature/page.tsx

import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mi Función - Pateá',
  description: 'Descripción de la función'
}

export default function MyFeaturePage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold">Mi Función</h1>
      {/* Content */}
    </div>
  )
}

// 2. Add navigation link in /src/app/main-nav.tsx if needed
```

### Creating a New Component

```typescript
// 1. Create component file in /src/components/
// Example: /src/components/my-component.tsx

'use client'

import { ComponentProps } from '@/lib/types'
import { Button } from '@/components/ui/button'

interface MyComponentProps {
  title: string
  onAction?: () => void
  className?: string
}

export function MyComponent({ title, onAction, className }: MyComponentProps) {
  return (
    <div className={className}>
      <h2>{title}</h2>
      <Button onClick={onAction}>Acción</Button>
    </div>
  )
}

// 2. Import and use in pages or other components
import { MyComponent } from '@/components/my-component'
```

### Adding a Server Action

```typescript
// 1. Add to /src/lib/actions/server-actions.ts

'use server'

export async function myNewAction(input: InputType): Promise<ActionResult> {
  try {
    const user = await validateUser()
    const { adminDb } = getFirebaseAdmin()

    // Your logic here

    return { success: true, data: result }
  } catch (error) {
    return handleServerActionError(error, {
      userMessage: 'Mensaje amigable en español',
      errorCode: ErrorCodes.APPROPRIATE_CODE
    })
  }
}

// 2. Call from client component
'use client'
import { myNewAction } from '@/lib/actions/server-actions'

const handleClick = async () => {
  const result = await myNewAction(inputData)
  if (result.success) {
    // Handle success
  }
}
```

### Adding a New Type

```typescript
// ALWAYS add to /src/lib/types.ts (single source of truth)

export interface MyNewType {
  id: string
  name: string
  createdAt: Date
  // ... other fields
}

// If used in Firestore, also add to Firestore type unions
export type FirestoreDocument = Player | Match | Group | MyNewType
```

### Creating an AI Flow

```typescript
// 1. Create flow in /src/ai/flows/my-flow.ts
import { z } from 'zod'
import { ai } from '../genkit'

const InputSchema = z.object({
  query: z.string()
})

const OutputSchema = z.object({
  response: z.string()
})

export const myFlow = ai.defineFlow(
  {
    name: 'myFlow',
    inputSchema: InputSchema,
    outputSchema: OutputSchema
  },
  async (input) => {
    const result = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      prompt: `Instrucciones en español: ${input.query}`,
      config: { temperature: 0.7 }
    })

    return { response: result.text }
  }
)

// 2. Create server action wrapper in /src/lib/actions/server-actions.ts
'use server'
import { myFlow } from '@/ai/flows/my-flow'

export async function callMyFlowAction(query: string) {
  try {
    const result = await myFlow({ query })
    return { success: true, ...result }
  } catch (error) {
    return handleServerActionError(error, {
      userMessage: 'Error al procesar solicitud',
      errorCode: ErrorCodes.AI_GENERATION_FAILED
    })
  }
}

// 3. Test in Genkit UI (npm run genkit:dev)
```

### Adding a shadcn/ui Component

```bash
# Use npx to add pre-built components
npx shadcn@latest add [component-name]

# Example
npx shadcn@latest add slider

# This will add the component to /src/components/ui/
```

---

## Testing

### E2E Testing with Playwright

```typescript
// Create test in tests/ directory
import { test, expect } from '@playwright/test'

test('user can create a match', async ({ page }) => {
  // Navigate to app
  await page.goto('http://localhost:3000')

  // Login
  await page.fill('[name="email"]', 'test@example.com')
  await page.fill('[name="password"]', 'password123')
  await page.click('button[type="submit"]')

  // Navigate to matches
  await page.click('text=Partidos')

  // Open create dialog
  await page.click('text=Nuevo Partido')

  // Fill form
  await page.fill('[name="title"]', 'Test Match')
  // ... more form fields

  // Submit
  await page.click('button:has-text("Crear")')

  // Verify success
  await expect(page.locator('text=Test Match')).toBeVisible()
})
```

**Run Tests**:
```bash
npm run test          # Headless
npm run test:ui       # Interactive UI
npm run test:headed   # Browser visible
npm run test:debug    # Step-through debugger
```

### Type Checking

```bash
# ALWAYS run before committing
npm run typecheck

# Should output: "No errors found"
```

---

## Deployment

### Firebase App Hosting

**Configuration**: `apphosting.yaml`

```yaml
runConfig:
  maxInstances: 1  # Development setting

env:
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    availability: [BUILD, RUNTIME]
  - variable: GOOGLE_GENAI_API_KEY
    availability: [RUNTIME]
  # ... 13 more variables
```

### Deployment Process

1. **Local Testing**:
   ```bash
   npm run build
   npm run start
   # Test at http://localhost:3000
   ```

2. **Push to Git**:
   ```bash
   git add .
   git commit -m "feat: description"
   git push origin claude/your-branch-name
   ```

3. **Automatic Deploy**:
   - Firebase App Hosting auto-deploys on push
   - Monitor in Firebase Console
   - Check build logs for errors

4. **Environment Variables**:
   - Set in Firebase Console
   - DO NOT commit `.env` files
   - Use `.env.example` as template

### Branch Strategy

**Development Branch**: `claude/claude-md-mkpj0vd5g77xarfv-IhU8y` (current)

**Important**:
- Always develop on designated `claude/*` branch
- Push with `-u origin branch-name` flag
- Branch name must start with `claude/` for deployment
- Never force push to main/master

---

## Language Conventions

### Spanish UI

All user-facing text MUST be in Spanish:
- Button labels: "Crear", "Editar", "Eliminar"
- Form fields: "Nombre", "Fecha", "Ubicación"
- Messages: "Operación exitosa", "No se pudo completar"
- AI responses: Always in Spanish

### English Code

- Variable names: English
- Comments: English (technical) or Spanish (domain-specific)
- Documentation: English
- Type names: English

### Spanish Attribute Names

Player attributes use Spanish abbreviations:
- PAC (Ritmo/Pace)
- TIR (Tiro/Shooting)
- PAS (Pase/Passing)
- REG (Regate/Dribbling)
- DEF (Defensa/Defense)
- FIS (Físico/Physical)

---

## Performance Considerations

### Next.js Optimization

- Use Server Components by default (no `'use client'` unless needed)
- Lazy load heavy components with `dynamic()`
- Optimize images with `next/image`
- Use route prefetching for navigation

### Firebase Best Practices

- Unsubscribe from real-time listeners on unmount
- Use indexed queries (defined in Firebase Console)
- Batch writes when updating multiple documents
- Paginate large collections

### AI Flow Optimization

- Use Genkit span tracking to monitor latency
- Cache AI responses when appropriate
- Use streaming for long responses
- Set appropriate timeouts

---

## Troubleshooting

### Common Issues

**Build Errors**:
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Type check
npm run typecheck
```

**Firebase Auth Issues**:
- Check `.env.local` has correct credentials
- Verify Firebase Auth is enabled in Console
- Check security rules allow operation

**AI Flow Failures**:
- Verify `GOOGLE_GENAI_API_KEY` is set
- Check Genkit UI for detailed errors
- Ensure input matches Zod schema

**Deployment Failures**:
- Check `apphosting.yaml` syntax
- Verify all environment variables are set in Firebase Console
- Review build logs in Firebase Console

---

## Additional Resources

### Documentation Files
- `PROJECT_DOCUMENTATION.md` - Comprehensive feature reference
- `FIREBASE_ENV_SETUP.md` - Environment setup guide
- `SECURITY_SETUP.md` - Security best practices
- `CHANGELOG.md` - Version history
- `README.md` - Quick start guide

### External Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Genkit Documentation](https://firebase.google.com/docs/genkit)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

## Quick Reference Card

### Key Directories
- `/src/app/` - Pages (Next.js App Router)
- `/src/components/` - React components
- `/src/lib/` - Utils, types, actions
- `/src/ai/flows/` - Genkit AI flows
- `/src/firebase/` - Firebase integration

### Key Files
- `/src/lib/types.ts` - ALL type definitions
- `/src/lib/actions/server-actions.ts` - ALL server actions
- `/src/lib/errors.ts` - Error codes & handling
- `/src/firebase/admin-init.ts` - Admin SDK init
- `tailwind.config.ts` - Theme customization

### Essential Commands
```bash
npm run dev           # Start dev server
npm run typecheck     # Type checking
npm run build         # Production build
npm run test          # E2E tests
npm run genkit:dev    # AI flow testing
```

### Import Shortcuts
```typescript
import { Player, Match } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { useUser } from '@/firebase/auth/use-user'
import { createPlayerAction } from '@/lib/actions/server-actions'
```

---

**Remember**: When in doubt, check existing code for patterns. This codebase follows consistent conventions throughout.
