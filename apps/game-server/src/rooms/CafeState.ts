import { ArraySchema, MapSchema, Schema, defineTypes } from "@colyseus/schema";

/**
 * NOTE: Under ES2022 (`useDefineForClassFields: true`), standard class field initializers
 * shadow prototype getters/setters created by `@colyseus/schema`'s `defineTypes()`.
 * Using `declare` + initializing inside `constructor()` guarantees every field and collection
 * attaches to Colyseus's `$changes` delta tracker cleanly under both `tsc` and `tsx`/esbuild.
 */
export class PlayerSchema extends Schema {
  declare sessionId: string;
  declare userId: string;
  declare displayName: string;
  declare avatarJson: string;
  declare x: number;
  declare y: number;
  declare facing: string;
  declare isMoving: boolean;
  declare carryingGameSlug: string;
  declare seatedTableId: string;
  declare seatIndex: number;
  declare isReady: boolean;
  declare inGameSessionId: string;
  declare emote: string;
  declare emoteSeq: number;
  declare speechText: string;
  declare speechSeq: number;

  constructor() {
    super();
    this.sessionId = "";
    this.userId = "";
    this.displayName = "";
    this.avatarJson = "";
    this.x = 672;
    this.y = 720;
    this.facing = "south";
    this.isMoving = false;
    this.carryingGameSlug = "";
    this.seatedTableId = "";
    this.seatIndex = -1;
    this.isReady = false;
    this.inGameSessionId = "";
    this.emote = "";
    this.emoteSeq = 0;
    this.speechText = "";
    this.speechSeq = 0;
  }
}

defineTypes(PlayerSchema, {
  sessionId: "string",
  userId: "string",
  displayName: "string",
  avatarJson: "string",
  x: "number",
  y: "number",
  facing: "string",
  isMoving: "boolean",
  carryingGameSlug: "string",
  seatedTableId: "string",
  seatIndex: "number",
  isReady: "boolean",
  inGameSessionId: "string",
  emote: "string",
  emoteSeq: "number",
  speechText: "string",
  speechSeq: "number",
});

export class SeatSchema extends Schema {
  declare seatIndex: number;
  declare status: string;
  declare occupantSessionId: string;
  declare occupantUserId: string;
  declare occupantName: string;
  declare isBot: boolean;
  declare isReady: boolean;

  constructor() {
    super();
    this.seatIndex = 0;
    this.status = "AVAILABLE";
    this.occupantSessionId = "";
    this.occupantUserId = "";
    this.occupantName = "";
    this.isBot = false;
    this.isReady = false;
  }
}

defineTypes(SeatSchema, {
  seatIndex: "number",
  status: "string",
  occupantSessionId: "string",
  occupantUserId: "string",
  occupantName: "string",
  isBot: "boolean",
  isReady: "boolean",
});

export class TableSchema extends Schema {
  declare tableId: string;
  declare name: string;
  declare category: string;
  declare capacity: number;
  declare status: string;
  declare selectedGameSlug: string;
  declare hostUserId: string;
  declare activeGameRoomId: string;
  declare seats: ArraySchema<SeatSchema>;

  constructor() {
    super();
    this.tableId = "";
    this.name = "";
    this.category = "standard";
    this.capacity = 4;
    this.status = "AVAILABLE";
    this.selectedGameSlug = "treasure-trails";
    this.hostUserId = "";
    this.activeGameRoomId = "";
    this.seats = new ArraySchema<SeatSchema>();
  }
}

defineTypes(TableSchema, {
  tableId: "string",
  name: "string",
  category: "string",
  capacity: "number",
  status: "string",
  selectedGameSlug: "string",
  hostUserId: "string",
  activeGameRoomId: "string",
  seats: [SeatSchema],
});

export class CafeRoomState extends Schema {
  declare cafeName: string;
  declare instanceLabel: string;
  declare isPrivate: boolean;
  declare accessCode: string;
  declare ownerUserId: string;
  declare mapId: string;
  declare players: MapSchema<PlayerSchema>;
  declare tables: MapSchema<TableSchema>;

  constructor() {
    super();
    this.cafeName = "Sunlit Oak Café";
    this.instanceLabel = "Public #001";
    this.isPrivate = false;
    this.accessCode = "";
    this.ownerUserId = "";
    this.mapId = "cozy-cafe-v1";
    this.players = new MapSchema<PlayerSchema>();
    this.tables = new MapSchema<TableSchema>();
  }
}

defineTypes(CafeRoomState, {
  cafeName: "string",
  instanceLabel: "string",
  isPrivate: "boolean",
  accessCode: "string",
  ownerUserId: "string",
  mapId: "string",
  players: { map: PlayerSchema },
  tables: { map: TableSchema },
});
