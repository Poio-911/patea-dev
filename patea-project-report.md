# Pateá - Project Report

## 1. Overview

### 1.1. Core Concept
Pateá is a comprehensive platform for amateur soccer players, designed to organize matches, manage teams, and track player performance with the help of AI-powered insights.

### 1.2. Target Audience
Amateur soccer players, team captains, and group organizers who want a more structured and data-driven approach to their games.

### 1.3. Key Features
*   Group and persistent team management.
*   Advanced match creation (manual, collaborative, by teams).
*   Detailed player profiles with OVR (Overall Rating) and statistics.
*   AI-powered team balancing, player analysis, and content generation.
*   Social features like user profiles, followers, and notifications.
*   Monetization through a credit system for AI image generation.
*   Installable Progressive Web App (PWA) for a native-like experience.

## 2. Core Functionalities

### 2.1. User & Auth
*   **Authentication**: Firebase Authentication (email/password, Google, Facebook).
*   **User Profiles**: Public profiles with name, photo, OVR, and stats.
*   **Social Graph**: Follower/following system.

### 2.2. Groups & Teams
*   **Groups**: Private communities for organizing matches, with unique invite codes.
*   **Persistent Teams**: Fixed teams within a group for internal leagues or consistent matchups.

### 2.3. Player Management
*   **Player Profiles**: Detailed profiles with attributes (Pace, Shooting, Passing, etc.), OVR, and performance history.
*   **Player Creation**: Users can create and manage multiple player profiles.

### 2.4. Match Management
*   **Match Types**:
    *   **Manual**: Organizer controls both teams.
    *   **Collaborative**: Organizer creates the match, other players can join.
    *   **By Teams**: A match between two persistent teams within a group.
*   **Match Lifecycle**: Upcoming, Live, Awaiting Evaluation, Finished.

### 2.5. Player Evaluation & OVR
*   **Peer Evaluation**: After a match, players rate their teammates on a 1-10 scale and assign performance tags.
*   **OVR Calculation**: The OVR is a weighted average of 6 key attributes, which are updated based on peer evaluations. The process is finalized by the match organizer.

### 2.6. Search & Discovery
*   **Search**: Users can search for other players and public groups.
*   **Discovery**: The platform suggests public matches to join.

### 2.7. Notifications
*   **Firebase Cloud Messaging (FCM)**: Used for push notifications.
*   **Notification Types**: Match invitations, reminders, evaluation readiness, credit purchase confirmations, and social notifications.

### 2.8. Venues
*   **Venue Management**: Group admins can create and manage a list of frequently used venues.
*   **Venue Details**: Includes location, cost, and a link to Google Maps.

### 2.9. Payments & Credits
*   **Monetization**: Users can purchase credits to generate AI images (player cards, duo images).
*   **Payment Gateway**: MercadoPago for secure payment processing.
*   **Credit System**:
    *   3 free credits per month per player.
    *   Purchased credits do not expire.
    *   Various credit packages are available for purchase.

### 2.10. PWA (Progressive Web App)
*   **Installable**: The app can be installed on mobile and desktop devices for a native-like experience.
*   **Offline Capabilities**: Caching of static assets, important routes, and Firestore data allows for offline access.
*   **Push Notifications**: Integrated with the notification system.

## 3. AI-Powered Features (Genkit & Gemini 2.5 Flash)

### 3.1. `generate-balanced-teams`
*   **Purpose**: Creates two balanced teams from a list of players, considering their OVR and positions.
*   **Integration**: Used in the match creation dialog.

### 3.2. `suggest-player-improvements`
*   **Purpose**: Provides 2-3 actionable tips for a player based on their recent performance and stats.
*   **Integration**: Available in the player's "Insights" panel.

### 3.3. `analyze-player-progression`
*   **Purpose**: Analyzes a player's OVR history and evaluations to generate a report on their performance trajectory.
*   **Integration**: Available in the player's progression view.

### 3.4. `detect-player-patterns`
*   **Purpose**: Identifies significant performance patterns (trends, specialties, inconsistencies) from a player's history.
*   **Integration**: Available in the player's "Insights" panel.

### 3.5. `find-best-fit-player`
*   **Purpose**: Recommends the best available players to fill empty spots in a match, prioritizing positional needs and OVR balance.
*   **Integration**: Used in the "Find Best Fit Player" dialog.

### 3.6. `coach-conversation`
*   **Purpose**: A conversational AI chat where a "virtual coach" provides personalized advice and motivation based on the player's data.
*   **Integration**: A dedicated chat view accessible from the player's profile.

### 3.7. `get-app-help`
*   **Purpose**: A contextual help assistant that answers user questions about the application's features.
*   **Integration**: Available in the main help dialog.

### 3.8. `get-match-day-forecast`
*   **Purpose**: Provides a simple weather forecast for the location and date of a scheduled match.
*   **Integration**: Displayed when creating a match and on the match card.

### 3.9. `generate-match-chronicle`
*   **Purpose**: Creates a narrative, journalistic-style summary of a finished match.
*   **Integration**: Shown in a "Chronicle" card after a match is completed.

### 3.10. `generate-duo-image`
*   **Purpose**: Generates an image of one or two players in a soccer-related scene, based on their profile pictures.
*   **Integration**: A visual content generation feature.

### 3.11. `generate-player-card-image`
*   **Purpose**: Creates a FIFA Ultimate Team-style player card with the player's photo, stats, and OVR.
*   **Integration**: Available on the player's profile.

### 3.12. `generate-group-summary`
*   **Purpose**: Generates a brief, descriptive summary of a group based on its members and stats.
*   **Integration**: Displayed on the group's detail view.

## 4. Technical Architecture

### 4.1. Frontend
*   **Framework**: Next.js (React)
*   **Styling**: Tailwind CSS
*   **UI Components**: Shadcn UI, Headless UI, Radix UI
*   **State Management**: React Context, Zustand
*   **PWA**: `@ducanh2912/next-pwa`

### 4.2. Backend
*   **Framework**: Next.js (Server Actions, API Routes)
*   **Authentication**: Firebase Authentication
*   **Real-time**: Firestore real-time listeners

### 4.3. Database
*   **Primary Database**: Firestore (NoSQL)

### 4.4. AI & Machine Learning
*   **Framework**: Google Genkit
*   **Model**: Gemini 2.5 Flash

### 4.5. Deployment & Hosting
*   **Platform**: Vercel (for the Next.js app)
*   **Database & Auth**: Firebase

## 5. Getting Started & Setup

### 5.1. Prerequisites
*   Node.js (v18 or later)
*   pnpm
*   Firebase account
*   Google AI API Key

### 5.2. Installation
```bash
git clone <repository-url>
cd patea
pnpm install
```

### 5.3. Running the App
1.  Set up your Firebase project and obtain your configuration.
2.  Create a `.env.local` file and add your Firebase and Google AI credentials.
3.  Run the development server:
    ```bash
    pnpm dev
    ```

## 6. Project Structure

### 6.1. Key Directories
*   `/src/app`: Main application routes and pages.
*   `/src/components`: Reusable React components.
*   `/src/lib`: Utility functions and configuration files.
*   `/src/ai`: Genkit flows and AI-related code.
*   `/src/firebase`: Firebase configuration and services.
*   `/docs`: Project documentation.

### 6.2. Component Organization
Components are organized by feature (e.g., `/src/components/auth`, `/src/components/matches`) and also include a `/src/components/ui` directory for generic, unstyled components based on Shadcn UI.
