import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  MoreHorizontal,
  Mail,
  Pause,
  Play,
  User2,
  X,
} from 'lucide-react';
import { STATUS_META, formatDate, normalizeTrack } from '../lib/releases';

function AudioPlayer({ src }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const handleLoaded = () => setDuration(audio.duration || 0);
    const handleTime = () => {
      setCurrentTime(audio.currentTime || 0);
      setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
    };
    const handleEnded = () => setPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoaded);
    audio.addEventListener('timeupdate', handleTime);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoaded);
      audio.removeEventListener('timeupdate', handleTime);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  }, [src]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    await audio.play();
    setPlaying(true);
  };

  const handleSeek = (event) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const nextValue = Number(event.target.value);
    audio.currentTime = (nextValue / 100) * audio.duration;
    setProgress(nextValue);
  };

  const formatTime = (value) => {
    const total = Number.isFinite(value) ? Math.floor(value) : 0;
    const minutes = Math.floor(total / 60);
    const seconds = String(total % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  return (
    <div className="mb-4 rounded-xl border border-zinc-800/70 bg-black/40 p-4">
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="flex items-center gap-4">
        <button type="button" onClick={togglePlayback} className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black transition hover:bg-zinc-200">
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <div className="flex-1">
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={handleSeek}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-white"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReleaseDetailsModal({
  release,
  onClose,
  actionButtons,
  showOwner = false,
  onRecall,
  onDelete,
  onEdit,
  onRequestUpc,
}) {
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);

  useEffect(() => {
    setSelectedTrackIndex(null);
    setActionsOpen(false);
    setCommentOpen(false);
  }, [release?.id]);

  if (!release) return null;

  const tracks = release?.tracks || [];
  const statusMeta = STATUS_META[release.status] || STATUS_META.draft;

  const profileLabel = (value) => {
    if (!value) return 'Не указано';
    if (value === 'already_submitted') return 'Указывал ранее';
    if (value === 'exists') return 'Есть';
    if (value === 'create') return 'Создать';
    return value;
  };

  const releaseFields = [
    { label: 'Название релиза', value: release.title || 'Не указан' },
    { label: 'Артист', value: release.artists || 'Не указан' },
    ...(release.subtitle ? [{ label: 'Подзаголовок', value: release.subtitle }] : []),
    { label: 'Жанр', value: release.displayGenre || 'Не указан' },
    { label: 'Тип релиза', value: release.release_type || release.type || 'Не указан' },
    { label: 'Telegram', value: release.metadata?.telegram || 'Не указан' },
    { label: 'Комментарий', value: release.metadata?.comment || 'Нет комментария' },
    ...(release.label_name ? [{ label: 'Лейбл', value: release.label_name }] : []),
    { label: 'Spotify', value: release.metadata?.spotify_profile === 'exists' ? (release.metadata?.spotify_link || 'Не указано') : profileLabel(release.metadata?.spotify_profile) },
    { label: 'Apple Music', value: release.metadata?.apple_music_profile === 'exists' ? (release.metadata?.apple_music_link || 'Не указано') : profileLabel(release.metadata?.apple_music_profile) },
  ];

  if (release.metadata?.original_release_date) {
    releaseFields.push({ label: 'Оригинальная дата релиза', value: release.metadata.original_release_date });
  }
  if (release.metadata?.moderator_comment) {
    releaseFields.push({ label: 'Комментарий модератора', value: release.metadata.moderator_comment });
  }

  const copyEnabledLabels = new Set([
    'Название релиза',
    'Артист',
    'UPC',
    'Telegram',
    'Spotify',
    'Apple Music',
    'Лейбл',
  ]);

  const copyValue = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
    } catch (error) {
      const textarea = document.createElement('textarea');
      textarea.value = String(value);
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  const downloadAsset = async (url, filename) => {
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename || url.split('/').pop() || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6 backdrop-blur-sm" onClick={onClose}>
        <div
          className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#121212] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">
          <h2 className="text-xl font-bold text-white">Подробности релиза</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-8 md:flex-row">
            <aside className="w-full space-y-4 md:w-1/3">
              <button type="button" onClick={() => downloadAsset(release.cover, `${release.title || 'cover'}.jpg`)} className="block w-full overflow-hidden rounded-xl border border-zinc-800 shadow-lg">
                <img src={release.cover} alt={release.title} className="aspect-square w-full object-cover" />
              </button>

              <span className={`inline-flex w-full items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${statusMeta.badgeClass}`}>
                {statusMeta.label}
              </span>
              {release.metadata?.moderator_comment ? (
                <button
                  type="button"
                  onClick={() => setCommentOpen(true)}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-blue-500 bg-blue-500 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white"
                >
                  Комм. от модератора
                </button>
              ) : null}

              <div className="flex justify-between rounded-lg border border-zinc-800/50 bg-zinc-900/50 p-3 text-sm text-zinc-300">
                <span className="text-zinc-500">Дата</span>
                <span className="font-medium">{formatDate(release.metadata?.release_date || release.created_at)}</span>
              </div>

              <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/50 p-3 text-sm text-zinc-300">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">UPC</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{release.metadata?.upc || 'Не указан'}</span>
                    {showOwner && release.metadata?.upc ? (
                      <button type="button" onClick={() => copyValue(release.metadata?.upc)} className="rounded-md p-1 text-zinc-400 hover:text-white">
                        <Copy size={14} />
                      </button>
                    ) : null}
                  </div>
                </div>
                {!release.metadata?.upc && !showOwner ? (
                  <button
                    type="button"
                    onClick={() => onRequestUpc?.(release)}
                    disabled={Boolean(release.metadata?.upc_requested)}
                    className="secondary-button mt-3 w-full disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {release.metadata?.upc_requested ? 'Запрос отправлен' : 'Запрос UPC'}
                  </button>
                ) : null}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActionsOpen((prev) => !prev)}
                  className="secondary-button w-full justify-between"
                >
                  Действия
                  <MoreHorizontal size={16} />
                </button>
                {actionsOpen ? (
                  <div className="absolute left-0 top-12 z-20 w-full rounded-xl border border-zinc-800/60 bg-[#121212] p-2 shadow-2xl">
                    {release.status === 'shipped' ? (
                      <button
                        type="button"
                        onClick={() => {
                          onRecall?.(release);
                          setActionsOpen(false);
                        }}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800/60"
                      >
                        Отозвать с площадок
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        onEdit?.(release);
                        setActionsOpen(false);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800/60"
                    >
                      Редактировать релиз
                    </button>
                    {(release.status === 'draft' || release.status === 'moderation' || release.status === 'delivered') ? (
                      <button
                        type="button"
                        onClick={() => {
                          onDelete?.(release);
                          setActionsOpen(false);
                        }}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-200 hover:bg-zinc-800/60"
                      >
                        Удалить релиз
                      </button>
                    ) : null}
                    <div className="border-t border-zinc-800/60 pt-2">
                      <button type="button" onClick={() => downloadAsset(release.cover, `${release.title || 'cover'}.jpg`)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800/60">
                        Скачать обложку
                      </button>
                      {release.metadata?.demo ? (
                        <a href={release.metadata.demo} target="_blank" rel="noreferrer" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800/60">
                          Открыть демо / договор
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              {showOwner ? (
                <>
                  <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/50 p-3 text-sm text-zinc-300">
                    <div className="flex items-center gap-2">
                      <User2 size={15} className="text-zinc-500" />
                      <span>{release.artist_login || 'Не указан'}</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/50 p-3 text-sm text-zinc-300">
                    <div className="flex items-center gap-2">
                      <Mail size={15} className="text-zinc-500" />
                      <span className="break-all">{release.artist_email || 'Не указан'}</span>
                    </div>
                  </div>
                </>
              ) : null}

              {actionButtons ? <div className="space-y-2">{actionButtons}</div> : null}
            </aside>

            <section className="w-full space-y-6 md:w-2/3">
              <div>
                <h3 className="text-3xl font-bold tracking-tight text-white">{release.title}</h3>
                <p className="mt-1 text-xl font-medium text-zinc-400">{release.artists}</p>
              </div>

              <div>
                <div className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                  <ChevronRight size={18} className="text-zinc-400" />
                  Треклист
                </div>

                <div className="space-y-2">
                  {tracks.map((track, index) => {
                    const currentTrack = normalizeTrack(track);
                    const isActive = selectedTrackIndex === index;

                    return (
                      <div
                        key={`${currentTrack.title}-${index}`}
                        className={`rounded-xl border transition ${
                          isActive ? 'border-zinc-700 bg-zinc-800/60' : 'border-zinc-800/60 bg-zinc-900/30'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedTrackIndex((prev) => (prev === index ? null : index))}
                          className="group flex w-full items-center justify-between px-4 py-3 text-left"
                        >
                          <div className="flex items-center gap-4">
                            <span className="w-4 text-right font-medium text-zinc-600">{index + 1}</span>
                            <span className="font-medium text-zinc-200 group-hover:text-white">{currentTrack.title}</span>
                          </div>
                          <div className="flex items-center gap-2 text-zinc-500">
                            {currentTrack.audioUrl ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadAsset(currentTrack.audioUrl, currentTrack.originalFilename || `${currentTrack.title}.wav`);
                                }}
                                className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                              >
                                <Download size={16} />
                              </button>
                            ) : null}
                            {isActive ? <ChevronDown size={18} className="text-zinc-400" /> : <ChevronRight size={18} className="text-zinc-500" />}
                          </div>
                        </button>

                        {isActive ? (
                          <div className="border-t border-zinc-800/70 px-4 py-4">
                            {currentTrack.audioUrl ? (
                              <AudioPlayer src={currentTrack.audioUrl} />
                            ) : (
                              <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
                                Аудиофайл для этого трека не найден.
                              </div>
                            )}

                            <div className="grid gap-4 text-sm md:grid-cols-2">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-zinc-600">Название трека</p>
                                  <p className="mt-1 font-medium text-zinc-300">{currentTrack.title}</p>
                                </div>
                                {showOwner ? <button type="button" onClick={() => copyValue(currentTrack.title)} className="rounded-md p-1 text-zinc-400 hover:text-white"><Copy size={14} /></button> : null}
                              </div>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-zinc-600">Артисты (в треке)</p>
                                  <p className="mt-1 font-medium text-zinc-300">{currentTrack.artists}</p>
                                </div>
                                {showOwner ? <button type="button" onClick={() => copyValue(currentTrack.artists)} className="rounded-md p-1 text-zinc-400 hover:text-white"><Copy size={14} /></button> : null}
                              </div>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-zinc-600">ФИО авторов текста</p>
                                  <p className="mt-1 font-medium text-zinc-300">{currentTrack.lyricsAuthors}</p>
                                </div>
                                {showOwner ? <button type="button" onClick={() => copyValue(currentTrack.lyricsAuthors)} className="rounded-md p-1 text-zinc-400 hover:text-white"><Copy size={14} /></button> : null}
                              </div>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-zinc-600">ФИО авторов музыки</p>
                                  <p className="mt-1 font-medium text-zinc-300">{currentTrack.musicAuthors}</p>
                                </div>
                                {showOwner ? <button type="button" onClick={() => copyValue(currentTrack.musicAuthors)} className="rounded-md p-1 text-zinc-400 hover:text-white"><Copy size={14} /></button> : null}
                              </div>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-zinc-600">ISRC (опционально)</p>
                                  <p className="mt-1 font-medium text-zinc-300">{currentTrack.isrc || 'Не указан'}</p>
                                </div>
                                {showOwner ? <button type="button" onClick={() => copyValue(currentTrack.isrc)} className="rounded-md p-1 text-zinc-400 hover:text-white"><Copy size={14} /></button> : null}
                              </div>
                              <div>
                                <p className="text-zinc-600">Ненормативная лексика</p>
                                <p className="mt-1 font-medium text-zinc-300">{currentTrack.explicit ? 'Да' : 'Нет'}</p>
                              </div>
                              <div>
                                <p className="text-zinc-600">Инструментальная музыка</p>
                                <p className="mt-1 font-medium text-zinc-300">{currentTrack.instrumental ? 'Да' : 'Нет'}</p>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-zinc-800/50 pt-6">
                <p className="text-sm font-bold uppercase tracking-[0.24em] text-zinc-500">Данные о релизе</p>
                <div className="mt-5 grid gap-4 text-sm md:grid-cols-2">
                  {releaseFields.map((field) => (
                    <div key={field.label} className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-zinc-600">{field.label}</p>
                        <p className="mt-1 break-words font-medium text-zinc-300">{field.value}</p>
                      </div>
                      {showOwner && copyEnabledLabels.has(field.label) ? (
                        <button type="button" onClick={() => copyValue(field.value)} className="rounded-md p-1 text-zinc-400 hover:text-white">
                          <Copy size={14} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
        </div>
      </div>
      {commentOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setCommentOpen(false)}>
          <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-[#121212] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-white">Комментарий от модератора</h3>
            <p className="mt-4 whitespace-pre-line text-sm leading-6 text-zinc-300">{release.metadata?.moderator_comment}</p>
            <button type="button" onClick={() => setCommentOpen(false)} className="primary-button mt-6">
              Закрыть
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
