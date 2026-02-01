# Data Flows and Module Map

## Overview
- Frontend: Next.js 14 (app dir) + React 18 + Tailwind
- Auth/Data: Firebase Client SDK (providers, real-time hooks)
- Server: Firebase Admin SDK in Server Actions; Cloud Functions (scheduled)
- Messaging: FCM via service worker and client hooks
- AI: Genkit flows integrated in server actions

## Authentication
- Client: `FirebaseProvider` exposes `auth` and `firestore`.
- `useUser()` subscribes to `users/{uid}`, syncs `players/{uid}` `groupId`, triggers monthly credit reset via API.
- Server: `getServerSession()` verifies `session` cookie with Admin Auth.

## Firestore
- Reads: `useDoc()`, `useCollection()` in client for real-time UI.
- Writes: Prefer `server-actions` (Admin SDK) for business logic; client writes limited to benign user-owned fields when necessary.

## Notifications
- Tokens: saved under `users/{uid}/fcmTokens` from `use-fcm` or `use-notifications`.
- SW: `public/firebase-messaging-sw.js` handles background notifications.
- Server actions send user notifications to per-user collections.

## Matches & Teams
- Create/update matches via server actions; AI-generated teams.
- Subcollections for invitations and proposals managed by server actions.

## Competitions
- Leagues/cups lifecycle in server actions; standings and brackets.

## Payments
- Webhook: `/api/webhooks/mercadopago` validates signature and delegates to server actions.

## Cloud Functions
- `resetMonthlyCredits` scheduled monthly; logs to `systemLogs`.

## Rules & Indexes
- `firestore.rules` and `storage.rules` documented; indexes for common queries in `firestore.indexes.json`.

## Critical Paths
- Auth -> `useUser` -> `users/{uid}` -> UI gating in `MainNav`.
- Player profile sync: `users/{uid}.activeGroupId` -> `players/{uid}.groupId` client-side merge.
- Monthly Credits: Cloud Function + API fallback -> `players/{uid}.cardGenerationCredits`.
- Notifications: token registration -> foreground/background delivery.

## Recommendations
- Harden Firestore writes for critical collections; ensure all writes go through server actions.
- Enforce env for VAPID; remove hardcoded defaults.
- Validate inputs with `zod` in server actions and APIs.
- Document and enforce business invariants in server actions.
