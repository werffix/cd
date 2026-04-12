import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus, User2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from './apiUpload';
import ReleaseDetailsModal from './components/ReleaseDetailsModal';
import { STATUS_META, formatDate, parseRelease } from './lib/releases';
import siteLogo from './assets/site-logo.png';
import { useAuth } from './AuthContext';

export default function DistributionDashboard() {
  const nav = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const [releases, setReleases] = useState([]);
  const [selectedRelease, setSelectedRelease] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '');
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    telegram: user?.telegram || '',
  });
  const [passwordForm, setPasswordForm] = useState({ old: '', next: '', confirm: '' });
  const [settingsMessage, setSettingsMessage] = useState('');

  useEffect(() => {
    fetchReleases();
  }, []);

  useEffect(() => {
    setAvatarPreview(user?.avatar || '');
    setProfile({
      name: user?.name || '',
      email: user?.email || '',
      telegram: user?.telegram || '',
    });
  }, [user]);

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

  const avatarFallback = useMemo(() => (!avatarPreview ? user?.name?.slice(0, 1)?.toUpperCase() : ''), [avatarPreview, user]);

  const handleAvatarChange = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  const saveSettings = () => {
    updateUser({ ...profile, avatar: avatarPreview });
    setSettingsMessage('Настройки сохранены');
    setTimeout(() => setSettingsMessage(''), 1600);
  };

  const handlePasswordSave = () => {
    if (!passwordForm.old || !passwordForm.next || passwordForm.next !== passwordForm.confirm) {
      setSettingsMessage('Проверьте данные пароля');
      setTimeout(() => setSettingsMessage(''), 1600);
      return;
    }
    setSettingsMessage('Пароль обновлён');
    setPasswordForm({ old: '', next: '', confirm: '' });
    setTimeout(() => setSettingsMessage(''), 1600);
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

        <div className="relative flex items-center gap-3">
          <button type="button" onClick={() => nav('/dashboard/new')} className="primary-button shadow-lg shadow-white/5">
            <Plus size={16} />
            Новый релиз
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-full border border-zinc-800/60 bg-zinc-900/40 px-3 py-2 text-sm text-white transition hover:bg-zinc-800/60"
          >
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-white">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
              ) : avatarFallback ? (
                <span className="text-sm font-semibold">{avatarFallback}</span>
              ) : (
                <User2 size={18} />
              )}
            </div>
            <ChevronDown size={16} className="text-zinc-400" />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-14 z-20 w-48 rounded-xl border border-zinc-800/60 bg-[#121212] p-2 shadow-2xl">
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(true);
                  setMenuOpen(false);
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800/60"
              >
                Настройки
              </button>
              <button
                type="button"
                onClick={logout}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800/60"
              >
                Выход
              </button>
            </div>
          ) : null}
        </div>
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

      {settingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6" onClick={() => setSettingsOpen(false)}>
          <div
            className="w-full max-w-3xl rounded-2xl border border-zinc-800 bg-[#121212] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <h2 className="text-xl font-bold text-white">Настройки профиля</h2>
              <button type="button" onClick={() => setSettingsOpen(false)} className="secondary-button px-3 py-2">
                Закрыть
              </button>
            </div>

            <div className="mt-6 space-y-8">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-[0.28em] text-zinc-500">Аватар</h3>
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-zinc-800">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar preview" className="h-full w-full object-cover" />
                    ) : (
                      <User2 size={24} className="text-zinc-300" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleAvatarChange(e.target.files?.[0])}
                    className="text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:text-black"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold uppercase tracking-[0.28em] text-zinc-500">Информация профиля</h3>
                <div className="mt-4 space-y-4">
                  <label className="block space-y-2">
                    <span className="field-label">Имя</span>
                    <input
                      className="field-input"
                      value={profile.name}
                      onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="field-label">Email</span>
                    <input
                      className="field-input"
                      value={profile.email}
                      onChange={(e) => setProfile((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="field-label">Telegram</span>
                    <input
                      className="field-input"
                      value={profile.telegram}
                      onChange={(e) => setProfile((prev) => ({ ...prev, telegram: e.target.value }))}
                    />
                  </label>
                  <button type="button" onClick={saveSettings} className="primary-button">
                    Сохранить
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold uppercase tracking-[0.28em] text-zinc-500">Изменить пароль</h3>
                <div className="mt-4 space-y-4">
                  <label className="block space-y-2">
                    <span className="field-label">Старый пароль</span>
                    <input
                      type="password"
                      className="field-input"
                      value={passwordForm.old}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, old: e.target.value }))}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="field-label">Новый пароль</span>
                    <input
                      type="password"
                      className="field-input"
                      value={passwordForm.next}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, next: e.target.value }))}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="field-label">Подтвердите новый пароль</span>
                    <input
                      type="password"
                      className="field-input"
                      value={passwordForm.confirm}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))}
                    />
                  </label>
                  <button type="button" onClick={handlePasswordSave} className="secondary-button">
                    Обновить пароль
                  </button>
                </div>
              </div>

              {settingsMessage ? (
                <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-200">
                  {settingsMessage}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
