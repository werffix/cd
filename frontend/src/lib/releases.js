export const STATUS_META = {
  draft: { label: 'Черновик', badgeClass: 'border-zinc-500 bg-zinc-500/20 text-zinc-200' },
  moderation: { label: 'На рассмотрении', badgeClass: 'border-amber-400 bg-amber-400/20 text-amber-200' },
  delivered: { label: 'Ожидает доставки', badgeClass: 'border-emerald-400 bg-emerald-400/20 text-emerald-200' },
  shipped: { label: 'Доставлен', badgeClass: 'border-emerald-400 bg-emerald-400/20 text-emerald-200' },
  revoked: { label: 'Отозван', badgeClass: 'border-rose-400 bg-rose-400/20 text-rose-200' },
  rejected: { label: 'Отклонён', badgeClass: 'border-red-400 bg-red-400/20 text-red-200' },
};

export const ADMIN_FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'moderation', label: 'На рассмотрении' },
  { key: 'rejected', label: 'Отклонен' },
  { key: 'delivered', label: 'Ожидает доставки' },
  { key: 'shipped', label: 'Доставлен' },
  { key: 'revoked', label: 'Отозван' },
];

export const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');

export const resolveAssetUrl = (assetPath) => {
  if (!assetPath) return 'https://via.placeholder.com/500';
  if (/^https?:\/\//.test(assetPath)) return assetPath;
  return `${API_ORIGIN}${assetPath}`;
};

export const formatDate = (value) => {
  if (!value) return 'Не указана';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('ru-RU');
};

export const mergeReleaseTracks = (tracks = []) => {
  const merged = [];

  tracks.forEach((track = {}) => {
    const title = (track.track_title || track.title || '').trim().toLowerCase();
    const artists = (track.track_artists || track.artists || '').trim().toLowerCase();
    if (!title && !artists) {
      return;
    }
    const existingIndex = merged.findIndex((item) => {
      const itemTitle = (item.track_title || item.title || '').trim().toLowerCase();
      const itemArtists = (item.track_artists || item.artists || '').trim().toLowerCase();
      return itemTitle === title && itemArtists === artists;
    });

    if (existingIndex >= 0) {
      merged[existingIndex] = {
        ...merged[existingIndex],
        ...track,
      };
      return;
    }

    merged.push(track);
  });

  return merged;
};

export const normalizeTrack = (track = {}) => ({
  title: track.track_title || track.title || 'Без названия',
  artists: track.track_artists || track.artists || 'Артист не указан',
  lyricsAuthors: track.lyrics_authors || track.lyricsAuthors || 'Не указаны',
  musicAuthors: track.music_authors || track.musicAuthors || 'Не указаны',
  explicit: Boolean(track.explicit),
  instrumental: Boolean(track.instrumental),
  isrc: track.isrc || 'Не указан',
  audioUrl: track.audio_file ? resolveAssetUrl(track.audio_file) : null,
  originalFilename: track.original_filename || track.originalFilename || null,
});

export const parseRelease = (release) => {
  const metadata =
    release.metadata && typeof release.metadata === 'string'
      ? JSON.parse(release.metadata)
      : release.metadata || {};

  const tracks = mergeReleaseTracks([...(release.tracks || []), ...(metadata.tracks || [])]);
  return {
    ...release,
    metadata,
    date: formatDate(release.created_at),
    cover: resolveAssetUrl(release.cover_url),
    tracks,
    displayGenre: metadata.sub_genre && metadata.main_genre
      ? `${metadata.main_genre} / ${metadata.sub_genre}`
      : metadata.main_genre || release.genre || 'Не указан',
  };
};
