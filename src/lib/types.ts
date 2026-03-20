
import { DocumentData, DocumentReference, Timestamp } from "firebase/firestore";
import type { PerformanceTag as Pt } from "./performance-tags";
import { z } from 'zod';

export type PerformanceTag = Pt;

export type PlayerPosition = 'DEL' | 'MED' | 'DEF' | 'POR';
export type PreferredFoot = 'derecho' | 'izquierdo' | 'ambidiestro';

export type AttributeKey = 'PAC' | 'SHO' | 'PAS' | 'DRI' | 'DEF' | 'PHY';

export type PlayerStats = {
  matchesPlayed: number;
  goals: number;
  assists: number;
  averageRating: number;
  yellowCards?: number;
  redCards?: number;
  mvpVotes?: number; // Total de veces que fue elegido MVP por sus compañeros
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
  photoURL?: string;
  photoUrl?: string; // Legacy alias for Firestore consistency
  stats: PlayerStats;
  ownerUid: string; // The UID of the user who created this player
  groupId: string | null;
  cardGenerationCredits?: number;
  lastCreditReset?: string; // ISO 8601 string - reset mensual gratis
  totalCreditsPurchased?: number; // Total histórico de créditos comprados
  lastPurchaseDate?: string; // ISO 8601 string - fecha de última compra
  cropPosition?: { x: number; y: number };
  cropZoom?: number;
  jersey?: Jersey; // Jersey del equipo al que pertenece (para watermark en cards)
  teamId?: string; // ID del equipo persistente al que pertenece
  preferredFoot?: PreferredFoot;
  bio?: string;
  birthYear?: number;
  nationality?: string;
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
  photoURL: string;
  position: PlayerPosition;
  ovr: number;
  location: {
    lat: number;
    lng: number;
    geohash: string; // Added for geospatial querying
  };
  availability: Availability;
} & DocumentData;


export type MatchStatus = 'planning' | 'upcoming' | 'active' | 'completed' | 'evaluated' | 'delayed';
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
  minute?: number;
};

export type LocationProposal = {
  id: string;
  location: MatchLocation;
  proposedBy: string; // uid
  votes: string[]; // array of user uids
  createdAt: string;
};

export type Match = {
  id: string;
  title: string;
  date: string;
  time: string;
  location: MatchLocation;
  type: MatchType;
  matchSize: number;
  isPublic: boolean;
  status: MatchStatus;

  // Participants
  ownerUid: string;
  groupId: string | null;
  players: { uid: string; displayName: string; ovr: number; position: PlayerPosition; photoURL: string }[]; // Flattened list
  playerUids: string[];
  pendingPlayerUids?: string[]; // UIDs with pending join requests (manual matches)

  // Teams structure (for by_teams/intergroup)
  teams?: Team[];

  // Additional Metadata
  weather?: {
    description: string;
    temperature?: number;
    icon?: string;
    humidity?: number;
    uvIndex?: number;
    windSpeed?: number;
    precipitation?: number;
    feelsLike?: number;
    conditions?: string;
    recommendation?: string;
  };

  // Inter-Group specific
  participantTeamIds?: string[];
  participantGroupIds?: string[];
  captains?: string[]; // [uid1, uid2]
  locationProposals?: LocationProposal[];
  dateProposals?: MatchDateProposal[]; // For 'planning' phase date voting
  isVotingOpen?: boolean;

  // Game Data
  finalScore?: { team1: number; team2: number };
  liveStatus?: LiveMatchStatus;
  currentMinute?: number;
  scorers?: MatchGoalScorer[];
  cards?: MatchCard[];
  startedAt?: string;
  endedAt?: string;

  // Legacy/Optional
  leagueId?: string;
  leagueInfo?: {
    leagueId: string;
    round?: number;
    isCupMatch?: boolean;
    cupId?: string;
    bracketMatchId?: string;
  };

  startTimestamp?: string;
  createdAt?: string;

  mvpId?: string;
  mvpData?: any;
  chronicle?: GenerateMatchChronicleOutput;
  chronicleGeneratedAt?: string;
  bestPlayerId?: string;
} & DocumentData;

// Enhanced event tracking types
export type MatchEventType =
  | 'goal'
  | 'card'
  | 'substitution'
  | 'foul'
  | 'corner'
  | 'throw_in'
  | 'offside'
  | 'penalty'
  | 'free_kick'
  | 'save'
  | 'kick_off'
  | 'half_time'
  | 'full_time';

export type GoalType = 'regular' | 'penalty' | 'free_kick' | 'header' | 'own_goal' | 'volley';
export type BodyPart = 'left_foot' | 'right_foot' | 'head' | 'chest' | 'other';
export type CardReason = 'foul' | 'unsporting_behavior' | 'dissent' | 'persistent_fouling' | 'delaying_game' | 'other';
export type SubstitutionReason = 'tactical' | 'injury' | 'tired' | 'poor_performance' | 'disciplinary';

export type MatchEvent = {
  id: string;
  type: MatchEventType;
  minute: number;
  playerId: string;
  playerName: string;
  teamId: string;
  description?: string;
  // Goal-specific data
  assistId?: string;
  assistName?: string;
  goalType?: GoalType;
  bodyPart?: BodyPart;
  // Card-specific data
  cardType?: CardType;
  cardReason?: CardReason;
  // Substitution-specific data
  playerOutId?: string;
  playerOutName?: string;
  playerInId?: string;
  playerInName?: string;
  substitutionReason?: SubstitutionReason;
  // General metadata
  timestamp: string; // ISO timestamp when event was recorded
  recordedBy?: string; // userId who recorded the event
};

export type MatchTimelineEvent = {
  id: string;
  minute: number;
  type: 'event' | 'period';
  eventId?: string; // Reference to MatchEvent if type is 'event'
  periodType?: 'kick_off' | 'half_time' | 'second_half' | 'full_time' | 'extra_time';
  description: string;
  timestamp: string;
};

export type MatchStatistics = {
  possession: { team1: number; team2: number }; // Percentage
  shots: {
    team1: { total: number; onTarget: number; offTarget: number; blocked: number };
    team2: { total: number; onTarget: number; offTarget: number; blocked: number };
  };
  passes: {
    team1: { total: number; completed: number; accuracy: number };
    team2: { total: number; completed: number; accuracy: number };
  };
  fouls: { team1: number; team2: number };
  corners: { team1: number; team2: number };
  offsides: { team1: number; team2: number };
  yellowCards: { team1: number; team2: number };
  redCards: { team1: number; team2: number };
  saves: { team1: number; team2: number };
};

export type LiveMatchStatus =
  | 'not_started'
  | 'first_half'
  | 'half_time'
  | 'second_half'
  | 'extra_time_first'
  | 'extra_time_break'
  | 'extra_time_second'
  | 'penalty_shootout'
  | 'finished';

export type MatchPeriod = {
  type: 'first_half' | 'second_half' | 'extra_time_first' | 'extra_time_second';
  startTime: string; // ISO timestamp
  endTime?: string; // ISO timestamp
  duration: number; // minutes
  addedTime?: number; // injury time in minutes
};

export type TeamFormation = {
  [key: string]: { x: number, y: number } // player.uid -> {x, y} percentage coordinates
};

// Duplicate Match definition removed

export type Team = {
  id?: string;
  name: string;
  players: {
    uid: string;
    displayName: string;
    position: string;
    ovr: number;
    photoURL?: string;
    photoUrl?: string;
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

export type JerseyType = 'plain' | 'vertical' | 'band' | 'chevron' | 'thirds' | 'lines' | 'solid' | 'hoops' | 'halves' | 'cross' | 'sash' | 'checkers' | 'quarters' | 'diagonal_half' | 'central_panel' | 'v_pinstripes';

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


export type GroupMember = {
  userId: string;
  role: 'admin' | 'moderator' | 'member';
  joinedAt: string;
  addedBy?: string; // userId who added this member
} & DocumentData;

export type Group = {
  id: string;
  name: string;
  ownerUid: string;
  inviteCode: string;
  members: string[]; // DEPRECATED: Array simple de IDs (mantener por compatibilidad)
  memberRoles?: GroupMember[]; // NUEVO: Array con roles y metadata
  description?: string;
  createdAt?: string;
} & DocumentData;

// --- CANCHAS / VENUES ---

export type VenueSurface = 'grass' | 'artificial' | 'indoor' | 'clay' | 'concrete';

export type Venue = {
  id: string;
  groupId: string; // Pertenece a un grupo específico
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  pricePerHour: number;
  currency: string; // 'ARS', 'USD', etc.
  surface?: VenueSurface;
  capacity?: number; // Cantidad máxima de jugadores
  fieldSize?: string; // '5v5', '7v7', '11v11', etc.
  hasLighting?: boolean;
  hasParking?: boolean;
  hasChangingRooms?: boolean;
  hasShowers?: boolean;
  contactPhone?: string;
  contactEmail?: string;
  website?: string;
  notes?: string;
  photos?: string[]; // URLs de fotos
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
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
  | 'cup_application'
  | 'new_follower'
  | 'match_invitation'
  | 'match_reminder'
  | 'ovr_milestone'
  | 'achievement_unlocked'
  | 'identity_reveal_requested';

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

export type AttributeChange = {
  attribute: 'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy';
  change: number;
  reason: string;
};

export type Evaluation = {
  id: string;
  assignmentId: string;
  playerId: string;
  evaluatorId: string;
  matchId: string;
  rating?: number;
  goals: number;
  assists?: number;
  personalChronicle?: string;
  performanceTags?: PerformanceTag[];
  // Texto de evaluación y resumen IA
  textDescription?: string;
  aiSummary?: string;
  // Cambios de atributos extraídos por IA (para evaluaciones de texto)
  aiAttributeChanges?: AttributeChange[];
  aiConfidence?: number;
  evaluatedAt: string;
  // Auto-generated evaluation (pending assignment filled with match average)
  autoGenerated?: boolean;
  // Identity Reveal Feature
  identityRequestStatus?: 'none' | 'pending' | 'accepted' | 'rejected';
  identityRevealed?: boolean;
  evaluatorDisplayName?: string;
  evaluatorPhotoUrl?: string;
} & DocumentData;


export type SelfEvaluation = {
  id: string;
  playerId: string;
  matchId: string;
  goals: number;
  assists: number;
  personalChronicle?: string;
  mvpVote?: string; // playerId of the voted MVP
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
  photoURL: string;
  position: string;
  evaluationType: 'points' | 'tags' | 'text';
  rating?: number;
  performanceTags?: PerformanceTag[];
  extractedTags?: PerformanceTag[];
  // Evaluación por descripción y resumen IA
  textDescription?: string;
  aiAnalysisComplete?: boolean;
  aiSummary?: string;
  // Cambios de atributos extraídos por IA (para evaluaciones de texto)
  aiAttributeChanges?: AttributeChange[];
  aiConfidence?: number;
  // Override consciente: permitir sólo positivas en modo tags
  overrideNoNegative?: boolean;
};

export type EvaluationSubmission = {
  id: string;
  evaluatorId: string;
  matchId: string;
  match?: Partial<Match>;
  submittedAt: string;
  submission: {
    evaluatorGoals: number;
    evaluatorAssists: number;
    personalChronicle?: string;
    mvpVote?: string; // playerId
    evaluations: PlayerEvaluationFormData[];
  }
} & DocumentData;

// Filtros combinables para partidos
export type MatchFilters = {
  types?: MatchType[];        // [] = todos
  statuses?: MatchStatus[];   // [] = todos
  onlyMine?: boolean;         // false = todos
};

// Modo de vista para partidos
export type MatchesViewMode = 'grid' | 'compact';

// Preferencias de usuario
export type UserPreferences = {
  matchesViewMode?: MatchesViewMode;
  matchFilters?: MatchFilters;
};

export type SavedLocation = {
  lat: number;
  lng: number;
  label?: string; // e.g., "Centro, Buenos Aires"
  savedAt: string; // ISO 8601 timestamp
};

export type UserRole = 'player' | 'organizer' | 'admin';

export type OrganizerProfile = {
  organizationName?: string;
  contactEmail?: string;
  phoneNumber?: string;
  bio?: string;
  logoUrl?: string; // Para branding institucional del organizador
  address?: string;
  website?: string;
  updatedAt?: string;
};

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber?: string; // WhatsApp or phone number
  role?: UserRole; // 'player' is default if undefined
  groups?: string[];
  activeGroupId?: string | null;
  organizedLeagues?: string[]; // IDs of leagues this user manages
  organizerProfile?: OrganizerProfile; // Perfil extendido para rol organizador
  fcmTokens?: string[]; // Firebase Cloud Messaging tokens for push notifications
  notificationPreferences?: {
    matchInvites?: boolean;
    matchReminders?: boolean;
    teamChanges?: boolean;
    matchUpdates?: boolean;
  };
  preferences?: UserPreferences;
  savedLocation?: SavedLocation; // Persisted location for availability feature
};

export type AppHelpInput = {
  userMessage: string;
  conversationHistory?: {
    role: 'user' | 'agent';
    content: string;
  }[];
};

export type MessageReaction = {
  emoji: string;
  userId: string;
  userName: string;
  createdAt: any;
};

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export type ChatMessage = {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhotoUrl: string;
  createdAt: any;
  // WhatsApp-style fields
  status?: MessageStatus;
  readBy?: string[];
  deliveredTo?: string[];
  reactions?: MessageReaction[];
  replyTo?: {
    messageId: string;
    text: string;
    senderName: string;
    senderId: string;
  } | null;
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
  matchLocation: z.string().optional().describe("Nombre de la cancha o ubicación donde se jugó el partido."),
  team1Name: z.string().describe("Nombre del Equipo 1."),
  team1Score: z.number().describe("Goles del Equipo 1."),
  team2Name: z.string().describe("Nombre del Equipo 2."),
  team2Score: z.number().describe("Goles del Equipo 2."),
  keyEvents: z.array(KeyEventSchema).describe("Lista de 3 a 5 eventos clave del partido."),
  mvp: z.object({
    name: z.string(),
    reason: z.string(),
  }).describe("El Jugador Más Valioso (MVP) y la razón."),
  playerChronicles: z.array(z.object({
    playerName: z.string().describe("Nombre del jugador."),
    chronicle: z.string().describe("Crónica personal escrita por el jugador."),
    position: z.string().describe("Posición del jugador (DEL, MED, DEF, POR)."),
  })).optional().describe("Crónicas personales escritas por los jugadores sobre su rendimiento."),
  topPerformanceTags: z.array(z.object({
    playerName: z.string().describe("Nombre del jugador."),
    tagName: z.string().describe("Nombre del tag de rendimiento."),
    tagDescription: z.string().describe("Descripción del tag."),
    impact: z.enum(['positive', 'negative']).describe("Impacto del tag (positivo o negativo)."),
  })).optional().describe("Tags de rendimiento más destacados del partido."),
});
export type GenerateMatchChronicleInput = z.infer<typeof GenerateMatchChronicleInputSchema>;

export const GenerateMatchChronicleOutputSchema = z.object({
  headline: z.string().describe("Un título evocativo y literario (no deportivo)."),
  story: z.string().describe("El relato completo del partido en 3-5 párrafos fluidos, estilo narrativo literario."),
  playerVoices: z.array(z.object({
    playerName: z.string().describe("Nombre del jugador."),
    quote: z.string().describe("Cita destacada del jugador."),
  })).optional().describe("Citas destacadas de todos los jugadores que dejaron un testimonio (incluir a todos los disponibles)."),
});
export type GenerateMatchChronicleOutput = z.infer<typeof GenerateMatchChronicleOutputSchema>;

export const GenerateDuoImageInputSchema = z.object({
  player1PhotoURL: z.string().describe("URL de Firebase Storage de la foto del primer jugador."),
  player1Name: z.string().describe("Nombre del primer jugador."),
  player2PhotoURL: z.string().optional().describe("URL de Firebase Storage de la foto del segundo jugador (opcional para imagen individual)."),
  player2Name: z.string().optional().describe("Nombre del segundo jugador (opcional para imagen individual)."),
  prompt: z.string().describe("La instrucción que describe la escena a generar entre los jugadores."),
});
export type GenerateDuoImageInput = z.infer<typeof GenerateDuoImageInputSchema>;

// NEW: Entities for Leagues and Cups
export type CompetitionFormat = 'league' | 'cup';
export type LeagueFormat = 'round_robin' | 'double_round_robin';
export type CupFormat = 'single_elimination';
export type CompetitionStatus = 'draft' | 'open_for_applications' | 'in_progress' | 'completed';
export type CompetitionType = 'league' | 'cup' | 'friendly';

export interface Sponsor {
  id: string;
  name: string;
  logoUrl: string;
  websiteUrl?: string;
  order?: number;
}

// Referee management types
export type Referee = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  leagueId: string;
  assignedMatches: string[]; // Array of fixture doc IDs + match IDs (format: "fixtureId:matchId")
  rating?: number; // Average rating from 1-10
  notes?: string;
  createdAt: string;
} & DocumentData;

export type RefereeEvaluation = {
  fixtureId: string;
  matchId: string;
  rating: number; // 1-10
  punctuality: number; // 1-5
  fairness: number; // 1-5
  control: number; // 1-5
  communication: number; // 1-5
  evaluatedBy: string; // uid of evaluator
  comments?: string;
  createdAt: string;
};

// Communication system types
export type MessageRecipientType = 'all_teams' | 'all_captains' | 'all_referees' | 'specific_teams' | 'specific_players';

export type MessageTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: 'match' | 'general' | 'emergency' | 'celebration';
  variables?: string[]; // e.g., ['teamName', 'matchDate', 'venue']
};

export type CommunicationMessage = {
  id: string;
  leagueId: string;
  sentBy: string; // uid of organizer
  sentByName: string;
  recipientType: MessageRecipientType;
  recipientIds: string[]; // Array of team IDs, player UIDs, or referee IDs
  subject: string;
  body: string;
  templateId?: string; // If using a template
  sentAt: string;
  deliveryMethod: ('push' | 'email')[]; // Which channels were used
  deliveryStatus?: {
    push: { sent: number; delivered: number; failed: number };
    email: { sent: number; delivered: number; failed: number };
  };
  priority: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: {
    relatedMatchId?: string;
    relatedFixtureId?: string;
  };
} & DocumentData;

// Team application for public registration
export type TeamApplication = {
  id: string;
  competitionId: string;
  competitionType: 'leagues' | 'cups';
  teamName: string;
  captainName: string;
  captainEmail: string;
  captainPhone?: string;
  playerCount?: number; // Approximate squad size
  message?: string; // Optional message to organizer
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string; // uid of organizer who reviewed
  reviewNotes?: string; // Organizer notes on decision
  paymentStatus?: 'not_required' | 'pending' | 'paid';
} & DocumentData;

// Venue / multi-cancha management
export type CompetitionVenue = {
  id: string;
  name: string;
  address: string;
  capacity?: number;
  cost?: number; // Cost per hour ARS
  contact?: string; // Contact info
  availability?: { day: string; timeSlots: string[] }[];
  leagueId: string;
  notes?: string;
} & DocumentData;

export type League = {
  id: string;
  name: string;
  format: LeagueFormat;
  rules?: {
    pointsForWin: number;
    pointsForDraw: number;
  };
  status: CompetitionStatus;
  ownerUid: string;
  groupId: string; // The "home" group of the league
  isPublic: boolean;
  teams: string[]; // Array of teamIds
  createdAt: string;
  logoUrl?: string; // URL to league logo image
  competitionType?: CompetitionType;
  sportType?: 'f5' | 'f7' | 'f11';
  location?: string;
  locationLat?: number;
  locationLng?: number;
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
  sponsors?: Sponsor[];
  // Referee management
  refereeIds?: string[]; // Array of referee IDs assigned to this league
  // Communication settings
  communicationSettings?: {
    emailEnabled: boolean;
    pushEnabled: boolean;
  };
  // Registration / Inscription settings
  allowPublicRegistration?: boolean; // Allow external teams to self-register
  registrationFee?: number; // Cost to register (ARS)
  maxTeams?: number; // Maximum teams allowed
  registrationDeadline?: string; // ISO date string  
  hasRelegation?: boolean;
  venueIds?: string[]; // Multi-venue management
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

// Cup seeding type
export type CupSeedingType = 'random' | 'ovr_based';

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
  finalScore?: { team1: number; team2: number }; // Score of the match
  streamingUrl?: string; // Optional streaming link
  isLive?: boolean; // Whether the match is currently live
  date?: string; // Match date (DD/MM/YYYY format)
  time?: string; // Match time (HH:MM format)
  venue?: string; // Venue/location name
  refereeId?: string; // Assigned referee ID
  refereeName?: string; // Assigned referee name
};

export type Cup = {
  id: string;
  name: string;
  format: CupFormat;
  status: CompetitionStatus;
  ownerUid: string;
  groupId: string; // The "home" group of the cup
  isPublic: boolean;
  teams: string[]; // Array of teamIds (ghost team IDs from subcollection or real team IDs)
  createdAt: string;
  logoUrl?: string; // URL to cup logo image
  // Scheduling configuration
  startDate?: string; // ISO date string of first match
  defaultLocation?: MatchLocation; // Default location for matches
  // Bracket structure
  bracket?: BracketMatch[]; // Generated when cup starts
  currentRound?: CupRound; // Track which round is active
  seedingType?: CupSeedingType; // How teams were seeded in bracket
  // Champion tracking
  championTeamId?: string;
  championTeamName?: string;
  runnerUpTeamId?: string;
  runnerUpTeamName?: string;
  completedAt?: string; // ISO date when cup was completed
  sponsors?: Sponsor[];
} & DocumentData;

export type CompetitionApplication = {
  id: string;
  competitionId: string;
  competitionType: CompetitionFormat;
  teamId: string;
  teamName: string;
  teamJersey: Jersey;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  submittedAt: string;
  submittedBy: string; // userId of team owner
} & DocumentData;

export const toCollectionName = (type: CompetitionFormat): 'leagues' | 'cups' =>
  type === 'league' ? 'leagues' : 'cups';

export const toCompetitionFormat = (collection: 'leagues' | 'cups'): CompetitionFormat =>
  collection === 'leagues' ? 'league' : 'cup';

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
  | 'match_organized'
  | 'ovr_increased'
  | 'ovr_decreased'
  | 'goal_scored'
  | 'achievement_unlocked'
  | 'player_created'
  | 'new_follower'
  | 'repost';

// Reaction types for social activities (Twitter/X style)
export type ReactionType = 'fire' | 'clap' | 'goal';

export type Reactions = {
  fire: string[];
  clap: string[];
  goal: string[];
};

// Comment on a social activity
export type SocialComment = {
  id: string;
  activityId: string;
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  text: string;
  createdAt: Timestamp | string;
  likes: string[];
} & DocumentData;

// Suggested user for explore page
export type SuggestedUserReason = 'same_group' | 'most_followed' | 'recently_active';

export type SuggestedUser = {
  uid: string;
  displayName: string;
  photoURL?: string;
  position?: PlayerPosition;
  ovr?: number;
  followerCount: number;
  matchesPlayed?: number;
  reason: SuggestedUserReason;
  isFollowing?: boolean;
  location?: { lat: number; lng: number };
};

// Social activity for the feed
export type SocialActivity = {
  id: string;
  type: ActivityType;
  userId: string; // User who performed the activity
  playerId?: string; // Player involved (if applicable)
  playerName?: string;
  playerPhotoUrl?: string;
  // Accept either a Firestore Timestamp (serverTimestamp result) or legacy ISO string
  timestamp: Timestamp | string;
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
  likes?: string[]; // userIds que dieron like (DEPRECATED - use reactions)
  // Twitter/X style features
  reactions?: Reactions; // Multiple reaction types
  commentCount?: number; // Denormalized comment count
  repostCount?: number; // Denormalized repost count
  // Repost specific fields
  isRepost?: boolean;
  originalActivityId?: string; // If repost, reference to original
  repostedBy?: {
    userId: string;
    userName: string;
    userPhotoUrl?: string;
  };
} & DocumentData;

// Note: Notification types are now unified with the main notification system above (lines 199-231)

// ============================================
// MATCH INVITATIONS & CONFIRMATIONS
// ============================================

// Respuesta de invitación a partido
export type MatchInvitationResponse = 'pending' | 'confirmed' | 'declined' | 'maybe';

// Invitación individual a un partido
export type MatchInvitation = {
  id: string; // userId
  matchId: string;
  userId: string;
  response: MatchInvitationResponse;
  respondedAt?: string; // ISO 8601
  notifiedAt: string; // ISO 8601
} & DocumentData;

// Propuesta de fecha para partido (votación)
export type MatchDateProposal = {
  id: string;
  matchId: string;
  proposedBy: string; // userId
  date: string; // ISO 8601 date
  time: string; // HH:mm
  votes: string[]; // Array de userIds que votaron
  createdAt: string; // ISO 8601
} & DocumentData;

// ============================================
// MONETIZATION & PAYMENTS
// ============================================

// Paquetes de créditos disponibles para compra
export type CreditPackage = {
  id: string;
  credits: number;
  price: number;           // En pesos argentinos
  title: string;
  description?: string;
  popular?: boolean;       // Destacar en UI
  discountPercentage?: number; // e.g., 20 means 20% discount
} & DocumentData;

// Transacción de compra de créditos
export type CreditTransaction = {
  id: string;
  userId: string;
  packageId: string;
  credits: number;
  amount: number;          // Total pagado en pesos
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  paymentMethod: 'mercadopago';
  mpPreferenceId?: string;  // Mercado Pago preference ID
  mpPaymentId?: string;     // Mercado Pago payment ID
  createdAt: string;
  completedAt?: string;
  // Metadata para auditoría
  metadata?: {
    userEmail?: string;
    userName?: string;
    packageTitle?: string;
  };
} & DocumentData;

// ============================================
// GAMIFICATION - ACHIEVEMENTS & LEADERBOARDS
// ============================================

export type AchievementCategory = 'performance' | 'social' | 'competition' | 'milestones';

export type AchievementRequirementType =
  | 'goals'
  | 'goals_in_match'
  | 'matches'
  | 'wins'
  | 'ovr'
  | 'followers'
  | 'organized'
  | 'champion';

// Definition of an achievement
export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  category: AchievementCategory;
  requirement: {
    type: AchievementRequirementType;
    count: number;
  };
};

// Achievement unlocked by a player
export type PlayerAchievement = {
  id: string;
  achievementId: string;
  playerId: string;
  userId: string;
  unlockedAt: string; // ISO date
} & DocumentData;

// Leaderboard categories
export type LeaderboardCategory = 'ovr' | 'goals' | 'assists' | 'matches' | 'rating' | 'mvp';

// Leaderboard entry
export type LeaderboardEntry = {
  rank: number;
  playerId: string;
  playerName: string;
  playerPhotoUrl?: string;
  position: PlayerPosition;
  value: number;
  userId: string;
};
