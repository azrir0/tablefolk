import { describe, expect, it } from "vitest";
import {
  AvatarConfigSchema,
  COZY_CAFE_MAP,
  buildCollisionGrid,
  findGridPath,
  generateRandomAvatarConfig,
  isWalkableWorldPos,
} from "../index.js";

describe("Cozy Café Map & Shared Contracts", () => {
  it("keeps spawn point and every table seat reachable while blocking solid tabletops and walls", () => {
    const grid = buildCollisionGrid(COZY_CAFE_MAP);

    // Spawn point is walkable
    expect(
      isWalkableWorldPos(
        COZY_CAFE_MAP.spawnPoint.x,
        COZY_CAFE_MAP.spawnPoint.y,
        10,
        COZY_CAFE_MAP,
        grid
      )
    ).toBe(true);

    // Outer walls are blocked
    expect(isWalkableWorldPos(10, 10, 10, COZY_CAFE_MAP, grid)).toBe(false);

    // Every tabletop center is solid
    for (const tbl of COZY_CAFE_MAP.tables) {
      expect(isWalkableWorldPos(tbl.x, tbl.y, 10, COZY_CAFE_MAP, grid)).toBe(false);
    }

    // A* pathfinder finds a valid walkable path from Entrance to Grand Lantern Table & Open Tables Board
    const grandTable = COZY_CAFE_MAP.tables.find((t) => t.id === "table_large_1")!;
    const pathToSeat = findGridPath(
      COZY_CAFE_MAP.spawnPoint.x,
      COZY_CAFE_MAP.spawnPoint.y,
      grandTable.seats[0]!.x,
      grandTable.seats[0]!.y,
      COZY_CAFE_MAP,
      grid
    );
    expect(pathToSeat.length).toBeGreaterThan(2);

    const noticeBoard = COZY_CAFE_MAP.interactables.find((i) => i.type === "notice_board")!;
    const pathToBoard = findGridPath(
      COZY_CAFE_MAP.spawnPoint.x,
      COZY_CAFE_MAP.spawnPoint.y,
      noticeBoard.interactX,
      noticeBoard.interactY,
      COZY_CAFE_MAP,
      grid
    );
    expect(pathToBoard.length).toBeGreaterThan(2);
  });

  it("generates schema-valid random procedural avatars that vary across default calls", () => {
    const serialized = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const cfg = generateRandomAvatarConfig();
      expect(AvatarConfigSchema.safeParse(cfg).success).toBe(true);
      serialized.add(JSON.stringify(cfg));
    }
    expect(serialized.size).toBeGreaterThan(8);
  });
});
