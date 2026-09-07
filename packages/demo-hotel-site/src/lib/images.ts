const BASE = 'https://images.unsplash.com/photo-';

export function unsplashUrl(photoId: string, w: number, h: number): string {
  return `${BASE}${photoId}?auto=format&fit=crop&w=${w}&h=${h}&q=70`;
}
