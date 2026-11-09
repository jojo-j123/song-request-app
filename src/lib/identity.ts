import { uid } from './utils';

const GUEST_KEY = 'encore:guest-id';
const NAME_KEY = 'encore:guest-name';

/** Stable anonymous device identifier used for duplicate-vote protection. */
export function getGuestId(): string {
  try {
    let id = localStorage.getItem(GUEST_KEY);
    if (!id) {
      id = 'g-' + uid();
      localStorage.setItem(GUEST_KEY, id);
    }
    return id;
  } catch {
    return 'g-' + uid();
  }
}

export const getGuestName = () => {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
};
export const setGuestName = (n: string) => {
  try {
    localStorage.setItem(NAME_KEY, n.trim());
  } catch {
    /* private mode */
  }
};

const votesKey = (eventId: string, ctx: string) => `encore:votes:${eventId}:${ctx}`;

export function getMyVotes(eventId: string, ctx: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(votesKey(eventId, ctx)) ?? '[]'));
  } catch {
    return new Set();
  }
}
export function addMyVote(eventId: string, ctx: string, id: string) {
  const s = getMyVotes(eventId, ctx);
  s.add(id);
  try {
    localStorage.setItem(votesKey(eventId, ctx), JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
  return s;
}

const myReqKey = (eventId: string) => `encore:my-requests:${eventId}`;
export function getMyRequests(eventId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(myReqKey(eventId)) ?? '[]');
  } catch {
    return [];
  }
}
export function addMyRequest(eventId: string, id: string) {
  const list = [...new Set([id, ...getMyRequests(eventId)])].slice(0, 50);
  try {
    localStorage.setItem(myReqKey(eventId), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}
