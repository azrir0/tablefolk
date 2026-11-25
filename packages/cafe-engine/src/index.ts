import * as Phaser from "phaser";
import {
  CozyCafeScene,
  type CafeEngineCallbacks,
  type SyncedPlayerSnapshot,
  type SyncedTableSnapshot,
} from "./CafeScene.js";

export type {
  CafeEngineCallbacks,
  SyncedPlayerSnapshot,
  SyncedSeatSnapshot,
  SyncedTableSnapshot,
} from "./CafeScene.js";

export interface CafeEngineHandle {
  setLocalSessionId: (sessionId: string) => void;
  syncPlayers: (players: SyncedPlayerSnapshot[]) => void;
  syncTables: (tables: SyncedTableSnapshot[]) => void;
  setJoystickVector: (vx: number, vy: number) => void;
  triggerNearbyInteract: () => void;
  setPaused: (paused: boolean) => void;
  resetInput: () => void;
  destroy: () => void;
}

export function mountCafeEngine(
  parent: HTMLElement,
  callbacks: CafeEngineCallbacks
): CafeEngineHandle {
  const scene = new CozyCafeScene();
  scene.configure(callbacks);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: parent.clientWidth || 960,
    height: parent.clientHeight || 640,
    backgroundColor: "#F3E7D3",
    antialias: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [scene],
  });

  return {
    setLocalSessionId: (sid) => scene.setLocalSessionId(sid),
    syncPlayers: (players) => scene.syncPlayers(players),
    syncTables: (tables) => scene.syncTables(tables),
    setJoystickVector: (vx, vy) => scene.setJoystickVector(vx, vy),
    triggerNearbyInteract: () => scene.triggerNearbyInteract(),
    setPaused: (paused) => {
      if (paused) {
        game.loop.sleep();
      } else {
        game.loop.wake();
        game.scale.refresh();
      }
    },
    resetInput: () => {
      scene.resetInput();
      game.scale.refresh();
    },
    destroy: () => {
      game.destroy(true);
    },
  };
}
