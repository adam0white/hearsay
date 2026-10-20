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
  | { type: 'hold-tongue' }
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
}
export interface Route {
  id: number;
  parent?: number;
  retractionOf?: number;
  retractedAt?: number;
  confrontedAt?: number;
  value: boolean;
  at: number;
  from: string;
  to: string;
  target: string;
  trait: Trait;
  origin: string;
  steps: number;
  lie: boolean;
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
}
export interface Game {
  s: State;
  inputs: LoggedInput[];
}
