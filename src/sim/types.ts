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
  | { type: 'ask'; listener: string; target: string; trait?: Trait }
  | { type: 'tell-story'; listener: string; incident: number }
  | { type: 'choose'; scene: string; choice: string }
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
  quick?: QuickReply;
  who?: string[];
  reply?: { to: number; believes?: 'yes' | 'doubt' | 'no' | 'refuse'; will?: string };
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
  stoodByAt?: number;
}
export interface Scene {
  id: string;
  kind: 'elif' | 'confrontation' | 'coffee' | 'coffee-missed' | 'word' | 'word-missed';
  who: string[];
  text: string;
  choices: { id: string; label: string; says: string; risk?: string }[];
  since: number;
  until: number;
  fallback: string;
}
export interface Thread {
  id: number;
  who: string;
  to: string;
  about: string;
  status: 'on its way' | 'arrived' | 'stalled';
  where?: string;
  reason?: string;
  attemptedAt?: number;
  at: number;
}
export interface QuickReply {
  listener: string;
  options: { label: string; says: string; input: Input }[];
}
export interface State {
  version: 1 | 2 | 3;
  /** Edition 3 only: includes an open or queued Elif request. */
  elifAsked?: boolean;
  /** Only facts Hatice told, witnessed in conversation, or learned from a reply. */
  knownTellings?: Record<
    string,
    {
      claims: Record<string, { value: boolean; source: string; at: number }>;
      incidents: Record<number, { source: string; at: number }>;
    }
  >;
  scene?: Scene;
  threads?: Thread[];
  sceneQueue?: Scene[];
  amends?: { target: string; listeners: string[]; after: number }[];
  morningVisits?: {
    who: string;
    at: number;
    until: number;
    bread?: boolean;
    done?: boolean;
    scene?: Scene;
  }[];
  wordDenial?: boolean;
  threadRoutes?: Record<number, number>;
  bareEndorsements?: Record<string, number>;
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
    word?: {
      status: 'open' | 'settled' | 'worse' | 'mending';
      words: string;
      because?: string;
      mend?: string;
    };
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
