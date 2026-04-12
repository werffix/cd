import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from './apiUpload';
import ReleaseDetailsModal from './components/ReleaseDetailsModal';
import { STATUS_META, formatDate, parseRelease } from './lib/releases';
import siteLogo from './assets/site-logo.png';

export default function DistributionDashboard() {
  const nav = useNavigate();
  const [releases, setReleases] = useState([]);
  const [selectedRelease, setSelectedRelease] = useState(null);

  useEffect(() => {
    fetchReleases();
  }, []);

  const fetchReleases = async () => {
    try {
      const res = await api.get('/releases');
      setReleases(res.data.map(parseRelease));
    } catch (e) {
      console.error(e);
    }
  };

  const openReleaseModal = (release) => {
    setSelectedRelease(release);
  };

  return (
    <div className="app-shell min-h-screen bg-[#0a0a0a]">
      <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-zinc-800/60 bg-[#0a0a0a]/80 px-6 backdrop-blur-md sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg shadow-white/10">
            <img src={siteLogo} alt="CDCULT" className="h-full w-full object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide text-white leading-tight">CDCULT</h1>
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.2em] block">Distribution</span>
          </div>
        </div>

        <button type="button" onClick={() => nav('/dashboard/new')} className="primary-button shadow-lg shadow-white/5">
          <Plus size={16} />
          Новый релиз
        </button>
      </header>

      <main className="mx-auto w-full max-w-[1600px] px-6 py-8 sm:px-8">
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {releases.map((release) => {
            const statusMeta = STATUS_META[release.status] || STATUS_META.draft;
            return (
              <button
                key={release.id}
                type="button"
                onClick={() => openReleaseModal(release)}
                className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-800/60 bg-[#121212] text-left transition-all duration-300 hover:border-zinc-600 hover:shadow-2xl hover:shadow-white/5"
              >
                <div className="relative aspect-square overflow-hidden bg-zinc-900 border-b border-zinc-800/60">
                  <img src={release.cover} alt={release.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  <div className="absolute right-3 top-3">
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${statusMeta.badgeClass}`}>
                    {statusMeta.label}
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div>
                    <h3 className="truncate text-lg font-bold tracking-tight text-zinc-100">{release.title}</h3>
                    <p className="mt-1 truncate text-sm font-medium text-zinc-400">{release.artists}</p>
                  </div>
                  <div className="mt-auto pt-5 flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-500">Дата релиза</span>
                    <span className="font-semibold text-zinc-300">{formatDate(release.metadata?.release_date || release.created_at)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </section>
      </main>

      <ReleaseDetailsModal
        release={selectedRelease}
        onClose={() => setSelectedRelease(null)}
      />
    </div>
  );
}
