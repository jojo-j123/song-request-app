import type {
  ActionResult,
  AdminAction,
  ConnectionStatus,
  CreateEventInput,
  EventInfo,
  EventSnapshot,
  SubmitInput,
} from '../types';

export interface AdminIdentity {
  id: string;
  email?: string | null;
}

export interface Backend {
  mode: 'local' | 'supabase';

  // Admin auth
  getAdmin(): Promise<AdminIdentity | null>;
  signIn(email: string, password: string): Promise<ActionResult>;
  signUp(email: string, password: string): Promise<ActionResult>;
  signOut(): Promise<void>;
  /** Local mode only: unlock an event's admin with its PIN. */
  unlockEvent(eventId: string, pin: string): Promise<ActionResult>;
  canAdmin(eventId: string): Promise<boolean>;

  // Events
  listEvents(): Promise<EventInfo[]>;
  createEvent(input: CreateEventInput): Promise<ActionResult<EventInfo>>;
  deleteEvent(eventId: string): Promise<ActionResult>;

  // Realtime
  subscribe(
    eventId: string,
    onSnapshot: (snap: EventSnapshot | null) => void,
    onStatus?: (s: ConnectionStatus) => void,
  ): () => void;

  // Guest (server-validated)
  registerGuest(eventId: string, guestId: string): Promise<void>;
  submitRequest(eventId: string, input: SubmitInput): Promise<ActionResult<any>>;
  castVote(eventId: string, requestId: string, voterId: string, battleId?: string | null): Promise<ActionResult<any>>;

  // Admin
  admin(eventId: string, action: AdminAction): Promise<ActionResult>;
}
