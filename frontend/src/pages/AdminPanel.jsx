import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, Search, Send, XCircle } from 'lucide-react';
import api from '../api';
import ReleaseDetailsModal from '../components/ReleaseDetailsModal';
import { ADMIN_FILTERS, STATUS_META, formatDate, parseRelease } from '../lib/releases';
import siteLogo from '../assets/site-logo.png';

const getArtistLabel = (release) =>
  release.artists || release.artist_login || release.artist_email || 'Артист не указан';

export default function AdminPanel() {
  const [releases, setReleases] = useState([]);
  const [selectedRelease, setSelectedRelease] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const fetchReleases = async () => {
    const res = await api.get('/admin/releases');
    const parsed = res.data.map(parseRelease);
    setReleases(parsed);
    return parsed;
  };

  useEffect(() => {
    fetchReleases();
  }, []);

  const updateStatus = async (id, status) => {
    await api.put(`/admin/releases/${id}`, { status });
    const updated = await fetchReleases();
    if (selectedRelease?.id === id) {
      const nextSelected = updated.find((item) => item.id === id);
      if (nextSelected) setSelectedRelease(nextSelected);
    }
  };

  const filteredReleases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return releases.filter((release) => {
      const matchesFilter = filter === 'all' ? true : release.status === filter;
      if (!matchesFilter) return false;
      if (!normalizedQuery) return true;
      const haystack = `${release.title || ''} ${getArtistLabel(release)}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [filter, query, releases]);

  const buildActionButtons = (release, fullWidth = false) => {
    if (!release) return null;
    const baseClass = fullWidth ? 'flex-1' : '';
    return (
      <>
        {release.status !== 'delivered' && release.status !== 'shipped' ? (
          <button
            type="button"
            onClick={() => updateStatus(release.id, 'delivered')}
            className={`primary-button ${baseClass}`}
          >
            <CheckCheck size={15} />
            Одобрить
          </button>
        ) : null}
        {release.status === 'delivered' ? (
          <button
            type="button"
            onClick={() => updateStatus(release.id, 'shipped')}
            className={`secondary-button ${baseClass}`}
          >
            <Send size={15} />
            Отправлен
          </button>
        ) : null}
        {release.status !== 'rejected' ? (
          <button
            type="button"
            onClick={() => updateStatus(release.id, 'rejected')}
            className={`secondary-button border-red-400/20 bg-red-400/10 text-red-100 hover:bg-red-400/20 ${baseClass}`}
          >
            <XCircle size={15} />
            Отклонить
          </button>
        ) : null}
      </>
    );
  };

  return (
    <div className="app-shell min-h-screen bg-[#0a0a0a] px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800/60 pb-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg shadow-white/10">
              <img src={siteLogo} alt="CDCULT" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">CDCULT</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Панель модерации</h1>
              <p className="mt-2 text-sm text-zinc-400">Поиск релизов, управление статусами и проверка материалов.</p>
            </div>
          </div>

          <div className="flex w-full max-w-md items-center gap-3 sm:w-auto">
            <div className="relative w-full">
              <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по названию или артисту"
                className="field-input w-full pl-11"
              />
            </div>
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          {ADMIN_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                filter === item.key ? 'border-white bg-white text-black' : 'border-zinc-800/60 bg-zinc-900/40 text-zinc-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {filteredReleases.map((release) => {
            const statusMeta = STATUS_META[release.status] || STATUS_META.draft;
            return (
              <div key={release.id} className="rounded-2xl border border-zinc-800/60 bg-[#121212] shadow-2xl">
                <button type="button" onClick={() => setSelectedRelease(release)} className="block w-full text-left">
                  <div className="relative aspect-square overflow-hidden bg-zinc-900 border-b border-zinc-800/60">
                    <img src={release.cover} alt={release.title} className="h-full w-full object-cover transition duration-700 hover:scale-105" />
                    <div className="absolute right-3 top-3">
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${statusMeta.badgeClass}`}>
                        {statusMeta.label}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-4 px-5 pb-5 pt-4">
                    <div>
                      <h3 className="text-lg font-bold tracking-tight text-white">{release.title}</h3>
                      <p className="mt-1 text-sm font-medium text-zinc-400">{getArtistLabel(release)}</p>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-500">Дата релиза</span>
                      <span className="font-semibold text-zinc-300">{formatDate(release.metadata?.release_date || release.created_at)}</span>
                    </div>
                  </div>
                </button>
                <div className="flex flex-wrap gap-2 px-5 pb-5">
                  {buildActionButtons(release, true)}
                </div>
              </div>
            );
          })}
        </section>
      </div>

      <ReleaseDetailsModal
        release={selectedRelease}
        onClose={() => setSelectedRelease(null)}
        showOwner
        actionButtons={buildActionButtons(selectedRelease)}
      />
    </div>
  );
}
