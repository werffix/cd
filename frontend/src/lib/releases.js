export const STATUS_META = {
  draft: { label: 'Черновик', badgeClass: 'border-slate-500/20 bg-slate-500/10 text-slate-300' },
  moderation: { label: 'На рассмотрении', badgeClass: 'border-amber-400/20 bg-amber-400/10 text-amber-100' },
  delivered: { label: 'Не отгружен', badgeClass: 'border-sky-400/20 bg-sky-400/10 text-sky-100' },
  shipped: { label: 'Отправлен', badgeClass: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' },
  rejected: { label: 'Отклонён', badgeClass: 'border-red-400/20 bg-red-400/10 text-red-200' },
};

export const ADMIN_FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'moderation', label: 'На рассмотрении' },
  { key: 'rejected', label: 'Отклонен' },
  { key: 'delivered', label: 'Не отгружен' },
  { key: 'shipped', label: 'Отгружен' },
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
