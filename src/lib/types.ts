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
} & DocumentData;


export type MatchStatus = 'upcoming' | 'active' | 'completed' | 'evaluated';

export type Match = {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  type: string;
  status: MatchStatus;
  ownerUid: string;
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
