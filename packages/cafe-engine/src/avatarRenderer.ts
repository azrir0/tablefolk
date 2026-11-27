import * as Phaser from "phaser";
import {
  DEFAULT_AVATAR_CONFIG,
  EMOTE_LIST,
  type AvatarConfig,
  type Direction,
} from "@tablefolk/shared";
import {
  configureSmoothContext,
  createSmoothImage,
  drawArc,
  drawCircle,
  drawEllipse,
  drawLine,
  drawRoundedRect,
  drawTriangle,
  ensureSmoothTexture,
  getSceneSmoothScale,
  renderSmoothPillTexture,
  renderSmoothTexture,
  toRgba,
} from "./smoothCanvas.js";

function hexToNum(hex: string, fallback = 0x8ab696): number {
  const cleaned = hex.replace("#", "");
  const n = Number.parseInt(cleaned, 16);
  return Number.isFinite(n) ? n : fallback;
}

const OUTLINE = 0x3b2b26;
const OUTLINE_CSS = toRgba(OUTLINE, 1);

const SHADOW_TEX_KEY = "cafe-avatar-shadow";
const SHADOW_WORLD_W = 44;
const SHADOW_WORLD_H = 24;

let nextAvatarAtlasId = 1;

interface AtlasFrameDef {
  name: string;
  fx: number;
  fy: number;
  fw: number;
  fh: number;
  cx: number;
  cy: number;
}

// Compact 5-frame sprite atlas (92 × 80 world units) with 4-unit transparent gutters
// so walking/limb animations run as 1 batched GPU draw call with silky Canvas2D AA curves.
const DOLL_ATLAS_W = 92;
const DOLL_ATLAS_H = 80;
const DOLL_FRAMES = {
  doll: { name: "doll", fx: 0, fy: 0, fw: 48, fh: 80, cx: 0, cy: -35 },
  leftFoot: { name: "leftFoot", fx: 52, fy: 0, fw: 16, fh: 14, cx: -6, cy: -1 },
  rightFoot: { name: "rightFoot", fx: 72, fy: 0, fw: 16, fh: 14, cx: 6, cy: -1 },
  leftArm: { name: "leftArm", fx: 52, fy: 18, fw: 16, fh: 22, cx: -12.5, cy: -22.5 },
  rightArm: { name: "rightArm", fx: 72, fy: 18, fw: 16, fh: 22, cx: 12.5, cy: -22.5 },
} as const satisfies Record<string, AtlasFrameDef>;

function ensureAvatarShadowTexture(scene: Phaser.Scene, scale: number): void {
  ensureSmoothTexture(scene, SHADOW_TEX_KEY, SHADOW_WORLD_W, SHADOW_WORLD_H, scale, (ctx) => {
    drawEllipse(ctx, SHADOW_WORLD_W / 2, SHADOW_WORLD_H / 2, 34, 14, toRgba(0x3a2a20, 0.18));
  });
}

function ensureEmoteTexture(scene: Phaser.Scene, emoteId: string, scale: number): string {
  const key = `cafe-emote-${emoteId}`;
  const size = 38;
  ensureSmoothTexture(scene, key, size, size, scale, (ctx) => {
    ctx.translate(size / 2, size / 2);

    // Soft speech medallion backdrop matching TableFolk's ink & cream aesthetic
    const bgMap: Record<string, number> = {
      wave: 0xfde68a,
      laugh: 0xfde047,
      dance: 0xfbcfe8,
      party: 0xfff3d6,
      cry: 0xbae6fd,
      love: 0xffe4e6,
      wow: 0xfde047,
      cheers: 0xd5f0df,
    };
    drawCircle(ctx, 0, 0, 14, toRgba(bgMap[emoteId] ?? 0xfff8ec, 1), OUTLINE_CSS, 2);

    if (emoteId === "love") {
      const heart = toRgba(0xe05a4e, 1);
      drawCircle(ctx, -3.6, -2, 4.2, heart);
      drawCircle(ctx, 3.6, -2, 4.2, heart);
      drawTriangle(ctx, -7.6, -0.5, 7.6, -0.5, 0, 7.5, heart);
    } else if (emoteId === "laugh") {
      drawArc(ctx, -4.5, -2.5, 2.5, Math.PI, Math.PI * 2, OUTLINE_CSS, 2);
      drawArc(ctx, 4.5, -2.5, 2.5, Math.PI, Math.PI * 2, OUTLINE_CSS, 2);
      drawRoundedRect(ctx, -5.5, 1.5, 11, 5.5, 3, toRgba(0xd9594c, 1), OUTLINE_CSS, 1.8);
    } else if (emoteId === "cry") {
      drawCircle(ctx, -4.5, -2.5, 1.8, OUTLINE_CSS);
      drawCircle(ctx, 4.5, -2.5, 1.8, OUTLINE_CSS);
      drawArc(ctx, 0, 6, 3.8, Math.PI + 0.3, Math.PI * 2 - 0.3, OUTLINE_CSS, 2);
      drawCircle(ctx, 6, 3, 2.5, toRgba(0x3b82f6, 1));
    } else if (emoteId === "wow") {
      drawCircle(ctx, -4.5, -3, 1.9, OUTLINE_CSS);
      drawCircle(ctx, 4.5, -3, 1.9, OUTLINE_CSS);
      drawEllipse(ctx, 0, 4, 6, 7.5, toRgba(0x7a4e33, 1), OUTLINE_CSS, 1.6);
    } else if (emoteId === "dance") {
      drawLine(ctx, -3, 5, -3, -5, OUTLINE_CSS, 2.2);
      drawLine(ctx, -3, -5, 5, -7, OUTLINE_CSS, 2.2);
      drawLine(ctx, 5, -7, 5, 3, OUTLINE_CSS, 2.2);
      drawCircle(ctx, -5, 5, 2.8, toRgba(0xbe185d, 1));
      drawCircle(ctx, 3, 3, 2.8, toRgba(0xbe185d, 1));
    } else if (emoteId === "party") {
      drawTriangle(ctx, -6, 7, -1, -5, 6, 2, toRgba(0xf4c145, 1), OUTLINE_CSS, 1.6);
      drawCircle(ctx, 4, -6, 2.2, toRgba(0x529b76, 1));
      drawCircle(ctx, 8, -1, 1.8, toRgba(0xd9594c, 1));
    } else if (emoteId === "cheers") {
      drawRoundedRect(ctx, -5, -3, 10, 9, 2.5, toRgba(0xf4c145, 1), OUTLINE_CSS, 1.6);
      const spark = toRgba(0xd97706, 1);
      drawLine(ctx, 0, -8, 0, -5, spark, 1.8);
      drawLine(ctx, -6, -6, -4, -4, spark, 1.8);
      drawLine(ctx, 6, -6, 4, -4, spark, 1.8);
    } else {
      // Friendly wave / star sparkle
      drawRoundedRect(ctx, -5.5, -5.5, 11, 12, 4.5, toRgba(0xfff8ec, 1), OUTLINE_CSS, 1.8);
      const spark = toRgba(0xd97706, 1);
      drawLine(ctx, -9, -4, -7, -7, spark, 1.8);
      drawLine(ctx, 7, -7, 9, -4, spark, 1.8);
    }
  });
  return key;
}

export interface AvatarRenderState {
  displayName: string;
  config: AvatarConfig;
  facing: Direction;
  isMoving: boolean;
  isSeated: boolean;
  carryingGameSlug: string;
  inGame: boolean;
  isLocal: boolean;
}

/**
 * High-FPS Procedural 2D Paper-Doll Avatar backed by a supersampled Canvas2D sprite atlas.
 * Splits limbs (left/right shoes & arms) into transform-animated Image nodes sharing one
 * CanvasTexture so outlines render with silky sub-pixel anti-aliasing & rounded joins
 * at a locked 60–144 FPS with ZERO geometry rebuilds per frame.
 */
export class PaperDollAvatar {
  public readonly root: Phaser.GameObjects.Container;
  private readonly bodyContainer: Phaser.GameObjects.Container;
  private readonly shadowImg: Phaser.GameObjects.Image;
  private readonly leftFootImg: Phaser.GameObjects.Image;
  private readonly rightFootImg: Phaser.GameObjects.Image;
  private readonly leftArmImg: Phaser.GameObjects.Image;
  private readonly rightArmImg: Phaser.GameObjects.Image;
  private readonly dollImg: Phaser.GameObjects.Image;
  private readonly nameTagImg: Phaser.GameObjects.Image;
  private readonly statusBadgeImg: Phaser.GameObjects.Image;
  private readonly speechContainer: Phaser.GameObjects.Container;
  private readonly speechBgImg: Phaser.GameObjects.Image;
  private readonly speechLabel: Phaser.GameObjects.Text;
  private readonly emoteImg: Phaser.GameObjects.Image;

  private readonly texScale: number;
  private readonly atlasKey: string;
  private readonly nameTagKey: string;
  private readonly statusBadgeKey: string;
  private readonly atlasTex: Phaser.Textures.CanvasTexture;
  private speechKey: string | null = null;

  private state: AvatarRenderState;
  private animPhase = Math.random() * Math.PI * 2;
  private walkBlend = 0; // Smooth 0..1 blend between idle and walk cycle
  private blinkTimer = 2 + Math.random() * 3;
  private isBlinking = false;
  private speechHideAt = 0;
  private emoteHideAt = 0;

  private configSignature = "";
  private lastDrawSignature = "";
  private lastDisplayName = "";
  private lastIsLocal = false;
  private lastBadgeText = "";

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    initial: AvatarRenderState
  ) {
    this.state = { ...initial };
    this.configSignature = JSON.stringify(initial.config ?? DEFAULT_AVATAR_CONFIG);
    this.lastDisplayName = initial.displayName;
    this.lastIsLocal = initial.isLocal;
    this.texScale = getSceneSmoothScale(scene);

    const instanceId = nextAvatarAtlasId++;
    this.atlasKey = `paper-doll-atlas-${instanceId}`;
    this.nameTagKey = `paper-doll-name-${instanceId}`;
    this.statusBadgeKey = `paper-doll-status-${instanceId}`;
    this.atlasTex = this.createAtlasTexture();

    this.root = scene.add.container(x, y);

    ensureAvatarShadowTexture(scene, this.texScale);
    this.shadowImg = createSmoothImage(scene, SHADOW_TEX_KEY, 0, 4, this.texScale);
    this.root.add(this.shadowImg);

    this.bodyContainer = scene.add.container(0, 0);
    this.leftFootImg = createSmoothImage(
      scene,
      this.atlasKey,
      DOLL_FRAMES.leftFoot.cx,
      DOLL_FRAMES.leftFoot.cy,
      this.texScale,
      DOLL_FRAMES.leftFoot.name
    );
    this.rightFootImg = createSmoothImage(
      scene,
      this.atlasKey,
      DOLL_FRAMES.rightFoot.cx,
      DOLL_FRAMES.rightFoot.cy,
      this.texScale,
      DOLL_FRAMES.rightFoot.name
    );
    this.leftArmImg = createSmoothImage(
      scene,
      this.atlasKey,
      DOLL_FRAMES.leftArm.cx,
      DOLL_FRAMES.leftArm.cy,
      this.texScale,
      DOLL_FRAMES.leftArm.name
    );
    this.rightArmImg = createSmoothImage(
      scene,
      this.atlasKey,
      DOLL_FRAMES.rightArm.cx,
      DOLL_FRAMES.rightArm.cy,
      this.texScale,
      DOLL_FRAMES.rightArm.name
    );
    this.dollImg = createSmoothImage(
      scene,
      this.atlasKey,
      DOLL_FRAMES.doll.cx,
      DOLL_FRAMES.doll.cy,
      this.texScale,
      DOLL_FRAMES.doll.name
    );

    // Layer order: shoes -> arms -> torso/head/hair/accessories
    this.bodyContainer.add([
      this.leftFootImg,
      this.rightFootImg,
      this.leftArmImg,
      this.rightArmImg,
      this.dollImg,
    ]);
    this.root.add(this.bodyContainer);

    // Crisp overhead rounded-pill nameplate floating cleanly above the character's head
    this.renderNameTagTexture(initial.displayName, initial.isLocal);
    this.nameTagImg = createSmoothImage(scene, this.nameTagKey, 0, -72, this.texScale).setOrigin(
      0.5,
      1
    );
    this.root.add(this.nameTagImg);

    // Floating rounded status badge above the overhead nameplate
    this.statusBadgeImg = scene.add
      .image(0, -94, SHADOW_TEX_KEY)
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.root.add(this.statusBadgeImg);

    // Overhead speech bubble above the nameplate
    this.speechContainer = scene.add.container(0, -96).setVisible(false);
    this.speechBgImg = scene.add.image(0, 4, SHADOW_TEX_KEY).setOrigin(0.5, 1).setVisible(false);
    this.speechLabel = scene.add
      .text(0, -10, "", {
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: "11px",
        color: "#3B2B26",
        wordWrap: { width: 150 },
        align: "center",
      })
      .setOrigin(0.5, 1);
    this.speechContainer.add([this.speechBgImg, this.speechLabel]);
    this.root.add(this.speechContainer);

    // Floating custom-drawn vector emote medallion
    const defaultEmoteKey = ensureEmoteTexture(scene, "wave", this.texScale);
    this.emoteImg = createSmoothImage(scene, defaultEmoteKey, 0, -102, this.texScale).setVisible(
      false
    );
    this.root.add(this.emoteImg);

    this.redrawStaticParts();
    this.syncBadges();
  }

  private renderNameTagTexture(displayName: string, isLocal: boolean) {
    renderSmoothPillTexture(this.scene, this.nameTagKey, this.texScale, {
      text: displayName || "Guest",
      fontSize: 10.5,
      fontWeight: isLocal ? "800" : "700",
      textColor: isLocal ? "#245437" : "#44322A",
      bgColor: isLocal ? "rgba(235, 249, 239, 0.96)" : "rgba(255, 250, 242, 0.94)",
      borderColor: isLocal ? "#88BA97" : "#DCC6AD",
      borderWidth: 1.25,
      dotColor: isLocal ? "#4DA36D" : undefined,
      padX: 7,
      padY: 3,
      maxWidth: 132,
    });
  }

  private createAtlasTexture(): Phaser.Textures.CanvasTexture {
    const s = this.texScale;
    const tex = this.scene.textures.createCanvas(
      this.atlasKey,
      Math.ceil(DOLL_ATLAS_W * s),
      Math.ceil(DOLL_ATLAS_H * s)
    );
    if (!tex) {
      throw new Error(`Failed to allocate avatar atlas "${this.atlasKey}"`);
    }
    for (const def of Object.values(DOLL_FRAMES)) {
      tex.add(def.name, 0, def.fx * s, def.fy * s, def.fw * s, def.fh * s);
    }
    return tex;
  }

  public updateState(partial: Partial<AvatarRenderState>) {
    if (partial.config && partial.config !== this.state.config) {
      const nextCfgSig = JSON.stringify(partial.config);
      if (nextCfgSig !== this.configSignature) {
        this.configSignature = nextCfgSig;
      }
    }

    this.state = { ...this.state, ...partial };

    let refreshName = false;
    if (this.state.displayName !== this.lastDisplayName) {
      this.lastDisplayName = this.state.displayName;
      refreshName = true;
    }

    if (this.state.isLocal !== this.lastIsLocal) {
      this.lastIsLocal = this.state.isLocal;
      refreshName = true;
    }

    if (refreshName) {
      this.renderNameTagTexture(this.state.displayName, this.state.isLocal);
      this.nameTagImg.setTexture(this.nameTagKey).setScale(1 / this.texScale);
    }

    this.syncBadges();
  }

  public showSpeech(text: string) {
    if (!text) return;
    this.speechLabel.setText(text);
    const w = Math.min(Math.max(this.speechLabel.width + 18, 44), 170);
    const h = this.speechLabel.height + 12;

    if (!this.speechKey) {
      this.speechKey = `${this.atlasKey}-speech`;
    }
    const padX = 5;
    const padTop = 4;
    const tailH = 7;
    const padBottom = 3;
    const canvasW = Math.ceil(w + padX * 2);
    const canvasH = Math.ceil(h + padTop + tailH + padBottom);
    const s = this.texScale;

    renderSmoothTexture(this.scene, this.speechKey, canvasW, canvasH, s, (ctx) => {
      const bx = padX;
      const by = padTop;
      const bw = w;
      const bh = h;
      const r = Math.min(10, bw / 2, bh / 2);
      const midX = bx + bw / 2;
      const bottomY = by + bh;

      // Single unified rounded speech bubble + pointer tail path for a seamless border
      ctx.beginPath();
      ctx.moveTo(bx + r, by);
      ctx.arcTo(bx + bw, by, bx + bw, bottomY, r);
      ctx.arcTo(bx + bw, bottomY, midX + 5, bottomY, r);
      ctx.lineTo(midX + 5, bottomY);
      ctx.lineTo(midX, bottomY + tailH);
      ctx.lineTo(midX - 5, bottomY);
      ctx.arcTo(bx, bottomY, bx, by, r);
      ctx.arcTo(bx, by, bx + bw, by, r);
      ctx.closePath();

      ctx.fillStyle = toRgba(0xfffcf6, 0.97);
      ctx.fill();
      ctx.strokeStyle = toRgba(0xd9c3ac, 1);
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    this.speechBgImg
      .setTexture(this.speechKey)
      .setScale(1 / s)
      .setPosition(0, 4)
      .setOrigin(0.5, 1)
      .setVisible(true);
    this.speechContainer.setVisible(true);
    this.speechHideAt = this.scene.time.now + 5500;
  }

  public triggerEmote(emoteId: string) {
    const found = EMOTE_LIST.find((e) => e.id === emoteId);
    if (!found) return;
    const key = ensureEmoteTexture(this.scene, found.id, this.texScale);
    this.emoteImg
      .setTexture(key)
      .setVisible(true)
      .setY(-96)
      .setScale(0.55 / this.texScale);
    this.emoteHideAt = this.scene.time.now + 2600;
    this.scene.tweens.add({
      targets: this.emoteImg,
      y: -112,
      scale: 1.08 / this.texScale,
      duration: 320,
      ease: "Back.easeOut",
    });
    this.scene.tweens.add({
      targets: this.bodyContainer,
      y: -10,
      duration: 160,
      yoyo: true,
      repeat: 1,
      ease: "Sine.easeInOut",
    });
  }

  public tick(dtSec: number) {
    const now = this.scene.time.now;

    // Smooth blend into/out of walk animation so starting & stopping feels silky
    const targetBlend = this.state.isMoving && !this.state.isSeated ? 1 : 0;
    const blendAlpha = 1 - Math.exp(-14 * dtSec);
    this.walkBlend += (targetBlend - this.walkBlend) * blendAlpha;

    const phaseSpeed = 2.6 + this.walkBlend * 9.2;
    this.animPhase += dtSec * phaseSpeed;

    // Periodic natural blink
    this.blinkTimer -= dtSec;
    if (this.blinkTimer <= 0) {
      if (this.isBlinking) {
        this.isBlinking = false;
        this.blinkTimer = 2.6 + Math.random() * 3.4;
      } else {
        this.isBlinking = true;
        this.blinkTimer = 0.13;
      }
    }

    if (this.speechContainer.visible && now >= this.speechHideAt) {
      this.speechContainer.setVisible(false);
    }
    if (this.emoteImg.visible && now >= this.emoteHideAt) {
      this.emoteImg.setVisible(false);
    }

    // Pure GPU transform animations (zero texture redraws while walking!)
    const strideSin = Math.sin(this.animPhase);
    const invScale = 1 / this.texScale;
    if (this.state.isSeated) {
      this.bodyContainer.y = 4;
      this.bodyContainer.rotation = 0;
      this.bodyContainer.scaleY = 1 + strideSin * 0.015;
      this.shadowImg.setScale(invScale, invScale);
      this.leftFootImg.y = DOLL_FRAMES.leftFoot.cy - 1;
      this.rightFootImg.y = DOLL_FRAMES.rightFoot.cy - 1;
      this.leftArmImg.y = DOLL_FRAMES.leftArm.cy;
      this.rightArmImg.y = DOLL_FRAMES.rightArm.cy;
    } else {
      const bounce = Math.abs(strideSin) * 4.5 * this.walkBlend;
      const idleBreath = strideSin * 0.018 * (1 - this.walkBlend);
      this.bodyContainer.y = -bounce;
      this.bodyContainer.rotation = strideSin * 0.055 * this.walkBlend;
      this.bodyContainer.scaleY = 1 + idleBreath;

      // Subtle ground shadow squash during bounce
      const shadowScale = (1 - bounce * 0.025) * invScale;
      this.shadowImg.setScale(shadowScale, shadowScale);

      // Smooth continuous foot & arm swing
      const footSwing = strideSin * 3.6 * this.walkBlend;
      this.leftFootImg.y = DOLL_FRAMES.leftFoot.cy + footSwing;
      this.rightFootImg.y = DOLL_FRAMES.rightFoot.cy - footSwing;

      if (this.state.carryingGameSlug) {
        this.leftArmImg.y = DOLL_FRAMES.leftArm.cy;
        this.rightArmImg.y = DOLL_FRAMES.rightArm.cy;
      } else {
        const armSwing = strideSin * 2.2 * this.walkBlend;
        this.leftArmImg.y = DOLL_FRAMES.leftArm.cy - armSwing;
        this.rightArmImg.y = DOLL_FRAMES.rightArm.cy + armSwing;
      }
    }

    // Horizontal flip for west vs east side view
    this.bodyContainer.scaleX = this.state.facing === "west" ? -1 : 1;

    // Only redraw vector atlas when facing, blink, outfit, or carry state changes
    this.redrawStaticParts();

    this.root.setDepth(this.root.y);
  }

  private syncBadges() {
    const nextText = this.state.inGame
      ? "Playing"
      : this.state.carryingGameSlug
        ? "Carrying Game"
        : "";
    if (nextText === this.lastBadgeText) return;
    this.lastBadgeText = nextText;
    if (nextText) {
      renderSmoothPillTexture(this.scene, this.statusBadgeKey, this.texScale, {
        text: nextText,
        fontSize: 9.5,
        fontWeight: "800",
        textColor: "#754719",
        bgColor: "rgba(255, 243, 214, 0.96)",
        borderColor: "#E4B867",
        borderWidth: 1.2,
        dotColor: "#E5A020",
        padX: 6.5,
        padY: 2.5,
      });
      this.statusBadgeImg
        .setTexture(this.statusBadgeKey)
        .setScale(1 / this.texScale)
        .setVisible(true);
    } else {
      this.statusBadgeImg.setVisible(false);
    }
  }

  private drawIntoFrame(
    ctx: CanvasRenderingContext2D,
    frame: AtlasFrameDef,
    drawFn: () => void
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(frame.fx, frame.fy, frame.fw, frame.fh);
    ctx.clip();
    ctx.translate(frame.fx + frame.fw / 2 - frame.cx, frame.fy + frame.fh / 2 - frame.cy);
    drawFn();
    ctx.restore();
  }

  private redrawStaticParts() {
    const cfg = this.state.config || DEFAULT_AVATAR_CONFIG;
    const isBack = this.state.facing === "north";
    const isSide = this.state.facing === "east" || this.state.facing === "west";

    const sig = `${this.configSignature}|${isBack}|${isSide}|${this.isBlinking}|${this.state.carryingGameSlug}`;
    if (sig === this.lastDrawSignature) return;
    this.lastDrawSignature = sig;

    const skin = toRgba(hexToNum(cfg.skinTone, 0xf6c9a6), 1);
    const hair = toRgba(hexToNum(cfg.hairColor, 0x4a312c), 1);
    const top = toRgba(hexToNum(cfg.topColor, 0x8ab696), 1);
    const accent = toRgba(hexToNum(cfg.topAccent, 0xf7f1e5), 1);
    const accent90 = toRgba(hexToNum(cfg.topAccent, 0xf7f1e5), 0.9);
    const bottom = toRgba(hexToNum(cfg.bottomColor, 0x6b8eb8), 1);
    const shoe = toRgba(hexToNum(cfg.shoeColor, 0x44414b), 1);

    const s = this.texScale;
    const ctx = this.atlasTex.getContext();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.atlasTex.width, this.atlasTex.height);
    ctx.scale(s, s);
    configureSmoothContext(ctx);

    // 1. Separate Shoes
    this.drawIntoFrame(ctx, DOLL_FRAMES.leftFoot, () => {
      drawRoundedRect(ctx, -10, -4, 8, 6, 3, shoe, OUTLINE_CSS, 1.8);
    });
    this.drawIntoFrame(ctx, DOLL_FRAMES.rightFoot, () => {
      drawRoundedRect(ctx, 2, -4, 8, 6, 3, shoe, OUTLINE_CSS, 1.8);
    });

    // 2. Separate Arms
    this.drawIntoFrame(ctx, DOLL_FRAMES.leftArm, () => {
      if (this.state.carryingGameSlug) {
        drawRoundedRect(ctx, -16, -28, 7, 11, 3, top, OUTLINE_CSS, 1.8);
      } else {
        drawRoundedRect(ctx, -16, -29, 6, 13, 3, top, OUTLINE_CSS, 1.8);
      }
    });
    this.drawIntoFrame(ctx, DOLL_FRAMES.rightArm, () => {
      if (this.state.carryingGameSlug) {
        drawRoundedRect(ctx, 9, -28, 7, 11, 3, top, OUTLINE_CSS, 1.8);
      } else {
        drawRoundedRect(ctx, 10, -29, 6, 13, 3, top, OUTLINE_CSS, 1.8);
      }
    });

    // 3. Main Torso + Head + Hair + Accessories
    this.drawIntoFrame(ctx, DOLL_FRAMES.doll, () => {
      // Bottoms
      if (cfg.bottomStyle === "skirt") {
        drawTriangle(ctx, -12, -4, 12, -4, 0, -19, bottom);
        drawRoundedRect(ctx, -11, -13, 22, 9, 4, bottom, OUTLINE_CSS, 1.8);
      } else if (cfg.bottomStyle === "shorts") {
        drawRoundedRect(ctx, -10, -14, 20, 8, 3, bottom, OUTLINE_CSS, 1.8);
      } else {
        drawRoundedRect(ctx, -10, -15, 9, 12, 3, bottom, OUTLINE_CSS, 1.8);
        drawRoundedRect(ctx, 1, -15, 9, 12, 3, bottom, OUTLINE_CSS, 1.8);
      }

      // Torso / Top
      drawRoundedRect(ctx, -13, -31, 26, 20, 8, top, OUTLINE_CSS, 2);

      if (cfg.topStyle === "cardigan") {
        drawRoundedRect(ctx, -4, -30, 8, 18, 2, accent);
      } else if (cfg.topStyle === "hoodie") {
        drawRoundedRect(ctx, -7, -18, 14, 6, 3, accent90);
      } else if (cfg.topStyle === "apron") {
        drawRoundedRect(ctx, -8, -26, 16, 16, 3, accent, toRgba(OUTLINE, 0.8), 1.4);
      } else if (cfg.topStyle === "sweater") {
        drawRoundedRect(ctx, -7, -31, 14, 4, 2, accent90);
      }

      // Scarf accessory
      if (cfg.accessory === "scarf") {
        drawRoundedRect(ctx, -11, -33, 22, 6, 3, accent, OUTLINE_CSS, 1.6);
        drawRoundedRect(ctx, 3, -29, 5, 9, 2, accent);
      }

      // Back Hair
      if (!isBack && (cfg.hairStyle === "wavy" || cfg.hairStyle === "bob")) {
        drawRoundedRect(ctx, -17, -48, 34, 22, 10, hair, OUTLINE_CSS, 2);
      }

      // Head
      drawCircle(ctx, 0, -43, 14.5, skin, OUTLINE_CSS, 2);

      // Face
      if (!isBack) {
        const eyeOffsetX = isSide ? 4 : 0;
        const blush = toRgba(0xf29ca3, 0.45);
        drawEllipse(ctx, -7 + eyeOffsetX, -39, 5, 3, blush);
        drawEllipse(ctx, 7 + eyeOffsetX, -39, 5, 3, blush);

        if (this.isBlinking) {
          drawLine(ctx, -7 + eyeOffsetX, -42, -3 + eyeOffsetX, -42, OUTLINE_CSS, 1.8);
          drawLine(ctx, 3 + eyeOffsetX, -42, 7 + eyeOffsetX, -42, OUTLINE_CSS, 1.8);
        } else {
          drawCircle(ctx, -5 + eyeOffsetX, -42, 2.2, OUTLINE_CSS);
          drawCircle(ctx, 5 + eyeOffsetX, -42, 2.2, OUTLINE_CSS);
          drawCircle(ctx, -5.7 + eyeOffsetX, -42.8, 0.85, "#ffffff");
          drawCircle(ctx, 4.3 + eyeOffsetX, -42.8, 0.85, "#ffffff");
        }

        drawArc(ctx, eyeOffsetX, -38.5, 3.2, 0.15, Math.PI - 0.15, OUTLINE_CSS, 1.6);
      }

      // Hair Crown
      if (isBack) {
        drawCircle(ctx, 0, -45, 15.2, hair, OUTLINE_CSS, 2);
        if (cfg.hairStyle === "ponytail") {
          drawRoundedRect(ctx, -5, -43, 10, 15, 5, hair, OUTLINE_CSS, 2);
        } else if (cfg.hairStyle === "bun") {
          drawCircle(ctx, 0, -61, 6.5, hair, OUTLINE_CSS, 2);
        }
      } else if (cfg.hairStyle === "beanie") {
        drawRoundedRect(ctx, -15, -60, 30, 14, 8, accent, OUTLINE_CSS, 2);
        drawCircle(ctx, 0, -62, 4.5, accent, OUTLINE_CSS, 2);
      } else if (cfg.hairStyle === "curly") {
        const puffs = [
          [-12, -52, 6.5],
          [-5, -57, 7],
          [4, -57, 7],
          [12, -52, 6.5],
          [0, -54, 6],
        ] as const;
        for (const [px, py, pr] of puffs) {
          drawCircle(ctx, px, py, pr, hair, OUTLINE_CSS, 2);
        }
      } else if (cfg.hairStyle === "spiky") {
        drawRoundedRect(ctx, -15, -58, 30, 13, 6, hair, OUTLINE_CSS, 2);
        drawTriangle(ctx, -9, -57, -4, -65, 1, -57, hair);
        drawTriangle(ctx, 0, -57, 6, -64, 10, -57, hair);
      } else {
        ctx.beginPath();
        ctx.arc(0, -45, 15, Math.PI, Math.PI * 2, false);
        ctx.lineTo(15, -44);
        ctx.lineTo(6, -48);
        ctx.lineTo(-2, -44);
        ctx.lineTo(-15, -45);
        ctx.closePath();
        ctx.fillStyle = hair;
        ctx.fill();
        ctx.strokeStyle = OUTLINE_CSS;
        ctx.lineWidth = 2;
        ctx.stroke();

        if (cfg.hairStyle === "bun") {
          drawCircle(ctx, 0, -61, 6.5, hair, OUTLINE_CSS, 2);
        } else if (cfg.hairStyle === "ponytail") {
          drawCircle(ctx, isSide ? -14 : 12, -52, 6, hair, OUTLINE_CSS, 2);
        }
      }

      // Head Accessories
      if (cfg.accessory === "glasses" && !isBack) {
        const gx = isSide ? 4 : 0;
        const rim = toRgba(0x3a2d28, 1);
        drawCircle(ctx, -5 + gx, -42, 4.4, null, rim, 1.8);
        drawCircle(ctx, 5 + gx, -42, 4.4, null, rim, 1.8);
        drawLine(ctx, -0.6 + gx, -42, 0.6 + gx, -42, rim, 1.8);
      } else if (cfg.accessory === "headphones") {
        drawArc(ctx, 0, -46, 16.5, Math.PI, Math.PI * 2, toRgba(0x5c4b51, 1), 3);
        const pad = toRgba(0xe5808a, 1);
        drawRoundedRect(ctx, -18, -48, 5, 10, 2.5, pad, OUTLINE_CSS, 1.6);
        drawRoundedRect(ctx, 13, -48, 5, 10, 2.5, pad, OUTLINE_CSS, 1.6);
      } else if (cfg.accessory === "beret") {
        drawEllipse(ctx, 2, -58, 26, 11, toRgba(0xc86b85, 1), OUTLINE_CSS, 1.8);
      } else if (cfg.accessory === "star_pin" && !isBack) {
        drawCircle(ctx, 9, -51, 3.6, toRgba(0xf6c945, 1), OUTLINE_CSS, 1.2);
      }

      // Carried Board Game Box
      if (this.state.carryingGameSlug && !isBack) {
        drawRoundedRect(ctx, -11, -24, 22, 14, 3, toRgba(0xf2c25b, 1), OUTLINE_CSS, 1.8);
        drawRoundedRect(ctx, -7, -21, 14, 8, 2, toRgba(0x529b76, 1));
      }
    });

    ctx.restore();
    this.atlasTex.refresh();
  }

  public destroy() {
    this.root.destroy(true);
    for (const key of [this.atlasKey, this.nameTagKey, this.statusBadgeKey, this.speechKey]) {
      if (key && this.scene?.textures?.exists(key)) {
        this.scene.textures.remove(key);
      }
    }
  }
}

export interface CafeBotRenderOptions {
  displayName: string;
  facing: Direction;
  variantIndex: number;
}

const BOT_PALETTES = [
  { chassis: 0xf4e8d2, shade: 0xe3d1b3, apron: 0xe5a94e, visorEye: 0xa8e6cf, bulb: 0xf6c945 },
  { chassis: 0xf1ebde, shade: 0xdfd5c2, apron: 0x8ab696, visorEye: 0xfde68a, bulb: 0xf6c945 },
  { chassis: 0xf5e9dc, shade: 0xe4d1be, apron: 0xd98a73, visorEye: 0xa8e6cf, bulb: 0xf6c945 },
  { chassis: 0xeeeae3, shade: 0xdcd5ca, apron: 0x7d9fc4, visorEye: 0xfde68a, bulb: 0xf6c945 },
] as const;

const BOT_TEX_W = 46;
const BOT_TEX_H = 82;
const BOT_WORLD_ORIGIN_X = 23;
const BOT_WORLD_ORIGIN_Y = 75;
const BOT_CENTER_OFFSET_Y = BOT_TEX_H / 2 - BOT_WORLD_ORIGIN_Y; // -34

function ensureBotTexture(
  scene: Phaser.Scene,
  variantIndex: number,
  isBack: boolean,
  isSide: boolean,
  isBlinking: boolean,
  scale: number
): string {
  const paletteIdx = variantIndex % BOT_PALETTES.length;
  const pose = isBack ? "b" : isSide ? "s" : "f";
  const key = `cafe-bot-${paletteIdx}-${pose}-${isBlinking ? 1 : 0}`;

  ensureSmoothTexture(scene, key, BOT_TEX_W, BOT_TEX_H, scale, (ctx) => {
    const palette = BOT_PALETTES[paletteIdx]!;
    const chassis = toRgba(palette.chassis, 1);
    const shade = toRgba(palette.shade, 1);
    const apron = toRgba(palette.apron, 1);
    const visorEye = toRgba(palette.visorEye, 1);
    const bulb = toRgba(palette.bulb, 1);

    ctx.translate(BOT_WORLD_ORIGIN_X, BOT_WORLD_ORIGIN_Y);

    // 1. Seated bronze boots (matches PaperDollAvatar shoe coordinates)
    const boots = toRgba(0x6b5344, 1);
    drawRoundedRect(ctx, -10, -5, 8, 6, 3, boots, OUTLINE_CSS, 1.8);
    drawRoundedRect(ctx, 2, -5, 8, 6, 3, boots, OUTLINE_CSS, 1.8);

    // 2. Porcelain arms with warm brass wrist cuffs
    drawRoundedRect(ctx, -16, -29, 6, 13, 3, chassis, OUTLINE_CSS, 1.8);
    drawRoundedRect(ctx, 10, -29, 6, 13, 3, chassis, OUTLINE_CSS, 1.8);
    const brass = toRgba(0xdba34d, 1);
    drawRoundedRect(ctx, -15.5, -20.5, 5, 3, 1.2, brass);
    drawRoundedRect(ctx, 10.5, -20.5, 5, 3, 1.2, brass);

    // 3. Lower chassis base
    drawRoundedRect(ctx, -10, -15, 20, 11, 4, toRgba(0x8a796c, 1), OUTLINE_CSS, 1.8);

    // 4. Rounded porcelain torso + café apron (or brass wind-up key on back)
    drawRoundedRect(ctx, -13, -31, 26, 20, 8, chassis, OUTLINE_CSS, 2);

    if (!isBack) {
      drawRoundedRect(ctx, -8, -26, 16, 15, 3, apron, toRgba(OUTLINE, 0.9), 1.4);
      // Brass café crest button
      drawCircle(ctx, 0, -20.5, 2.8, toRgba(0xf6c945, 1), OUTLINE_CSS, 1.2);
    } else {
      drawRoundedRect(ctx, -8, -26, 16, 11, 3, apron, toRgba(OUTLINE, 0.85), 1.4);
      // Cute brass wind-up key on back
      const gold = toRgba(0xf6c945, 1);
      drawCircle(ctx, -3.4, -20.5, 2.6, gold, OUTLINE_CSS, 1.4);
      drawCircle(ctx, 3.4, -20.5, 2.6, gold, OUTLINE_CSS, 1.4);
      drawCircle(ctx, 0, -20.5, 1.7, gold, OUTLINE_CSS, 1.4);
    }

    // 5. Top brass antenna + glowing amber lantern bulb
    drawLine(ctx, 0, -55, 0, -63, OUTLINE_CSS, 2.2);
    drawCircle(ctx, 0, -64.5, 3.6, bulb, OUTLINE_CSS, 1.6);
    drawCircle(ctx, -1, -65.5, 1.1, toRgba(0xfffdf5, 0.95));

    // 6. Side brass ear-caps
    drawRoundedRect(ctx, -17.5, -47, 4.5, 8.5, 2, brass, OUTLINE_CSS, 1.6);
    drawRoundedRect(ctx, 13, -47, 4.5, 8.5, 2, brass, OUTLINE_CSS, 1.6);

    // 7. Rounded chibi porcelain head
    drawRoundedRect(ctx, -15, -56, 30, 26, 11, chassis, OUTLINE_CSS, 2);

    // Soft pastel top trim
    drawRoundedRect(ctx, -9, -54, 18, 3.5, 1.8, toRgba(palette.apron, 0.85));

    // 8. Face visor or rear vent plate
    if (!isBack) {
      const fx = isSide ? 2.5 : 0;

      // Dark warm espresso glass visor
      drawRoundedRect(ctx, -11 + fx, -48.5, 22, 13.5, 5.5, toRgba(0x362825, 1), OUTLINE_CSS, 1.6);

      // Subtle glass sheen
      drawRoundedRect(ctx, -8.5 + fx, -47, 8, 2.2, 1, toRgba(0xffffff, 0.14));

      // Expressive glowing eyes
      if (isBlinking) {
        drawLine(ctx, -6.8 + fx, -43, -2.5 + fx, -43, visorEye, 1.8);
        drawLine(ctx, 2.5 + fx, -43, 6.8 + fx, -43, visorEye, 1.8);
      } else {
        drawCircle(ctx, -4.6 + fx, -43.2, 2.2, visorEye);
        drawCircle(ctx, 4.6 + fx, -43.2, 2.2, visorEye);
        drawCircle(ctx, -3.9 + fx, -44, 0.8, toRgba(0xffffff, 0.9));
        drawCircle(ctx, 5.3 + fx, -44, 0.8, toRgba(0xffffff, 0.9));
      }

      // Friendly smile curve inside visor
      drawArc(ctx, fx, -40.6, 2.8, 0.25, Math.PI - 0.25, toRgba(palette.visorEye, 0.95), 1.5);

      // Rosy porcelain cheeks
      const cheek = toRgba(0xf29ca3, 0.65);
      drawCircle(ctx, -9.5 + fx, -33.5, 2.1, cheek);
      drawCircle(ctx, 9.5 + fx, -33.5, 2.1, cheek);
    } else {
      // Back panel with warm vents & status LED
      drawRoundedRect(ctx, -9, -48.5, 18, 12.5, 5, shade, toRgba(OUTLINE, 0.6), 1.4);
      const vent = toRgba(OUTLINE, 0.45);
      drawLine(ctx, -5, -44.5, 5, -44.5, vent, 1.5);
      drawLine(ctx, -5, -41, 5, -41, vent, 1.5);
      drawCircle(ctx, 0, -38, 1.8, visorEye, toRgba(OUTLINE, 0.8), 1);
    }
  });

  return key;
}

/**
 * Standardized Cozy Chibi Café Bot companion for Practice Bot seats.
 * Shares cached supersampled Canvas2D textures with the exact same espresso ink line weight,
 * seated proportions, depth sorting, directional facing, breathing cadence, and pill nameplate
 * as PaperDollAvatar.
 */
export class CafeBotAvatar {
  public readonly root: Phaser.GameObjects.Container;
  private readonly bodyContainer: Phaser.GameObjects.Container;
  private readonly shadowImg: Phaser.GameObjects.Image;
  private readonly dollImg: Phaser.GameObjects.Image;
  private readonly nameTagImg: Phaser.GameObjects.Image;

  private readonly scene: Phaser.Scene;
  private readonly texScale: number;
  private readonly nameTagKey: string;
  private readonly facing: Direction;
  private readonly variantIndex: number;
  private animPhase = Math.random() * Math.PI * 2;
  private blinkTimer = 2.2 + Math.random() * 3.2;
  private isBlinking = false;
  private lastTextureKey = "";
  private lastDisplayName = "";

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    options: CafeBotRenderOptions
  ) {
    this.scene = scene;
    this.texScale = getSceneSmoothScale(scene);
    this.nameTagKey = `cafe-bot-name-${nextAvatarAtlasId++}`;
    this.facing = options.facing;
    this.variantIndex = Math.abs(options.variantIndex);
    this.lastDisplayName = options.displayName;

    this.root = scene.add.container(x, y);
    this.root.setDepth(y);

    ensureAvatarShadowTexture(scene, this.texScale);
    this.shadowImg = createSmoothImage(scene, SHADOW_TEX_KEY, 0, 4, this.texScale);
    this.root.add(this.shadowImg);

    this.bodyContainer = scene.add.container(0, 4);
    this.bodyContainer.scaleX = this.facing === "west" ? -1 : 1;

    const initialKey = this.resolveTextureKey();
    this.lastTextureKey = initialKey;
    this.dollImg = createSmoothImage(scene, initialKey, 0, BOT_CENTER_OFFSET_Y, this.texScale);
    this.bodyContainer.add(this.dollImg);
    this.root.add(this.bodyContainer);

    // Overhead warm amber rounded-pill nameplate above the glowing antenna bulb
    this.renderNameTag(options.displayName);
    this.nameTagImg = createSmoothImage(scene, this.nameTagKey, 0, -70, this.texScale).setOrigin(
      0.5,
      1
    );
    this.root.add(this.nameTagImg);
  }

  private renderNameTag(name: string) {
    renderSmoothPillTexture(this.scene, this.nameTagKey, this.texScale, {
      text: name || "Café Bot",
      fontSize: 10,
      fontWeight: "800",
      textColor: "#6B4423",
      bgColor: "rgba(255, 244, 217, 0.96)",
      borderColor: "#E4B867",
      borderWidth: 1.2,
      dotColor: "#E5A020",
      padX: 6.5,
      padY: 2.5,
      maxWidth: 120,
    });
  }

  public setVisible(visible: boolean) {
    this.root.setVisible(visible);
    return this;
  }

  public setDisplayName(name: string) {
    const clean = name.trim() || "Café Bot";
    if (clean === this.lastDisplayName) return;
    this.lastDisplayName = clean;
    this.renderNameTag(clean);
    this.nameTagImg.setTexture(this.nameTagKey).setScale(1 / this.texScale);
  }

  public tick(dtSec: number) {
    if (!this.root.visible) return;

    this.animPhase += dtSec * 2.4;
    this.bodyContainer.scaleY = 1 + Math.sin(this.animPhase) * 0.015;

    this.blinkTimer -= dtSec;
    if (this.blinkTimer <= 0) {
      if (this.isBlinking) {
        this.isBlinking = false;
        this.blinkTimer = 2.6 + Math.random() * 3.4;
      } else {
        this.isBlinking = true;
        this.blinkTimer = 0.13;
      }
      this.syncTexture();
    }
  }

  private resolveTextureKey(): string {
    const isBack = this.facing === "north";
    const isSide = this.facing === "east" || this.facing === "west";
    return ensureBotTexture(
      this.scene,
      this.variantIndex,
      isBack,
      isSide,
      this.isBlinking,
      this.texScale
    );
  }

  private syncTexture() {
    const key = this.resolveTextureKey();
    if (key === this.lastTextureKey) return;
    this.lastTextureKey = key;
    this.dollImg.setTexture(key);
  }

  public destroy() {
    this.root.destroy(true);
    if (this.scene?.textures?.exists(this.nameTagKey)) {
      this.scene.textures.remove(this.nameTagKey);
    }
  }
}
