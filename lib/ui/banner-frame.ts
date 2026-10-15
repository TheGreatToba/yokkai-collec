export type BannerFrame = { x: number; y: number; zoom: number };
export const BANNER_ASPECT = 2.3;
export const DEFAULT_BANNER_FRAME: BannerFrame = { x: 50, y: 28, zoom: 1 };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function normalizeBannerFrame(frame: BannerFrame): BannerFrame {
  const finite = (value: number, fallback: number) =>
    Number.isFinite(value) ? value : fallback;
  return {
    x: clamp(finite(frame.x, 50), 0, 100),
    y: clamp(finite(frame.y, 50), 0, 100),
    zoom: clamp(finite(frame.zoom, 1), 0.01, 4)
  };
}

/** Relative geometry: no raster export, CORS canvas access or GIF conversion. */
export function bannerGeometry(imageAspect: number, input: BannerFrame) {
  const aspect =
    Number.isFinite(imageAspect) && imageAspect > 0
      ? imageAspect
      : BANNER_ASPECT;
  const frame = normalizeBannerFrame(input);
  const cover = Math.max(aspect / BANNER_ASPECT, BANNER_ASPECT / aspect);
  const overflowX = Math.max(
    0,
    Math.max(1, aspect / BANNER_ASPECT) * frame.zoom - 1
  );
  const overflowY = Math.max(
    0,
    Math.max(1, BANNER_ASPECT / aspect) * frame.zoom - 1
  );
  return {
    minZoom: 1 / cover,
    scale: cover * frame.zoom,
    overflowX,
    overflowY,
    offsetX: (50 - frame.x) * overflowX,
    offsetY: (50 - frame.y) * overflowY
  };
}

export function panBanner(
  frame: BannerFrame,
  aspect: number,
  dx: number,
  dy: number
): BannerFrame {
  const { overflowX, overflowY } = bannerGeometry(aspect, frame);
  return normalizeBannerFrame({
    ...frame,
    x: overflowX > 0.00001 ? frame.x - (dx * 100) / overflowX : 50,
    y: overflowY > 0.00001 ? frame.y - (dy * 100) / overflowY : 50
  });
}
