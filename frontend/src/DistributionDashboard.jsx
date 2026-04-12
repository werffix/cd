import React, { useEffect, useState } from 'react';
import {
  Music2,
  Plus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from './apiUpload';
import ReleaseDetailsModal from './components/ReleaseDetailsModal';
import { STATUS_META, formatDate, parseRelease } from './lib/releases';

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
    <div className="app-shell">
      <div className="mx-auto min-h-screen w-full max-w-[1600px] px-5 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <Music2 size={18} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500">CDCULT</p>
              <p className="text-sm font-semibold text-slate-200">Distribution</p>
            </div>
          </div>

          <button type="button" onClick={() => nav('/dashboard/new')} className="primary-button">
            <Plus size={16} />
            Новый релиз
          </button>
        </header>

        <section className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-5">
          {releases.map((release) => {
            const statusMeta = STATUS_META[release.status] || STATUS_META.draft;
            return (
              <button
                key={release.id}
                type="button"
                onClick={() => openReleaseModal(release)}
                className="group rounded-[26px] border border-white/10 bg-[#0a0a0a] text-left shadow-[0_18px_50px_rgba(0,0,0,0.4)] transition hover:-translate-y-1 hover:border-white/20"
              >
                <div className="relative overflow-hidden rounded-[22px] bg-[#0a0a0a]">
                  <img src={release.cover} alt={release.title} className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105" />
                  <div className={`absolute right-4 top-4 rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.badgeClass}`}>
                    {statusMeta.label}
                  </div>
                </div>
                <div className="space-y-4 px-5 pb-5 pt-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{release.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">{release.artists}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Дата релиза</span>
                    <span className="text-slate-200">{formatDate(release.metadata?.release_date || release.created_at)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </section>
      </div>

      <ReleaseDetailsModal
        release={selectedRelease}
        onClose={() => setSelectedRelease(null)}
      />
    </div>
  );
}
