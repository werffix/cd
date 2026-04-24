import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  MoreHorizontal,
  Mail,
  User2,
  X,
} from 'lucide-react';
import { STATUS_META, formatDate, normalizeTrack } from '../lib/releases';

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

  useEffect(() => {
    setSelectedTrackIndex(null);
    setActionsOpen(false);
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
    { label: 'Spotify', value: profileLabel(release.metadata?.spotify_profile) },
    { label: 'Apple Music', value: profileLabel(release.metadata?.apple_music_profile) },
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
  ]);

  const copyValue = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
    } catch (error) {
      console.error(error);
    }
  };

  return (
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
              <a href={release.cover} download className="block overflow-hidden rounded-xl border border-zinc-800 shadow-lg">
                <img src={release.cover} alt={release.title} className="aspect-square w-full object-cover" />
              </a>

              <span className={`inline-flex w-full items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${statusMeta.badgeClass}`}>
                {statusMeta.label}
              </span>
              {release.metadata?.moderator_comment ? (
                <span className="inline-flex w-full items-center justify-center rounded-lg border border-blue-500 bg-blue-500 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                  Комм. от модератора
                </span>
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
                  <button type="button" onClick={() => onRequestUpc?.(release)} className="secondary-button mt-3 w-full">
                    Запрос UPC
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
                    {(release.status === 'moderation' || release.status === 'delivered') ? (
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
                      <a href={release.cover} download className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800/60">
                        Скачать обложку
                      </a>
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
                              <a
                                href={currentTrack.audioUrl}
                                download={currentTrack.originalFilename || true}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                              >
                                <Download size={16} />
                              </a>
                            ) : null}
                            {isActive ? <ChevronDown size={18} className="text-zinc-400" /> : <ChevronRight size={18} className="text-zinc-500" />}
                          </div>
                        </button>

                        {isActive ? (
                          <div className="border-t border-zinc-800/70 px-4 py-4">
                            {currentTrack.audioUrl ? (
                              <audio controls className="mb-4 w-full" src={currentTrack.audioUrl} />
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
  );
}
