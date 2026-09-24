/**
 * Image URL optimizer for fast network loading:
 * - Switches TMDB to high-speed Cloudflare CDN (image.tmdb.org)
 * - Downscales poster requests from w600/original to w342 (~30-50KB)
 * - Downscales backdrops from 4K (w3840) to w780 / w1280 (~80KB)
 * - Maps local heavy PNGs to lightweight compressed WebP equivalents
 */
export function optimizeImageUrl(
  url: string | null | undefined,
  type: 'poster' | 'backdrop' | 'thumb' = 'poster'
): string {
  if (!url) return '';

  // Local Figma assets: use high-efficiency WebP
  if (url.includes('/assets/figma/')) {
    return url.replace(/\.(png|jpg)$/i, '.webp');
  }

  // TMDB URLs optimization
  if (url.includes('themoviedb.org/t/p/')) {
    let optimized = url.replace('www.themoviedb.org', 'image.tmdb.org');

    if (type === 'poster') {
      optimized = optimized.replace(
        /\/t\/p\/(original|w\d+(_and_h\d+_\w+)?)/,
        '/t/p/w342'
      );
    } else if (type === 'thumb') {
      optimized = optimized.replace(
        /\/t\/p\/(original|w\d+(_and_h\d+_\w+)?)/,
        '/t/p/w185'
      );
    } else if (type === 'backdrop') {
      optimized = optimized.replace(
        /\/t\/p\/(original|w\d+(_and_h\d+_\w+)?)/,
        '/t/p/w780'
      );
    }

    return optimized;
  }

  return url;
}
