import { DocumentData, DocumentReference } from "firebase/firestore";

export type PlayerPosition = 'DEL' | 'MED' | 'DEF' | 'POR';

export type PlayerStats = {
  matchesPlayed: number;
  goals: number;
  assists: number;
  averageRating: number;
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
  ownerUid: string;
  groupId: string;
} & DocumentData;


export type MatchStatus = 'upcoming' | 'active' | 'completed' | 'evaluated';
export type MatchType = 'manual' | 'collaborative';
export type MatchSize = 10 | 14 | 22;

export type Match = {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  type: MatchType;
  matchSize: MatchSize;
  players: { uid: string; displayName: string; ovr: number; position: PlayerPosition; photoUrl: string }[];
  teams: Team[];
  status: MatchStatus;
  ownerUid: string;
  groupId: string;
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
};

export type Group = {
    id: string;
    name: string;
    ownerUid: string;
    inviteCode: string;
    members: string[];
} & DocumentData;