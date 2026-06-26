export interface EntityTokenSize {
  width: number;
  height: number;
}

export interface FitEntityArtSizeOptions {
  minSize?: number;
  maxSize?: number;
}

export function fitEntityArtSizeToImage(
  defaultSize: EntityTokenSize,
  imageSize: EntityTokenSize,
  options: FitEntityArtSizeOptions = {}
): EntityTokenSize {
  const minSize = options.minSize ?? 64;
  const maxSize = options.maxSize ?? 1200;
  const defaultWidth = Math.min(maxSize, Math.max(minSize, Math.round(defaultSize.width)));
  const defaultHeight = Math.min(maxSize, Math.max(minSize, Math.round(defaultSize.height)));
  const imageWidth = Math.round(imageSize.width);
  const imageHeight = Math.round(imageSize.height);

  if (imageWidth <= 0 || imageHeight <= 0) {
    return { width: defaultWidth, height: defaultHeight };
  }

  const aspect = imageWidth / imageHeight;
  let width = defaultWidth;
  let height = Math.round(width / aspect);

  if (height > maxSize) {
    height = maxSize;
    width = Math.round(height * aspect);
  }

  if (height < minSize) {
    height = minSize;
    width = Math.round(height * aspect);
  }

  return {
    width: Math.min(maxSize, Math.max(minSize, width)),
    height: Math.min(maxSize, Math.max(minSize, height)),
  };
}
