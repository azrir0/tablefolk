/**
 * Lightweight in-process registry linking active CafeRooms and spawned GameRooms
 * so a CafeRoom table automatically resets when its GameRoom finishes, AND
 * an abandoned bot-only GameRoom immediately terminates when all humans leave the table.
 */
type TableFinishedHandler = (tableId: string) => void;
type GameAbortHandler = () => void;

const cafeHandlers = new Map<string, TableFinishedHandler>();
const gameAbortHandlers = new Map<string, GameAbortHandler>();
const privateCodeToRoomId = new Map<string, string>();

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

export function registerGameRoom(gameRoomId: string, onAbort: GameAbortHandler): void {
  gameAbortHandlers.set(gameRoomId, onAbort);
}

export function unregisterGameRoom(gameRoomId: string): void {
  gameAbortHandlers.delete(gameRoomId);
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
