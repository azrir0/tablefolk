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
  // Render at native device pixels (Retina / high-DPI phones) — capped at 3x for GPU budget
  const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);

  const scene = new CozyCafeScene();
  scene.configure(callbacks, dpr);

  const cssWidth = () => Math.max(1, parent.clientWidth || 960);
  const cssHeight = () => Math.max(1, parent.clientHeight || 640);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: Math.round(cssWidth() * dpr),
    height: Math.round(cssHeight() * dpr),
    backgroundColor: "#F3E7D3",
    antialias: true,
    scale: {
      // Backing buffer is DPR× larger; zoom 1/DPR keeps the CSS display size identical
      mode: Phaser.Scale.NONE,
      zoom: 1 / dpr,
    },
    scene: [scene],
  });

  let destroyed = false;
  let lastW = 0;
  let lastH = 0;
  const fitToParent = () => {
    if (destroyed || !game.scale) return;
    const w = cssWidth();
    const h = cssHeight();
    if (w === lastW && h === lastH) {
      game.scale.refresh();
      return;
    }
    lastW = w;
    lastH = h;
    game.scale.resize(Math.round(w * dpr), Math.round(h * dpr));
    game.scale.refresh();
  };

  const resizeObserver =
    typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => fitToParent()) : null;
  resizeObserver?.observe(parent);
  window.addEventListener("resize", fitToParent);
  window.addEventListener("orientationchange", fitToParent);

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
        fitToParent();
      }
    },
    resetInput: () => {
      scene.resetInput();
      fitToParent();
    },
    destroy: () => {
      destroyed = true;
      resizeObserver?.disconnect();
      window.removeEventListener("resize", fitToParent);
      window.removeEventListener("orientationchange", fitToParent);
      game.destroy(true);
    },
  };
}
