import { useEffect, useMemo, useState } from 'react';
import {
  Barcode,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
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
}) {
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(null);

  const tracks = release?.tracks || [];

  useEffect(() => {
    setSelectedTrackIndex(null);
  }, [release?.id]);
  const selectedTrack = useMemo(
    () => (selectedTrackIndex === null ? null : normalizeTrack(tracks[selectedTrackIndex] || tracks[0])),
    [selectedTrackIndex, tracks],
  );

  if (!release) return null;

  const statusMeta = STATUS_META[release.status] || STATUS_META.draft;
  const profileLabel = (value) => {
    if (!value) return 'Не указано';
    if (value === 'already_submitted') return 'Указывал ранее';
    if (value === 'exists') return 'Есть';
    if (value === 'create') return 'Создать';
    return value;
  };
  const releaseFields = [
    { label: 'Жанр', value: release.displayGenre || 'Не указан' },
    { label: 'Тип релиза', value: release.release_type || release.type || 'Не указан' },
    { label: 'Telegram', value: release.metadata?.telegram || 'Не указан' },
    { label: 'Комментарий', value: release.metadata?.comment || 'Нет комментария' },
    { label: 'Spotify', value: profileLabel(release.metadata?.spotify_profile) },
    { label: 'Apple Music', value: profileLabel(release.metadata?.apple_music_profile) },
  ];
  if (release.metadata?.moderator_comment) {
    releaseFields.push({ label: 'Комментарий модератора', value: release.metadata.moderator_comment });
  }

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

              <div className="flex justify-between rounded-lg border border-zinc-800/50 bg-zinc-900/50 p-3 text-sm text-zinc-300">
                <span className="text-zinc-500">Дата</span>
                <span className="font-medium">{formatDate(release.metadata?.release_date || release.created_at)}</span>
              </div>

              <div className="flex justify-between rounded-lg border border-zinc-800/50 bg-zinc-900/50 p-3 text-sm text-zinc-300">
                <span className="text-zinc-500">UPC</span>
                <span className="font-medium">{release.metadata?.upc || 'Не указан'}</span>
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
                      <button
                        key={`${currentTrack.title}-${index}`}
                        type="button"
                        onClick={() => setSelectedTrackIndex((prev) => (prev === index ? null : index))}
                        className={`group flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                          isActive
                            ? 'border-zinc-700 bg-zinc-800/60'
                            : 'border-zinc-800/60 bg-zinc-900/30 hover:bg-zinc-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="w-4 text-right text-zinc-600 font-medium">{index + 1}</span>
                          <span className="text-zinc-200 font-medium group-hover:text-white">{currentTrack.title}</span>
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
                    );
                  })}
                </div>
              </div>

              {selectedTrack ? (
                <>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.28em] text-zinc-500">Информация о треке</p>
                        <h4 className="mt-2 text-2xl font-bold text-white">{selectedTrack.title}</h4>
                        <p className="mt-1 text-zinc-400">{selectedTrack.artists}</p>
                      </div>
                      {selectedTrack.audioUrl ? (
                        <a href={selectedTrack.audioUrl} download={selectedTrack.originalFilename || true} className="primary-button">
                          <Download size={16} />
                          Скачать файл
                        </a>
                      ) : null}
                    </div>

                    {selectedTrack.audioUrl ? (
                      <audio controls className="mt-5 w-full" src={selectedTrack.audioUrl} />
                    ) : (
                      <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
                        Аудиофайл для этого трека не найден.
                      </div>
                    )}

                    <div className="mt-6 grid gap-4 text-sm md:grid-cols-2">
                      <div>
                        <p className="text-zinc-600">Название трека</p>
                        <p className="mt-1 text-zinc-300 font-medium">{selectedTrack.title}</p>
                      </div>
                      <div>
                        <p className="text-zinc-600">Артисты (в треке)</p>
                        <p className="mt-1 text-zinc-300 font-medium">{selectedTrack.artists}</p>
                      </div>
                      <div>
                        <p className="text-zinc-600">ФИО авторов текста</p>
                        <p className="mt-1 text-zinc-300 font-medium">{selectedTrack.lyricsAuthors}</p>
                      </div>
                      <div>
                        <p className="text-zinc-600">ФИО авторов музыки</p>
                        <p className="mt-1 text-zinc-300 font-medium">{selectedTrack.musicAuthors}</p>
                      </div>
                      <div>
                        <p className="text-zinc-600">ISRC (опционально)</p>
                        <p className="mt-1 text-zinc-300 font-medium">{selectedTrack.isrc || 'Не указан'}</p>
                      </div>
                      <div>
                        <p className="text-zinc-600">Ненормативная лексика</p>
                        <p className="mt-1 text-zinc-300 font-medium">{selectedTrack.explicit ? 'Да' : 'Нет'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-zinc-800/50 pt-6">
                    <p className="text-sm font-bold uppercase tracking-[0.24em] text-zinc-500">Данные релиза</p>
                    <div className="mt-5 grid gap-4 md:grid-cols-2 text-sm">
                      {releaseFields.map((field) => (
                        <div key={field.label}>
                          <p className="text-zinc-600">{field.label}</p>
                          <p className="mt-1 text-zinc-300 font-medium">{field.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              {!selectedTrack ? (
                <div className="border-t border-zinc-800/50 pt-6">
                  <p className="text-sm font-bold uppercase tracking-[0.24em] text-zinc-500">Данные релиза</p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2 text-sm">
                    {releaseFields.map((field) => (
                      <div key={field.label}>
                        <p className="text-zinc-600">{field.label}</p>
                        <p className="mt-1 text-zinc-300 font-medium">{field.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <a href={release.cover} download className="secondary-button justify-center">
                  <Download size={16} />
                  Скачать обложку
                </a>
                {release.metadata?.demo ? (
                  <a href={release.metadata.demo} target="_blank" rel="noreferrer" className="secondary-button justify-center">
                    <Barcode size={16} />
                    Открыть демо / договор
                  </a>
                ) : (
                  <div className="secondary-button pointer-events-none justify-center opacity-50">
                    <Calendar size={16} />
                    Демо не добавлено
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
