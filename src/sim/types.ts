import type { Person } from '@adam0white/human-framework';
export type Trait =
  | 'honest'
  | 'dishonest'
  | 'reliable'
  | 'unreliable'
  | 'generous'
  | 'stingy'
  | 'kind'
  | 'cruel'
  | 'hardworking'
  | 'lazy'
  | 'owes';
export type Input =
  | { type: 'tell' | 'defend'; listener: string; target: string; trait: Trait }
  | { type: 'ask'; listener: string; target: string }
  | { type: 'tell-story'; listener: string; incident: number }
  | { type: 'hold-tongue' }
  | { type: 'sit'; listener: string }
  | { type: 'release' }
  | { type: 'make-amends'; listener: string; target: string }
  | { type: 'call-over'; person: string; buySilence?: boolean };
export interface LoggedInput {
  at: number;
  input: Input;
}
export interface Neighbor {
  id: string;
  name: string;
  household: number;
  job: string;
  home: string;
  norm: 'forbidden' | 'disliked' | 'permitted';
}
export interface Line {
  id: number;
  at: number;
  kind: string;
  speaker?: string;
  text: string;
  target?: string;
  count?: number;
  witnessed?: boolean;
  who?: string[];
  reply?: { to: number; believes: 'yes' | 'doubt' | 'no' | 'refuse'; will?: string };
}
export interface Route {
  id: number;
  parent?: number;
  root?: number;
  retractionOf?: number;
  retractedAt?: number;
  confrontedAt?: number;
  contradictedAt?: number;
  contradictedHouseholds?: number[];
  value: boolean;
  at: number;
  from: string;
  to: string;
  target: string;
  trait: Trait;
  origin: string;
  steps: number;
  lie: boolean;
  incident?: number;
  title?: string;
  confirmedAt?: number;
}
export interface State {
  version: 1;
  seed: number;
  minute: number;
  people: Record<string, Person>;
  locations: Record<string, string>;
  log: Line[];
  routes: Route[];
  newsWaiting: boolean;
  engagement: 'waiting' | 'accepted' | 'refused';
  garden: 'empty' | 'quiet' | 'lively' | 'full';
  custom: Record<string, number>;
  closedUntil: number;
  ended: boolean;
  voiceUsed: Record<string, string[]>;
  called: Record<string, number>;
  silence: Record<string, number>;
  confronted: number[];
  greetings: Record<string, boolean>;
  incidentWitnesses?: Record<number, string[]>;
  groundTruth?: Record<string, boolean>;
  pendingConfrontations?: { root: number; due: number }[];
  heardClaims?: Record<string, { count: number; who: string[]; echo?: number }>;
  held?: { id: string; until: number };
  deferredScenes?: Record<string, number>;
  errands?: Record<string, { target: string; until: number }>;
  riza?: {
    lean: 'warm' | 'unsure' | 'cool';
    line: string;
    at: number;
    answerDay: number;
    doubts?: {
      key: 'honest' | 'reliable' | 'kind';
      words: string;
      status: 'open' | 'settled' | 'worse';
      because?: string;
    }[];
    steps?: { day: number; label: string; status: 'ahead' | 'met' | 'missed' }[];
    cause?: string;
  };
  stories?: { id: number; day: number; title: string; target: string; truth: boolean }[];
  days?: { day: number; summary: string[]; question: string; tomorrow?: string }[];
}
export interface Game {
  s: State;
  inputs: LoggedInput[];
}
