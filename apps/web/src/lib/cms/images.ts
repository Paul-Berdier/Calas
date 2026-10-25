import { createImageUrlBuilder } from '@sanity/image-url';
import type { ContentImage } from './types';
import { serverEnv } from './env';

export function imageUrl(image: ContentImage, width: number, height?: number): string | undefined {
  if (!image?.asset) return undefined;
  const projectId = serverEnv('PUBLIC_SANITY_PROJECT_ID');
  const dataset = serverEnv('PUBLIC_SANITY_DATASET');
  if (!projectId || !dataset) return undefined;
  const builder = createImageUrlBuilder({ projectId, dataset }).image(image).width(width);
  const sized = height === undefined ? builder.fit('max') : builder.height(height).fit('crop');
  return sized.auto('format').quality(82).url();
}
