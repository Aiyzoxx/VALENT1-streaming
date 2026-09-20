// Clés TMDB (token read-only : usage côté client prévu par TMDB,
// aucun droit d'écriture — risque limité si exposé dans le binaire).
export const TMDB = {
  readToken:
    'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJhYWI0ZjVmNzE1MzQyZTRkMGZlNDQzYTBiYTI4ZmZhNSIsIm5iZiI6MTc4OTg1Mzg1NS4zOSwic3ViIjoiNmFhZjAwOWZjZjU4NTQ3YmFmYjlmNTNkIiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.Z-PIlOjmpR9WyqYN6V73rtlHmJ2cwb5qqZL8j4jctbk',
  apiKey: 'aab4f5f715342e4d0fe443a0ba28ffa5',
  baseUrl: 'https://api.themoviedb.org/3',
  imageBaseUrl: 'https://image.tmdb.org/t/p',
  language: 'fr-FR',
  region: 'FR',
} as const;
