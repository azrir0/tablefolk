/**
 * Lightweight in-process registry linking active CafeRooms, spawned GameRooms,
 * private café access codes, and active human match memberships so players can
 * seamlessly rejoin after tapping out, refreshing, or minimizing mobile browsers.
 */
type TableFinishedHandler = (tableId: string) => void;
type GameAbortHandler = () => void;

export interface ActiveUserGameRef {
  gameRoomId: string;
  cafeRoomId: string;
  tableId: string;
  gameSlug: string;
}

const cafeHandlers = new Map<string, TableFinishedHandler>();
const gameAbortHandlers = new Map<string, GameAbortHandler>();
const privateCodeToRoomId = new Map<string, string>();
const activeUserGames = new Map<string, ActiveUserGameRef>();

export function registerCafeRoom(roomId: string, onTableFinished: TableFinishedHandler): void {
  cafeHandlers.set(roomId, onTableFinished);
}

export function unregisterCafeRoom(roomId: string, accessCode?: string): void {
  cafeHandlers.delete(roomId);
  if (accessCode) {
    privateCodeToRoomId.delete(accessCode.toUpperCase());
  }
}

export function notifyCafeTableFinished(cafeRoomId: string, tableId: string): void {
  const handler = cafeHandlers.get(cafeRoomId);
  if (handler) {
    handler(tableId);
  }
}

export function registerGameRoom(
  gameRoomId: string,
  onAbort: GameAbortHandler,
  humanUserIds: string[],
  meta: Omit<ActiveUserGameRef, "gameRoomId">
): void {
  gameAbortHandlers.set(gameRoomId, onAbort);
  for (const uid of humanUserIds) {
    activeUserGames.set(uid, { gameRoomId, ...meta });
  }
}

export function unregisterGameRoom(gameRoomId: string): void {
  gameAbortHandlers.delete(gameRoomId);
  for (const [uid, ref] of activeUserGames.entries()) {
    if (ref.gameRoomId === gameRoomId) {
      activeUserGames.delete(uid);
    }
  }
}

export function clearActiveGameForUser(userId: string, gameRoomId?: string): void {
  const current = activeUserGames.get(userId);
  if (!current) return;
  if (!gameRoomId || current.gameRoomId === gameRoomId) {
    activeUserGames.delete(userId);
  }
}

export function getActiveGameForUser(userId: string): ActiveUserGameRef | null {
  return activeUserGames.get(userId) ?? null;
}

export function abortGameRoom(gameRoomId: string): void {
  const handler = gameAbortHandlers.get(gameRoomId);
  if (handler) {
    handler();
  }
}

export function registerPrivateCafeCode(accessCode: string, roomId: string): void {
  privateCodeToRoomId.set(accessCode.toUpperCase(), roomId);
}

export function lookupPrivateCafeRoom(accessCode: string): string | undefined {
  return privateCodeToRoomId.get(accessCode.toUpperCase());
}
