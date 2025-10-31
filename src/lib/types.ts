

import { DocumentData, DocumentReference } from "firebase/firestore";
import type { PerformanceTag as Pt } from "./performance-tags";

export type PerformanceTag = Pt;

export type PlayerPosition = 'DEL' | 'MED' | 'DEF' | 'POR';

export type AttributeKey = 'PAC' | 'SHO' | 'PAS' | 'DRI' | 'DEF' | 'PHY';

export type PlayerStats = {
  matchesPlayed: number;
  goals: number;
  assists: number;
  averageRating: number;
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
export type MatchType = 'manual' | 'collaborative' | 'by_teams';
export type MatchSize = 10 | 14 | 22;

export type MatchLocation = {
    name: string;
    address: string;
    lat: number;
    lng: number;
    placeId: string;
}

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
} & DocumentData;


export type Group = {
  id: string;
  name: string;
  ownerUid: string;
  inviteCode: string;
  members: string[];
} & DocumentData;


export type NotificationType = 'match_invite' | 'new_joiner' | 'evaluation_pending' | 'match_update';

export type Notification = {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    link: string;
    isRead: boolean;
    createdAt: string; // ISO 8601 string
} & DocumentData;

export type Invitation = {
    id: string;
    matchId: string;
    matchTitle: string;
    matchDate: string;
    playerId: string; // The invited player
    status: 'pending' | 'accepted' | 'declined';
    createdAt: string;
} & DocumentData;


export type Evaluation = {
    id: string;
    assignmentId: string; // The ID of the assignment this evaluation fulfills
    playerId: string; // The player being evaluated
    evaluatorId: string; // The user UID who submitted the evaluation
    matchId: string; // The ID of the match, for easier querying
    rating?: number; // Scale 1-10
    goals: number; // Goals scored by the evaluator in that match
    performanceTags?: PerformanceTag[]; // Array of full PerformanceTag objects
    evaluatedAt: string;
} & DocumentData;


export type EvaluationAssignment = {
    id: string;
    matchId: string;
    evaluatorId: string; // Who has to do the evaluation
    subjectId: string; // Who is being evaluated
    status: 'pending' | 'completed';
    evaluationId?: string; // The ID of the resulting evaluation doc
} & DocumentData;

export type SelfEvaluation = {
  id: string;
  playerId: string;
  matchId: string;
  goals: number;
  reportedAt: string;
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
        evaluations: PlayerEvaluationFormData[];
    }
} & DocumentData;

export type PlayerProfileViewProps = {
    playerId: string;
    isUploading?: boolean;
};
    
export type FcmToken = {
    id: string;
    token: string;
    createdAt: string;
} & DocumentData;

export type ChatMessage = {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    senderPhotoUrl: string;
    createdAt: any; // Can be a server timestamp
} & DocumentData;
    
export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  groups?: string[];
  activeGroupId?: string | null;
};
