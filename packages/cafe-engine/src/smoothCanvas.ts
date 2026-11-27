import * as Phaser from "phaser";

export const SMOOTH_SCALE_REGISTRY_KEY = "smoothTexScale";

/**
 * Optimal Canvas2D supersampling multiplier for WebGL LINEAR texture filtering.
 * Keeps texels-per-physical-pixel in the [1.33x, 2.0x] golden zone across 1x–3x DPR
 * screens so curved outlines get both native 8-bit analytic Canvas2D anti-aliasing
 * and hardware 2x2 bilinear supersampling without Nyquist shimmering or blur.
 */
export function getSmoothTextureScale(dpr: number): number {
  const safeDpr = Number.isFinite(dpr) ? Math.max(1, dpr) : 1;
  return Math.min(Math.max(Math.round(safeDpr * 2), 2), 4);
}

export function getSceneSmoothScale(scene: Phaser.Scene): number {
  const stored = scene.registry?.get(SMOOTH_SCALE_REGISTRY_KEY);
  return typeof stored === "number" && stored >= 1 ? stored : 2;
}

export function toRgba(color: number | string, alpha = 1): string {
  let num: number;
  if (typeof color === "string") {
    const cleaned = color.replace("#", "").trim();
    num = Number.parseInt(cleaned, 16);
    if (!Number.isFinite(num)) num = 0x3b2b26;
  } else {
    num = color >>> 0;
  }
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return alpha >= 0.999 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

export function configureSmoothContext(ctx: CanvasRenderingContext2D): void {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.miterLimit = 2;
  ctx.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in ctx) {
    ctx.imageSmoothingQuality = "high";
  }
}

export function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill?: string | null,
  stroke?: string | null,
  lineWidth = 2
): void {
  roundedRectPath(ctx, x, y, w, h, radius);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke && lineWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function drawCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fill?: string | null,
  stroke?: string | null,
  lineWidth = 2
): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke && lineWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/**
 * Draws an ellipse using full width and height (matching Phaser's fillEllipse/strokeEllipse),
 * rendered via native Canvas2D ctx.ellipse for zero polygon faceting or miter spikes.
 */
export function drawEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height: number,
  fill?: string | null,
  stroke?: string | null,
  lineWidth = 2
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, width / 2, height / 2, 0, 0, Math.PI * 2);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke && lineWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function drawTriangle(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  fill?: string | null,
  stroke?: string | null,
  lineWidth = 2
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke && lineWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  lineWidth = 2
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

export function drawArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
  stroke: string,
  lineWidth = 2,
  anticlockwise = false
): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle, anticlockwise);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/**
 * Ensures a cached Canvas2D vector texture exists for `key` and returns it.
 * Drawing happens ONCE in world-space units scaled cleanly by `scale`.
 */
export function ensureSmoothTexture(
  scene: Phaser.Scene,
  key: string,
  worldW: number,
  worldH: number,
  scale: number,
  drawFn: (ctx: CanvasRenderingContext2D) => void
): Phaser.Textures.CanvasTexture {
  if (scene.textures.exists(key)) {
    return scene.textures.get(key) as Phaser.Textures.CanvasTexture;
  }
  return renderSmoothTexture(scene, key, worldW, worldH, scale, drawFn);
}

/**
 * Creates or updates a Canvas2D vector texture for `key`, re-uploading to WebGL via `refresh()`.
 */
export function renderSmoothTexture(
  scene: Phaser.Scene,
  key: string,
  worldW: number,
  worldH: number,
  scale: number,
  drawFn: (ctx: CanvasRenderingContext2D) => void
): Phaser.Textures.CanvasTexture {
  const pxW = Math.max(1, Math.ceil(worldW * scale));
  const pxH = Math.max(1, Math.ceil(worldH * scale));

  let tex: Phaser.Textures.CanvasTexture | null = null;
  if (scene.textures.exists(key)) {
    const existing = scene.textures.get(key) as Phaser.Textures.CanvasTexture;
    if (existing.width === pxW && existing.height === pxH) {
      tex = existing;
    } else {
      scene.textures.remove(key);
    }
  }

  if (!tex) {
    tex = scene.textures.createCanvas(key, pxW, pxH);
    if (!tex) {
      throw new Error(`Failed to create smooth CanvasTexture "${key}"`);
    }
  }

  const ctx = tex.getContext();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pxW, pxH);
  ctx.scale(scale, scale);
  configureSmoothContext(ctx);
  drawFn(ctx);
  ctx.restore();

  tex.refresh();
  return tex;
}

/**
 * Draws a soft warm radial ambient light glow (for café lamps, fairy lights, table candles).
 */
export function drawSoftGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  innerRgba: string,
  outerRgba = "rgba(255,232,175,0)"
): void {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, innerRgba);
  grad.addColorStop(1, outerRgba);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

export interface SmoothPillOptions {
  text: string;
  fontSize?: number;
  fontWeight?: string;
  textColor: string;
  bgColor: string;
  borderColor?: string;
  borderWidth?: number;
  dotColor?: string;
  padX?: number;
  padY?: number;
  maxWidth?: number;
  shadow?: boolean;
}

/**
 * Renders a crisp supersampled Canvas2D rounded-pill badge with optional status dot and text.
 * Eliminates sharp boxy Phaser Text rectangles for overhead nameplates & table placards.
 */
export function renderSmoothPillTexture(
  scene: Phaser.Scene,
  key: string,
  scale: number,
  opts: SmoothPillOptions
): { texture: Phaser.Textures.CanvasTexture; worldWidth: number; worldHeight: number } {
  const fontSize = opts.fontSize ?? 10.5;
  const fontWeight = opts.fontWeight ?? "700";
  const padX = opts.padX ?? 8;
  const padY = opts.padY ?? 3.5;
  const dotRadius = opts.dotColor ? 2.6 : 0;
  const dotGap = opts.dotColor ? 5 : 0;
  const fontSpec = `${fontWeight} ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

  // Measure text width accurately using a tiny shared offscreen 2D context
  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  let label = opts.text;
  let textW = label.length * fontSize * 0.56;
  if (mctx) {
    mctx.font = fontSpec;
    textW = mctx.measureText(label).width;
    if (opts.maxWidth) {
      const avail = Math.max(24, opts.maxWidth - padX * 2 - dotRadius * 2 - dotGap);
      if (textW > avail) {
        while (label.length > 2 && mctx.measureText(`${label}…`).width > avail) {
          label = label.slice(0, -1);
        }
        label = `${label.trimEnd()}…`;
        textW = mctx.measureText(label).width;
      }
    }
  }

  const pillW = Math.ceil(textW + padX * 2 + dotRadius * 2 + dotGap);
  const pillH = Math.ceil(fontSize + padY * 2);
  const margin = 4;
  const worldW = pillW + margin * 2;
  const worldH = pillH + margin * 2 + 2;

  const texture = renderSmoothTexture(scene, key, worldW, worldH, scale, (ctx) => {
    const px = margin;
    const py = margin;
    const r = pillH / 2;

    if (opts.shadow !== false) {
      drawRoundedRect(ctx, px, py + 1.5, pillW, pillH, r, "rgba(58,42,32,0.16)");
    }

    drawRoundedRect(
      ctx,
      px,
      py,
      pillW,
      pillH,
      r,
      opts.bgColor,
      opts.borderColor ?? null,
      opts.borderWidth ?? 1.25
    );

    let textStartX = px + padX;
    if (opts.dotColor) {
      drawCircle(ctx, px + padX + dotRadius, py + pillH / 2, dotRadius, opts.dotColor);
      textStartX += dotRadius * 2 + dotGap;
    }

    ctx.font = fontSpec;
    ctx.fillStyle = opts.textColor;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(label, textStartX, py + pillH / 2 + 0.5);
  });

  return { texture, worldWidth: worldW, worldHeight: worldH };
}

/**
 * Creates a Phaser Image backed by a supersampled smooth Canvas2D texture,
 * scaled back by `1 / scale` so its world dimensions match `worldW × worldH`.
 */
export function createSmoothImage(
  scene: Phaser.Scene,
  key: string,
  x: number,
  y: number,
  scale: number,
  frame?: string | number
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, key, frame).setScale(1 / scale);
}
