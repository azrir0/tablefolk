import * as Phaser from "phaser";
import {
  DEFAULT_AVATAR_CONFIG,
  EMOTE_LIST,
  type AvatarConfig,
  type Direction,
} from "@tablefolk/shared";

function hexToNum(hex: string, fallback = 0x8ab696): number {
  const cleaned = hex.replace("#", "");
  const n = Number.parseInt(cleaned, 16);
  return Number.isFinite(n) ? n : fallback;
}

const OUTLINE = 0x3b2b26;

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
 * High-FPS Procedural 2D Paper-Doll Avatar.
 * Splits limbs (left/right shoes & arms) into transform-animated Graphics nodes so walking
 * runs at a locked 60-144 FPS with ZERO geometry rebuilds or Text texture re-uploads per frame.
 */
export class PaperDollAvatar {
  public readonly root: Phaser.GameObjects.Container;
  private readonly bodyContainer: Phaser.GameObjects.Container;
  private readonly shadowGfx: Phaser.GameObjects.Graphics;
  private readonly leftFootGfx: Phaser.GameObjects.Graphics;
  private readonly rightFootGfx: Phaser.GameObjects.Graphics;
  private readonly leftArmGfx: Phaser.GameObjects.Graphics;
  private readonly rightArmGfx: Phaser.GameObjects.Graphics;
  private readonly dollGfx: Phaser.GameObjects.Graphics;
  private readonly nameTag: Phaser.GameObjects.Text;
  private readonly statusBadge: Phaser.GameObjects.Text;
  private readonly speechContainer: Phaser.GameObjects.Container;
  private readonly speechBg: Phaser.GameObjects.Graphics;
  private readonly speechLabel: Phaser.GameObjects.Text;
  private readonly emoteGfx: Phaser.GameObjects.Graphics;

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

    this.root = scene.add.container(x, y);

    this.shadowGfx = scene.add.graphics();
    this.shadowGfx.fillStyle(0x3a2a20, 0.18);
    this.shadowGfx.fillEllipse(0, 4, 34, 14);
    this.root.add(this.shadowGfx);

    this.bodyContainer = scene.add.container(0, 0);
    this.leftFootGfx = scene.add.graphics();
    this.rightFootGfx = scene.add.graphics();
    this.leftArmGfx = scene.add.graphics();
    this.rightArmGfx = scene.add.graphics();
    this.dollGfx = scene.add.graphics();

    // Layer order: shoes -> arms -> torso/head/hair/accessories
    this.bodyContainer.add([
      this.leftFootGfx,
      this.rightFootGfx,
      this.leftArmGfx,
      this.rightArmGfx,
      this.dollGfx,
    ]);
    this.root.add(this.bodyContainer);

    // Nameplate below feet
    this.nameTag = scene.add
      .text(0, 14, initial.displayName, {
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: "11px",
        fontStyle: initial.isLocal ? "700" : "600",
        color: initial.isLocal ? "#2D5A3D" : "#3E2F2A",
        backgroundColor: initial.isLocal
          ? "rgba(235, 249, 238, 0.92)"
          : "rgba(255, 250, 242, 0.88)",
        padding: { left: 6, right: 6, top: 2, bottom: 2 },
      })
      .setOrigin(0.5, 0);
    this.root.add(this.nameTag);

    // Floating status badge
    this.statusBadge = scene.add
      .text(0, -64, "", {
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: "10px",
        fontStyle: "700",
        color: "#6B4423",
        backgroundColor: "#FFF3D6",
        padding: { left: 6, right: 6, top: 2, bottom: 2 },
      })
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.root.add(this.statusBadge);

    // Overhead speech bubble
    this.speechContainer = scene.add.container(0, -68).setVisible(false);
    this.speechBg = scene.add.graphics();
    this.speechLabel = scene.add
      .text(0, -10, "", {
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: "11px",
        color: "#3B2B26",
        wordWrap: { width: 150 },
        align: "center",
      })
      .setOrigin(0.5, 1);
    this.speechContainer.add([this.speechBg, this.speechLabel]);
    this.root.add(this.speechContainer);

    // Floating custom-drawn vector emote medallion
    this.emoteGfx = scene.add.graphics().setPosition(0, -76).setVisible(false);
    this.root.add(this.emoteGfx);

    this.redrawStaticParts();
    this.syncBadges();
  }

  public updateState(partial: Partial<AvatarRenderState>) {
    if (partial.config && partial.config !== this.state.config) {
      const nextCfgSig = JSON.stringify(partial.config);
      if (nextCfgSig !== this.configSignature) {
        this.configSignature = nextCfgSig;
      }
    }

    this.state = { ...this.state, ...partial };

    if (this.state.displayName !== this.lastDisplayName) {
      this.lastDisplayName = this.state.displayName;
      this.nameTag.setText(this.state.displayName);
    }

    if (this.state.isLocal !== this.lastIsLocal) {
      this.lastIsLocal = this.state.isLocal;
      this.nameTag.setStyle({
        fontStyle: this.state.isLocal ? "700" : "600",
        color: this.state.isLocal ? "#2D5A3D" : "#3E2F2A",
        backgroundColor: this.state.isLocal
          ? "rgba(235, 249, 238, 0.92)"
          : "rgba(255, 250, 242, 0.88)",
      });
    }

    this.syncBadges();
  }

  public showSpeech(text: string) {
    if (!text) return;
    this.speechLabel.setText(text);
    const w = Math.min(Math.max(this.speechLabel.width + 18, 44), 170);
    const h = this.speechLabel.height + 12;
    this.speechBg.clear();
    this.speechBg.fillStyle(0xfffcf6, 0.96);
    this.speechBg.lineStyle(2, 0xd9c3ac, 1);
    this.speechBg.fillRoundedRect(-w / 2, -h - 6, w, h, 10);
    this.speechBg.strokeRoundedRect(-w / 2, -h - 6, w, h, 10);
    this.speechBg.fillStyle(0xfffcf6, 1);
    this.speechBg.fillTriangle(-5, -6, 5, -6, 0, 1);
    this.speechContainer.setVisible(true);
    this.speechHideAt = this.scene.time.now + 5500;
  }

  public triggerEmote(emoteId: string) {
    const found = EMOTE_LIST.find((e) => e.id === emoteId);
    if (!found) return;
    this.drawVectorEmote(found.id);
    this.emoteGfx.setVisible(true).setY(-74).setScale(0.55);
    this.emoteHideAt = this.scene.time.now + 2600;
    this.scene.tweens.add({
      targets: this.emoteGfx,
      y: -90,
      scale: 1.08,
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

  private drawVectorEmote(emoteId: string) {
    const g = this.emoteGfx;
    g.clear();

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
    g.fillStyle(bgMap[emoteId] ?? 0xfff8ec, 1);
    g.lineStyle(2, OUTLINE, 1);
    g.fillCircle(0, 0, 14);
    g.strokeCircle(0, 0, 14);

    if (emoteId === "love") {
      g.fillStyle(0xe05a4e, 1);
      g.fillCircle(-3.6, -2, 4.2);
      g.fillCircle(3.6, -2, 4.2);
      g.fillTriangle(-7.6, -0.5, 7.6, -0.5, 0, 7.5);
    } else if (emoteId === "laugh") {
      g.lineStyle(2, OUTLINE, 1);
      g.beginPath();
      g.arc(-4.5, -2.5, 2.5, Math.PI, Math.PI * 2, false);
      g.strokePath();
      g.beginPath();
      g.arc(4.5, -2.5, 2.5, Math.PI, Math.PI * 2, false);
      g.strokePath();
      g.fillStyle(0xd9594c, 1);
      g.fillRoundedRect(-5.5, 1.5, 11, 5.5, 3);
      g.strokeRoundedRect(-5.5, 1.5, 11, 5.5, 3);
    } else if (emoteId === "cry") {
      g.fillStyle(OUTLINE, 1);
      g.fillCircle(-4.5, -2.5, 1.8);
      g.fillCircle(4.5, -2.5, 1.8);
      g.lineStyle(2, OUTLINE, 1);
      g.beginPath();
      g.arc(0, 6, 3.8, Math.PI + 0.3, Math.PI * 2 - 0.3, false);
      g.strokePath();
      g.fillStyle(0x3b82f6, 1);
      g.fillCircle(6, 3, 2.5);
    } else if (emoteId === "wow") {
      g.fillStyle(OUTLINE, 1);
      g.fillCircle(-4.5, -3, 1.9);
      g.fillCircle(4.5, -3, 1.9);
      g.fillStyle(0x7a4e33, 1);
      g.lineStyle(1.6, OUTLINE, 1);
      g.fillEllipse(0, 4, 6, 7.5);
      g.strokeEllipse(0, 4, 6, 7.5);
    } else if (emoteId === "dance") {
      g.lineStyle(2.2, OUTLINE, 1);
      g.lineBetween(-3, 5, -3, -5);
      g.lineBetween(-3, -5, 5, -7);
      g.lineBetween(5, -7, 5, 3);
      g.fillStyle(0xbe185d, 1);
      g.fillCircle(-5, 5, 2.8);
      g.fillCircle(3, 3, 2.8);
    } else if (emoteId === "party") {
      g.fillStyle(0xf4c145, 1);
      g.lineStyle(1.6, OUTLINE, 1);
      g.fillTriangle(-6, 7, -1, -5, 6, 2);
      g.strokeTriangle(-6, 7, -1, -5, 6, 2);
      g.fillStyle(0x529b76, 1);
      g.fillCircle(4, -6, 2.2);
      g.fillStyle(0xd9594c, 1);
      g.fillCircle(8, -1, 1.8);
    } else if (emoteId === "cheers") {
      g.fillStyle(0xf4c145, 1);
      g.lineStyle(1.6, OUTLINE, 1);
      g.fillRoundedRect(-5, -3, 10, 9, 2.5);
      g.strokeRoundedRect(-5, -3, 10, 9, 2.5);
      g.lineStyle(1.8, 0xd97706, 1);
      g.lineBetween(0, -8, 0, -5);
      g.lineBetween(-6, -6, -4, -4);
      g.lineBetween(6, -6, 4, -4);
    } else {
      // Friendly wave / star sparkle
      g.fillStyle(0xfff8ec, 1);
      g.lineStyle(1.8, OUTLINE, 1);
      g.fillRoundedRect(-5.5, -5.5, 11, 12, 4.5);
      g.strokeRoundedRect(-5.5, -5.5, 11, 12, 4.5);
      g.lineStyle(1.8, 0xd97706, 1);
      g.lineBetween(-9, -4, -7, -7);
      g.lineBetween(7, -7, 9, -4);
    }
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
    if (this.emoteGfx.visible && now >= this.emoteHideAt) {
      this.emoteGfx.setVisible(false);
    }

    // Pure GPU transform animations (zero geometry redraw while walking!)
    const strideSin = Math.sin(this.animPhase);
    if (this.state.isSeated) {
      this.bodyContainer.y = 4;
      this.bodyContainer.rotation = 0;
      this.bodyContainer.scaleY = 1 + strideSin * 0.015;
      this.leftFootGfx.y = -1;
      this.rightFootGfx.y = -1;
      this.leftArmGfx.y = 0;
      this.rightArmGfx.y = 0;
    } else {
      const bounce = Math.abs(strideSin) * 4.5 * this.walkBlend;
      const idleBreath = strideSin * 0.018 * (1 - this.walkBlend);
      this.bodyContainer.y = -bounce;
      this.bodyContainer.rotation = strideSin * 0.055 * this.walkBlend;
      this.bodyContainer.scaleY = 1 + idleBreath;

      // Subtle ground shadow squash during bounce
      this.shadowGfx.scaleX = 1 - bounce * 0.025;
      this.shadowGfx.scaleY = 1 - bounce * 0.025;

      // Smooth continuous foot & arm swing
      const footSwing = strideSin * 3.6 * this.walkBlend;
      this.leftFootGfx.y = footSwing;
      this.rightFootGfx.y = -footSwing;

      if (this.state.carryingGameSlug) {
        this.leftArmGfx.y = 0;
        this.rightArmGfx.y = 0;
      } else {
        const armSwing = strideSin * 2.2 * this.walkBlend;
        this.leftArmGfx.y = -armSwing;
        this.rightArmGfx.y = armSwing;
      }
    }

    // Horizontal flip for west vs east side view
    this.bodyContainer.scaleX = this.state.facing === "west" ? -1 : 1;

    // Only redraw vector geometry when facing, blink, outfit, or carry state changes
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
      this.statusBadge.setText(nextText).setVisible(true);
    } else {
      this.statusBadge.setVisible(false);
    }
  }

  private redrawStaticParts() {
    const cfg = this.state.config || DEFAULT_AVATAR_CONFIG;
    const isBack = this.state.facing === "north";
    const isSide = this.state.facing === "east" || this.state.facing === "west";

    const sig = `${this.configSignature}|${isBack}|${isSide}|${this.isBlinking}|${this.state.carryingGameSlug}`;
    if (sig === this.lastDrawSignature) return;
    this.lastDrawSignature = sig;

    const skin = hexToNum(cfg.skinTone, 0xf6c9a6);
    const hair = hexToNum(cfg.hairColor, 0x4a312c);
    const top = hexToNum(cfg.topColor, 0x8ab696);
    const accent = hexToNum(cfg.topAccent, 0xf7f1e5);
    const bottom = hexToNum(cfg.bottomColor, 0x6b8eb8);
    const shoe = hexToNum(cfg.shoeColor, 0x44414b);

    // Separate Shoes
    this.leftFootGfx.clear();
    this.leftFootGfx.fillStyle(shoe, 1);
    this.leftFootGfx.lineStyle(1.8, OUTLINE, 1);
    this.leftFootGfx.fillRoundedRect(-10, -4, 8, 6, 3);
    this.leftFootGfx.strokeRoundedRect(-10, -4, 8, 6, 3);

    this.rightFootGfx.clear();
    this.rightFootGfx.fillStyle(shoe, 1);
    this.rightFootGfx.lineStyle(1.8, OUTLINE, 1);
    this.rightFootGfx.fillRoundedRect(2, -4, 8, 6, 3);
    this.rightFootGfx.strokeRoundedRect(2, -4, 8, 6, 3);

    // Separate Arms
    this.leftArmGfx.clear();
    this.leftArmGfx.fillStyle(top, 1);
    this.leftArmGfx.lineStyle(1.8, OUTLINE, 1);
    this.rightArmGfx.clear();
    this.rightArmGfx.fillStyle(top, 1);
    this.rightArmGfx.lineStyle(1.8, OUTLINE, 1);
    if (this.state.carryingGameSlug) {
      this.leftArmGfx.fillRoundedRect(-16, -28, 7, 11, 3);
      this.leftArmGfx.strokeRoundedRect(-16, -28, 7, 11, 3);
      this.rightArmGfx.fillRoundedRect(9, -28, 7, 11, 3);
      this.rightArmGfx.strokeRoundedRect(9, -28, 7, 11, 3);
    } else {
      this.leftArmGfx.fillRoundedRect(-16, -29, 6, 13, 3);
      this.leftArmGfx.strokeRoundedRect(-16, -29, 6, 13, 3);
      this.rightArmGfx.fillRoundedRect(10, -29, 6, 13, 3);
      this.rightArmGfx.strokeRoundedRect(10, -29, 6, 13, 3);
    }

    // Main Torso + Head + Hair + Accessories
    const g = this.dollGfx;
    g.clear();

    // Bottoms
    g.fillStyle(bottom, 1);
    g.lineStyle(1.8, OUTLINE, 1);
    if (cfg.bottomStyle === "skirt") {
      g.fillTriangle(-12, -4, 12, -4, 0, -19);
      g.fillRoundedRect(-11, -13, 22, 9, 4);
      g.strokeRoundedRect(-11, -13, 22, 9, 4);
    } else if (cfg.bottomStyle === "shorts") {
      g.fillRoundedRect(-10, -14, 20, 8, 3);
      g.strokeRoundedRect(-10, -14, 20, 8, 3);
    } else {
      g.fillRoundedRect(-10, -15, 9, 12, 3);
      g.strokeRoundedRect(-10, -15, 9, 12, 3);
      g.fillRoundedRect(1, -15, 9, 12, 3);
      g.strokeRoundedRect(1, -15, 9, 12, 3);
    }

    // Torso / Top
    g.fillStyle(top, 1);
    g.lineStyle(2, OUTLINE, 1);
    g.fillRoundedRect(-13, -31, 26, 20, 8);
    g.strokeRoundedRect(-13, -31, 26, 20, 8);

    if (cfg.topStyle === "cardigan") {
      g.fillStyle(accent, 1);
      g.fillRoundedRect(-4, -30, 8, 18, 2);
    } else if (cfg.topStyle === "hoodie") {
      g.fillStyle(accent, 0.9);
      g.fillRoundedRect(-7, -18, 14, 6, 3);
    } else if (cfg.topStyle === "apron") {
      g.fillStyle(accent, 1);
      g.fillRoundedRect(-8, -26, 16, 16, 3);
      g.lineStyle(1.4, OUTLINE, 0.8);
      g.strokeRoundedRect(-8, -26, 16, 16, 3);
    } else if (cfg.topStyle === "sweater") {
      g.fillStyle(accent, 0.9);
      g.fillRoundedRect(-7, -31, 14, 4, 2);
    }

    // Scarf accessory
    if (cfg.accessory === "scarf") {
      g.fillStyle(accent, 1);
      g.lineStyle(1.6, OUTLINE, 1);
      g.fillRoundedRect(-11, -33, 22, 6, 3);
      g.strokeRoundedRect(-11, -33, 22, 6, 3);
      g.fillRoundedRect(3, -29, 5, 9, 2);
    }

    // Back Hair
    if (!isBack && (cfg.hairStyle === "wavy" || cfg.hairStyle === "bob")) {
      g.fillStyle(hair, 1);
      g.lineStyle(2, OUTLINE, 1);
      g.fillRoundedRect(-17, -48, 34, 22, 10);
      g.strokeRoundedRect(-17, -48, 34, 22, 10);
    }

    // Head
    g.fillStyle(skin, 1);
    g.lineStyle(2, OUTLINE, 1);
    g.fillCircle(0, -43, 14.5);
    g.strokeCircle(0, -43, 14.5);

    // Face
    if (!isBack) {
      const eyeOffsetX = isSide ? 4 : 0;
      g.fillStyle(0xf29ca3, 0.45);
      g.fillEllipse(-7 + eyeOffsetX, -39, 5, 3);
      g.fillEllipse(7 + eyeOffsetX, -39, 5, 3);

      g.fillStyle(OUTLINE, 1);
      if (this.isBlinking) {
        g.lineStyle(1.8, OUTLINE, 1);
        g.lineBetween(-7 + eyeOffsetX, -42, -3 + eyeOffsetX, -42);
        g.lineBetween(3 + eyeOffsetX, -42, 7 + eyeOffsetX, -42);
      } else {
        g.fillCircle(-5 + eyeOffsetX, -42, 2.2);
        g.fillCircle(5 + eyeOffsetX, -42, 2.2);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(-5.7 + eyeOffsetX, -42.8, 0.8);
        g.fillCircle(4.3 + eyeOffsetX, -42.8, 0.8);
      }

      g.lineStyle(1.6, OUTLINE, 1);
      g.beginPath();
      g.arc(eyeOffsetX, -38.5, 3.2, 0.15, Math.PI - 0.15, false);
      g.strokePath();
    }

    // Hair Crown
    g.fillStyle(hair, 1);
    g.lineStyle(2, OUTLINE, 1);
    if (isBack) {
      g.fillCircle(0, -45, 15.2);
      g.strokeCircle(0, -45, 15.2);
      if (cfg.hairStyle === "ponytail") {
        g.fillRoundedRect(-5, -43, 10, 15, 5);
        g.strokeRoundedRect(-5, -43, 10, 15, 5);
      } else if (cfg.hairStyle === "bun") {
        g.fillCircle(0, -61, 6.5);
        g.strokeCircle(0, -61, 6.5);
      }
    } else if (cfg.hairStyle === "beanie") {
      g.fillStyle(accent, 1);
      g.fillRoundedRect(-15, -60, 30, 14, 8);
      g.strokeRoundedRect(-15, -60, 30, 14, 8);
      g.fillCircle(0, -62, 4.5);
      g.strokeCircle(0, -62, 4.5);
    } else if (cfg.hairStyle === "curly") {
      const puffs = [
        [-12, -52, 6.5],
        [-5, -57, 7],
        [4, -57, 7],
        [12, -52, 6.5],
        [0, -54, 6],
      ] as const;
      for (const [px, py, pr] of puffs) {
        g.fillCircle(px, py, pr);
        g.strokeCircle(px, py, pr);
      }
    } else if (cfg.hairStyle === "spiky") {
      g.fillRoundedRect(-15, -58, 30, 13, 6);
      g.strokeRoundedRect(-15, -58, 30, 13, 6);
      g.fillTriangle(-9, -57, -4, -65, 1, -57);
      g.fillTriangle(0, -57, 6, -64, 10, -57);
    } else {
      g.beginPath();
      g.arc(0, -45, 15, Math.PI, Math.PI * 2, false);
      g.lineTo(15, -44);
      g.lineTo(6, -48);
      g.lineTo(-2, -44);
      g.lineTo(-15, -45);
      g.closePath();
      g.fillPath();
      g.strokePath();

      if (cfg.hairStyle === "bun") {
        g.fillCircle(0, -61, 6.5);
        g.strokeCircle(0, -61, 6.5);
      } else if (cfg.hairStyle === "ponytail") {
        g.fillCircle(isSide ? -14 : 12, -52, 6);
        g.strokeCircle(isSide ? -14 : 12, -52, 6);
      }
    }

    // Head Accessories
    if (cfg.accessory === "glasses" && !isBack) {
      const gx = isSide ? 4 : 0;
      g.lineStyle(1.8, 0x3a2d28, 1);
      g.strokeCircle(-5 + gx, -42, 4.4);
      g.strokeCircle(5 + gx, -42, 4.4);
      g.lineBetween(-0.6 + gx, -42, 0.6 + gx, -42);
    } else if (cfg.accessory === "headphones") {
      g.lineStyle(3, 0x5c4b51, 1);
      g.beginPath();
      g.arc(0, -46, 16.5, Math.PI, Math.PI * 2, false);
      g.strokePath();
      g.fillStyle(0xe5808a, 1);
      g.lineStyle(1.6, OUTLINE, 1);
      g.fillRoundedRect(-18, -48, 5, 10, 2.5);
      g.strokeRoundedRect(-18, -48, 5, 10, 2.5);
      g.fillRoundedRect(13, -48, 5, 10, 2.5);
      g.strokeRoundedRect(13, -48, 5, 10, 2.5);
    } else if (cfg.accessory === "beret") {
      g.fillStyle(0xc86b85, 1);
      g.lineStyle(1.8, OUTLINE, 1);
      g.fillEllipse(2, -58, 26, 11);
      g.strokeEllipse(2, -58, 26, 11);
    } else if (cfg.accessory === "star_pin" && !isBack) {
      g.fillStyle(0xf6c945, 1);
      g.lineStyle(1.2, OUTLINE, 1);
      g.fillCircle(9, -51, 3.6);
      g.strokeCircle(9, -51, 3.6);
    }

    // Carried Board Game Box
    if (this.state.carryingGameSlug && !isBack) {
      g.fillStyle(0xf2c25b, 1);
      g.lineStyle(1.8, OUTLINE, 1);
      g.fillRoundedRect(-11, -24, 22, 14, 3);
      g.strokeRoundedRect(-11, -24, 22, 14, 3);
      g.fillStyle(0x529b76, 1);
      g.fillRoundedRect(-7, -21, 14, 8, 2);
    }
  }

  public destroy() {
    this.root.destroy(true);
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

/**
 * Standardized Cozy Chibi Café Bot companion for Practice Bot seats.
 * Uses the exact same espresso ink line weight, seated proportions, depth sorting,
 * directional facing, breathing cadence, and pill nameplate as PaperDollAvatar.
 */
export class CafeBotAvatar {
  public readonly root: Phaser.GameObjects.Container;
  private readonly bodyContainer: Phaser.GameObjects.Container;
  private readonly shadowGfx: Phaser.GameObjects.Graphics;
  private readonly dollGfx: Phaser.GameObjects.Graphics;
  private readonly nameTag: Phaser.GameObjects.Text;

  private readonly facing: Direction;
  private readonly variantIndex: number;
  private animPhase = Math.random() * Math.PI * 2;
  private blinkTimer = 2.2 + Math.random() * 3.2;
  private isBlinking = false;
  private lastDrawSignature = "";
  private lastDisplayName = "";

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    options: CafeBotRenderOptions
  ) {
    this.facing = options.facing;
    this.variantIndex = Math.abs(options.variantIndex);
    this.lastDisplayName = options.displayName;

    this.root = scene.add.container(x, y);
    this.root.setDepth(y);

    this.shadowGfx = scene.add.graphics();
    this.shadowGfx.fillStyle(0x3a2a20, 0.18);
    this.shadowGfx.fillEllipse(0, 4, 34, 14);
    this.root.add(this.shadowGfx);

    this.bodyContainer = scene.add.container(0, 4);
    this.bodyContainer.scaleX = this.facing === "west" ? -1 : 1;
    this.dollGfx = scene.add.graphics();
    this.bodyContainer.add(this.dollGfx);
    this.root.add(this.bodyContainer);

    // Warm amber nameplate matching TableLobbyDrawer bot pills
    this.nameTag = scene.add
      .text(0, 14, options.displayName, {
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: "10.5px",
        fontStyle: "700",
        color: "#6B4423",
        backgroundColor: "rgba(255, 243, 214, 0.94)",
        padding: { left: 6, right: 6, top: 2, bottom: 2 },
      })
      .setOrigin(0.5, 0);
    this.root.add(this.nameTag);

    this.redraw();
  }

  public setVisible(visible: boolean) {
    this.root.setVisible(visible);
    return this;
  }

  public setDisplayName(name: string) {
    const clean = name.trim() || "Café Bot";
    if (clean === this.lastDisplayName) return;
    this.lastDisplayName = clean;
    this.nameTag.setText(clean);
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
      this.redraw();
    }
  }

  private redraw() {
    const isBack = this.facing === "north";
    const isSide = this.facing === "east" || this.facing === "west";
    const sig = `${this.variantIndex}|${isBack}|${isSide}|${this.isBlinking}`;
    if (sig === this.lastDrawSignature) return;
    this.lastDrawSignature = sig;

    const palette = BOT_PALETTES[this.variantIndex % BOT_PALETTES.length]!;
    const g = this.dollGfx;
    g.clear();

    // 1. Seated bronze boots (matches PaperDollAvatar shoe coordinates)
    g.fillStyle(0x6b5344, 1);
    g.lineStyle(1.8, OUTLINE, 1);
    g.fillRoundedRect(-10, -5, 8, 6, 3);
    g.strokeRoundedRect(-10, -5, 8, 6, 3);
    g.fillRoundedRect(2, -5, 8, 6, 3);
    g.strokeRoundedRect(2, -5, 8, 6, 3);

    // 2. Porcelain arms with warm brass wrist cuffs
    g.fillStyle(palette.chassis, 1);
    g.lineStyle(1.8, OUTLINE, 1);
    g.fillRoundedRect(-16, -29, 6, 13, 3);
    g.strokeRoundedRect(-16, -29, 6, 13, 3);
    g.fillRoundedRect(10, -29, 6, 13, 3);
    g.strokeRoundedRect(10, -29, 6, 13, 3);
    g.fillStyle(0xdba34d, 1);
    g.fillRoundedRect(-15.5, -20.5, 5, 3, 1.2);
    g.fillRoundedRect(10.5, -20.5, 5, 3, 1.2);

    // 3. Lower chassis base
    g.fillStyle(0x8a796c, 1);
    g.lineStyle(1.8, OUTLINE, 1);
    g.fillRoundedRect(-10, -15, 20, 11, 4);
    g.strokeRoundedRect(-10, -15, 20, 11, 4);

    // 4. Rounded porcelain torso + café apron (or brass wind-up key on back)
    g.fillStyle(palette.chassis, 1);
    g.lineStyle(2, OUTLINE, 1);
    g.fillRoundedRect(-13, -31, 26, 20, 8);
    g.strokeRoundedRect(-13, -31, 26, 20, 8);

    if (!isBack) {
      g.fillStyle(palette.apron, 1);
      g.lineStyle(1.4, OUTLINE, 0.9);
      g.fillRoundedRect(-8, -26, 16, 15, 3);
      g.strokeRoundedRect(-8, -26, 16, 15, 3);

      // Brass café crest button
      g.fillStyle(0xf6c945, 1);
      g.lineStyle(1.2, OUTLINE, 1);
      g.fillCircle(0, -20.5, 2.8);
      g.strokeCircle(0, -20.5, 2.8);
    } else {
      g.fillStyle(palette.apron, 1);
      g.lineStyle(1.4, OUTLINE, 0.85);
      g.fillRoundedRect(-8, -26, 16, 11, 3);
      g.strokeRoundedRect(-8, -26, 16, 11, 3);

      // Cute brass wind-up key on back
      g.fillStyle(0xf6c945, 1);
      g.lineStyle(1.4, OUTLINE, 1);
      g.fillCircle(-3.4, -20.5, 2.6);
      g.strokeCircle(-3.4, -20.5, 2.6);
      g.fillCircle(3.4, -20.5, 2.6);
      g.strokeCircle(3.4, -20.5, 2.6);
      g.fillCircle(0, -20.5, 1.7);
      g.strokeCircle(0, -20.5, 1.7);
    }

    // 5. Top brass antenna + glowing amber lantern bulb
    g.lineStyle(2.2, OUTLINE, 1);
    g.lineBetween(0, -55, 0, -63);
    g.fillStyle(palette.bulb, 1);
    g.lineStyle(1.6, OUTLINE, 1);
    g.fillCircle(0, -64.5, 3.6);
    g.strokeCircle(0, -64.5, 3.6);
    g.fillStyle(0xfffdf5, 0.95);
    g.fillCircle(-1, -65.5, 1.1);

    // 6. Side brass ear-caps
    g.fillStyle(0xdba34d, 1);
    g.lineStyle(1.6, OUTLINE, 1);
    g.fillRoundedRect(-17.5, -47, 4.5, 8.5, 2);
    g.strokeRoundedRect(-17.5, -47, 4.5, 8.5, 2);
    g.fillRoundedRect(13, -47, 4.5, 8.5, 2);
    g.strokeRoundedRect(13, -47, 4.5, 8.5, 2);

    // 7. Rounded chibi porcelain head
    g.fillStyle(palette.chassis, 1);
    g.lineStyle(2, OUTLINE, 1);
    g.fillRoundedRect(-15, -56, 30, 26, 11);
    g.strokeRoundedRect(-15, -56, 30, 26, 11);

    // Soft pastel top trim
    g.fillStyle(palette.apron, 0.85);
    g.fillRoundedRect(-9, -54, 18, 3.5, 1.8);

    // 8. Face visor or rear vent plate
    if (!isBack) {
      const fx = isSide ? 2.5 : 0;

      // Dark warm espresso glass visor
      g.fillStyle(0x362825, 1);
      g.lineStyle(1.6, OUTLINE, 1);
      g.fillRoundedRect(-11 + fx, -48.5, 22, 13.5, 5.5);
      g.strokeRoundedRect(-11 + fx, -48.5, 22, 13.5, 5.5);

      // Subtle glass sheen
      g.fillStyle(0xffffff, 0.14);
      g.fillRoundedRect(-8.5 + fx, -47, 8, 2.2, 1);

      // Expressive glowing eyes
      if (this.isBlinking) {
        g.lineStyle(1.8, palette.visorEye, 1);
        g.lineBetween(-6.8 + fx, -43, -2.5 + fx, -43);
        g.lineBetween(2.5 + fx, -43, 6.8 + fx, -43);
      } else {
        g.fillStyle(palette.visorEye, 1);
        g.fillCircle(-4.6 + fx, -43.2, 2.2);
        g.fillCircle(4.6 + fx, -43.2, 2.2);
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(-3.9 + fx, -44, 0.8);
        g.fillCircle(5.3 + fx, -44, 0.8);
      }

      // Friendly smile curve inside visor
      g.lineStyle(1.5, palette.visorEye, 0.95);
      g.beginPath();
      g.arc(fx, -40.6, 2.8, 0.25, Math.PI - 0.25, false);
      g.strokePath();

      // Rosy porcelain cheeks
      g.fillStyle(0xf29ca3, 0.65);
      g.fillCircle(-9.5 + fx, -33.5, 2.1);
      g.fillCircle(9.5 + fx, -33.5, 2.1);
    } else {
      // Back panel with warm vents & status LED
      g.fillStyle(palette.shade, 1);
      g.lineStyle(1.4, OUTLINE, 0.6);
      g.fillRoundedRect(-9, -48.5, 18, 12.5, 5);
      g.strokeRoundedRect(-9, -48.5, 18, 12.5, 5);

      g.lineStyle(1.5, OUTLINE, 0.45);
      g.lineBetween(-5, -44.5, 5, -44.5);
      g.lineBetween(-5, -41, 5, -41);

      g.fillStyle(palette.visorEye, 1);
      g.lineStyle(1, OUTLINE, 0.8);
      g.fillCircle(0, -38, 1.8);
      g.strokeCircle(0, -38, 1.8);
    }
  }

  public destroy() {
    this.root.destroy(true);
  }
}

