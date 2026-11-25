import * as Phaser from "phaser";
import {
  COZY_CAFE_MAP,
  DEFAULT_AVATAR_CONFIG,
  findGridPath,
  isWalkableWorldPos,
  type AvatarConfig,
  type Direction,
  type InteractableDefinition,
} from "@tablefolk/shared";
import { PaperDollAvatar } from "./avatarRenderer.js";

export interface SyncedPlayerSnapshot {
  sessionId: string;
  userId: string;
  displayName: string;
  avatarConfig: AvatarConfig;
  x: number;
  y: number;
  facing: Direction;
  isMoving: boolean;
  carryingGameSlug: string;
  seatedTableId: string;
  seatIndex: number;
  inGameSessionId: string;
  emote: string;
  emoteSeq: number;
  speechText: string;
  speechSeq: number;
}

export interface SyncedSeatSnapshot {
  seatIndex: number;
  status: string;
  occupantName: string;
  isBot: boolean;
  isReady: boolean;
}

export interface SyncedTableSnapshot {
  tableId: string;
  name: string;
  category: string;
  capacity: number;
  status: string;
  selectedGameSlug: string;
  hostUserId: string;
  activeGameRoomId: string;
  seats: SyncedSeatSnapshot[];
}

export interface CafeEngineCallbacks {
  onLocalMove: (payload: {
    x: number;
    y: number;
    facing: Direction;
    isMoving: boolean;
  }) => void;
  onChairClick: (tableId: string, seatIndex: number) => void;
  onInteract: (interactable: InteractableDefinition) => void;
  onNearbyPromptChange: (prompt: { label: string; subtitle: string; interactableId: string } | null) => void;
}

interface ChairVisual {
  tableId: string;
  seatIndex: number;
  x: number;
  y: number;
  glowRing: Phaser.GameObjects.Arc;
  botBadge: Phaser.GameObjects.Text;
  hitZone: Phaser.GameObjects.Zone;
}

export class CozyCafeScene extends Phaser.Scene {
  private callbacks!: CafeEngineCallbacks;
  private localSessionId = "";
  private avatars = new Map<string, PaperDollAvatar>();
  private remoteTargets = new Map<string, { x: number; y: number }>();
  private lastEmoteSeq = new Map<string, number>();
  private lastSpeechSeq = new Map<string, number>();
  private playerSnapshots = new Map<string, SyncedPlayerSnapshot>();
  private tableSnapshots = new Map<string, SyncedTableSnapshot>();

  // Local player movement & controls
  private localPos = { x: COZY_CAFE_MAP.spawnPoint.x, y: COZY_CAFE_MAP.spawnPoint.y };
  private localVel = { x: 0, y: 0 };
  private localInitialized = false;
  private localFacing: Direction = "north";
  private localMoving = false;
  private localSeated = false;
  private walkPath: Array<{ x: number; y: number }> = [];
  private pathIndicator?: Phaser.GameObjects.Arc;
  private joystickVec = { x: 0, y: 0 };
  private lastMoveSendAt = 0;

  private keys?: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    E: Phaser.Input.Keyboard.Key;
    UP: Phaser.Input.Keyboard.Key;
    DOWN: Phaser.Input.Keyboard.Key;
    LEFT: Phaser.Input.Keyboard.Key;
    RIGHT: Phaser.Input.Keyboard.Key;
  };

  // Dynamic visuals
  private chairVisuals: ChairVisual[] = [];
  private tableLabels = new Map<string, Phaser.GameObjects.Text>();
  private tableGameBoxes = new Map<string, Phaser.GameObjects.Graphics>();
  private baristaNpc?: PaperDollAvatar;
  private activeInteractable: InteractableDefinition | null = null;
  private lastReportedPromptId = "";
  private sceneReady = false;

  constructor() {
    super("CozyCafeScene");
  }

  public configure(callbacks: CafeEngineCallbacks) {
    this.callbacks = callbacks;
  }

  public setLocalSessionId(sessionId: string) {
    if (this.localSessionId === sessionId && this.localInitialized) return;
    this.localSessionId = sessionId;
    this.localInitialized = false;
    if (!this.sceneReady || !sessionId) return;

    const existing = this.avatars.get(sessionId);
    const snap = this.playerSnapshots.get(sessionId);
    if (existing && snap) {
      this.localPos.x = snap.x;
      this.localPos.y = snap.y;
      this.localVel.x = 0;
      this.localVel.y = 0;
      this.localFacing = snap.facing;
      this.localSeated = Boolean(snap.seatedTableId);
      this.localInitialized = true;
      existing.updateState({ isLocal: true });
      this.cameras.main.startFollow(existing.root, false, 0.14, 0.14);
    }
  }

  public setJoystickVector(vx: number, vy: number) {
    this.joystickVec = { x: vx, y: vy };
    if (Math.hypot(vx, vy) > 0.1) {
      this.walkPath = [];
    }
  }

  public triggerNearbyInteract() {
    if (this.activeInteractable) {
      this.callbacks?.onInteract(this.activeInteractable);
    }
  }

  public syncPlayers(players: SyncedPlayerSnapshot[]) {
    const incomingIds = new Set<string>();
    for (const p of players) {
      incomingIds.add(p.sessionId);
      this.playerSnapshots.set(p.sessionId, p);

      const isLocal = p.sessionId === this.localSessionId;
      if (isLocal) {
        const wasSeated = this.localSeated;
        this.localSeated = Boolean(p.seatedTableId);
        // Only snap local position on first spawn, seating state change, or extreme server correction (>160px)
        const serverDrift = Math.hypot(p.x - this.localPos.x, p.y - this.localPos.y);
        if (
          !this.localInitialized ||
          this.localSeated ||
          (wasSeated && !this.localSeated) ||
          serverDrift > 160
        ) {
          this.localPos.x = p.x;
          this.localPos.y = p.y;
          this.localVel.x = 0;
          this.localVel.y = 0;
          this.localFacing = p.facing;
          this.walkPath = [];
          this.localInitialized = true;
        }
      } else {
        this.remoteTargets.set(p.sessionId, { x: p.x, y: p.y });
      }

      if (!this.sceneReady) continue;

      let avatar = this.avatars.get(p.sessionId);
      if (!avatar) {
        avatar = new PaperDollAvatar(this, p.x, p.y, {
          displayName: p.displayName,
          config: p.avatarConfig,
          facing: p.facing,
          isMoving: p.isMoving,
          isSeated: Boolean(p.seatedTableId),
          carryingGameSlug: p.carryingGameSlug,
          inGame: Boolean(p.inGameSessionId),
          isLocal,
        });
        avatar.root.setDepth(p.y);
        this.avatars.set(p.sessionId, avatar);
        if (isLocal) {
          this.localInitialized = true;
          this.cameras.main.startFollow(avatar.root, false, 0.14, 0.14);
        }
      } else {
        avatar.updateState({
          displayName: p.displayName,
          config: p.avatarConfig,
          facing: isLocal && !this.localSeated ? this.localFacing : p.facing,
          isMoving: isLocal && !this.localSeated ? this.localMoving : p.isMoving,
          isSeated: Boolean(p.seatedTableId),
          carryingGameSlug: p.carryingGameSlug,
          inGame: Boolean(p.inGameSessionId),
          isLocal,
        });
        if (isLocal && this.localSeated) {
          avatar.root.setPosition(p.x, p.y);
        }
      }

      // Emote trigger
      const prevEmote = this.lastEmoteSeq.get(p.sessionId) ?? p.emoteSeq;
      if (p.emoteSeq > prevEmote && p.emote) {
        avatar.triggerEmote(p.emote);
      }
      this.lastEmoteSeq.set(p.sessionId, p.emoteSeq);

      // Speech bubble trigger
      const prevSpeech = this.lastSpeechSeq.get(p.sessionId) ?? p.speechSeq;
      if (p.speechSeq > prevSpeech && p.speechText) {
        avatar.showSpeech(p.speechText);
      }
      this.lastSpeechSeq.set(p.sessionId, p.speechSeq);
    }

    // Remove departed players
    for (const [sid, avatar] of this.avatars.entries()) {
      if (!incomingIds.has(sid)) {
        avatar.destroy();
        this.avatars.delete(sid);
        this.remoteTargets.delete(sid);
        this.playerSnapshots.delete(sid);
      }
    }
  }

  public syncTables(tables: SyncedTableSnapshot[]) {
    for (const t of tables) {
      this.tableSnapshots.set(t.tableId, t);
    }
    if (this.sceneReady) {
      this.refreshTableVisuals();
    }
  }

  create() {
    const map = COZY_CAFE_MAP;
    this.cameras.main.setBackgroundColor("#F3E7D3");
    this.cameras.main.setBounds(0, 0, map.width, map.height);
    this.cameras.main.centerOn(map.spawnPoint.x, map.spawnPoint.y);

    this.drawCafeArchitecture();
    this.drawRugsAndDecor();
    this.drawInteractables();
    this.drawTablesAndChairs();
    this.createAmbientBaristaNpc();

    // Floor click target ripple
    this.pathIndicator = this.add
      .circle(0, 0, 10, 0x62a87c, 0.28)
      .setStrokeStyle(2, 0x458b60, 0.85)
      .setDepth(15)
      .setVisible(false);

    // Keyboard bindings (non-capturing so React chat inputs still type normally!)
    if (this.input.keyboard) {
      this.keys = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W, false),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A, false),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S, false),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D, false),
        E: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E, false),
        UP: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP, false),
        DOWN: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN, false),
        LEFT: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT, false),
        RIGHT: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT, false),
      };

      this.keys.E.on("down", () => {
        if (this.isTypingInInput()) return;
        this.triggerNearbyInteract();
      });
    }

    // Tap-to-move on open café floor (with line-of-sight smoothing!)
    this.input.on(
      "pointerdown",
      (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
        if (currentlyOver.length > 0) return;
        if (this.localSeated) return;

        const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const rawPath = findGridPath(this.localPos.x, this.localPos.y, worldPt.x, worldPt.y);
        if (rawPath.length > 0) {
          this.walkPath = this.smoothWalkPath(rawPath);
          const dest = this.walkPath[this.walkPath.length - 1]!;
          this.pathIndicator?.setPosition(dest.x, dest.y).setVisible(true).setScale(0.6);
          this.tweens.add({
            targets: this.pathIndicator,
            scale: 1.25,
            alpha: 0.9,
            duration: 240,
            ease: "Quad.easeOut",
          });
        }
      }
    );

    this.sceneReady = true;

    // Replay any snapshots that arrived before Phaser finished booting
    if (this.playerSnapshots.size > 0) {
      this.syncPlayers(Array.from(this.playerSnapshots.values()));
    }
    if (this.tableSnapshots.size > 0) {
      this.refreshTableVisuals();
    }
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.05);

    this.updateLocalMovement(dt);
    this.updateRemoteInterpolation(dt);
    this.updateProximityHighlights();

    for (const avatar of this.avatars.values()) {
      avatar.tick(dt);
    }
    this.baristaNpc?.tick(dt);
  }

  private isTypingInInput(): boolean {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || (el as HTMLElement).isContentEditable;
  }

  /** Line-of-sight string-pulling so click-to-move glides straight instead of tile-stepping */
  private smoothWalkPath(raw: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
    if (raw.length <= 1) return raw;
    const smoothed: Array<{ x: number; y: number }> = [];
    let anchor = { x: this.localPos.x, y: this.localPos.y };
    let idx = 0;

    while (idx < raw.length) {
      let furthest = idx;
      for (let probe = raw.length - 1; probe > idx; probe--) {
        if (this.hasClearLine(anchor.x, anchor.y, raw[probe]!.x, raw[probe]!.y)) {
          furthest = probe;
          break;
        }
      }
      const nextPt = raw[furthest]!;
      smoothed.push(nextPt);
      anchor = nextPt;
      idx = furthest + 1;
    }
    return smoothed;
  }

  private hasClearLine(x0: number, y0: number, x1: number, y1: number): boolean {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(2, Math.ceil(dist / 12));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!isWalkableWorldPos(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 12)) {
        return false;
      }
    }
    return true;
  }

  private updateLocalMovement(dt: number) {
    const localAvatar = this.avatars.get(this.localSessionId);
    if (!localAvatar || this.localSeated) {
      this.localMoving = false;
      this.localVel.x = 0;
      this.localVel.y = 0;
      this.pathIndicator?.setVisible(false);
      return;
    }

    let inputX = 0;
    let inputY = 0;

    if (!this.isTypingInInput() && this.keys) {
      if (this.keys.A.isDown || this.keys.LEFT.isDown) inputX -= 1;
      if (this.keys.D.isDown || this.keys.RIGHT.isDown) inputX += 1;
      if (this.keys.W.isDown || this.keys.UP.isDown) inputY -= 1;
      if (this.keys.S.isDown || this.keys.DOWN.isDown) inputY += 1;
    }

    if (Math.hypot(this.joystickVec.x, this.joystickVec.y) > 0.12) {
      inputX = this.joystickVec.x;
      inputY = this.joystickVec.y;
    }

    const maxSpeed = 205;
    let targetVx = 0;
    let targetVy = 0;

    if (Math.hypot(inputX, inputY) > 0.05) {
      // Direct WASD / joystick input
      this.walkPath = [];
      this.pathIndicator?.setVisible(false);
      const len = Math.hypot(inputX, inputY);
      const scale = Math.min(1, len);
      targetVx = (inputX / len) * maxSpeed * scale;
      targetVy = (inputY / len) * maxSpeed * scale;
      this.localFacing = this.vectorToFacing(inputX, inputY);
    } else if (this.walkPath.length > 0) {
      const target = this.walkPath[0]!;
      const dx = target.x - this.localPos.x;
      const dy = target.y - this.localPos.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= 10) {
        this.walkPath.shift();
        if (this.walkPath.length === 0) {
          this.pathIndicator?.setVisible(false);
        }
      }

      if (this.walkPath.length > 0) {
        const activeTarget = this.walkPath[0]!;
        const adx = activeTarget.x - this.localPos.x;
        const ady = activeTarget.y - this.localPos.y;
        const adist = Math.hypot(adx, ady);
        if (adist > 1) {
          // Gentle arrival slowdown on final waypoint
          const isLast = this.walkPath.length === 1;
          const speedFactor = isLast ? Math.min(1, adist / 24 + 0.25) : 1;
          targetVx = (adx / adist) * maxSpeed * speedFactor;
          targetVy = (ady / adist) * maxSpeed * speedFactor;
          this.localFacing = this.vectorToFacing(adx, ady);
        }
      }
    }

    // Silky framerate-independent acceleration & deceleration damping
    const hasTarget = Math.hypot(targetVx, targetVy) > 1;
    const responseRate = hasTarget ? 18 : 15;
    const smoothAlpha = 1 - Math.exp(-responseRate * dt);
    this.localVel.x += (targetVx - this.localVel.x) * smoothAlpha;
    this.localVel.y += (targetVy - this.localVel.y) * smoothAlpha;

    if (!hasTarget && Math.hypot(this.localVel.x, this.localVel.y) < 4) {
      this.localVel.x = 0;
      this.localVel.y = 0;
    }

    const dxStep = this.localVel.x * dt;
    const dyStep = this.localVel.y * dt;
    let moved = false;

    // X axis + gentle corner-slide nudge
    if (Math.abs(dxStep) > 0.01) {
      if (isWalkableWorldPos(this.localPos.x + dxStep, this.localPos.y, 11)) {
        this.localPos.x += dxStep;
        moved = true;
      } else if (Math.abs(dyStep) < 0.01) {
        // Nudge smoothly around table corners when brushing the edge!
        const slide = Math.abs(dxStep) * 0.75;
        if (isWalkableWorldPos(this.localPos.x + dxStep, this.localPos.y - slide, 11)) {
          this.localPos.y -= slide;
          moved = true;
        } else if (isWalkableWorldPos(this.localPos.x + dxStep, this.localPos.y + slide, 11)) {
          this.localPos.y += slide;
          moved = true;
        } else {
          this.localVel.x = 0;
        }
      } else {
        this.localVel.x = 0;
      }
    }

    // Y axis + gentle corner-slide nudge
    if (Math.abs(dyStep) > 0.01) {
      if (isWalkableWorldPos(this.localPos.x, this.localPos.y + dyStep, 11)) {
        this.localPos.y += dyStep;
        moved = true;
      } else if (Math.abs(dxStep) < 0.01) {
        const slide = Math.abs(dyStep) * 0.75;
        if (isWalkableWorldPos(this.localPos.x - slide, this.localPos.y + dyStep, 11)) {
          this.localPos.x -= slide;
          moved = true;
        } else if (isWalkableWorldPos(this.localPos.x + slide, this.localPos.y + dyStep, 11)) {
          this.localPos.x += slide;
          moved = true;
        } else {
          this.localVel.y = 0;
        }
      } else {
        this.localVel.y = 0;
      }
    }

    const prevMoving = this.localMoving;
    this.localMoving = moved && Math.hypot(this.localVel.x, this.localVel.y) > 12;
    localAvatar.root.setPosition(this.localPos.x, this.localPos.y);

    if (this.localMoving !== prevMoving || this.localMoving) {
      localAvatar.updateState({
        facing: this.localFacing,
        isMoving: this.localMoving,
      });
    }

    // Throttled position sync (~15 Hz) + immediate stop packet
    const now = this.time.now;
    if ((this.localMoving && now - this.lastMoveSendAt >= 65) || (prevMoving && !this.localMoving)) {
      this.lastMoveSendAt = now;
      this.callbacks?.onLocalMove({
        x: Math.round(this.localPos.x),
        y: Math.round(this.localPos.y),
        facing: this.localFacing,
        isMoving: this.localMoving,
      });
    }
  }

  private updateRemoteInterpolation(dt: number) {
    const lerpFactor = 1 - Math.exp(-14 * dt);
    for (const [sid, target] of this.remoteTargets.entries()) {
      if (sid === this.localSessionId) continue;
      const avatar = this.avatars.get(sid);
      if (!avatar) continue;
      avatar.root.x += (target.x - avatar.root.x) * lerpFactor;
      avatar.root.y += (target.y - avatar.root.y) * lerpFactor;
    }
  }

  private updateProximityHighlights() {
    const px = this.localPos.x;
    const py = this.localPos.y;
    const pulse = 0.55 + Math.sin(this.time.now / 260) * 0.35;

    // 1. Highlight available chairs whenever player walks within table interaction range
    for (const cv of this.chairVisuals) {
      const tblDef = COZY_CAFE_MAP.tables.find((t) => t.id === cv.tableId);
      const tblState = this.tableSnapshots.get(cv.tableId);
      const seatState = tblState?.seats[cv.seatIndex];
      if (!tblDef) continue;

      const inRange = Math.hypot(px - tblDef.x, py - tblDef.y) <= tblDef.interactionRadius;
      const isAvailable =
        (!seatState || seatState.status === "AVAILABLE") && tblState?.status !== "IN_PROGRESS";

      if (inRange && isAvailable) {
        cv.glowRing.setVisible(true).setAlpha(pulse);
      } else {
        cv.glowRing.setVisible(false);
      }
    }

    // 2. Check nearest interactable object (Cashier, Wardrobe, Notice Board, Exit)
    let closest: InteractableDefinition | null = null;
    let closestDist = Infinity;
    for (const obj of COZY_CAFE_MAP.interactables) {
      const d = Math.hypot(px - obj.interactX, py - obj.interactY);
      if (d <= obj.interactRadius && d < closestDist) {
        closest = obj;
        closestDist = d;
      }
    }

    this.activeInteractable = closest;
    const nextId = closest?.id ?? "";
    if (nextId !== this.lastReportedPromptId) {
      this.lastReportedPromptId = nextId;
      this.callbacks?.onNearbyPromptChange(
        closest
          ? {
              label: closest.label,
              subtitle: closest.subtitle,
              interactableId: closest.id,
            }
          : null
      );
    }
  }

  private vectorToFacing(vx: number, vy: number): Direction {
    if (Math.abs(vx) > Math.abs(vy)) {
      return vx > 0 ? "east" : "west";
    }
    return vy > 0 ? "south" : "north";
  }

  private drawCafeArchitecture() {
    const T = COZY_CAFE_MAP.tileSize;
    const W = COZY_CAFE_MAP.width;
    const H = COZY_CAFE_MAP.height;

    const g = this.add.graphics().setDepth(0);

    // Warm honey-oak wooden floor planks
    g.fillStyle(0xf6ebd8, 1);
    g.fillRect(0, 0, W, H);

    for (let y = 2 * T; y < (COZY_CAFE_MAP.rows - 1) * T; y += T / 2) {
      g.fillStyle(y % T === 0 ? 0xf2e3c8 : 0xf7ecd9, 1);
      g.fillRect(T, y, W - 2 * T, T / 2);
      g.lineStyle(1, 0xe5d3b7, 0.55);
      g.lineBetween(T, y, W - T, y);
    }

    // Soft afternoon sunlight beams slanting from upper windows
    g.fillStyle(0xfff9e6, 0.34);
    const windowXs = [3.5 * T, 11 * T, 18.5 * T, 24 * T];
    for (const wx of windowXs) {
      g.fillPoints(
        [
          new Phaser.Geom.Point(wx, 2 * T),
          new Phaser.Geom.Point(wx + 2.5 * T, 2 * T),
          new Phaser.Geom.Point(wx + 4.2 * T, 6.2 * T),
          new Phaser.Geom.Point(wx + 1.4 * T, 6.2 * T),
        ],
        true
      );
    }

    // Top Café Wall (cream plaster + sage wainscot + sunny arched windows)
    g.fillStyle(0xfaefe0, 1);
    g.fillRect(0, 0, W, 2 * T);
    g.fillStyle(0xc5d8c2, 1);
    g.fillRect(T, T * 1.15, W - 2 * T, T * 0.85);
    g.lineStyle(3, 0x9b7e66, 1);
    g.lineBetween(T, 2 * T, W - T, 2 * T);

    // Sunny café windows along upper wall
    for (const wx of windowXs) {
      g.fillStyle(0xd8eef8, 1);
      g.lineStyle(3, 0xa88263, 1);
      g.fillRoundedRect(wx, 14, 2.3 * T, 1.35 * T, 10);
      g.strokeRoundedRect(wx, 14, 2.3 * T, 1.35 * T, 10);
      g.lineStyle(2, 0xffffff, 0.8);
      g.lineBetween(wx + 1.15 * T, 16, wx + 1.15 * T, 14 + 1.35 * T);
      g.lineBetween(wx + 4, 14 + 0.7 * T, wx + 2.3 * T - 4, 14 + 0.7 * T);
    }

    // Outer perimeter warm timber border walls
    g.fillStyle(0x8e6b53, 1);
    g.fillRect(0, 0, T, H);
    g.fillRect(W - T, 0, T, H);
    g.fillRect(0, H - T, 12.5 * T, T);
    g.fillRect(15.5 * T, H - T, W - 15.5 * T, T);

    // Welcoming entrance doorway arch
    g.fillStyle(0xdeb98a, 1);
    g.fillRoundedRect(12.5 * T, H - T, 3 * T, T, 6);
    this.add
      .text(14 * T, H - T * 0.5, "EXIT / LOBBY", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "10px",
        fontStyle: "700",
        color: "#6B4A31",
      })
      .setOrigin(0.5)
      .setDepth(12);
  }

  private drawRugsAndDecor() {
    const g = this.add.graphics().setDepth(5);

    for (const dec of COZY_CAFE_MAP.decorations) {
      if (dec.kind === "rug") {
        const col = Number.parseInt((dec.color || "#E9C7A3").replace("#", ""), 16);
        g.fillStyle(col, 0.72);
        g.fillRoundedRect(dec.x, dec.y, dec.w, dec.h, 18);
        g.lineStyle(2, 0xffffff, 0.55);
        g.strokeRoundedRect(dec.x + 8, dec.y + 8, dec.w - 16, dec.h - 16, 12);
      } else if (dec.kind === "sofa") {
        const sofaG = this.add.graphics().setDepth(dec.y + dec.h);
        sofaG.fillStyle(0x3a2a20, 0.14);
        sofaG.fillRoundedRect(dec.x + 4, dec.y + 8, dec.w, dec.h, 14);
        sofaG.fillStyle(0xcf8472, 1);
        sofaG.lineStyle(2.5, 0x5c3c31, 1);
        sofaG.fillRoundedRect(dec.x, dec.y, dec.w, dec.h, 14);
        sofaG.strokeRoundedRect(dec.x, dec.y, dec.w, dec.h, 14);
        // Backrest cushion
        sofaG.fillStyle(0xdc9a89, 1);
        sofaG.fillRoundedRect(dec.x + 8, dec.y + 5, dec.w - 16, 16, 8);
      } else if (dec.kind === "plant") {
        const cx = dec.x + dec.w / 2;
        const cy = dec.y + dec.h / 2;
        const pG = this.add.graphics().setDepth(dec.y + dec.h);
        pG.fillStyle(0x3a2a20, 0.16);
        pG.fillEllipse(cx, cy + 14, 34, 14);
        // Terracotta pot
        pG.fillStyle(0xc87556, 1);
        pG.lineStyle(2, 0x5d3b2b, 1);
        pG.fillRoundedRect(cx - 12, cy - 2, 24, 18, 6);
        pG.strokeRoundedRect(cx - 12, cy - 2, 24, 18, 6);
        // Lush stylized leaves
        pG.fillStyle(0x6da375, 1);
        pG.fillCircle(cx - 9, cy - 10, 10);
        pG.fillCircle(cx + 9, cy - 10, 10);
        pG.fillStyle(0x84bb8a, 1);
        pG.fillCircle(cx, cy - 16, 11);
      }
    }
  }

  private drawInteractables() {
    const T = COZY_CAFE_MAP.tileSize;

    for (const obj of COZY_CAFE_MAP.interactables) {
      const x = obj.tileX * T;
      const y = obj.tileY * T;
      const w = obj.tileW * T;
      const h = obj.tileH * T;

      const g = this.add.graphics().setDepth(obj.type === "exit" ? 8 : y + h - 8);

      if (obj.type === "cashier") {
        // Warm walnut espresso & tutorial counter
        g.fillStyle(0x3a2a20, 0.16);
        g.fillRoundedRect(x + 4, y + 8, w, h, 14);
        g.fillStyle(0xb98258, 1);
        g.lineStyle(2.5, 0x5c3e29, 1);
        g.fillRoundedRect(x, y, w, h, 14);
        g.strokeRoundedRect(x, y, w, h, 14);
        // Cream marble countertop
        g.fillStyle(0xfbf5ea, 1);
        g.fillRoundedRect(x + 6, y + 6, w - 12, h - 22, 10);
        // Espresso machine + pastry dome + guide book
        g.fillStyle(0x6d7d74, 1);
        g.fillRoundedRect(x + 18, y + 14, 44, 30, 6);
        g.fillStyle(0xe8c488, 1);
        g.fillCircle(x + w - 42, y + 28, 16);
        g.fillStyle(0x529b76, 1);
        g.fillRoundedRect(x + w / 2 - 18, y + 16, 36, 24, 4);
      } else if (obj.type === "wardrobe") {
        // Tall cozy Board Game Wardrobe bookshelf stocked with colorful game boxes!
        g.fillStyle(0x9d6b48, 1);
        g.lineStyle(2.5, 0x523623, 1);
        g.fillRoundedRect(x, y - 22, w, h + 22, 10);
        g.strokeRoundedRect(x, y - 22, w, h + 22, 10);

        const boxColors = [0xf2c25b, 0x7cb992, 0xe28479, 0x7aa9d6, 0xb88fd4, 0xf09f60];
        for (let i = 0; i < 11; i++) {
          g.fillStyle(boxColors[i % boxColors.length]!, 1);
          g.lineStyle(1.4, 0x4b3528, 0.9);
          g.fillRoundedRect(x + 12 + i * 24, y - 12, 19, 24, 3);
          g.strokeRoundedRect(x + 12 + i * 24, y - 12, 19, 24, 3);
          g.fillStyle(boxColors[(i + 2) % boxColors.length]!, 1);
          g.fillRoundedRect(x + 12 + i * 24, y + 16, 19, 22, 3);
          g.strokeRoundedRect(x + 12 + i * 24, y + 16, 19, 22, 3);
        }
      } else if (obj.type === "notice_board") {
        g.fillStyle(0xc89a67, 1);
        g.lineStyle(2.5, 0x6b472b, 1);
        g.fillRoundedRect(x, y - 14, w, h + 12, 8);
        g.strokeRoundedRect(x, y - 14, w, h + 12, 8);
        // Pinned notes
        g.fillStyle(0xfff5c0, 1);
        g.fillRect(x + 14, y - 4, 28, 24);
        g.fillStyle(0xdaf4e1, 1);
        g.fillRect(x + 54, y - 2, 34, 26);
        g.fillStyle(0xfad8db, 1);
        g.fillRect(x + 98, y - 6, 30, 24);
      }

      // Label above interactable
      if (obj.type !== "exit") {
        this.add
          .text(x + w / 2, y - 26, obj.label, {
            fontFamily: "system-ui, sans-serif",
            fontSize: "11px",
            fontStyle: "700",
            color: "#4F3728",
            backgroundColor: "rgba(255, 250, 240, 0.92)",
            padding: { left: 7, right: 7, top: 3, bottom: 3 },
          })
          .setOrigin(0.5, 1)
          .setDepth(2100);
      }

      // Clickable interaction zone
      const zone = this.add
        .zone(x + w / 2, y + h / 2, w + 16, h + 28)
        .setInteractive({ useHandCursor: true })
        .setDepth(2200);
      zone.on("pointerdown", () => {
        const dist = Math.hypot(
          this.localPos.x - obj.interactX,
          this.localPos.y - obj.interactY
        );
        if (dist <= obj.interactRadius + 45) {
          this.callbacks?.onInteract(obj);
        } else {
          // Walk automatically toward the interactable!
          this.walkPath = this.smoothWalkPath(
            findGridPath(
              this.localPos.x,
              this.localPos.y,
              obj.interactX,
              obj.interactY
            )
          );
        }
      });
    }
  }

  private drawTablesAndChairs() {
    const T = COZY_CAFE_MAP.tileSize;

    for (const tbl of COZY_CAFE_MAP.tables) {
      const tx = tbl.tileX * T;
      const ty = tbl.tileY * T;
      const tw = tbl.tileW * T;
      const th = tbl.tileH * T;

      // 1. Draw Chairs / Floor Cushions
      for (const seat of tbl.seats) {
        const chairG = this.add.graphics().setDepth(seat.y - 6);
        if (tbl.category === "floor") {
          // Pastel floor cushion
          chairG.fillStyle(0xe5989b, 1);
          chairG.lineStyle(2, 0x6b4744, 1);
          chairG.fillRoundedRect(seat.x - 16, seat.y - 14, 32, 28, 10);
          chairG.strokeRoundedRect(seat.x - 16, seat.y - 14, 32, 28, 10);
        } else {
          // Rounded café wooden chair with pastel seat pad
          chairG.fillStyle(0xa87854, 1);
          chairG.lineStyle(2, 0x573b27, 1);
          chairG.fillCircle(seat.x, seat.y, 15);
          chairG.strokeCircle(seat.x, seat.y, 15);
          chairG.fillStyle(0xe9dcc8, 1);
          chairG.fillCircle(seat.x, seat.y, 10);
        }

        // Glowing availability ring (visible when player approaches!)
        const glowRing = this.add
          .circle(seat.x, seat.y, 20, 0x65c18c, 0.22)
          .setStrokeStyle(2.5, 0x3f9d68, 0.95)
          .setDepth(seat.y - 5)
          .setVisible(false);

        const botBadge = this.add
          .text(seat.x, seat.y - 4, "🤖", { fontSize: "20px" })
          .setOrigin(0.5)
          .setDepth(seat.y + 2)
          .setVisible(false);

        const hitZone = this.add
          .zone(seat.x, seat.y, 38, 38)
          .setInteractive({ useHandCursor: true })
          .setDepth(2300);

        hitZone.on("pointerdown", () => {
          const dist = Math.hypot(this.localPos.x - tbl.x, this.localPos.y - tbl.y);
          if (dist <= tbl.interactionRadius + 60) {
            this.callbacks?.onChairClick(tbl.id, seat.seatIndex);
          } else {
            this.walkPath = this.smoothWalkPath(
              findGridPath(this.localPos.x, this.localPos.y, seat.x, seat.y)
            );
          }
        });

        this.chairVisuals.push({
          tableId: tbl.id,
          seatIndex: seat.seatIndex,
          x: seat.x,
          y: seat.y,
          glowRing,
          botBadge,
          hitZone,
        });
      }

      // 2. Draw Rounded Warm Tabletop (depth sorted cleanly between north & south chairs!)
      const tableDepth = ty + th - 14;
      const tG = this.add.graphics().setDepth(tableDepth);
      tG.fillStyle(0x3a2a20, 0.16);
      tG.fillRoundedRect(tx + 5, ty + 9, tw, th, 16);

      const woodColor =
        tbl.category === "floor"
          ? 0xd6a979
          : tbl.category === "large"
            ? 0xc6905c
            : 0xd29f6c;
      tG.fillStyle(woodColor, 1);
      tG.lineStyle(2.5, 0x6b472b, 1);
      tG.fillRoundedRect(tx, ty, tw, th, 16);
      tG.strokeRoundedRect(tx, ty, tw, th, 16);

      // Soft inner inlay highlight
      tG.lineStyle(1.5, 0xf6dfc2, 0.55);
      tG.strokeRoundedRect(tx + 7, ty + 7, tw - 14, th - 14, 11);

      // Miniature board game box centerpiece (shown when a game is selected)
      const boxG = this.add.graphics().setDepth(tableDepth + 2);
      this.tableGameBoxes.set(tbl.id, boxG);

      // Floating Table Status Pill ("Grand Lantern Table • 0/8")
      const label = this.add
        .text(tx + tw / 2, ty + th / 2, `${tbl.name} • 0/${tbl.capacity}`, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "10.5px",
          fontStyle: "700",
          color: "#4B3423",
          backgroundColor: "rgba(255, 250, 241, 0.9)",
          padding: { left: 7, right: 7, top: 3, bottom: 3 },
        })
        .setOrigin(0.5)
        .setDepth(2050);
      this.tableLabels.set(tbl.id, label);
    }
  }

  private refreshTableVisuals() {
    for (const tblDef of COZY_CAFE_MAP.tables) {
      const state = this.tableSnapshots.get(tblDef.id);
      const label = this.tableLabels.get(tblDef.id);
      const boxG = this.tableGameBoxes.get(tblDef.id);

      const occupied = state
        ? state.seats.filter((s) => s.status !== "AVAILABLE").length
        : 0;

      if (label) {
        if (state?.status === "IN_PROGRESS") {
          label.setText(`🎲 ${tblDef.name} • Playing (${occupied})`);
          label.setStyle({
            backgroundColor: "rgba(254, 243, 199, 0.96)",
            color: "#7C4A03",
          });
        } else if (occupied > 0) {
          label.setText(`${tblDef.name} • ${occupied}/${tblDef.capacity} • Join!`);
          label.setStyle({
            backgroundColor: "rgba(220, 247, 230, 0.95)",
            color: "#225D3B",
          });
        } else {
          label.setText(`${tblDef.name} • 0/${tblDef.capacity}`);
          label.setStyle({
            backgroundColor: "rgba(255, 250, 241, 0.88)",
            color: "#574031",
          });
        }
      }

      if (boxG) {
        boxG.clear();
        if (state?.selectedGameSlug) {
          boxG.fillStyle(0xf2c25b, 1);
          boxG.lineStyle(1.8, 0x5c3e29, 1);
          boxG.fillRoundedRect(tblDef.x - 16, tblDef.y - 12, 32, 22, 4);
          boxG.strokeRoundedRect(tblDef.x - 16, tblDef.y - 12, 32, 22, 4);
          boxG.fillStyle(0x529b76, 1);
          boxG.fillRoundedRect(tblDef.x - 11, tblDef.y - 8, 22, 14, 2);
        }
      }
    }

    // Update Practice Bot chair visuals
    for (const cv of this.chairVisuals) {
      const state = this.tableSnapshots.get(cv.tableId);
      const seat = state?.seats[cv.seatIndex];
      cv.botBadge.setVisible(Boolean(seat?.isBot));
    }
  }

  private createAmbientBaristaNpc() {
    const npcMarker = COZY_CAFE_MAP.decorations.find((d) => d.kind === "counter_npc");
    if (!npcMarker) return;
    this.baristaNpc = new PaperDollAvatar(this, npcMarker.x, npcMarker.y, {
      displayName: "Sage (Guide)",
      config: {
        ...DEFAULT_AVATAR_CONFIG,
        hairStyle: "bun",
        hairColor: "#764935",
        topStyle: "apron",
        topColor: "#8AB696",
        topAccent: "#F7F1E5",
        accessory: "glasses",
      },
      facing: "south",
      isMoving: false,
      isSeated: false,
      carryingGameSlug: "",
      inGame: false,
      isLocal: false,
    });

    // Periodic cozy greeting bubble from our friendly café guide
    const lines = [
      "Welcome to TableFolk! ☕",
      "Walk up to me for Treasure Trails rules!",
      "Grab a game box from the Wardrobe!",
      "Walk near a table to see glowing seats!",
    ];
    let idx = 0;
    this.time.addEvent({
      delay: 11_000,
      loop: true,
      callback: () => {
        this.baristaNpc?.showSpeech(lines[idx % lines.length]!);
        idx += 1;
      },
    });
  }
}
