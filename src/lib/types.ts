

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
} & DocumentData;


export type MatchStatus = 'upcoming' | 'active' | 'completed' | 'evaluated';
export type MatchType = 'manual' | 'collaborative';
export type MatchSize = 10 | 14 | 22;

export type MatchLocation = {
    address: string;
    lat: number;
    lng: number;
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


export type Evaluation = {
    id: string;
    assignmentId: string; // The ID of the assignment this evaluation fulfills
    playerId: string; // The player being evaluated
    evaluatorId: string; // The user UID who submitted the evaluation
    matchId: string; // The ID of the match, added for easier querying
    rating: number; // Scale 1-10
    goals: number; // Goals scored by the evaluator in that match
    performanceTags: string[];
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

export interface PlayerProfileViewProps {
    playerId: string;
}
    
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
    createdAt: string; // ISO 8601 string
} & DocumentData;
    

    

    
