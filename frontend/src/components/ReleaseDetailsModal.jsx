import { useMemo, useState } from 'react';
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
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0);

  const tracks = release?.tracks || [];
  const selectedTrack = useMemo(
    () => (tracks.length ? normalizeTrack(tracks[selectedTrackIndex] || tracks[0]) : null),
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
  const detailFields = [
    { label: 'Жанр', value: release.displayGenre || 'Не указан' },
    { label: 'Тип релиза', value: release.release_type || release.type || 'Не указан' },
    { label: 'ISRC', value: selectedTrack?.isrc || 'Не указан' },
    { label: 'Ненормативная лексика', value: selectedTrack ? (selectedTrack.explicit ? 'Да' : 'Нет') : 'Нет' },
    { label: 'Telegram', value: release.metadata?.telegram || 'Не указан' },
    { label: 'Комментарий', value: release.metadata?.comment || 'Нет комментария' },
    { label: 'Spotify', value: profileLabel(release.metadata?.spotify_profile) },
    { label: 'Apple Music', value: profileLabel(release.metadata?.apple_music_profile) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#0a0a0a] shadow-[0_40px_120px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-7 py-6">
          <h2 className="text-[2rem] font-extrabold tracking-[-0.04em] text-white">Подробности релиза</h2>
          <button type="button" onClick={onClose} className="rounded-full border border-white/10 p-3 text-slate-400 transition hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-8 overflow-y-auto px-7 py-7 lg:grid-cols-[260px_1fr]">
          <aside className="space-y-4">
            <a href={release.cover} download className="block overflow-hidden rounded-[26px] border border-white/10">
              <img src={release.cover} alt={release.title} className="aspect-square w-full object-cover" />
            </a>

            <div className={`flex items-center justify-center rounded-2xl border px-4 py-3 text-sm font-bold uppercase tracking-[0.2em] ${statusMeta.badgeClass}`}>
              {statusMeta.label}
            </div>

            <div className="soft-card p-4 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Дата</span>
                <span className="font-semibold text-white">{formatDate(release.metadata?.release_date || release.created_at)}</span>
              </div>
            </div>

            <div className="soft-card p-4 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">UPC</span>
                <span className="font-semibold text-white">{release.metadata?.upc || 'Не указан'}</span>
              </div>
            </div>

            {showOwner ? (
              <>
                <div className="soft-card p-4 text-sm text-slate-300">
                  <div className="flex items-center gap-2">
                    <User2 size={15} className="text-slate-500" />
                    <span>{release.artist_login || 'Не указан'}</span>
                  </div>
                </div>
                <div className="soft-card p-4 text-sm text-slate-300">
                  <div className="flex items-center gap-2">
                    <Mail size={15} className="text-slate-500" />
                    <span className="break-all">{release.artist_email || 'Не указан'}</span>
                  </div>
                </div>
              </>
            ) : null}

            {actionButtons ? <div className="space-y-2">{actionButtons}</div> : null}
          </aside>

          <section className="min-h-0 space-y-6">
            <div>
              <h3 className="text-[3rem] font-extrabold tracking-[-0.05em] text-white">{release.title}</h3>
              <p className="mt-2 text-2xl font-medium text-slate-400">{release.artists}</p>
            </div>

            <div>
              <div className="mb-4 flex items-center gap-2 text-2xl font-bold text-white">
                <ChevronRight size={20} className="text-slate-500" />
                Треклист
              </div>

              <div className="space-y-3">
                {tracks.map((track, index) => {
                  const currentTrack = normalizeTrack(track);
                  const isActive = selectedTrackIndex === index;

                  return (
                    <button
                      key={`${currentTrack.title}-${index}`}
                      type="button"
                      onClick={() => setSelectedTrackIndex(index)}
                      className={`flex w-full items-center justify-between rounded-[20px] border px-5 py-4 text-left transition ${
                        isActive
                          ? 'border-white/20 bg-white/[0.05]'
                          : 'border-white/8 bg-white/[0.02] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="w-5 text-lg text-slate-500">{index + 1}</span>
                        <span className="text-[1.4rem] font-semibold text-white">{currentTrack.title}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {currentTrack.audioUrl ? (
                          <a
                            href={currentTrack.audioUrl}
                            download={currentTrack.originalFilename || true}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded-full border border-white/10 p-2 text-slate-400 transition hover:text-white"
                          >
                            <Download size={16} />
                          </a>
                        ) : null}
                        {isActive ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-500" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedTrack ? (
              <>
                <div className="panel-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">Информация о треке</p>
                      <h4 className="mt-2 text-2xl font-bold text-white">{selectedTrack.title}</h4>
                      <p className="mt-1 text-slate-400">{selectedTrack.artists}</p>
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
                    <div className="mt-5 rounded-[20px] border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                      Аудиофайл для этого трека не найден.
                    </div>
                  )}
                </div>

                <div className="border-t border-white/10 pt-6">
                  <p className="text-sm font-bold uppercase tracking-[0.24em] text-slate-500">Дополнительно</p>
                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    {detailFields.map((field) => (
                      <div key={field.label}>
                        <p className="text-sm text-slate-500">{field.label}</p>
                        <p className="mt-2 text-xl font-medium text-white">{field.value}</p>
                      </div>
                    ))}
                    <div>
                      <p className="text-sm text-slate-500">Авторы текста</p>
                      <p className="mt-2 text-xl font-medium text-white">{selectedTrack.lyricsAuthors}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Авторы музыки</p>
                      <p className="mt-2 text-xl font-medium text-white">{selectedTrack.musicAuthors}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
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
  );
}
