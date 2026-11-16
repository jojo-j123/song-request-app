export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'playing' | 'played' | 'skipped';
export type DisplayMode = 'main' | 'wall' | 'leaderboard' | 'nowplaying';
export type BackgroundTheme = 'aurora' | 'nebula' | 'grid' | 'minimal';
export type MomentType =
  | 'countdown'
  | 'fame'
  | 'hype'
  | 'dedication'
  | 'birthday'
  | 'surprise'
  | 'clear';

export interface ThemeConfig {
  primary: string;
  secondary: string;
  magenta: string;
  cyan: string;
  background: BackgroundTheme;
}

export interface EventInfo {
  id: string;
  name: string;
  logoUrl: string | null;
  date: string | null;
  theme: ThemeConfig;
  status: 'live' | 'ended';
  createdAt: string;
}

export interface DemoConfig {
  enabled: boolean;
  running: boolean;
  speed: number; // 0.5 .. 4
  autoDj: boolean; // simulator also approves requests & advances songs
}

/** Jukebox mode: guests pick from the imported library and the laptop plays the files itself. */
export interface JukeboxConfig {
  enabled: boolean;
  /** What plays next: the crowd's top-voted song, or the DJ's queue order. */
  order: 'votes' | 'queue';
  /** Run the cinematic countdown on the big screen before each song. */
  reveal: boolean;
  /** Keep the music going with a random library song when the queue is empty. */
  fill: boolean;
}

/** One imported audio file. Only this metadata is shared; the file itself stays on the player laptop. */
export interface LibraryTrack {
  id: string;
  eventId: string;
  title: string;
  artist: string;
  durationSec: number;
  artworkUrl: string | null;
  /** Identifies the file on disk (name|size) so a re-import re-links it. */
  fileKey: string;
}

export interface EventSettings {
  votingEnabled: boolean;
  submissionsEnabled: boolean;
  maxRequestsPerGuest: number;
  maxQueueSize: number;
  countdownDuration: number; // seconds
  autoApprove: boolean;
  displayMode: DisplayMode;
  soundEnabled: boolean;
  volume: number; // 0..1
  animationIntensity: 'low' | 'normal' | 'high';
  showRequesterNames: boolean;
  qrUrl: string | null;
  votingRound: number;
  totalVotes: number;
  guestCount: number;
  demo: DemoConfig;
  jukebox: JukeboxConfig;
}

export interface SongRequest {
  id: string;
  eventId: string;
  guestId: string;
  guestName: string;
  songTitle: string;
  artist: string;
  artworkUrl: string | null;
  status: RequestStatus;
  voteCount: number;
  queuePosition: number;
  requestedAt: string;
  playedAt: string | null;
  dedicatedTo: string | null;
  message: string | null;
  isDemo: boolean;
  /** Library track this request plays (jukebox mode). */
  trackId: string | null;
}

export interface DisplayCommand {
  id: string;
  type: MomentType;
  payload: Record<string, any>;
  triggeredAt: string;
}

export interface Battle {
  id: string;
  requestIds: [string, string];
  tallies: Record<string, number>;
  endsAt: string;
  status: 'live' | 'ended';
  winnerId: string | null;
  startedAt: string;
}

export interface EventSnapshot {
  event: EventInfo;
  settings: EventSettings;
  requests: SongRequest[];
  command: DisplayCommand | null;
  battle: Battle | null;
  library: LibraryTrack[];
}

export interface SubmitInput {
  guestId: string;
  guestName: string;
  songTitle: string;
  artist: string;
  artworkUrl?: string | null;
  clientId: string; // idempotency key
  trackId?: string | null;
  dedicatedTo?: string | null;
  message?: string | null;
}

export type ResultCode =
  | 'ok'
  | 'submissions_closed'
  | 'event_ended'
  | 'invalid'
  | 'guest_limit'
  | 'queue_full'
  | 'duplicate_song'
  | 'voting_closed'
  | 'already_voted'
  | 'not_found'
  | 'battle_closed'
  | 'unauthorized'
  | 'network'
  | 'error';

export interface ActionResult<T = unknown> {
  ok: boolean;
  code: ResultCode;
  message?: string;
  data?: T;
}

export type AdminAction =
  | { type: 'approve'; id: string }
  | { type: 'reject'; id: string }
  | { type: 'delete'; id: string }
  | { type: 'restore'; id: string }
  | { type: 'move'; id: string; dir: -1 | 1 }
  | { type: 'reorder'; ids: string[] }
  | { type: 'sortByVotes' }
  | { type: 'playNow'; id: string }
  | { type: 'reveal'; id: string }
  | { type: 'skip'; id: string }
  | { type: 'finishCurrent' }
  | { type: 'updateSettings'; patch: Partial<EventSettings> }
  | { type: 'updateEvent'; patch: Partial<Omit<EventInfo, 'id' | 'createdAt'>> }
  | { type: 'command'; command: { type: MomentType; payload?: Record<string, any> } }
  | { type: 'clearQueue' }
  | { type: 'resetEvent' }
  | { type: 'newRound' }
  | { type: 'resetRounds' }
  | { type: 'startBattle'; a: string; b: string; seconds: number }
  | { type: 'endBattle' }
  | { type: 'clearBattle' }
  | { type: 'injectRequests'; requests: Array<Omit<SongRequest, 'id' | 'eventId' | 'queuePosition'>> }
  | { type: 'clearDemo' }
  | { type: 'importTracks'; tracks: Array<Omit<LibraryTrack, 'id' | 'eventId'>> }
  | { type: 'removeTrack'; id: string }
  | { type: 'clearLibrary' }
  /** Play a library song that nobody requested (keeps the music going). */
  | { type: 'playTrack'; trackId: string };

export interface CreateEventInput {
  name: string;
  date?: string | null;
  pin?: string; // local mode admin PIN
  id?: string;
}

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';
