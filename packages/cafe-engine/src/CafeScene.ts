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
import { CafeBotAvatar, PaperDollAvatar } from "./avatarRenderer.js";
import {
  SMOOTH_SCALE_REGISTRY_KEY,
  createSmoothImage,
  drawCircle,
  drawEllipse,
  drawLine,
  drawRoundedRect,
  drawSoftGlow,
  ensureSmoothTexture,
  getSmoothTextureScale,
  renderSmoothPillTexture,
  toRgba,
} from "./smoothCanvas.js";

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
  occupantUserId: string;
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
  onSpectateTable?: (tableId: string) => void;
  onInteract: (interactable: InteractableDefinition) => void;
  onNearbyPromptChange: (prompt: { label: string; subtitle: string; interactableId: string } | null) => void;
}

interface ChairVisual {
  tableId: string;
  seatIndex: number;
  x: number;
  y: number;
  glowRing: Phaser.GameObjects.Image;
  botAvatar: CafeBotAvatar;
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
  private pathIndicator?: Phaser.GameObjects.Image;
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
  private tableLabels = new Map<string, Phaser.GameObjects.Image>();
  private tableLabelSignatures = new Map<string, string>();
  private tableGameBoxes = new Map<string, Phaser.GameObjects.Image>();
  private baristaNpc?: PaperDollAvatar;
  private activeInteractable: InteractableDefinition | null = null;
  private lastReportedPromptId = "";
  private sceneReady = false;

  constructor() {
    super("CozyCafeScene");
  }

  /** Device pixel ratio used to render the canvas at native (HD/Retina) resolution */
  private renderDpr = 1;
  /** Supersampling scale for smooth Canvas2D vector sprites */
  private smoothTexScale = 2;

  public configure(callbacks: CafeEngineCallbacks, renderDpr = 1) {
    this.callbacks = callbacks;
    this.renderDpr = Math.max(1, renderDpr);
    this.smoothTexScale = getSmoothTextureScale(this.renderDpr);
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

  public resetInput() {
    this.localVel.x = 0;
    this.localVel.y = 0;
    this.joystickVec = { x: 0, y: 0 };
    this.walkPath = [];
    this.localMoving = false;
    this.lastMoveSendAt = 0;
    this.pathIndicator?.setVisible(false);
    if (this.sceneReady && this.input?.keyboard) {
      this.input.keyboard.resetKeys();
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

  private computeWorldZoom(): number {
    const map = COZY_CAFE_MAP;
    const cssW = Math.max(1, this.scale.width / this.renderDpr);
    const cssH = Math.max(1, this.scale.height / this.renderDpr);
    const isDesktop = cssW >= 900 && cssH >= 560;
    if (!isDesktop) {
      // Mobile portrait & landscape keep crisp 1:1 follow-cam zoom inside the café walls
      return 1;
    }
    // Desktop / tablet: fit the whole cozy café height cleanly so windows, fairy lights,
    // Sage, Open Tables & every game table are visible together, framed symmetrically by the garden!
    const fitZoom = Math.min(cssW / map.width, cssH / map.height);
    return Math.min(Math.max(fitZoom, 0.85), 1.85);
  }

  private fitCameraToViewport() {
    const map = COZY_CAFE_MAP;
    const cssW = Math.max(1, this.scale.width / this.renderDpr);
    const cssH = Math.max(1, this.scale.height / this.renderDpr);
    const worldZoom = this.computeWorldZoom();
    this.cameras.main.setZoom(this.renderDpr * worldZoom);

    const visibleW = cssW / worldZoom;
    const visibleH = cssH / worldZoom;
    const boundW = Math.max(map.width, visibleW);
    const boundH = Math.max(map.height, visibleH);
    const boundX = -(boundW - map.width) / 2;
    const boundY = -(boundH - map.height) / 2;

    this.cameras.main.setBounds(boundX, boundY, boundW, boundH);
    if (visibleW >= map.width - 1 && visibleH >= map.height - 1) {
      this.cameras.main.centerOn(map.width / 2, map.height / 2);
    }
  }

  create() {
    const map = COZY_CAFE_MAP;

    // HD / Retina: rasterize Text & vector textures for native DPR × desktop zoom
    const dpr = this.renderDpr;
    const initialWorldZoom = this.computeWorldZoom();
    const effectiveScale = Math.max(1, dpr * initialWorldZoom);
    this.smoothTexScale = getSmoothTextureScale(effectiveScale);
    this.registry.set(SMOOTH_SCALE_REGISTRY_KEY, this.smoothTexScale);

    const textResolution = Math.min(Math.max(Math.ceil(effectiveScale), 1), 4);
    if (textResolution > 1) {
      const factory = this.add;
      const originalText = factory.text.bind(factory);
      factory.text = ((
        x: number,
        y: number,
        text: string | string[],
        style?: Phaser.Types.GameObjects.Text.TextStyle
      ) =>
        originalText(x, y, text, {
          ...(style ?? {}),
          resolution: textResolution,
        })) as typeof factory.text;
    }

    // Warm sunlit garden lawn backdrop outside the cottage walls (eliminates empty beige void!)
    this.cameras.main.setBackgroundColor("#A9C38F");
    this.fitCameraToViewport();
    const cssW = Math.max(1, this.scale.width / this.renderDpr);
    const cssH = Math.max(1, this.scale.height / this.renderDpr);
    if (cssW < 900 || cssH < 560) {
      this.cameras.main.centerOn(map.spawnPoint.x, map.spawnPoint.y);
    }
    this.scale.on("resize", () => this.fitCameraToViewport());

    this.drawGardenExterior();
    this.drawCafeArchitecture();
    this.drawRugsAndDecor();
    this.drawInteractables();
    this.drawTablesAndChairs();
    this.createAmbientBaristaNpc();

    // Floor click target ripple (smooth anti-aliased Canvas2D ring)
    const rippleKey = "cafe-path-ripple";
    ensureSmoothTexture(this, rippleKey, 32, 32, this.smoothTexScale, (ctx) => {
      drawCircle(ctx, 16, 16, 10, toRgba(0x62a87c, 0.28), toRgba(0x458b60, 0.85), 2);
    });
    this.pathIndicator = createSmoothImage(this, rippleKey, 0, 0, this.smoothTexScale)
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
          const invScale = 1 / this.smoothTexScale;
          this.pathIndicator
            ?.setPosition(dest.x, dest.y)
            .setVisible(true)
            .setAlpha(1)
            .setScale(0.6 * invScale);
          this.tweens.add({
            targets: this.pathIndicator,
            scale: 1.25 * invScale,
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
    for (const cv of this.chairVisuals) {
      cv.botAvatar.tick(dt);
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

  private drawGardenExterior() {
    const T = COZY_CAFE_MAP.tileSize;
    const W = COZY_CAFE_MAP.width;
    const H = COZY_CAFE_MAP.height;
    const s = this.smoothTexScale;
    const padX = 760;
    const padY = 300;

    // 1. Painterly Sunlit Sage Meadow Lawn + Cobblestone Café Terraces (depth -10)
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(0xa9c38f, 1);
    g.fillRect(-padX, -padY, W + padX * 2, H + padY * 2);

    // Soft organic meadow grass tone bands & sunlit dappled lawn patches
    g.fillStyle(0xb6cf9c, 0.55);
    const lawnPatches = [
      { x: -160, y: 120, rx: 190, ry: 120 },
      { x: -180, y: 560, rx: 210, ry: 150 },
      { x: W + 170, y: 160, rx: 200, ry: 130 },
      { x: W + 190, y: 620, rx: 220, ry: 150 },
      { x: W * 0.5, y: -110, rx: 460, ry: 100 },
      { x: W * 0.5, y: H + 120, rx: 480, ry: 110 },
    ];
    for (const p of lawnPatches) {
      g.fillEllipse(p.x, p.y, p.rx * 2, p.ry * 2);
    }

    // Warm sandstone cobblestone terrace decks flanking BOTH left & right café walls
    const terraceW = 196;
    const drawTerrace = (tx: number) => {
      // Soft recessed gravel border
      g.fillStyle(0x95af7c, 0.7);
      g.fillRoundedRect(tx - 6, 36, terraceW + 12, H - 72, 22);
      // Warm cream-sandstone patio deck
      g.fillStyle(0xe5d6bc, 1);
      g.fillRoundedRect(tx, 42, terraceW, H - 84, 18);
      g.lineStyle(2, 0xcab695, 0.9);
      g.strokeRoundedRect(tx, 42, terraceW, H - 84, 18);

      // Gentle cobblestone paver grid inside terrace
      let row = 0;
      for (let py = 58; py < H - 64; py += 38) {
        const offset = (row % 2) * 26;
        for (let px = tx + 10 + offset; px < tx + terraceW - 44; px += 52) {
          const stoneCol = (row + Math.floor(px / 52)) % 2 === 0 ? 0xefe3ce : 0xdfd0b4;
          g.fillStyle(stoneCol, 0.82);
          g.fillRoundedRect(px, py, 44, 30, 7);
          g.lineStyle(1, 0xc5b08f, 0.55);
          g.strokeRoundedRect(px, py, 44, 30, 7);
        }
        row++;
      }
    };
    drawTerrace(-terraceW + 8);
    drawTerrace(W - 8);

    // Welcoming front garden cobblestone stepping path below WELCOME · LOBBY doorway
    g.fillStyle(0xe5d6bc, 0.95);
    g.fillRoundedRect(12.2 * T, H - 6, 3.6 * T, padY + 12, 14);
    for (let sy = H + 16; sy < H + padY - 20; sy += 42) {
      g.fillStyle(0xefe3ce, 0.9);
      g.fillRoundedRect(12.55 * T, sy, 1.35 * T, 28, 8);
      g.fillRoundedRect(14.1 * T, sy + 8, 1.35 * T, 28, 8);
    }

    // Soft architectural drop shadow cast by the cozy café cottage onto the garden
    g.fillStyle(0x3a2a20, 0.22);
    g.fillRoundedRect(-10, -4, W + 26, H + 22, 16);

    // Warm golden diagonal outdoor sunlight shafts harmonizing with the indoor beams
    g.fillStyle(0xfff7dc, 0.16);
    for (const sx of [-260, -80, W + 40, W + 220]) {
      g.fillPoints(
        [
          new Phaser.Geom.Point(sx, -80),
          new Phaser.Geom.Point(sx + 120, -80),
          new Phaser.Geom.Point(sx + 250, H + 120),
          new Phaser.Geom.Point(sx + 130, H + 120),
        ],
        true
      );
    }

    // 2. Smooth Anti-Aliased Exterior Botanical Sprites (depth -5 to -2)
    // A. Lush Watercolor Garden Bush with Blooming Wildflowers
    const bushKey = "cafe-ext-bush";
    ensureSmoothTexture(this, bushKey, 96, 84, s, (ctx) => {
      ctx.translate(48, 44);
      drawEllipse(ctx, 2, 18, 72, 26, "rgba(44, 64, 38, 0.18)");
      drawCircle(ctx, -20, 4, 21, "#5C8F58", "#3B6239", 1.8);
      drawCircle(ctx, 20, 5, 20, "#63975F", "#3B6239", 1.8);
      drawCircle(ctx, 0, -8, 24, "#74AA6C", "#3B6239", 1.8);
      drawCircle(ctx, -9, -12, 15, "#8BC07E");
      drawCircle(ctx, 11, -6, 13, "#83B978");
      // Tiny hand-painted cream, blush & buttercup blossoms
      const flowers = [
        { fx: -18, fy: 0, col: "#FFF9E2" },
        { fx: -5, fy: -16, col: "#FAD2D6" },
        { fx: 13, fy: -10, col: "#FFE596" },
        { fx: 22, fy: 6, col: "#FFF9E2" },
        { fx: -2, fy: 7, col: "#FAD2D6" },
      ];
      for (const f of flowers) {
        drawCircle(ctx, f.fx, f.fy, 3.6, f.col, "rgba(120,90,70,0.35)", 0.8);
        drawCircle(ctx, f.fx, f.fy, 1.3, "#E8A63C");
      }
    });

    // B. Vertical Oak Flower Planter Box hugging the café timber walls
    const planterKey = "cafe-ext-planter";
    ensureSmoothTexture(this, planterKey, 48, 128, s, (ctx) => {
      ctx.translate(24, 64);
      drawRoundedRect(ctx, -12, -52, 26, 108, 7, "rgba(50,36,24,0.18)");
      drawRoundedRect(ctx, -14, -54, 26, 106, 7, "#9D704C", "#593C26", 1.8);
      drawRoundedRect(ctx, -10, -49, 18, 96, 4, "#5E4332");
      // Layered herbs & colorful blooms inside the box
      for (let py = -40; py <= 40; py += 16) {
        drawCircle(ctx, -2 + ((py / 8) % 2) * 3, py, 9, "#6CA267", "#3D663B", 1.2);
        drawCircle(ctx, 2, py - 4, 6.5, "#87BD7F");
      }
      drawCircle(ctx, -3, -34, 3.6, "#FAD0C4");
      drawCircle(ctx, 3, -14, 3.8, "#F5E29B");
      drawCircle(ctx, -2, 10, 3.6, "#D7C2F0");
      drawCircle(ctx, 2, 32, 3.8, "#FFF6DE");
    });

    // C. Outdoor Sunlit Patio Bistro Table + Two Bentwood Chairs (purely scenic!)
    const bistroKey = "cafe-ext-bistro";
    ensureSmoothTexture(this, bistroKey, 124, 104, s, (ctx) => {
      ctx.translate(62, 52);
      // Left & right mini bistro chairs
      for (const dir of [-1, 1]) {
        const cx = dir * 34;
        drawCircle(ctx, cx, 3, 12, "rgba(58,42,32,0.15)");
        drawRoundedRect(ctx, cx + (dir > 0 ? 4 : -14), -11, 10, 22, 5, "#986947", "#543824", 1.5);
        drawCircle(ctx, cx, 0, 11, "#B88862", "#573B27", 1.6);
        drawCircle(ctx, cx, 0, 7.2, "#F5EBDA");
      }
      // Round outdoor cream-mosaic café table
      drawCircle(ctx, 2, 5, 24, "rgba(58,42,32,0.16)");
      drawCircle(ctx, 0, 0, 23, "#EEDCC2", "#755236", 2);
      drawCircle(ctx, 0, 0, 18, "#F9F1E2", "rgba(181,148,112,0.5)", 1.2);
      // Tiny vase with blossom + two espresso cups
      drawCircle(ctx, 0, -1, 5.2, "#A8C9A6", "#4A6E50", 1.1);
      drawCircle(ctx, -2, -3, 2.5, "#FFF9E4");
      drawCircle(ctx, 2, -2, 2.3, "#F7BFC7");
      drawCircle(ctx, -9, 7, 4.2, "#FFFDF7", "#6B4A32", 1);
      drawCircle(ctx, -9, 7, 2.4, "#C58D5D");
      drawCircle(ctx, 9, -7, 4.2, "#FFFDF7", "#6B4A32", 1);
      drawCircle(ctx, 9, -7, 2.4, "#88B88C");
    });

    // D. Glowing Brass Garden Path Lantern Post
    const gardenLampKey = "cafe-ext-lamp";
    ensureSmoothTexture(this, gardenLampKey, 76, 76, s, (ctx) => {
      ctx.translate(38, 38);
      drawSoftGlow(ctx, 0, 0, 34, "rgba(255, 226, 146, 0.42)", "rgba(255, 226, 146, 0)");
      drawCircle(ctx, 1, 5, 10, "rgba(58,42,32,0.16)");
      drawCircle(ctx, 0, 0, 9.5, "#5A4435", "#38281E", 1.6);
      drawCircle(ctx, 0, 0, 6.2, "#FFE9A3", "#C58F3A", 1.2);
      drawCircle(ctx, 0, 0, 2.5, "#FFFDF4");
    });

    // Place symmetrical cozy garden details on BOTH left & right terraces!
    // Left terrace (x < 0)
    createSmoothImage(this, planterKey, -18, 175, s).setDepth(-4);
    createSmoothImage(this, planterKey, -18, 635, s).setDepth(-4);
    createSmoothImage(this, bistroKey, -86, 415, s).setDepth(-3);
    createSmoothImage(this, gardenLampKey, -112, 225, s).setDepth(-2);
    createSmoothImage(this, gardenLampKey, -112, 660, s).setDepth(-2);
    createSmoothImage(this, bushKey, -118, 92, s).setDepth(-3);
    createSmoothImage(this, bushKey, -166, 315, s).setScale(0.85 / s).setDepth(-3);
    createSmoothImage(this, bushKey, -164, 535, s).setScale(0.9 / s).setDepth(-3);
    createSmoothImage(this, bushKey, -116, 772, s).setDepth(-3);

    // Right terrace (x > W)
    createSmoothImage(this, planterKey, W + 18, 175, s).setDepth(-4);
    createSmoothImage(this, planterKey, W + 18, 635, s).setDepth(-4);
    createSmoothImage(this, bistroKey, W + 86, 415, s).setDepth(-3);
    createSmoothImage(this, gardenLampKey, W + 112, 225, s).setDepth(-2);
    createSmoothImage(this, gardenLampKey, W + 112, 660, s).setDepth(-2);
    createSmoothImage(this, bushKey, W + 118, 92, s).setDepth(-3);
    createSmoothImage(this, bushKey, W + 166, 315, s).setScale(0.85 / s).setDepth(-3);
    createSmoothImage(this, bushKey, W + 164, 535, s).setScale(0.9 / s).setDepth(-3);
    createSmoothImage(this, bushKey, W + 116, 772, s).setDepth(-3);

    // Extra lush outer meadow bushes for ultrawide monitors (21:9+)
    for (const bx of [-275, -390, W + 275, W + 390]) {
      createSmoothImage(this, bushKey, bx, 180, s).setScale(1.08 / s).setDepth(-5);
      createSmoothImage(this, bushKey, bx + (bx < 0 ? -24 : 24), 460, s).setScale(0.95 / s).setDepth(-5);
      createSmoothImage(this, bushKey, bx, 720, s).setScale(1.05 / s).setDepth(-5);
    }
  }

  private drawCafeArchitecture() {
    const T = COZY_CAFE_MAP.tileSize;
    const W = COZY_CAFE_MAP.width;
    const H = COZY_CAFE_MAP.height;
    const s = this.smoothTexScale;

    const g = this.add.graphics().setDepth(0);

    // 1. Warm honey-oak wooden floor planks with staggered board joints
    g.fillStyle(0xf5e8d2, 1);
    g.fillRect(0, 0, W, H);

    const plankH = T / 2;
    let rowIdx = 0;
    for (let y = 2 * T; y < (COZY_CAFE_MAP.rows - 1) * T; y += plankH) {
      const plankColors = [0xf4e4c9, 0xf8edd9, 0xf1e0c4, 0xf6ead5];
      g.fillStyle(plankColors[rowIdx % plankColors.length]!, 1);
      g.fillRect(T, y, W - 2 * T, plankH);

      // Horizontal seam
      g.lineStyle(1, 0xdfc9a7, 0.52);
      g.lineBetween(T, y, W - T, y);

      // Subtle staggered vertical plank joints
      const offset = (rowIdx % 3) * 76 + 34;
      g.lineStyle(1, 0xdfc9a7, 0.36);
      for (let px = T + offset; px < W - T - 24; px += 196) {
        g.lineBetween(px, y, px, y + plankH);
      }
      rowIdx++;
    }

    // Gentle interior ambient shadow along all perimeter walls for cozy architectural depth
    g.fillStyle(0x6e4e37, 0.08);
    g.fillRect(T, 2 * T, W - 2 * T, 14);
    g.fillRect(T, 2 * T, 12, H - 3 * T);
    g.fillRect(W - T - 12, 2 * T, 12, H - 3 * T);
    g.fillRect(T, H - T - 10, W - 2 * T, 10);

    // 2. Four evenly spaced sunlit café windows (zero overlap with wall art or Open Tables board!)
    const windowXs = [2.6 * T, 9.2 * T, 17.0 * T, 23.4 * T];

    // Soft golden afternoon sunlight shafts slanting across the oak floor
    g.fillStyle(0xfff7dc, 0.34);
    for (const wx of windowXs) {
      g.fillPoints(
        [
          new Phaser.Geom.Point(wx + 6, 2 * T),
          new Phaser.Geom.Point(wx + 2.25 * T, 2 * T),
          new Phaser.Geom.Point(wx + 3.8 * T, 6.4 * T),
          new Phaser.Geom.Point(wx + 1.3 * T, 6.4 * T),
        ],
        true
      );
    }

    // 3. Top Café Wall: warm cream stucco + sage beadboard wainscot + oak chair rail & baseboard
    g.fillStyle(0xfbf2e4, 1);
    g.fillRect(0, 0, W, 2 * T);
    g.fillStyle(0xc5dac2, 1);
    g.fillRect(T, T * 1.12, W - 2 * T, T * 0.88);

    // Vertical beadboard wainscot slats
    g.lineStyle(1, 0xb1cab0, 0.55);
    for (let bx = T + 12; bx < W - T; bx += 14) {
      g.lineBetween(bx, T * 1.14, bx, 2 * T - 4);
    }

    // Oak chair rail & bottom wall baseboard trim
    g.fillStyle(0xd9be9b, 1);
    g.fillRect(T, T * 1.08, W - 2 * T, 5);
    g.lineStyle(1.5, 0x9b7a5e, 0.9);
    g.lineBetween(T, T * 1.08, W - T, T * 1.08);
    g.fillStyle(0x8e6b53, 1);
    g.fillRect(T, 2 * T - 5, W - 2 * T, 5);

    // 4. Arched Café Windows with sheer tied-back curtains, sky view & mini window-sill succulent!
    const winW = 2.3 * T;
    const winH = 1.32 * T;
    const winPad = 8;
    const winKey = "cafe-cozy-window";
    ensureSmoothTexture(this, winKey, winW + winPad * 2, winH + winPad * 2 + 6, s, (ctx) => {
      ctx.translate(winPad, winPad);
      // Soft exterior sky & distant botanical treetops clipped inside window
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, winH);
      ctx.lineTo(0, 18);
      ctx.arcTo(0, 0, 18, 0, 18);
      ctx.lineTo(winW - 18, 0);
      ctx.arcTo(winW, 0, winW, 18, 18);
      ctx.lineTo(winW, winH);
      ctx.closePath();
      ctx.clip();

      const skyGrad = ctx.createLinearGradient(0, 0, 0, winH);
      skyGrad.addColorStop(0, "#CBE8F7");
      skyGrad.addColorStop(1, "#EAF6FA");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, winW, winH);

      // Soft puffy cloud & distant sunny tree foliage
      drawCircle(ctx, winW * 0.34, 16, 10, "rgba(255,255,255,0.85)");
      drawCircle(ctx, winW * 0.44, 15, 12, "rgba(255,255,255,0.88)");
      drawCircle(ctx, winW * 0.56, 17, 9, "rgba(255,255,255,0.82)");
      drawCircle(ctx, 18, winH - 6, 18, "rgba(143,191,142,0.52)");
      drawCircle(ctx, winW - 18, winH - 4, 20, "rgba(128,179,131,0.48)");

      // Sheer cream curtains gracefully tied back at the edges
      ctx.fillStyle = "rgba(255,250,240,0.72)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(24, 0);
      ctx.quadraticCurveTo(18, winH * 0.55, 8, winH);
      ctx.lineTo(0, winH);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(winW, 0);
      ctx.lineTo(winW - 24, 0);
      ctx.quadraticCurveTo(winW - 18, winH * 0.55, winW - 8, winH);
      ctx.lineTo(winW, winH);
      ctx.closePath();
      ctx.fill();

      // Mullion crossbars
      const mullion = "rgba(255,253,247,0.92)";
      drawLine(ctx, winW / 2, 2, winW / 2, winH, mullion, 2.2);
      drawLine(ctx, 2, winH * 0.52, winW - 2, winH * 0.52, mullion, 2.2);
      ctx.restore();

      // Warm oak window frame outline
      ctx.beginPath();
      ctx.moveTo(0, winH);
      ctx.lineTo(0, 18);
      ctx.arcTo(0, 0, 18, 0, 18);
      ctx.lineTo(winW - 18, 0);
      ctx.arcTo(winW, 0, winW, 18, 18);
      ctx.lineTo(winW, winH);
      ctx.closePath();
      ctx.strokeStyle = toRgba(0x9a7354, 1);
      ctx.lineWidth = 3;
      ctx.stroke();

      // Warm oak window sill ledge + cute mini potted succulent!
      drawRoundedRect(ctx, -5, winH - 2, winW + 10, 7, 3, toRgba(0xb88b65, 1), toRgba(0x6d4c34, 1), 1.6);
      drawRoundedRect(ctx, winW - 22, winH - 10, 11, 8, 2.5, toRgba(0xcf7c5c, 1), toRgba(0x643c2c, 1), 1.1);
      drawCircle(ctx, winW - 16.5, winH - 12, 4.2, toRgba(0x6ea574, 1));
      drawCircle(ctx, winW - 13.5, winH - 11, 3.2, toRgba(0x88bf8d, 1));
    });
    for (const wx of windowXs) {
      createSmoothImage(this, winKey, wx - winPad, 12 - winPad, s)
        .setOrigin(0, 0)
        .setDepth(1);
    }

    // 5. Cozy Café Wall Art Bay 1 (between Window 1 & Window 2): Botanical Print + Brass Wall Clock
    const wallBay1Key = "cafe-wall-bay-art";
    ensureSmoothTexture(this, wallBay1Key, 128, 72, s, (ctx) => {
      // Framed botanical leaf illustration
      drawRoundedRect(ctx, 10, 12, 46, 50, 5, toRgba(0x9b7454, 1), toRgba(0x5c3e29, 1), 1.8);
      drawRoundedRect(ctx, 15, 17, 36, 40, 3, toRgba(0xfdf7ec, 1));
      drawLine(ctx, 33, 50, 33, 25, toRgba(0x4d7d56, 1), 1.6);
      drawEllipse(ctx, 27, 36, 10, 6, toRgba(0x74aa7c, 1));
      drawEllipse(ctx, 39, 32, 10, 6, toRgba(0x88bd8e, 1));
      drawEllipse(ctx, 33, 25, 8, 6, toRgba(0x63986c, 1));

      // Cute vintage brass wall clock
      drawCircle(ctx, 90, 34, 18, toRgba(0xd9a75a, 1), toRgba(0x65452b, 1), 2);
      drawCircle(ctx, 90, 34, 14, toRgba(0xfffaf0, 1));
      drawLine(ctx, 90, 34, 90, 24, toRgba(0x4a3426, 1), 1.8);
      drawLine(ctx, 90, 34, 97, 37, toRgba(0x4a3426, 1), 1.5);
      drawCircle(ctx, 90, 34, 2, toRgba(0xc87556, 1));
    });
    createSmoothImage(this, wallBay1Key, 5.85 * T, 12, s).setOrigin(0, 0).setDepth(1);

    // 6. Center Back Wall Feature (replaces old unused Game Wardrobe!):
    // Handcrafted Café Chalkboard Menu + Floating Oak Mug Shelves with Trailing Ivy!
    const menuWallKey = "cafe-wall-menu-shelves";
    ensureSmoothTexture(this, menuWallKey, 212, 86, s, (ctx) => {
      // Left floating oak mug shelf
      drawRoundedRect(ctx, 6, 36, 44, 6, 2.5, toRgba(0xb8865c, 1), toRgba(0x5e3e27, 1), 1.4);
      // Cute stacked pastel mugs + trailing leaf vine on left shelf
      drawRoundedRect(ctx, 11, 24, 10, 11, 3, toRgba(0xf4d8a8, 1), toRgba(0x6b4b34, 1), 1.2);
      drawRoundedRect(ctx, 24, 25, 10, 10, 3, toRgba(0x9dc7a4, 1), toRgba(0x4b6d52, 1), 1.2);
      drawRoundedRect(ctx, 37, 26, 9, 9, 2.5, toRgba(0xcf7c5c, 1), toRgba(0x663b2a, 1), 1.1);
      drawCircle(ctx, 41.5, 23, 4.5, toRgba(0x6da375, 1));
      drawCircle(ctx, 45, 29, 3.2, toRgba(0x83b888, 1));
      drawCircle(ctx, 46, 36, 2.8, toRgba(0x6da375, 1));

      // Center Walnut-Framed Café Chalkboard Menu
      drawRoundedRect(ctx, 58, 10, 96, 62, 8, toRgba(0x9a6d4b, 1), toRgba(0x543824, 1), 2.2);
      drawRoundedRect(ctx, 64, 16, 84, 50, 5, toRgba(0x313e38, 1));
      // Chalk decorative header & steaming cup doodle
      ctx.font = '800 7.5px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = "#F5DFB0";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("SUNLIT BREWS", 106, 25);
      drawLine(ctx, 74, 31, 138, 31, "rgba(245,223,176,0.45)", 1);
      // Tiny chalk menu lines
      drawLine(ctx, 74, 39, 108, 39, "rgba(255,250,240,0.75)", 1.6);
      drawLine(ctx, 74, 47, 102, 47, "rgba(181,226,193,0.8)", 1.6);
      drawLine(ctx, 74, 55, 110, 55, "rgba(247,208,195,0.8)", 1.6);
      // Tiny chalk latte cup doodle on right of board
      drawRoundedRect(ctx, 121, 41, 14, 12, 3, "rgba(255,250,240,0.88)");
      drawLine(ctx, 125, 36, 125, 39, "rgba(245,223,176,0.75)", 1.3);
      drawLine(ctx, 130, 35, 130, 38, "rgba(245,223,176,0.75)", 1.3);

      // Right floating oak teapot & book shelf
      drawRoundedRect(ctx, 162, 36, 44, 6, 2.5, toRgba(0xb8865c, 1), toRgba(0x5e3e27, 1), 1.4);
      // Mini cream teapot
      drawCircle(ctx, 174, 29, 7, toRgba(0xf7efe1, 1), toRgba(0x6b4b34, 1), 1.2);
      drawCircle(ctx, 174, 21.5, 2.2, toRgba(0xd99b52, 1));
      // Mini colorful tabletop books leaning on shelf
      drawRoundedRect(ctx, 186, 22, 6, 13, 1.5, toRgba(0xd97c5e, 1), toRgba(0x5c382a, 1), 1);
      drawRoundedRect(ctx, 193, 24, 6, 11, 1.5, toRgba(0x6ea67f, 1), toRgba(0x3a5d45, 1), 1);
      drawRoundedRect(ctx, 200, 23, 5, 12, 1.5, toRgba(0xe8b954, 1), toRgba(0x694c1d, 1), 1);
    });
    createSmoothImage(this, menuWallKey, 12.05 * T, 10, s).setOrigin(0, 0).setDepth(2);

    // 7. Warm Hanging Bistro String Lights draped across upper wall
    const stringW = W - 2 * T;
    const stringKey = "cafe-bistro-lights";
    ensureSmoothTexture(this, stringKey, stringW, 44, s, (ctx) => {
      const spans = 6;
      const spanW = stringW / spans;
      // Soft dark festoon cord
      ctx.strokeStyle = "rgba(74, 53, 39, 0.55)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < spans; i++) {
        const x0 = i * spanW;
        const xMid = x0 + spanW / 2;
        const x1 = x0 + spanW;
        ctx.moveTo(x0, 6);
        ctx.quadraticCurveTo(xMid, 24, x1, 6);
      }
      ctx.stroke();

      // Warm glowing Edison fairy bulbs along each curve
      for (let i = 0; i < spans; i++) {
        const x0 = i * spanW;
        for (const t of [0.22, 0.5, 0.78]) {
          const bx = x0 + spanW * t;
          const by = (1 - t) * (1 - t) * 6 + 2 * (1 - t) * t * 24 + t * t * 6 + 3;
          drawSoftGlow(ctx, bx, by, 13, "rgba(255, 224, 138, 0.45)", "rgba(255, 224, 138, 0)");
          drawCircle(ctx, bx, by, 3.2, "#FFE599", "#B88435", 0.9);
          drawCircle(ctx, bx - 0.8, by - 0.8, 1.1, "#FFFDF5");
        }
      }
    });
    createSmoothImage(this, stringKey, T, 2, s).setOrigin(0, 0).setDepth(3);

    // 8. Outer perimeter warm timber border walls with inner bevel highlight
    g.fillStyle(0x7f5d47, 1);
    g.fillRect(0, 0, T, H);
    g.fillRect(W - T, 0, T, H);
    g.fillRect(0, H - T, 12.5 * T, T);
    g.fillRect(15.5 * T, H - T, W - 15.5 * T, T);
    g.lineStyle(2, 0x5c3e2b, 0.65);
    g.strokeRect(T, 2 * T, W - 2 * T, H - 3 * T);

    // 9. Welcoming French-Door Entrance & Woven "WELCOME" Coir Doormat
    const doorPad = 6;
    const doorKey = "cafe-door-arch";
    ensureSmoothTexture(this, doorKey, 3 * T + doorPad * 2, T + doorPad * 2, s, (ctx) => {
      ctx.translate(doorPad, doorPad);
      // Warm sunlit entryway threshold
      drawRoundedRect(ctx, 0, 0, 3 * T, T, 8, toRgba(0xe5c497, 1), toRgba(0x6b472b, 1), 2);
      // Woven coir welcome mat
      drawRoundedRect(ctx, 16, 8, 3 * T - 32, T - 16, 6, toRgba(0xcf9f68, 1), toRgba(0x855a34, 1), 1.5);
      drawRoundedRect(ctx, 21, 12, 3 * T - 42, T - 24, 4, null, "rgba(255,245,226,0.55)", 1);
      ctx.font = '800 9.5px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = "#5B3B24";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("WELCOME · LOBBY", (3 * T) / 2, T / 2 + 0.5);
    });
    createSmoothImage(this, doorKey, 12.5 * T - doorPad, H - T - doorPad, s)
      .setOrigin(0, 0)
      .setDepth(4);
  }

  private drawRugsAndDecor() {
    const T = COZY_CAFE_MAP.tileSize;
    const s = this.smoothTexScale;

    // 1. Lush Stylized Monstera / Fiddle-Leaf Potted Plant Sprite
    const plantKey = "cafe-decor-plant";
    ensureSmoothTexture(this, plantKey, 68, 72, s, (ctx) => {
      ctx.translate(34, 38);
      drawEllipse(ctx, 0, 15, 36, 14, toRgba(0x3a2a20, 0.16));
      // Ribbed terracotta planter pot
      drawRoundedRect(ctx, -12, -1, 24, 18, 6, toRgba(0xc97455, 1), toRgba(0x5c3929, 1), 2);
      drawRoundedRect(ctx, -14, -4, 28, 6, 3, toRgba(0xd98667, 1), toRgba(0x5c3929, 1), 1.6);
      drawEllipse(ctx, 0, -2, 20, 5, toRgba(0x5a3e2e, 0.75));
      // Layered lush botanical leaves with subtle veins
      drawCircle(ctx, -12, -11, 10, toRgba(0x4f8a5b, 1), toRgba(0x355c3d, 0.75), 1.3);
      drawCircle(ctx, 12, -11, 10, toRgba(0x569463, 1), toRgba(0x355c3d, 0.75), 1.3);
      drawCircle(ctx, -6, -19, 10.5, toRgba(0x6da675, 1), toRgba(0x355c3d, 0.75), 1.3);
      drawCircle(ctx, 7, -18, 10, toRgba(0x78b280, 1), toRgba(0x355c3d, 0.75), 1.3);
      drawCircle(ctx, 0, -13, 9.5, toRgba(0x8cc292, 1));
      // Delicate leaf highlight veins
      drawLine(ctx, -12, -11, -16, -14, "rgba(232,248,230,0.55)", 1.1);
      drawLine(ctx, 12, -11, 16, -14, "rgba(232,248,230,0.55)", 1.1);
      drawLine(ctx, 0, -13, 0, -20, "rgba(232,248,230,0.6)", 1.2);
    });

    for (const dec of COZY_CAFE_MAP.decorations) {
      if (dec.kind === "rug") {
        const col = Number.parseInt((dec.color || "#E9C7A3").replace("#", ""), 16);
        const isTatami = dec.id === "rug_tatami";
        const padX = 12;
        const padY = 6;
        const rugKey = `cafe-rug-v2-${dec.id}-${dec.w}x${dec.h}`;
        ensureSmoothTexture(this, rugKey, dec.w + padX * 2, dec.h + padY * 2, s, (ctx) => {
          ctx.translate(padX, padY);
          // Hand-knotted cream rug fringes along left & right edges (except tatami mat)
          if (!isTatami) {
            ctx.strokeStyle = "rgba(252, 245, 232, 0.85)";
            ctx.lineWidth = 2;
            for (let fy = 18; fy < dec.h - 16; fy += 9) {
              drawLine(ctx, -6, fy, 1, fy, "rgba(252, 245, 232, 0.85)", 2);
              drawLine(ctx, dec.w - 1, fy, dec.w + 6, fy, "rgba(252, 245, 232, 0.85)", 2);
            }
          }

          drawRoundedRect(
            ctx,
            0,
            0,
            dec.w,
            dec.h,
            isTatami ? 12 : 18,
            toRgba(col, isTatami ? 0.82 : 0.74),
            isTatami ? toRgba(0x7c9973, 0.75) : toRgba(0xffffff, 0.45),
            isTatami ? 3 : 1.5
          );

          if (isTatami) {
            // Subtle woven tatami seam lines
            drawLine(ctx, dec.w / 2, 4, dec.w / 2, dec.h - 4, "rgba(124,153,115,0.4)", 1.5);
            drawLine(ctx, 4, dec.h / 2, dec.w - 4, dec.h / 2, "rgba(124,153,115,0.4)", 1.5);
          } else {
            // Cozy double-stitched woven inner border
            drawRoundedRect(
              ctx,
              9,
              9,
              dec.w - 18,
              dec.h - 18,
              12,
              null,
              toRgba(0xffffff, 0.6),
              1.8
            );
            ctx.save();
            ctx.setLineDash([5, 5]);
            drawRoundedRect(
              ctx,
              15,
              15,
              dec.w - 30,
              dec.h - 30,
              9,
              null,
              "rgba(120, 88, 66, 0.16)",
              1.1
            );
            ctx.restore();
          }
        });
        createSmoothImage(this, rugKey, dec.x - padX, dec.y - padY, s)
          .setOrigin(0, 0)
          .setDepth(5);
      } else if (dec.kind === "sofa") {
        // 2. Plush Tufted Dusty-Rose Loveseat with Throw Pillows & Draped Knit Blanket!
        const padX = 10;
        const padY = 10;
        const sofaKey = `cafe-sofa-plush-${dec.w}x${dec.h}`;
        ensureSmoothTexture(this, sofaKey, dec.w + 24, dec.h + 28, s, (ctx) => {
          ctx.translate(padX, padY);
          // Soft drop shadow
          drawRoundedRect(ctx, 4, 9, dec.w, dec.h, 15, toRgba(0x3a2a20, 0.16));
          // Main velvet sofa body
          drawRoundedRect(
            ctx,
            0,
            0,
            dec.w,
            dec.h,
            14,
            toRgba(0xcf806f, 1),
            toRgba(0x5c3a2f, 1),
            2.2
          );
          // Plush backrest & seat cushions
          drawRoundedRect(
            ctx,
            10,
            4,
            dec.w - 20,
            16,
            8,
            toRgba(0xdc9383, 1),
            toRgba(0x7c4f42, 0.45),
            1.2
          );
          drawLine(ctx, dec.w / 2, 18, dec.w / 2, dec.h - 5, "rgba(92,58,47,0.28)", 1.3);
          // Rolled armrests on left & right
          drawRoundedRect(ctx, -2, 6, 14, dec.h - 10, 7, toRgba(0xc47362, 1), toRgba(0x5c3a2f, 1), 1.8);
          drawRoundedRect(
            ctx,
            dec.w - 12,
            6,
            14,
            dec.h - 10,
            7,
            toRgba(0xc47362, 1),
            toRgba(0x5c3a2f, 1),
            1.8
          );
          // Cozy throw pillows (cream + soft sage)
          drawRoundedRect(ctx, 16, 12, 20, 15, 5, toRgba(0xfbf2e1, 1), toRgba(0x8e725b, 0.7), 1.2);
          drawRoundedRect(
            ctx,
            dec.w - 38,
            12,
            20,
            15,
            5,
            toRgba(0xa8cbb0, 1),
            toRgba(0x4c6e55, 0.7),
            1.2
          );
          // Folded warm oat knit throw draped across right armrest
          drawRoundedRect(
            ctx,
            dec.w - 16,
            16,
            14,
            24,
            5,
            toRgba(0xf2e2c8, 1),
            toRgba(0x8a6d53, 0.7),
            1.2
          );
        });
        createSmoothImage(this, sofaKey, dec.x - padX, dec.y - padY, s)
          .setOrigin(0, 0)
          .setDepth(dec.y + dec.h);

        // Adorable decorative Coffee Table & Glowing Brass Floor Lamp on the blush lounge rug!
        const coffeeTableKey = "cafe-nook-coffee-table";
        ensureSmoothTexture(this, coffeeTableKey, 76, 54, s, (ctx) => {
          ctx.translate(38, 27);
          drawEllipse(ctx, 2, 5, 58, 32, toRgba(0x3a2a20, 0.14));
          drawEllipse(ctx, 0, 0, 58, 32, toRgba(0xd9ae7e, 1), toRgba(0x6e4a2e, 1), 2);
          drawEllipse(ctx, 0, 0, 48, 24, null, "rgba(255,244,226,0.5)", 1.2);
          // Two steaming latte cups + tiny croissant plate
          drawCircle(ctx, -13, -1, 5.5, "#FFFDF8", "#6B4A32", 1.2);
          drawCircle(ctx, -13, -1, 3.6, "#C89566");
          drawCircle(ctx, -13, -1, 1.2, "#FFF8EE");
          drawCircle(ctx, 13, 2, 5.5, "#E8F4E9", "#4A6E53", 1.2);
          drawCircle(ctx, 13, 2, 3.6, "#88B88C");
          drawCircle(ctx, 1, -4, 6.5, "#FFF8EC", "#C9B195", 1);
          drawEllipse(ctx, 1, -4, 7, 4.2, "#E3A65B", "#8A5623", 0.9);
        });
        createSmoothImage(this, coffeeTableKey, dec.x + dec.w * 0.5, dec.y + dec.h + 26, s).setDepth(
          dec.y + dec.h + 22
        );

        const lampKey = "cafe-nook-floor-lamp";
        ensureSmoothTexture(this, lampKey, 84, 84, s, (ctx) => {
          ctx.translate(42, 42);
          // Warm golden ambient glow pool
          drawSoftGlow(ctx, 0, 0, 38, "rgba(255, 224, 146, 0.36)", "rgba(255, 224, 146, 0)");
          // Brass stand shadow & circular base
          drawCircle(ctx, 1, 10, 10, toRgba(0x3a2a20, 0.16));
          drawCircle(ctx, 0, 8, 9, toRgba(0xc99649, 1), toRgba(0x6b4b21, 1), 1.6);
          // Pleated warm cream lampshade viewed from cozy top-down angle
          drawCircle(ctx, 0, -4, 14, toRgba(0xfff4d4, 1), toRgba(0x9e7442, 1), 1.8);
          drawCircle(ctx, 0, -4, 5, toRgba(0xffe194, 1), toRgba(0xc99649, 1), 1.2);
        });
        createSmoothImage(this, lampKey, dec.x + dec.w + 26, dec.y + 18, s).setDepth(
          dec.y + dec.h + 4
        );
      } else if (dec.kind === "plant") {
        const cx = dec.x + dec.w / 2;
        const cy = dec.y + dec.h / 2;
        createSmoothImage(this, plantKey, cx, cy, s).setDepth(dec.y + dec.h);
      }
    }

    // Two cozy decorative mini olive planters flanking the entrance doorway (outside walkable path)
    createSmoothImage(this, plantKey, 12.05 * T, COZY_CAFE_MAP.height - T * 0.72, s)
      .setScale(0.76 / s)
      .setDepth(COZY_CAFE_MAP.height);
    createSmoothImage(this, plantKey, 15.95 * T, COZY_CAFE_MAP.height - T * 0.72, s)
      .setScale(0.76 / s)
      .setDepth(COZY_CAFE_MAP.height);
  }

  private drawInteractables() {
    const T = COZY_CAFE_MAP.tileSize;
    const s = this.smoothTexScale;

    for (const obj of COZY_CAFE_MAP.interactables) {
      const x = obj.tileX * T;
      const y = obj.tileY * T;
      const w = obj.tileW * T;
      const h = obj.tileH * T;
      const depth = obj.type === "exit" ? 8 : y + h - 8;

      if (obj.type === "cashier") {
        const padX = 8;
        const padY = 8;
        const key = `cafe-interact-cashier-v2-${w}x${h}`;
        ensureSmoothTexture(this, key, w + 20, h + 24, s, (ctx) => {
          ctx.translate(padX, padY);
          // Warm drop shadow
          drawRoundedRect(ctx, 5, 9, w, h, 14, toRgba(0x3a2a20, 0.18));
          // Slatted walnut counter body
          drawRoundedRect(ctx, 0, 0, w, h, 14, toRgba(0xaa734b, 1), toRgba(0x573924, 1), 2.5);
          // Vertical wood slats on the front apron of the counter
          for (let sx = 16; sx < w - 14; sx += 14) {
            drawLine(ctx, sx, h - 16, sx, h - 3, "rgba(87, 57, 36, 0.32)", 1.3);
          }
          // Cream marble countertop slab
          drawRoundedRect(
            ctx,
            6,
            6,
            w - 12,
            h - 22,
            10,
            toRgba(0xfcf6ec, 1),
            toRgba(0xdcc9b1, 0.85),
            1.4
          );

          // 1. Vintage Sage & Brass Espresso Machine (left)
          drawRoundedRect(ctx, 18, 14, 52, 34, 7, toRgba(0x638273, 1), toRgba(0x384d42, 1), 1.8);
          drawRoundedRect(ctx, 23, 18, 42, 14, 4, toRgba(0x88a898, 1));
          // Stacked porcelain espresso cups on top warmer tray
          drawCircle(ctx, 32, 25, 4.5, "#FFFDF7", "#6B4E37", 1.1);
          drawCircle(ctx, 43, 25, 4.5, "#FFFDF7", "#6B4E37", 1.1);
          drawCircle(ctx, 54, 25, 4.5, "#F6E3BE", "#6B4E37", 1.1);
          // Brass drip tray & dual portafilters
          drawRoundedRect(ctx, 23, 37, 42, 7, 3, toRgba(0xdca855, 1), toRgba(0x6b4d22, 1), 1.2);
          drawCircle(ctx, 35, 40.5, 2.5, "#4E3728");
          drawCircle(ctx, 53, 40.5, 2.5, "#4E3728");

          // 2. Open Sage's Illustrated Rulebook on Wooden Lectern (center)
          drawRoundedRect(
            ctx,
            w / 2 - 24,
            16,
            48,
            32,
            5,
            toRgba(0x4e946f, 1),
            toRgba(0x2d5942, 1),
            1.6
          );
          drawRoundedRect(ctx, w / 2 - 20, 19, 19, 25, 2, "#FFFBF2", "#D9C7AE", 1);
          drawRoundedRect(ctx, w / 2 + 1, 19, 19, 25, 2, "#FFFBF2", "#D9C7AE", 1);
          drawLine(ctx, w / 2 - 16, 25, w / 2 - 5, 25, "#B09679", 1.2);
          drawLine(ctx, w / 2 - 16, 30, w / 2 - 7, 30, "#B09679", 1.2);
          drawLine(ctx, w / 2 + 5, 25, w / 2 + 16, 25, "#B09679", 1.2);
          drawLine(ctx, w / 2 + 5, 30, w / 2 + 14, 30, "#B09679", 1.2);
          // Red ribbon bookmark
          drawLine(ctx, w / 2, 19, w / 2, 47, "#D66151", 1.8);

          // 3. Crystal Glass Pastry Cloche / Cake Dome with Croissants & Berry Tarts (right)
          const domeX = w - 46;
          const domeY = 32;
          drawCircle(ctx, domeX, domeY, 20, toRgba(0xe6cba0, 1), toRgba(0x8e6642, 1), 1.6);
          // Croissant & pink-frosted berry tarts inside
          drawEllipse(ctx, domeX - 6, domeY + 4, 12, 7, "#E3A152", "#8A5320", 1);
          drawCircle(ctx, domeX + 7, domeY + 2, 5.5, "#F6B8C1", "#9C5562", 1);
          drawCircle(ctx, domeX + 7, domeY + 2, 2.2, "#D44D5C");
          drawCircle(ctx, domeX, domeY - 7, 5.5, "#BCE0B8", "#4D7B4A", 1);
          // Translucent glass cloche dome sheen & glass knob
          drawCircle(ctx, domeX, domeY, 18.5, "rgba(235, 248, 255, 0.28)", "rgba(255,255,255,0.8)", 1.5);
          ctx.beginPath();
          ctx.arc(domeX, domeY, 13, Math.PI * 1.15, Math.PI * 1.55);
          ctx.strokeStyle = "rgba(255,255,255,0.75)";
          ctx.lineWidth = 2;
          ctx.stroke();
          drawCircle(ctx, domeX, domeY, 2.8, "#FFFDF9", "#A8BFC9", 1);
        });
        createSmoothImage(this, key, x - padX, y - padY, s).setOrigin(0, 0).setDepth(depth);

        // Cozy rounded counter plaque tucked cleanly onto the front rim (zero collision with Sage!)
        const signKey = "cafe-sign-cashier";
        renderSmoothPillTexture(this, signKey, s, {
          text: obj.label,
          fontSize: 10,
          fontWeight: "800",
          textColor: "#4F3422",
          bgColor: "rgba(255, 250, 240, 0.96)",
          borderColor: "#C9A882",
          borderWidth: 1.3,
          dotColor: "#5DA679",
          padX: 8,
          padY: 3,
        });
        createSmoothImage(this, signKey, x + w / 2, y + h - 3, s)
          .setOrigin(0.5, 0.5)
          .setDepth(depth + 5);
      } else if (obj.type === "notice_board") {
        // Charming framed Oak & Cork Café Community Board mounted cleanly between Windows 3 & 4
        const padX = 10;
        const topOffset = 26;
        const key = `cafe-interact-notice-v2-${w}x${h}`;
        ensureSmoothTexture(this, key, w + 20, h + 38, s, (ctx) => {
          ctx.translate(padX, topOffset);
          // Soft wall shadow
          drawRoundedRect(ctx, 3, -10, w, h + 12, 10, toRgba(0x3a2a20, 0.16));
          // Warm oak outer picture frame
          drawRoundedRect(ctx, 0, -14, w, h + 14, 10, toRgba(0x9a6d48, 1), toRgba(0x543822, 1), 2.2);
          // Warm recessed cork backing
          drawRoundedRect(ctx, 7, -7, w - 14, h, 5, toRgba(0xd4a674, 1), toRgba(0x7c5433, 0.65), 1.2);
          // Subtle cork texture dots
          ctx.fillStyle = "rgba(122, 82, 46, 0.2)";
          for (let cx = 14; cx < w - 14; cx += 13) {
            for (let cy = -2; cy < h - 10; cy += 10) {
              ctx.fillRect(cx + ((cy * 3) % 5), cy, 1.5, 1.5);
            }
          }

          // Tilted pinned community notes with colorful pushpins & mini lines!
          const notes = [
            { nx: 26, ny: 10, nw: 28, nh: 24, rot: -0.08, fill: "#FFF8D6", pin: "#D65A4F" },
            { nx: 62, ny: 12, nw: 32, nh: 25, rot: 0.05, fill: "#E1F5E7", pin: "#E5A020" },
            { nx: 100, ny: 9, nw: 28, nh: 24, rot: -0.05, fill: "#FCE2E5", pin: "#4E8D68" },
            { nx: 124, ny: 16, nw: 18, nh: 16, rot: 0.1, fill: "#E7F0FA", pin: "#D65A4F" },
          ];
          for (const n of notes) {
            ctx.save();
            ctx.translate(n.nx, n.ny);
            ctx.rotate(n.rot);
            drawRoundedRect(ctx, -n.nw / 2 + 1, -n.nh / 2 + 1.5, n.nw, n.nh, 2.5, "rgba(58,42,32,0.16)");
            drawRoundedRect(ctx, -n.nw / 2, -n.nh / 2, n.nw, n.nh, 2.5, n.fill, "rgba(110,82,58,0.35)", 0.9);
            drawLine(ctx, -n.nw / 2 + 4, -2, n.nw / 2 - 5, -2, "rgba(92,70,54,0.35)", 1.2);
            drawLine(ctx, -n.nw / 2 + 4, 3, n.nw / 2 - 8, 3, "rgba(92,70,54,0.28)", 1.1);
            drawCircle(ctx, 0, -n.nh / 2 + 3.5, 2.4, n.pin, "#4A2E20", 0.8);
            ctx.restore();
          }

          // Cute carved wooden header plaque baked right onto the top frame!
          drawRoundedRect(
            ctx,
            w / 2 - 42,
            -21,
            84,
            15,
            7,
            toRgba(0xfff9ee, 1),
            toRgba(0x7c5638, 1),
            1.4
          );
          ctx.font = '800 8.5px system-ui, -apple-system, sans-serif';
          ctx.fillStyle = "#523724";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("OPEN TABLES", w / 2, -13.5);
        });
        createSmoothImage(this, key, x - padX, y - topOffset, s).setOrigin(0, 0).setDepth(depth);
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

  private ensureGameBoxTexture(slug: string): string {
    const key = `cafe-gamebox-${slug}`;
    ensureSmoothTexture(this, key, 44, 34, this.smoothTexScale, (ctx) => {
      ctx.translate(22, 17);
      const outerColor =
        slug === "velvet-masque"
          ? 0x7a1c34
          : slug === "hearthvale"
            ? 0xd97c5e
            : slug === "sunstone-guild"
              ? 0x2b5096
              : slug === "harborreach"
                ? 0x1e7d74
                : slug === "dawnspire"
                  ? 0x8b3a62
                  : 0xf2c25b;
      const innerColor =
        slug === "velvet-masque"
          ? 0xf4c145
          : slug === "hearthvale"
            ? 0x7db37a
            : slug === "sunstone-guild"
              ? 0xf3c349
              : slug === "harborreach"
                ? 0xf2d17a
                : slug === "dawnspire"
                  ? 0xf4c762
                  : 0x529b76;
      drawRoundedRect(ctx, -15, -10, 30, 20, 4, toRgba(outerColor, 1), toRgba(0x5c3e29, 1), 1.8);
      drawRoundedRect(ctx, -10, -6.5, 20, 13, 2, toRgba(innerColor, 1));
    });
    return key;
  }

  private ensureWoodChairTexture(facing: Direction): string {
    const key = `cafe-chair-wood-${facing}`;
    const s = this.smoothTexScale;
    ensureSmoothTexture(this, key, 48, 48, s, (ctx) => {
      ctx.translate(24, 24);
      // Soft floor contact shadow
      drawCircle(ctx, 0, 2.5, 15.5, toRgba(0x3a2a20, 0.14));

      // Rotate so curved wooden backrest sits cleanly BEHIND the seated guest!
      // facing = direction guest looks toward table; backrest goes on the opposite side.
      const angle =
        facing === "south"
          ? 0 // backrest on top (north)
          : facing === "north"
            ? Math.PI // backrest on bottom (south)
            : facing === "east"
              ? -Math.PI / 2 // backrest on left (west)
              : Math.PI / 2; // backrest on right (east)

      ctx.save();
      ctx.rotate(angle);

      // Cute curved bentwood café chair backrest
      drawRoundedRect(ctx, -14, -17.5, 28, 10, 5, toRgba(0x966745, 1), toRgba(0x543824, 1), 1.8);
      // Round oak seat frame
      drawCircle(ctx, 0, 0, 14.5, toRgba(0xb2815b, 1), toRgba(0x573b27, 1), 2);
      // Plush oat-linen seat cushion + tiny center tuft dimple
      drawCircle(ctx, 0, 0.5, 10.2, toRgba(0xf2e7d5, 1), toRgba(0x7c583c, 0.25), 0.9);
      drawCircle(ctx, 0, 0.5, 1.5, toRgba(0xb89c80, 0.55));
      ctx.restore();
    });
    return key;
  }

  private renderTablePlacard(
    tblId: string,
    maxWidth: number,
    text: string,
    tone: "open" | "join" | "live"
  ): string {
    const sig = `${text}|${tone}|${maxWidth}`;
    const key = `cafe-table-placard-${tblId}`;
    if (this.tableLabelSignatures.get(tblId) === sig && this.textures.exists(key)) {
      return key;
    }
    this.tableLabelSignatures.set(tblId, sig);

    const palette =
      tone === "live"
        ? {
            bg: "rgba(254, 243, 199, 0.96)",
            border: "#D99B36",
            text: "#7C4A03",
            dot: "#E59317",
          }
        : tone === "join"
          ? {
              bg: "rgba(226, 247, 234, 0.96)",
              border: "#68B084",
              text: "#225D3B",
              dot: "#3E9B64",
            }
          : {
              bg: "rgba(255, 249, 238, 0.92)",
              border: "#C9AA84",
              text: "#5A3F2B",
              dot: "#B59472",
            };

    renderSmoothPillTexture(this, key, this.smoothTexScale, {
      text,
      fontSize: 9.2,
      fontWeight: "800",
      textColor: palette.text,
      bgColor: palette.bg,
      borderColor: palette.border,
      borderWidth: 1.2,
      dotColor: palette.dot,
      padX: 6.5,
      padY: 2.6,
      maxWidth,
    });
    return key;
  }

  private drawTablesAndChairs() {
    const T = COZY_CAFE_MAP.tileSize;
    const s = this.smoothTexScale;

    // Pre-bake quilted tatami zabuton floor cushion & availability glows
    const cushionKey = "cafe-chair-cushion-v2";
    ensureSmoothTexture(this, cushionKey, 48, 46, s, (ctx) => {
      ctx.translate(24, 23);
      drawRoundedRect(ctx, -16, -12, 32, 28, 9, toRgba(0x3a2a20, 0.14));
      // Cute cream corner tassels
      for (const [tx, ty] of [
        [-15, -13],
        [15, -13],
        [-15, 13],
        [15, 13],
      ] as const) {
        drawCircle(ctx, tx, ty, 3, toRgba(0xf7ead6, 1), toRgba(0x8e6760, 0.8), 1);
      }
      // Dusty-rose quilted zabuton
      drawRoundedRect(ctx, -16, -14, 32, 28, 9, toRgba(0xe5979b, 1), toRgba(0x6b4543, 1), 2);
      drawRoundedRect(ctx, -11, -9, 22, 18, 6, toRgba(0xf3b3b6, 0.42));
      drawCircle(ctx, 0, 0, 2.2, toRgba(0x9a5e5e, 0.55));
    });

    const chairGlowKey = "cafe-chair-glow";
    ensureSmoothTexture(this, chairGlowKey, 56, 56, s, (ctx) => {
      ctx.translate(28, 28);
      drawCircle(ctx, 0, 0, 21, toRgba(0x65c18c, 0.22), toRgba(0x3f9d68, 0.92), 2.4);
    });

    const cushionGlowKey = "cafe-cushion-glow";
    ensureSmoothTexture(this, cushionGlowKey, 58, 54, s, (ctx) => {
      ctx.translate(29, 27);
      drawRoundedRect(
        ctx,
        -21,
        -19,
        42,
        38,
        14,
        toRgba(0x65c18c, 0.22),
        toRgba(0x3f9d68, 0.92),
        2.4
      );
    });

    const defaultBoxKey = this.ensureGameBoxTexture("treasure-trails");

    for (const tbl of COZY_CAFE_MAP.tables) {
      const tx = tbl.tileX * T;
      const ty = tbl.tileY * T;
      const tw = tbl.tileW * T;
      const th = tbl.tileH * T;
      const isFloor = tbl.category === "floor";
      const isCompact = th <= T;

      // 1. Draw Directional Café Chairs / Quilted Floor Cushions
      for (const seat of tbl.seats) {
        const seatKey = isFloor ? cushionKey : this.ensureWoodChairTexture(seat.facing);
        createSmoothImage(this, seatKey, seat.x, seat.y, s).setDepth(seat.y - 6);

        // Glowing availability ring (visible when player approaches!)
        const glowRing = createSmoothImage(
          this,
          isFloor ? cushionGlowKey : chairGlowKey,
          seat.x,
          seat.y,
          s
        )
          .setDepth(seat.y - 5)
          .setVisible(false);

        const botAvatar = new CafeBotAvatar(this, seat.x, seat.y, {
          displayName: "Café Bot",
          facing: seat.facing,
          variantIndex: seat.seatIndex,
        }).setVisible(false);

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
          botAvatar,
          hitZone,
        });
      }

      // 2. Draw Cozy Candlelit Honey-Oak Tabletop
      const tableDepth = ty + th - 14;
      const woodColor =
        tbl.category === "floor"
          ? 0xd9ad7d
          : tbl.category === "large"
            ? 0xc78f5b
            : 0xd4a16e;

      const padX = 10;
      const padY = 10;
      const tableKey = `cafe-table-v2-${tbl.id}-${tw}x${th}`;
      ensureSmoothTexture(this, tableKey, tw + 24, th + 28, s, (ctx) => {
        ctx.translate(padX, padY);
        // Drop shadow
        drawRoundedRect(ctx, 5, 9, tw, th, 16, toRgba(0x3a2a20, 0.17));
        // Tabletop wood + silky espresso border
        drawRoundedRect(ctx, 0, 0, tw, th, 16, toRgba(woodColor, 1), toRgba(0x634128, 1), 2.5);
        // Subtle horizontal wood plank grain lines
        ctx.strokeStyle = "rgba(107, 71, 43, 0.14)";
        ctx.lineWidth = 1;
        for (let gy = 20; gy < th - 12; gy += 22) {
          ctx.beginPath();
          ctx.moveTo(10, gy);
          ctx.lineTo(tw - 10, gy);
          ctx.stroke();
        }
        // Soft inner inlay bevel highlight
        drawRoundedRect(ctx, 7, 7, tw - 14, th - 14, 11, null, toRgba(0xf9e5ca, 0.62), 1.4);

        // Cute cozy tabletop corner props (candle lantern + ceramic teacup on coaster!)
        // Tucked neatly into corners so the center game box & placard stay 100% crisp & clear
        const lanternX = isCompact ? tw - 14 : tw - 22;
        const lanternY = isCompact ? th / 2 : 22;
        const lanternR = isCompact ? 4.8 : 6;
        drawSoftGlow(ctx, lanternX, lanternY, isCompact ? 16 : 20, "rgba(255, 224, 138, 0.48)", "rgba(255, 224, 138, 0)");
        drawCircle(ctx, lanternX, lanternY, lanternR, "#C99449", "#694821", 1.2);
        drawCircle(ctx, lanternX, lanternY, lanternR * 0.6, "#FFF2B2");
        drawCircle(ctx, lanternX, lanternY, 1.4, "#FFFFFF");

        if (!isCompact) {
          // Cute pastel ceramic mug on cork coaster (top-left corner)
          const mugX = 23;
          const mugY = 23;
          drawCircle(ctx, mugX, mugY, 7.2, "#B98B5E", "#7B5636", 1);
          drawCircle(ctx, mugX, mugY, 5.2, "#FFFBF3", "#6B4A32", 1.1);
          drawCircle(ctx, mugX, mugY, 3.4, isFloor ? "#88B88C" : "#C58D5D");
          drawCircle(ctx, mugX, mugY, 1.1, "#FFF9EE");
        }
      });
      createSmoothImage(this, tableKey, tx - padX, ty - padY, s)
        .setOrigin(0, 0)
        .setDepth(tableDepth);

      // Miniature board game box centerpiece (sits cleanly above the bottom table placard!)
      const boxY = isCompact ? ty + th / 2 : ty + th * 0.42;
      const boxImg = createSmoothImage(this, defaultBoxKey, tbl.x, boxY, s)
        .setDepth(tableDepth + 2)
        .setVisible(false);
      this.tableGameBoxes.set(tbl.id, boxImg);

      // Handcrafted Rounded Parchment Table Placard:
      // Tucked neatly along lower edge of standard/large tables, or cleanly below compact Window Nook!
      const placardMaxW = isCompact ? 116 : tw - 12;
      const placardY = isCompact ? ty + th + 12 : ty + th - 11;
      const placardKey = this.renderTablePlacard(
        tbl.id,
        placardMaxW,
        `${tbl.name} · 0/${tbl.capacity}`,
        "open"
      );
      const placard = createSmoothImage(this, placardKey, tx + tw / 2, placardY, s)
        .setOrigin(0.5, 0.5)
        .setDepth(tableDepth + 4)
        .setInteractive({ useHandCursor: true });

      placard.on("pointerdown", () => {
        const state = this.tableSnapshots.get(tbl.id);
        if (state?.status === "IN_PROGRESS") {
          this.callbacks?.onSpectateTable?.(tbl.id);
        }
      });

      this.tableLabels.set(tbl.id, placard);
    }
  }

  private refreshTableVisuals() {
    const T = COZY_CAFE_MAP.tileSize;
    for (const tblDef of COZY_CAFE_MAP.tables) {
      const state = this.tableSnapshots.get(tblDef.id);
      const placard = this.tableLabels.get(tblDef.id);
      const boxImg = this.tableGameBoxes.get(tblDef.id);

      const occupied = state
        ? state.seats.filter((s) => s.status !== "AVAILABLE").length
        : 0;

      if (placard) {
        const isCompact = tblDef.tileH * T <= T;
        const maxW = isCompact ? 116 : tblDef.tileW * T - 12;
        let text = `${tblDef.name} · 0/${tblDef.capacity}`;
        let tone: "open" | "join" | "live" = "open";

        if (state?.status === "IN_PROGRESS") {
          text = `LIVE · ${tblDef.name} (${occupied}) · Watch`;
          tone = "live";
        } else if (occupied > 0) {
          text = `${tblDef.name} · ${occupied}/${tblDef.capacity} · Join`;
          tone = "join";
        }

        const key = this.renderTablePlacard(tblDef.id, maxW, text, tone);
        placard.setTexture(key).setScale(1 / this.smoothTexScale);
      }

      if (boxImg) {
        if (state?.selectedGameSlug) {
          const boxKey = this.ensureGameBoxTexture(state.selectedGameSlug);
          boxImg.setTexture(boxKey).setVisible(true);
        } else {
          boxImg.setVisible(false);
        }
      }
    }

    // Update Practice Bot chair visuals
    for (const cv of this.chairVisuals) {
      const state = this.tableSnapshots.get(cv.tableId);
      const seat = state?.seats[cv.seatIndex];
      const isBot = Boolean(seat?.isBot);
      cv.botAvatar.setVisible(isBot);
      if (isBot && seat?.occupantName) {
        cv.botAvatar.setDisplayName(seat.occupantName);
      }
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
      "Welcome to Sunlit Oak Café!",
      "Walk up to me for rules & Quick Tours!",
      "Tap any Live table to watch a match!",
      "Sit at any table to pick a game & play!",
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
