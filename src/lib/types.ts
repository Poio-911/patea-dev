

import { DocumentData, DocumentReference } from "firebase/firestore";

export type PlayerPosition = 'DEL' | 'MED' | 'DEF' | 'POR';

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
  groupId: string;
  cardGenerationCredits?: number;
} & DocumentData;

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
export type MatchType = 'manual' | 'collaborative';
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
  name: string;
  players: {
    uid: string;
    displayName: string;
    position: string;
    ovr: number;
  }[];
  totalOVR: number;
  averageOVR: number;
  suggestedFormation: string;
  tags: string[];
  balanceMetrics?: {
    ovrDifference: number;
    fairnessPercentage: number;
  }
};

export type Group = {
    id: string;
    name: string;
    ownerUid: string;
    inviteCode: string;
    members: string[];
} & DocumentData;

export type GroupTeam = {
  id: string;
  name: string;
  shield: string;
  ownerUid: string;
  groupId: string;
  members: string[]; // Array of player UIDs
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
    performanceTags?: {
        id: string;
        name: string;
        description: string;
        effects: { attribute: string; change: number }[];
    }[];
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

export type EvaluationSubmission = {
    id: string;
    evaluatorId: string;
    matchId: string;
    match?: Partial<Match>;
    submittedAt: string;
    submission: {
        evaluatorGoals: number;
        evaluations: {
            assignmentId: string;
            subjectId: string;
            displayName: string;
            photoUrl: string;
            position: string;
            evaluationType: 'points' | 'tags';
            rating?: number;
            performanceTags?: any[];
        }[];
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

    