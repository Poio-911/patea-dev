
import { DocumentData, DocumentReference } from "firebase/firestore";
import type { PerformanceTag as Pt } from "./performance-tags";
import { z } from 'zod';

export type PerformanceTag = Pt;

export type PlayerPosition = 'DEL' | 'MED' | 'DEF' | 'POR';

export type AttributeKey = 'PAC' | 'SHO' | 'PAS' | 'DRI' | 'DEF' | 'PHY';

export type PlayerStats = {
  matchesPlayed: number;
  goals: number;
  assists: number;
  averageRating: number;
  yellowCards?: number;
  redCards?: number;
};

export type OvrHistory = {
  id: string;
  date: string;
  oldOVR: number;
  newOVR: number;
  change: number;
  matchId: string;
  attributeChanges?: Partial<Pick<Player, 'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy'>>;
};

export type Player = {
  id: string;
  name: string;
  position: PlayerPosition;
  ovr: number;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  photoUrl?: string;
  stats: PlayerStats;
  ownerUid: string; // The UID of the user who created this player
  groupId: string | null;
  cardGenerationCredits?: number;
  lastCreditReset?: string; // ISO 8601 string
  cropPosition?: { x: number; y: number };
  cropZoom?: number;
} & DocumentData;

export type DetailedTeamPlayer = Player & { number: number; status: 'titular' | 'suplente' };

export type DayOfWeek = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';
export type TimeOfDay = 'mañana' | 'tarde' | 'noche';

export type Availability = {
    [key in DayOfWeek]?: TimeOfDay[];
};

export type AvailablePlayer = {
  uid: string;
  displayName: string;
  photoUrl: string;
  position: PlayerPosition;
  ovr: number;
  location: {
    lat: number;
    lng: number;
  };
  availability: Availability;
} & DocumentData;


export type MatchStatus = 'upcoming' | 'active' | 'completed' | 'evaluated';
export type MatchType = 'manual' | 'collaborative' | 'by_teams' | 'intergroup_friendly' | 'league' | 'cup' | 'league_final';
export type MatchSize = 10 | 14 | 22;

export type MatchLocation = {
    name: string;
    address: string;
    lat: number;
    lng: number;
    placeId: string;
}

export type MatchGoalScorer = {
  playerId: string;
  playerName: string;
  teamId: string;
};

export type CardType = 'yellow' | 'red';

export type MatchCard = {
  playerId: string;
  playerName: string;
  teamId: string;
  cardType: CardType;
};

export type TeamFormation = {
  [key: string]: { x: number, y: number } // player.uid -> {x, y} percentage coordinates
};

export type Match = {
  id: string;
  title: string;
  date: string;
  time: string;
  location: MatchLocation;
  type: MatchType;
  matchSize: MatchSize;
  players: { uid: string; displayName: string; ovr: number; position: PlayerPosition; photoUrl: string }[];
  playerUids: string[]; // Added for simpler queries
  teams: Team[];
  status: MatchStatus;
  ownerUid: string;
  groupId: string;
  isPublic?: boolean;
  weather?: {
    description: string;
    icon: string;
    temperature: number;
  };
  chronicle?: string; // AI-generated match summary
  startTimestamp?: string;
  participantTeamIds?: string[];
  createdAt?: string;
  finalScore?: { team1: number; team2: number } | null;
  finalizedAt?: string | null;
  leagueInfo?: {
    leagueId: string;
    round: number;
  };
  goalScorers?: MatchGoalScorer[]; // Individual goal scorers
  cards?: MatchCard[]; // Yellow and red cards
} & DocumentData;

export type Team = {
  id?: string;
  name: string;
  players: {
    uid: string;
    displayName: string;
    position: string;
    ovr: number;
  }[];
  totalOVR: number;
  averageOVR: number;
  suggestedFormation?: string;
  tags?: string[];
  balanceMetrics?: {
    ovrDifference: number;
    fairnessPercentage: number;
  };
  jersey?: Jersey;
  formation?: TeamFormation;
  finalScore?: number; // Score for this team in the match
};

export type JerseyType = 'plain' | 'vertical' | 'band' | 'chevron' | 'thirds' | 'lines';

export type Jersey = {
  type: JerseyType;
  primaryColor: string;
  secondaryColor: string;
};

export type PlayerStatus = 'titular' | 'suplente';

export type GroupTeamMember = {
  playerId: string;
  number: number;
  status: PlayerStatus;
};

export type GroupTeam = {
  id: string;
  name: string;
  groupId: string;
  jersey: Jersey;
  members: GroupTeamMember[];
  createdBy: string;
  createdAt: string;
  isChallengeable?: boolean; 
} & DocumentData;


export type Group = {
  id: string;
  name: string;
  ownerUid: string;
  inviteCode: string;
  members: string[];
} & DocumentData;


export type NotificationType =
    | 'match_invite'
    | 'new_joiner'
    | 'evaluation_pending'
    | 'match_update'
    | 'challenge_received'
    | 'challenge_accepted'
    | 'challenge_rejected'
    | 'league_application'
    | 'new_follower'
    | 'match_invitation'
    | 'match_reminder'
    | 'ovr_milestone'
    | 'achievement_unlocked';

export type Notification = {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    link: string;
    isRead: boolean;
    createdAt: string;
    // Optional metadata for additional context
    metadata?: {
        fromUserId?: string;
        fromUserName?: string;
        fromUserPhoto?: string;
        matchId?: string;
        achievementId?: string;
        playerId?: string;
    };
} & DocumentData;

export type TeamAvailabilityPost = {
    id: string;
    teamId: string;
    teamName: string;
    jersey: Jersey;
    date: string; 
    time: string; 
    location: MatchLocation;
    description?: string;
    createdBy: string; 
    createdAt: string; 
    status?: 'active' | 'matched' | 'expired';
    matchedWithTeamId?: string; 
    matchId?: string; 
} & DocumentData;

export type Invitation = {
    id: string;
    type: 'player_to_match' | 'team_challenge';
    status: 'pending' | 'accepted' | 'declined';
    createdBy: string; 
    createdAt: string;
    matchId?: string;
    matchTitle?: string;
    matchDate?: string;
    playerId?: string;
    fromTeamId?: string;
    fromTeamName?: string;
    fromTeamJersey?: Jersey;
    toTeamId?: string;
    toTeamName?: string;
    toTeamJersey?: Jersey;
    postId?: string;
} & DocumentData;

    
export type FcmToken = {
    id: string;
    token: string;
    createdAt: string;
} & DocumentData;

export type Evaluation = {
    id: string;
    assignmentId: string; 
    playerId: string; 
    evaluatorId: string; 
    matchId: string; 
    rating?: number; 
    goals: number; 
    performanceTags?: PerformanceTag[]; 
    evaluatedAt: string;
} & DocumentData;


export type SelfEvaluation = {
  id: string;
  playerId: string;
  matchId: string;
  goals: number;
  assists?: number;
  reportedAt: string;
} & DocumentData;

export type EvaluationAssignment = {
    id: string;
    matchId: string;
    evaluatorId: string; 
    subjectId: string; 
    status: 'pending' | 'completed';
    evaluationId?: string; 
} & DocumentData;

export type PlayerEvaluationFormData = {
  assignmentId: string;
  subjectId: string;
  displayName: string;
  photoUrl: string;
  position: string;
  evaluationType: 'points' | 'tags';
  rating?: number;
  performanceTags?: PerformanceTag[];
};

export type EvaluationSubmission = {
    id: string;
    evaluatorId: string;
    matchId: string;
    match?: Partial<Match>;
    submittedAt: string;
    submission: {
        evaluatorGoals: number;
    evaluatorAssists?: number;
        evaluations: PlayerEvaluationFormData[];
    }
} & DocumentData;
    
export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  groups?: string[];
  activeGroupId?: string | null;
};

export type AppHelpInput = {
    userMessage: string;
    conversationHistory?: {
        role: 'user' | 'agent';
        content: string;
    }[];
};

export type ChatMessage = {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhotoUrl: string;
  createdAt: any; 
} & DocumentData;

const KeyEventSchema = z.object({
  minute: z.number().describe("Minuto aproximado del evento (e.g., 15, 40, 75)."),
  type: z.enum(['Goal', 'Assist', 'Save', 'KeyDefensivePlay', 'KeyPlay']).describe("Tipo de evento."),
  playerName: z.string().describe("Nombre del jugador protagonista."),
  description: z.string().describe("Descripción de la acción basada en su etiqueta de rendimiento (e.g., 'Definió como los dioses', 'Cierre providencial')."),
  relatedPlayerName: z.string().optional().describe("Nombre de un segundo jugador involucrado (e.g., el asistidor)."),
});

export const GenerateMatchChronicleInputSchema = z.object({
  matchTitle: z.string().describe("Título del partido."),
  team1Name: z.string().describe("Nombre del Equipo 1."),
  team1Score: z.number().describe("Goles del Equipo 1."),
  team2Name: z.string().describe("Nombre del Equipo 2."),
  team2Score: z.number().describe("Goles del Equipo 2."),
  keyEvents: z.array(KeyEventSchema).describe("Lista de 3 a 5 eventos clave del partido."),
  mvp: z.object({
    name: z.string(),
    reason: z.string(),
  }).describe("El Jugador Más Valioso (MVP) y la razón."),
});
export type GenerateMatchChronicleInput = z.infer<typeof GenerateMatchChronicleInputSchema>;

export const GenerateMatchChronicleOutputSchema = z.object({
  headline: z.string().describe("Un titular periodístico y llamativo para la crónica."),
  introduction: z.string().describe("Un párrafo introductorio que resume el partido y el resultado final."),
  keyMoments: z.array(
    z.object({
      minute: z.string().describe("El minuto del evento, en formato 'Min XX'."),
      event: z.string().describe("La descripción del evento clave, narrado en estilo de relator de fútbol."),
    })
  ).describe("Una lista de los 3-4 momentos más importantes del partido."),
  conclusion: z.string().describe("Un párrafo final que resume el partido y nombra al MVP."),
});
export type GenerateMatchChronicleOutput = z.infer<typeof GenerateMatchChronicleOutputSchema>;

export const GenerateDuoImageInputSchema = z.object({
  player1PhotoUrl: z.string().describe("URL de Firebase Storage de la foto del primer jugador."),
  player1Name: z.string().describe("Nombre del primer jugador."),
  player2PhotoUrl: z.string().optional().describe("URL de Firebase Storage de la foto del segundo jugador (opcional para imagen individual)."),
  player2Name: z.string().optional().describe("Nombre del segundo jugador (opcional para imagen individual)."),
  prompt: z.string().describe("La instrucción que describe la escena a generar entre los jugadores."),
});
export type GenerateDuoImageInput = z.infer<typeof GenerateDuoImageInputSchema>;

// NEW: Entities for Leagues and Cups
export type CompetitionFormat = 'league' | 'cup';
export type LeagueFormat = 'round_robin' | 'double_round_robin';
export type CupFormat = 'single_elimination';
export type CompetitionStatus = 'draft' | 'open_for_applications' | 'in_progress' | 'completed';

export type League = {
  id: string;
  name: string;
  format: LeagueFormat;
  status: CompetitionStatus;
  ownerUid: string;
  groupId: string; // The "home" group of the league
  isPublic: boolean;
  teams: string[]; // Array of teamIds
  createdAt: string;
  logoUrl?: string; // URL to league logo image
  // Schedule configuration
  startDate?: string; // ISO date string of first match
  matchFrequency?: 'weekly' | 'biweekly' | 'custom'; // How often matches occur
  matchDayOfWeek?: number; // 0-6 (Sunday-Saturday)
  matchTime?: string; // HH:mm format
  defaultLocation?: MatchLocation; // Default location for matches
  // Champion and tiebreaker
  championTeamId?: string;
  championTeamName?: string;
  runnerUpTeamId?: string;
  runnerUpTeamName?: string;
  completedAt?: string; // ISO date when league was completed
  requiresTiebreaker?: boolean; // If final match needed
  finalMatchId?: string; // Reference to tiebreaker match
  // Standings table (updated after each match)
  standings?: LeagueStanding[];
} & DocumentData;

// League standings/statistics
export type LeagueStanding = {
  teamId: string;
  teamName: string;
  teamJersey: Jersey;
  position: number; // Current position in table
  matchesPlayed: number; // PJ
  wins: number; // PG
  draws: number; // PE
  losses: number; // PP
  goalsFor: number; // GF
  goalsAgainst: number; // GC
  goalDifference: number; // DG
  points: number; // Pts
};

// Team statistics in a league
export type LeagueTeamStats = {
  teamId: string;
  teamName: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number; // Partidos sin goles en contra
  topScorers: Array<{ playerId: string; playerName: string; goals: number }>;
};

// Player statistics in a specific league
export type LeaguePlayerStats = {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  matchesPlayed: number;
  goals: number;
  yellowCards: number;
  redCards: number;
};

// Cup rounds enum
export type CupRound = 'round_of_32' | 'round_of_16' | 'round_of_8' | 'semifinals' | 'final';

// Bracket match for cup knockout structure
export type BracketMatch = {
  id: string;
  round: CupRound;
  matchNumber: number; // Position in the round (1, 2, 3, 4...)
  team1Id?: string; // undefined until determined
  team2Id?: string;
  team1Name?: string;
  team2Name?: string;
  team1Jersey?: Jersey;
  team2Jersey?: Jersey;
  winnerId?: string;
  matchId?: string; // Reference to actual Match document when played
  nextMatchNumber?: number; // Which match the winner advances to
};

export type Cup = {
  id: string;
  name: string;
  format: CupFormat;
  status: CompetitionStatus;
  ownerUid: string;
  groupId: string; // The "home" group of the cup
  isPublic: boolean;
  teams: string[]; // Array of teamIds
  createdAt: string;
  logoUrl?: string; // URL to cup logo image
  // Scheduling configuration
  startDate?: string; // ISO date string of first match
  defaultLocation?: MatchLocation; // Default location for matches
  // Bracket structure
  bracket?: BracketMatch[]; // Generated when cup starts
  currentRound?: CupRound; // Track which round is active
  // Champion tracking
  championTeamId?: string;
  championTeamName?: string;
  runnerUpTeamId?: string;
  runnerUpTeamName?: string;
  completedAt?: string; // ISO date when cup was completed
} & DocumentData;

export type CompetitionApplication = {
    id: string;
    competitionId: string;
    competitionType: CompetitionFormat;
    teamId: string;
    teamName: string;
    teamJersey: Jersey;
    status: 'pending' | 'approved' | 'rejected';
    submittedAt: string;
    submittedBy: string; // userId of team owner
} & DocumentData;

// ============================================================================
// HEALTH & FITNESS INTEGRATION (Smartwatch)
// ============================================================================

export type HealthProvider = 'google_fit' | 'apple_health';

export type HealthConnection = {
    id: string;
    provider: HealthProvider;
    userId: string;
    accessToken: string; // Should be encrypted in production
    refreshToken: string; // Should be encrypted in production
    expiresAt: string; // ISO timestamp when access token expires
    scopes: string[]; // OAuth scopes granted
    connectedAt: string; // ISO timestamp when first connected
    lastSyncAt?: string; // ISO timestamp of last successful sync
    isActive: boolean; // Whether connection is still valid
} & DocumentData;

export type PlayerPerformance = {
    id: string;
    playerId: string;
    matchId: string;
    userId: string; // uid of the user who owns this performance data
    // Physical metrics
    distance?: number; // kilometers
    avgHeartRate?: number; // bpm
    maxHeartRate?: number; // bpm
    steps?: number;
    calories?: number; // kcal
    duration?: number; // minutes
    // Source and timing
    source: 'google_fit' | 'apple_health' | 'manual';
    activityStartTime: string; // ISO timestamp
    activityEndTime: string; // ISO timestamp
    linkedAt: string; // ISO timestamp when linked to match
    // Impact on player attributes
    impactOnAttributes?: {
        pac?: number;
        phy?: number;
    };
    // Raw data for debugging/auditing
    rawData?: any;
} & DocumentData;

// OAuth2 configuration
export type GoogleFitAuthUrl = {
    authUrl: string;
    state: string; // CSRF token
};

// Activity session from Google Fit
export type GoogleFitSession = {
    id: string;
    name: string;
    description?: string;
    startTime: string;
    endTime: string;
    activityType: string; // 'running', 'soccer', 'walking', etc.
    duration: number; // milliseconds
    metrics?: {
        distance?: number;
        steps?: number;
        calories?: number;
        avgHeartRate?: number;
        maxHeartRate?: number;
    };
};

// Flattened activity data from Google Fit (for UI usage)
export type GoogleFitActivity = {
    id: string;
    name: string;
    description?: string;
    startTime: string;
    endTime: string;
    activityType: string;
    duration: number; // milliseconds
    distance?: number; // meters
    steps?: number;
    calories?: number; // kcal
    avgHeartRate?: number; // bpm
    maxHeartRate?: number; // bpm
};

// ============================================
// SOCIAL FEATURES
// ============================================

// Follow relationship between users/players
export type Follow = {
    id: string;
    followerId: string; // UID of user who is following
    followingId: string; // UID of user being followed
    createdAt: string; // ISO timestamp
} & DocumentData;

// Activity types for the social feed
export type ActivityType =
    | 'match_played'
    | 'ovr_increased'
    | 'ovr_decreased'
    | 'goal_scored'
    | 'achievement_unlocked'
    | 'player_created'
    | 'new_follower';

// Social activity for the feed
export type SocialActivity = {
    id: string;
    type: ActivityType;
    userId: string; // User who performed the activity
    playerId?: string; // Player involved (if applicable)
    playerName?: string;
    playerPhotoUrl?: string;
    timestamp: string; // ISO timestamp
    // Activity-specific data
    metadata?: {
        matchId?: string;
        matchTitle?: string;
        oldOvr?: number;
        newOvr?: number;
        ovrChange?: number;
        goals?: number;
        achievementName?: string;
        achievementIcon?: string;
    };
} & DocumentData;

// Note: Notification types are now unified with the main notification system above (lines 199-231)
