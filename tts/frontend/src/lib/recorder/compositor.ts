import type { Snapshot } from "./snapshot";

export const OUTPUT_WIDTH = 2560;
export const OUTPUT_HEIGHT = 1440;
const MARGIN = 88;
const RADIUS = 28;

type Rect = { x: number; y: number; width: number; height: number };

const fitFrame = (width: number, height: number): Rect => {
  const scale = Math.min(
    (OUTPUT_WIDTH - MARGIN * 2) / width,
    (OUTPUT_HEIGHT - MARGIN * 2) / height,
  );
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  return {
    x: Math.round((OUTPUT_WIDTH - w) / 2),
    y: Math.round((OUTPUT_HEIGHT - h) / 2),
    width: w,
    height: h,
  };
};

const createCanvas = () => {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;
  return canvas;
};

const framePath = (ctx: CanvasRenderingContext2D, frame: Rect) => {
  ctx.beginPath();
  ctx.roundRect(frame.x, frame.y, frame.width, frame.height, RADIUS);
};

const loadImage = async (url: string) => {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = url;
  await image.decode();
  return image;
};

const paintPhoto = (ctx: CanvasRenderingContext2D, photo: HTMLImageElement) => {
  const scale = Math.max(
    OUTPUT_WIDTH / photo.naturalWidth,
    OUTPUT_HEIGHT / photo.naturalHeight,
  );
  const width = photo.naturalWidth * scale;
  const height = photo.naturalHeight * scale;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    photo,
    (OUTPUT_WIDTH - width) / 2,
    (OUTPUT_HEIGHT - height) / 2,
    width,
    height,
  );
};

const paintGradient = (ctx: CanvasRenderingContext2D) => {
  const gradient = ctx.createLinearGradient(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  gradient.addColorStop(0, "#1d4ed8");
  gradient.addColorStop(0.5, "#4f46e5");
  gradient.addColorStop(1, "#9333ea");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

  const [glowX, glowY] = [OUTPUT_WIDTH * 0.2, OUTPUT_HEIGHT * 0.1];
  const glow = ctx.createRadialGradient(
    glowX,
    glowY,
    0,
    glowX,
    glowY,
    OUTPUT_WIDTH * 0.8,
  );
  glow.addColorStop(0, "rgba(255,255,255,0.25)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
};

const renderBackground = (frame: Rect, photo?: HTMLImageElement) => {
  const canvas = createCanvas();
  const ctx = canvas.getContext("2d")!;
  if (photo) paintPhoto(ctx, photo);
  else paintGradient(ctx);

  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = RADIUS * 3;
  ctx.shadowOffsetY = RADIUS;
  ctx.fillStyle = "#000";
  framePath(ctx, frame);
  ctx.fill();
  return canvas;
};

/** `backgroundUrl` is covered with; without it, a gradient. */
export const createCompositor = async (backgroundUrl?: string) => {
  const photo = backgroundUrl
    ? await loadImage(backgroundUrl).catch((err) => {
        console.warn("Recording without its background:", err);
        return undefined;
      })
    : undefined;
  const canvas = createCanvas();
  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.imageSmoothingQuality = "high";
  let fitted:
    | { size: string; frame: Rect; background: HTMLCanvasElement }
    | undefined;

  const draw = ({ image, width, height }: Snapshot) => {
    const size = `${width}x${height}`;
    if (fitted?.size !== size) {
      const frame = fitFrame(width, height);
      fitted = { size, frame, background: renderBackground(frame, photo) };
    }
    const { frame, background } = fitted;
    ctx.drawImage(background, 0, 0);
    ctx.save();
    framePath(ctx, frame);
    ctx.clip();
    ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height);
    ctx.restore();
  };

  return { canvas, draw };
};
