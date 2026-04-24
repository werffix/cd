import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, Search, Send, Trash2, User2, Users, BadgeCheck, XCircle, Ticket } from 'lucide-react';
import api from '../api';
import ReleaseDetailsModal from '../components/ReleaseDetailsModal';
import { ADMIN_FILTERS, STATUS_META, formatDate, parseRelease } from '../lib/releases';
import siteLogo from '../assets/site-logo.png';
import { useAuth } from '../AuthContext';

const getArtistLabel = (release) =>
  release.artists || release.artist_login || release.artist_email || 'Артист не указан';

export default function AdminPanel() {
  const { user, logout, updateUser } = useAuth();
  const [releases, setReleases] = useState([]);
  const [selectedRelease, setSelectedRelease] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('actions');
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
  const [commentModal, setCommentModal] = useState({ open: false, release: null, status: '', comment: '' });
  const [upcRequests, setUpcRequests] = useState([]);
  const [upcDrafts, setUpcDrafts] = useState({});

  const fetchReleases = async () => {
    const res = await api.get('/admin/releases');
    const parsed = res.data.map(parseRelease);
    setReleases(parsed);
    return parsed;
  };

  const fetchUpcRequests = async () => {
    const res = await api.get('/admin/upc-requests');
    setUpcRequests(res.data);
    return res.data;
  };

  useEffect(() => {
    fetchReleases();
    fetchUpcRequests();
  }, []);

  useEffect(() => {
    setAvatarPreview(user?.avatar || '');
    setProfile({
      name: user?.name || '',
      email: user?.email || '',
      telegram: user?.telegram || '',
    });
  }, [user]);

  const handleAvatarChange = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  const saveSettings = () => {
    api.put('/profile', { ...profile, avatar: avatarPreview })
      .then((res) => {
        updateUser(res.data.user);
        setSettingsMessage('Настройки сохранены');
        setTimeout(() => setSettingsMessage(''), 1600);
      })
      .catch((error) => {
        setSettingsMessage(error.response?.data?.error || 'Не удалось сохранить настройки');
        setTimeout(() => setSettingsMessage(''), 2200);
      });
  };

  const handlePasswordSave = () => {
    if (!passwordForm.old || !passwordForm.next || passwordForm.next !== passwordForm.confirm) {
      setSettingsMessage('Проверьте данные пароля');
      setTimeout(() => setSettingsMessage(''), 1600);
      return;
    }
    api.put('/profile', {
      oldPassword: passwordForm.old,
      newPassword: passwordForm.next,
    })
      .then(() => {
        setSettingsMessage('Пароль обновлён');
        setPasswordForm({ old: '', next: '', confirm: '' });
        setTimeout(() => setSettingsMessage(''), 1600);
      })
      .catch((error) => {
        setSettingsMessage(error.response?.data?.error || 'Не удалось обновить пароль');
        setTimeout(() => setSettingsMessage(''), 2200);
      });
  };

  const updateStatus = async (id, status, moderatorComment = '') => {
    await api.put(`/admin/releases/${id}`, { status, moderator_comment: moderatorComment });
    const updated = await fetchReleases();
    if (selectedRelease?.id === id) {
      const nextSelected = updated.find((item) => item.id === id);
      if (nextSelected) setSelectedRelease(nextSelected);
    }
  };

  const deleteRelease = async (releaseId) => {
    if (!window.confirm('Удалить релиз без возможности восстановления?')) return;
    await api.delete(`/admin/releases/${releaseId}`);
    const updated = await fetchReleases();
    if (selectedRelease?.id === releaseId) {
      const nextSelected = updated[0] || null;
      setSelectedRelease(nextSelected);
    }
  };

  const saveUpcRequest = async (requestId) => {
    const upc = (upcDrafts[requestId] || '').trim();
    if (!upc) {
      setSettingsMessage('Введите UPC код');
      setTimeout(() => setSettingsMessage(''), 1800);
      return;
    }
    await api.put(`/admin/upc-requests/${requestId}`, { upc });
    await Promise.all([fetchUpcRequests(), fetchReleases()]);
    setSettingsMessage('UPC сохранён');
    setTimeout(() => setSettingsMessage(''), 1800);
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

  const avatarFallback = useMemo(() => (!avatarPreview ? user?.name?.slice(0, 1)?.toUpperCase() : ''), [avatarPreview, user]);

  const buildActionButtons = (release, fullWidth = false) => {
    if (!release) return null;
    const baseClass = fullWidth ? 'flex-1' : '';
    return (
      <>
        {release.status !== 'delivered' && release.status !== 'shipped' ? (
          <button
            type="button"
            onClick={() => setCommentModal({ open: true, release, status: 'delivered', comment: '' })}
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
            Доставлен
          </button>
        ) : null}
        {release.status === 'shipped' ? (
          <button
            type="button"
            onClick={() => setCommentModal({ open: true, release, status: 'revoked', comment: '' })}
            className={`secondary-button ${baseClass}`}
          >
            Отозвать
          </button>
        ) : null}
        {release.status !== 'rejected' ? (
          <button
            type="button"
            onClick={() => setCommentModal({ open: true, release, status: 'rejected', comment: '' })}
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
    <div className="app-shell min-h-screen bg-[#0a0a0a]">
      <div className="flex min-h-screen">
        <aside className={`border-r border-zinc-800/60 bg-[#0f0f0f] transition-all ${sidebarOpen ? 'w-64' : 'w-20'}`}>
          <div className="flex h-20 items-center justify-center border-b border-zinc-800/60">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="secondary-button px-3 py-3"
            >
              {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
          <div className="space-y-2 p-4">
            {[
              { label: 'Действия', icon: LayoutGrid, key: 'actions' },
              { label: 'Запросы UPC', icon: Ticket, key: 'upc' },
              { label: 'Пользователи', icon: Users, key: 'users' },
              { label: 'Лейблы', icon: BadgeCheck, key: 'labels' },
            ].map(({ label, icon: Icon, key }) => (
              <button
                key={label}
                type="button"
                onClick={() => setActiveSection(key || 'actions')}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                  activeSection === (key || 'actions')
                    ? 'border-white bg-white text-black'
                    : 'border-zinc-800/60 bg-zinc-900/40 text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${activeSection === (key || 'actions') ? 'bg-black text-white' : 'bg-zinc-800 text-white'}`}>
                  <Icon size={16} />
                </span>
                {sidebarOpen ? <span>{label}</span> : null}
              </button>
            ))}
          </div>
        </aside>

        <div className="flex-1 px-4 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1600px] space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800/60 bg-[#000000] pb-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-transparent">
                  <img src={siteLogo} alt="CDCULT" className="h-full w-full object-contain" />
                </div>
                <div>
                  <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Панель модерации</h1>
                </div>
              </div>

              <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((prev) => !prev)}
                    className="flex items-center gap-2 rounded-full border border-zinc-800/60 bg-zinc-900/40 px-3 py-2 text-sm text-white transition hover:bg-zinc-800/60"
                  >
                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-white">
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
                    <div className="absolute right-0 top-12 z-20 w-64 rounded-xl border border-zinc-800/60 bg-[#121212] p-2 shadow-2xl">
                      <div className="flex items-center gap-3 border-b border-zinc-800/60 px-3 py-3">
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-white">
                          {avatarPreview ? (
                            <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                          ) : avatarFallback ? (
                            <span className="text-sm font-semibold">{avatarFallback}</span>
                          ) : (
                            <User2 size={18} />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{user?.name || 'Администратор'}</p>
                          <p className="text-xs text-zinc-400">{user?.email || 'email не указан'}</p>
                        </div>
                      </div>
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

              </div>
            </header>

            {activeSection === 'actions' ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4">
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
                  <div className="relative w-full max-w-xs">
                    <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Поиск по названию"
                      className="field-input w-full pl-11"
                    />
                  </div>
                </div>

                <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {filteredReleases.map((release) => {
                const statusMeta = STATUS_META[release.status] || STATUS_META.draft;
                return (
                  <div key={release.id} className="rounded-2xl border border-zinc-800/60 bg-[#121212] shadow-2xl">
                    <button type="button" onClick={() => setSelectedRelease(release)} className="block w-full text-left">
                      <div className="relative aspect-square overflow-hidden bg-zinc-900 border-b border-zinc-800/60">
                        <img src={release.cover} alt={release.title} className="h-full w-full rounded-t-2xl object-cover transition duration-700 hover:scale-105" />
                        <div className="absolute right-3 top-3">
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${statusMeta.badgeClass}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                        {release.metadata?.moderator_comment ? (
                          <div className="absolute bottom-3 left-3">
                            <span className="rounded-full border border-blue-500 bg-blue-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                              Комм. от модератора
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <div className="space-y-4 px-5 pb-5 pt-4">
                    <div>
                      <h3 className="text-lg font-bold tracking-tight text-white">
                        {release.title}
                        {release.subtitle ? ` (${release.subtitle})` : ''}
                      </h3>
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
              </>
            ) : activeSection === 'upc' ? (
              <section className="space-y-4">
                {upcRequests.length ? upcRequests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-zinc-800/60 bg-[#121212] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-lg font-semibold text-white">{request.release_title || 'Без названия'}</p>
                        <p className="text-sm text-zinc-400">{request.artist_name || request.artist_login || 'Артист не указан'}</p>
                        <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                          {request.status === 'resolved' ? 'Обработан' : 'Ожидает UPC'}
                        </p>
                      </div>
                      <div className="w-full max-w-sm space-y-3">
                        <input
                          value={upcDrafts[request.id] ?? request.upc_code ?? ''}
                          onChange={(e) => setUpcDrafts((prev) => ({ ...prev, [request.id]: e.target.value }))}
                          placeholder="Введите UPC код"
                          className="field-input"
                          disabled={request.status === 'resolved'}
                        />
                        <button
                          type="button"
                          onClick={() => saveUpcRequest(request.id)}
                          className="primary-button w-full"
                          disabled={request.status === 'resolved'}
                        >
                          Сохранить
                        </button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-zinc-800/60 bg-[#121212] p-6 text-sm text-zinc-400">
                    Запросов UPC пока нет.
                  </div>
                )}
              </section>
            ) : (
              <section className="rounded-2xl border border-zinc-800/60 bg-[#121212] p-6 text-sm text-zinc-400">
                Раздел в работе.
              </section>
            )}
          </div>
        </div>
      </div>

      <ReleaseDetailsModal
        release={selectedRelease}
        onClose={() => setSelectedRelease(null)}
        showOwner
        actionButtons={buildActionButtons(selectedRelease)}
        onRecall={(release) => setCommentModal({ open: true, release, status: 'revoked', comment: '' })}
        onDelete={(release) => deleteRelease(release.id)}
      />

      {settingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6" onClick={() => setSettingsOpen(false)}>
          <div
            className="w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-800 bg-[#121212] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <h2 className="text-xl font-bold text-white">Настройки профиля</h2>
              <button type="button" onClick={() => setSettingsOpen(false)} className="secondary-button px-3 py-2">
                Закрыть
              </button>
            </div>

            <div className="mt-6 max-h-[70vh] space-y-8 overflow-y-auto pr-2">
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
                  <button type="button" onClick={saveSettings} className="primary-button w-full">
                    Сохранить изменения
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
                  <button type="button" onClick={handlePasswordSave} className="primary-button w-full">
                    Обновить пароль
                  </button>
                </div>
              </div>

              {settingsMessage ? (
                <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 text-sm text-white">
                  {settingsMessage}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {commentModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6" onClick={() => setCommentModal({ open: false, release: null, status: '', comment: '' })}>
          <div
            className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#121212] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white">
              {commentModal.status === 'rejected' ? 'Отклонение релиза' : 'Одобрение релиза'}
            </h3>
            <p className="mt-2 text-sm text-zinc-400">Комментарий будет показан артисту.</p>
            <textarea
              rows={4}
              value={commentModal.comment}
              onChange={(e) => setCommentModal((prev) => ({ ...prev, comment: e.target.value }))}
              className="field-textarea mt-4"
              placeholder="Комментарий от модератора"
            />
            <div className="mt-4 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setCommentModal({ open: false, release: null, status: '', comment: '' })} className="secondary-button">
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  updateStatus(commentModal.release.id, commentModal.status, commentModal.comment);
                  setCommentModal({ open: false, release: null, status: '', comment: '' });
                }}
                className="primary-button"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
