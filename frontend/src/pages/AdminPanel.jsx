import { useEffect, useMemo, useState } from 'react';
import { Ban, BadgeCheck, CheckCheck, ChevronDown, Disc3, FileText, FolderOpen, KeyRound, Menu, MessageSquare, Rocket, Search, Send, Shield, ShieldCheck, Ticket, Trash2, User2, Users, XCircle } from 'lucide-react';
import api from '../api';
import ReleaseDetailsModal from '../components/ReleaseDetailsModal';
import { ADMIN_FILTERS, STATUS_META, formatDate, formatDateTime, parseRelease, resolveAssetUrl } from '../lib/releases';
import { useAuth } from '../AuthContext';

const getArtistLabel = (release) =>
  release.artists || release.artist_login || release.artist_email || 'Артист не указан';

const USER_STATUS_META = {
  active: { label: 'Активен', badge: 'border-emerald-500/25 bg-emerald-500/15 text-emerald-100' },
  blocked: { label: 'Заблокирован', badge: 'border-red-500/25 bg-red-500/15 text-red-100' },
  rejected: { label: 'Отклонён', badge: 'border-amber-500/25 bg-amber-500/15 text-amber-100' },
  pending: { label: 'На рассмотрении', badge: 'border-blue-500/25 bg-blue-500/15 text-blue-100' },
};

const ROLE_LABELS = {
  artist: 'Артист',
  moderator: 'Модератор',
  admin: 'Админ',
};

export default function AdminPanel() {
  const { user, logout, updateUser } = useAuth();
  const [releases, setReleases] = useState([]);
  const [myReleases, setMyReleases] = useState([]);
  const [selectedRelease, setSelectedRelease] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('releases');
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
  const [users, setUsers] = useState([]);
  const [registrationRequests, setRegistrationRequests] = useState([]);
  const [userModal, setUserModal] = useState({ open: false, loading: false, user: null, releases: [] });
  const [userActionModal, setUserActionModal] = useState({ open: false, type: '', user: null, reason: '' });
  const [adminMessage, setAdminMessage] = useState('');
  const [supportTickets, setSupportTickets] = useState([]);
  const [supportModal, setSupportModal] = useState({ open: false, ticket: null, messages: [], reply: '', attachment: null });
  const [labels, setLabels] = useState([]);
  const [labelForm, setLabelForm] = useState({ userQuery: '', labelName: '' });
  const [fileFolders, setFileFolders] = useState([]);
  const [activeFileFolder, setActiveFileFolder] = useState('covers');
  const [dmbExportingId, setDmbExportingId] = useState(null);
  const [dmbLogsModal, setDmbLogsModal] = useState({ open: false, release: null, logs: [], loading: false });

  const navItems = useMemo(() => {
    if (user?.role === 'moderator') {
      return [
        { label: 'Релизы', icon: Disc3, key: 'releases' },
        { label: 'Мои релизы', icon: Shield, key: 'my-releases', dividerBefore: true },
        { label: 'Поддержка', icon: MessageSquare, key: 'support', dividerBefore: true },
      ];
    }

    return [
      { label: 'Релизы', icon: Disc3, key: 'releases' },
      { label: 'Файловый менеджер', icon: FolderOpen, key: 'files', dividerBefore: true },
      { label: 'Запросы UPC', icon: Ticket, key: 'upc' },
      { label: 'Пользователи', icon: Users, key: 'users', dividerBefore: true },
      { label: 'Поддержка', icon: MessageSquare, key: 'support' },
      { label: 'Лейблы', icon: BadgeCheck, key: 'labels' },
    ];
  }, [user?.role]);

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

  const fetchUsers = async () => {
    const res = await api.get('/admin/users');
    setUsers(res.data);
    return res.data;
  };

  const fetchRegistrationRequests = async () => {
    const res = await api.get('/admin/registration-requests');
    setRegistrationRequests(res.data);
    return res.data;
  };

  const fetchSupportTickets = async () => {
    const res = await api.get('/admin/support/tickets');
    setSupportTickets(res.data);
    return res.data;
  };

  const fetchLabels = async () => {
    const res = await api.get('/admin/labels');
    setLabels(res.data);
    return res.data;
  };

  const fetchMyReleases = async () => {
    const res = await api.get('/admin/my-releases');
    const parsed = res.data.map(parseRelease);
    setMyReleases(parsed);
    return parsed;
  };

  const fetchFiles = async () => {
    const res = await api.get('/admin/files');
    const folders = res.data.folders || [];
    setFileFolders(folders);
    if (folders.length && !folders.some((folder) => folder.key === activeFileFolder)) {
      setActiveFileFolder(folders[0].key);
    }
    return folders;
  };

  useEffect(() => {
    fetchReleases();
    fetchMyReleases();
    fetchSupportTickets();
    if (user?.role === 'admin') {
      fetchUpcRequests();
      fetchUsers();
      fetchRegistrationRequests();
      fetchLabels();
      fetchFiles();
    }
  }, [user?.role]);

  useEffect(() => {
    if (!navItems.some((item) => item.key === activeSection)) {
      setActiveSection(navItems[0]?.key || 'releases');
    }
  }, [activeSection, navItems]);

  useEffect(() => {
    setAvatarPreview(user?.avatar || '');
    setProfile({
      name: user?.name || '',
      email: user?.email || '',
      telegram: user?.telegram || '',
    });
  }, [user]);

  useEffect(() => {
    setQuery('');
    if (activeSection === 'releases' || activeSection === 'my-releases') setFilter('all');
    if (activeSection === 'users') setFilter('all-users');
  }, [activeSection]);

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
    const [updated, ownUpdated] = await Promise.all([fetchReleases(), fetchMyReleases()]);
    if (selectedRelease?.id === id) {
      const nextSelected = updated.find((item) => item.id === id) || ownUpdated.find((item) => item.id === id);
      if (nextSelected) setSelectedRelease(nextSelected);
    }
  };

  const deleteRelease = async (releaseId) => {
    if (!window.confirm('Удалить релиз без возможности восстановления?')) return;
    await api.delete(`/admin/releases/${releaseId}`);
    const [updated, ownUpdated] = await Promise.all([fetchReleases(), fetchMyReleases()]);
    if (selectedRelease?.id === releaseId) {
      const nextSelected = updated[0] || ownUpdated[0] || null;
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

  const showAdminMessage = (message) => {
    setAdminMessage(message);
    setTimeout(() => setAdminMessage(''), 2200);
  };

  const openUserModal = async (account) => {
    setUserModal({ open: true, loading: true, user: account, releases: [] });
    try {
      const res = await api.get(`/admin/users/${account.id}`);
      setUserModal({
        open: true,
        loading: false,
        user: res.data.user,
        releases: (res.data.releases || []).map(parseRelease),
      });
    } catch (error) {
      setUserModal({ open: true, loading: false, user: account, releases: [] });
      showAdminMessage(error.response?.data?.error || 'Не удалось загрузить пользователя');
    }
  };

  const refreshUsersData = async () => {
    await Promise.all([fetchUsers(), fetchRegistrationRequests()]);
    if (userModal.user?.id) {
      await openUserModal(userModal.user);
    }
  };

  const resetUserPassword = async (account) => {
    try {
      const res = await api.post(`/admin/users/${account.id}/reset-password`);
      showAdminMessage(`Новый пароль: ${res.data.password}`);
    } catch (error) {
      showAdminMessage(error.response?.data?.error || 'Не удалось сбросить пароль');
    }
  };

  const promoteUser = async (account) => {
    try {
      await api.put(`/admin/users/${account.id}/promote`);
      await refreshUsersData();
      showAdminMessage('Права администратора выданы');
    } catch (error) {
      showAdminMessage(error.response?.data?.error || 'Не удалось выдать админку');
    }
  };

  const unblockUser = async (account) => {
    try {
      await api.put(`/admin/users/${account.id}/unblock`);
      await refreshUsersData();
      showAdminMessage('Пользователь разблокирован');
    } catch (error) {
      showAdminMessage(error.response?.data?.error || 'Не удалось разблокировать пользователя');
    }
  };

  const submitUserAction = async () => {
    if (!userActionModal.user) return;

    try {
      if (userActionModal.type === 'block') {
        await api.put(`/admin/users/${userActionModal.user.id}/block`, { reason: userActionModal.reason });
        showAdminMessage('Пользователь заблокирован');
      }

      if (userActionModal.type === 'reject') {
        await api.put(`/admin/registration-requests/${userActionModal.user.id}/reject`, { reason: userActionModal.reason });
        showAdminMessage('Заявка отклонена');
      }

      setUserActionModal({ open: false, type: '', user: null, reason: '' });
      await refreshUsersData();
    } catch (error) {
      showAdminMessage(error.response?.data?.error || 'Не удалось выполнить действие');
    }
  };

  const approveRegistration = async (account) => {
    try {
      await api.put(`/admin/registration-requests/${account.id}/approve`);
      await refreshUsersData();
      showAdminMessage('Заявка одобрена');
    } catch (error) {
      showAdminMessage(error.response?.data?.error || 'Не удалось одобрить заявку');
    }
  };

  const openSupportTicket = async (ticket) => {
    const res = await api.get(`/admin/support/tickets/${ticket.id}`);
    setSupportModal({ open: true, ticket: res.data.ticket, messages: res.data.messages, reply: '', attachment: null });
  };

  const replySupportTicket = async () => {
    if (!supportModal.ticket) return;
    const data = new FormData();
    data.append('message', supportModal.reply);
    if (supportModal.attachment) data.append('attachment', supportModal.attachment);
    await api.post(`/admin/support/tickets/${supportModal.ticket.id}/messages`, data);
    await fetchSupportTickets();
    await openSupportTicket(supportModal.ticket);
    showAdminMessage('Ответ отправлен');
  };

  const closeSupportTicket = async () => {
    if (!supportModal.ticket) return;
    await api.put(`/admin/support/tickets/${supportModal.ticket.id}/close`);
    await fetchSupportTickets();
    await openSupportTicket(supportModal.ticket);
    showAdminMessage('Тикет закрыт');
  };

  const saveLabel = async () => {
    try {
      await api.post('/admin/labels', labelForm);
      setLabelForm({ userQuery: '', labelName: '' });
      await Promise.all([fetchLabels(), fetchReleases()]);
      showAdminMessage('Лейбл сохранён');
    } catch (error) {
      showAdminMessage(error.response?.data?.error || 'Не удалось сохранить лейбл');
    }
  };

  const updateUserRole = async (account, role) => {
    try {
      await api.put(`/admin/users/${account.id}/set-role`, { role });
      await refreshUsersData();
      showAdminMessage(role === 'artist' ? 'Права сняты' : role === 'moderator' ? 'Роль модератора выдана' : role === 'admin' ? 'Права администратора выданы' : 'Роль обновлена');
    } catch (error) {
      showAdminMessage(error.response?.data?.error || 'Не удалось обновить роль');
    }
  };

  const deleteManagedFile = async (folderKey, fileName) => {
    if (!window.confirm(`Удалить файл ${fileName}?`)) return;
    await api.delete(`/admin/files/${folderKey}/${encodeURIComponent(fileName)}`);
    await fetchFiles();
    showAdminMessage('Файл удалён');
  };

  const deleteAllManagedFiles = async (folderKey) => {
    if (!window.confirm('Удалить все файлы из этой папки?')) return;
    const res = await api.delete(`/admin/files/${folderKey}`);
    await fetchFiles();
    showAdminMessage(`Удалено файлов: ${res.data.deleted ?? 0}`);
  };

  const openDmbLogs = async (release) => {
    if (!release) return;
    setDmbLogsModal({ open: true, release, logs: [], loading: true });
    try {
      const res = await api.get(`/admin/releases/${release.id}/dmb-logs`);
      setDmbLogsModal({ open: true, release, logs: res.data, loading: false });
    } catch (error) {
      setDmbLogsModal({
        open: true,
        release,
        loading: false,
        logs: [{ id: 'error', level: 'error', message: error.response?.data?.error || 'Не удалось загрузить логи', created_at: new Date().toISOString() }],
      });
    }
  };

  const runDmbExport = async (release) => {
    if (!release) return;
    setDmbExportingId(release.id);
    showAdminMessage('Автоотгруз DMB запущен');
    try {
      const res = await api.post(`/admin/releases/${release.id}/dmb-export`);
      showAdminMessage(res.data?.message || 'Автоотгруз DMB выполнен');
    } catch (error) {
      showAdminMessage(error.response?.data?.error || 'Не удалось выполнить автоотгруз DMB');
    } finally {
      setDmbExportingId(null);
      await openDmbLogs(release);
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

  const filteredMyReleases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return myReleases.filter((release) => {
      const matchesFilter = filter === 'all' ? true : release.status === filter;
      if (!matchesFilter) return false;
      if (!normalizedQuery) return true;
      return `${release.title || ''} ${getArtistLabel(release)}`.toLowerCase().includes(normalizedQuery);
    });
  }, [filter, myReleases, query]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users.filter((account) => {
      if (!normalizedQuery) return true;
      const haystack = `${account.name || ''} ${account.login || ''} ${account.email || ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [query, users]);

  const filteredRegistrationRequests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return registrationRequests.filter((account) => {
      if (!normalizedQuery) return true;
      const haystack = `${account.name || ''} ${account.login || ''} ${account.email || ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [query, registrationRequests]);

  const avatarFallback = useMemo(() => (!avatarPreview ? user?.name?.slice(0, 1)?.toUpperCase() : ''), [avatarPreview, user]);
  const hasUnreadSupport = useMemo(() => supportTickets.some((ticket) => Number(ticket.admin_unread) > 0), [supportTickets]);
  const activeFilesFolder = useMemo(
    () => fileFolders.find((folder) => folder.key === activeFileFolder) || fileFolders[0] || null,
    [activeFileFolder, fileFolders],
  );
  const canModerateSelectedRelease = useMemo(
    () => (selectedRelease ? releases.some((item) => item.id === selectedRelease.id) : false),
    [releases, selectedRelease],
  );
  const canDeleteSelectedRelease = useMemo(
    () => Boolean(selectedRelease && (user?.role === 'admin' || Number(selectedRelease.user_id) === Number(user?.id))),
    [selectedRelease, user],
  );

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
        <button
          type="button"
          onClick={() => runDmbExport(release)}
          disabled={dmbExportingId === release.id}
          className={`secondary-button ${baseClass} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <Rocket size={15} />
          {dmbExportingId === release.id ? 'Отгружаем...' : 'Автоотгруз DMB'}
        </button>
        <button
          type="button"
          onClick={() => openDmbLogs(release)}
          className={`secondary-button ${baseClass}`}
        >
          <FileText size={15} />
          Логи DMB
        </button>
      </>
    );
  };

  return (
    <div className="app-shell min-h-screen">
      <div className="flex min-h-screen">
        <aside className={`sticky top-0 hidden h-screen shrink-0 bg-[#0f0f0f] transition-all duration-300 md:block ${sidebarOpen ? 'w-64' : 'w-20'}`}>
          <div className={`flex h-20 items-center ${sidebarOpen ? 'justify-between px-4' : 'justify-center px-3'}`}>
            {sidebarOpen ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen((prev) => !prev)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900/40 text-zinc-300 transition hover:bg-zinc-800/60"
                >
                  <Menu size={16} />
                </button>
                <div className="text-sm font-bold tracking-wide text-white">Меню</div>
              </div>
            ) : null}
            {!sidebarOpen ? (
              <button
                type="button"
                onClick={() => setSidebarOpen((prev) => !prev)}
                className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900/40 text-zinc-300 transition hover:bg-zinc-800/60"
              >
                <Menu size={16} />
              </button>
            ) : null}
          </div>
          <div className="mx-3 border-t border-zinc-800/70" />
          <div className="flex flex-col gap-3 p-3">
            {navItems.map(({ label, icon: Icon, key, dividerBefore }) => {
              const isActive = activeSection === key;
              const unread = key === 'support' && hasUnreadSupport;
              return (
                <div key={label} className="space-y-3">
                  {dividerBefore ? <div className="border-t border-zinc-800/70" /> : null}
                  <button
                    type="button"
                    title={label}
                    onClick={() => setActiveSection(key)}
                    className={`relative flex h-12 items-center rounded-2xl transition ${
                      sidebarOpen
                        ? `w-full gap-3 px-3 text-sm font-semibold ${isActive ? 'bg-white text-black' : 'bg-zinc-900/40 text-zinc-200 hover:bg-zinc-800/60'}`
                        : `w-12 justify-center self-center ${isActive ? 'bg-white text-black' : 'bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800/60'}`
                    }`}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                      <Icon size={18} />
                    </span>
                    {sidebarOpen ? <span>{label}</span> : null}
                    {unread ? (
                      <span className={`rounded-full border border-blue-500 bg-blue-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ${sidebarOpen ? 'ml-auto' : 'absolute -right-1 -top-1 px-1.5'}`}>
                        Новое
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="flex-1 pb-24 md:pb-0">
          <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8">
            <header className="sticky top-0 z-10 mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800/60 bg-black/45 pb-5 backdrop-blur-xl">
                <div className="flex items-center gap-3 pl-5 sm:pl-8">
                  <div className="flex items-center gap-2">
                    <Disc3 size={16} className="text-zinc-400" />
                    <span className="text-sm font-semibold tracking-wide text-white">Панель модерации</span>
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

            {activeSection === 'releases' ? (
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

                <section className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {filteredReleases.map((release) => {
                const statusMeta = STATUS_META[release.status] || STATUS_META.draft;
                return (
                  <div
                    key={release.id}
                    className="overflow-hidden rounded-2xl border border-zinc-800/60 bg-[#121212] shadow-2xl transition-all duration-300 hover:border-zinc-600 hover:shadow-white/5"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedRelease(release)}
                      className="group flex w-full flex-col text-left"
                    >
                      <div className="relative aspect-square overflow-hidden bg-zinc-900 border-b border-zinc-800/60">
                        <img src={release.cover} alt={release.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
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
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      </div>
                      <div className="flex flex-1 flex-col space-y-4 px-5 pb-5 pt-4">
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
            ) : activeSection === 'my-releases' ? (
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
                <section className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {filteredMyReleases.length ? filteredMyReleases.map((release) => {
                    const statusMeta = STATUS_META[release.status] || STATUS_META.draft;
                    return (
                      <button
                        key={release.id}
                        type="button"
                        onClick={() => setSelectedRelease(release)}
                        className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-800/60 bg-[#121212] text-left transition-all duration-300 hover:border-zinc-600 hover:shadow-2xl hover:shadow-white/5"
                      >
                        <div className="relative aspect-square overflow-hidden bg-zinc-900 border-b border-zinc-800/60">
                          <img src={release.cover} alt={release.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
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
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        </div>
                        <div className="flex flex-1 flex-col p-5">
                          <div>
                            <h3 className="truncate text-lg font-bold tracking-tight text-zinc-100">
                              {release.title}
                              {release.subtitle ? ` (${release.subtitle})` : ''}
                            </h3>
                            <p className="mt-1 truncate text-sm font-medium text-zinc-400">{release.artists}</p>
                          </div>
                          <div className="mt-auto pt-5 flex items-center justify-between text-xs">
                            <span className="font-medium text-zinc-500">Дата релиза</span>
                            <span className="font-semibold text-zinc-300">{formatDate(release.metadata?.release_date || release.created_at)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  }) : (
                    <div className="rounded-2xl border border-zinc-800/60 bg-[#121212] p-6 text-sm text-zinc-400">
                      У вас пока нет релизов.
                    </div>
                  )}
                </section>
              </>
            ) : activeSection === 'files' ? (
              <section className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {fileFolders.map((folder) => (
                    <button
                      key={folder.key}
                      type="button"
                      onClick={() => setActiveFileFolder(folder.key)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        activeFilesFolder?.key === folder.key ? 'border-white bg-white text-black' : 'border-zinc-800/60 bg-zinc-900/40 text-zinc-300'
                      }`}
                    >
                      {folder.label}
                    </button>
                  ))}
                </div>
                {activeFilesFolder ? (
                  <div className="rounded-2xl border border-zinc-800/60 bg-[#121212] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 pb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{activeFilesFolder.label}</h3>
                        <p className="mt-1 text-sm text-zinc-400">Файлов: {activeFilesFolder.files.length}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteAllManagedFiles(activeFilesFolder.key)}
                        className="secondary-button border-red-400/20 bg-red-400/10 text-red-100 hover:bg-red-400/20"
                      >
                        Удалить все
                      </button>
                    </div>
                    <div className="mt-4 space-y-3">
                      {activeFilesFolder.files.length ? activeFilesFolder.files.map((file) => (
                        <div key={`${activeFilesFolder.key}-${file.name}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">{file.name}</p>
                            <p className="mt-1 text-xs text-zinc-500">{formatDateTime(file.modified_at)} • {Math.max(1, Math.round(file.size / 1024))} KB</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <a href={resolveAssetUrl(file.url)} target="_blank" rel="noreferrer" className="secondary-button">
                              Открыть
                            </a>
                            <a href={resolveAssetUrl(file.url)} download className="secondary-button">
                              Скачать
                            </a>
                            <button
                              type="button"
                              onClick={() => deleteManagedFile(activeFilesFolder.key, file.name)}
                              className="secondary-button border-red-400/20 bg-red-400/10 text-red-100 hover:bg-red-400/20"
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      )) : (
                        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-5 text-sm text-zinc-400">
                          В этой папке пока нет файлов.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </section>
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
            ) : activeSection === 'users' ? (
              <section className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'all-users', label: 'Пользователи' },
                      { key: 'registration-requests', label: 'Заявки на регистрацию' },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setFilter(tab.key)}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          filter === tab.key ? 'border-white bg-white text-black' : 'border-zinc-800/60 bg-zinc-900/40 text-zinc-300'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full max-w-md">
                    <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={filter === 'registration-requests' ? 'Поиск по заявкам' : 'Поиск по пользователям'}
                      className="field-input w-full pl-11"
                    />
                  </div>
                </div>

                {filter === 'registration-requests' ? (
                  <div className="space-y-4">
                    {filteredRegistrationRequests.length ? filteredRegistrationRequests.map((account) => (
                      <div key={account.id} className="rounded-2xl border border-zinc-800/60 bg-[#121212] p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <h3 className="text-lg font-semibold text-white">{account.name || account.login}</h3>
                              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${USER_STATUS_META.pending.badge}`}>
                                {USER_STATUS_META.pending.label}
                              </span>
                            </div>
                            <p className="text-sm text-zinc-400">@{account.login} • {account.email}</p>
                            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Подана {formatDate(account.created_at)}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => openUserModal(account)} className="secondary-button">
                              Открыть
                            </button>
                            <button type="button" onClick={() => approveRegistration(account)} className="primary-button">
                              Одобрить
                            </button>
                            <button
                              type="button"
                              onClick={() => setUserActionModal({ open: true, type: 'reject', user: account, reason: '' })}
                              className="secondary-button border-red-400/20 bg-red-400/10 text-red-100 hover:bg-red-400/20"
                            >
                              Отклонить
                            </button>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-zinc-800/60 bg-[#121212] p-6 text-sm text-zinc-400">
                        Новых заявок на регистрацию пока нет.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredUsers.length ? filteredUsers.map((account) => {
                      const statusMeta = USER_STATUS_META[account.account_status] || USER_STATUS_META.active;
                      return (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => openUserModal(account)}
                          className="rounded-2xl border border-zinc-800/60 bg-[#121212] p-5 text-left transition hover:border-zinc-600 hover:bg-zinc-900/70"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-white">
                                {account.avatar ? (
                                  <img src={account.avatar} alt={account.name || account.login} className="h-full w-full object-cover" />
                                ) : (
                                  <span className="text-sm font-semibold">{(account.name || account.login || '?').slice(0, 1).toUpperCase()}</span>
                                )}
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold text-white">{account.name || account.login}</h3>
                                <p className="text-sm text-zinc-400">@{account.login}</p>
                              </div>
                            </div>
                            <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusMeta.badge}`}>
                              {statusMeta.label}
                            </span>
                          </div>
                          <div className="mt-4 space-y-2 text-sm text-zinc-400">
                            <p>{account.email}</p>
                            <p>Роль: <span className="text-zinc-200">{ROLE_LABELS[account.role] || 'Артист'}</span></p>
                            <p>Релизы: <span className="text-zinc-200">{account.releases_count || 0}</span></p>
                          </div>
                        </button>
                      );
                    }) : (
                      <div className="rounded-2xl border border-zinc-800/60 bg-[#121212] p-6 text-sm text-zinc-400">
                        Пользователи не найдены.
                      </div>
                    )}
                  </div>
                )}
              </section>
            ) : activeSection === 'support' ? (
              <section className="space-y-4">
                {supportTickets.length ? supportTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => openSupportTicket(ticket)}
                    className="w-full rounded-2xl border border-zinc-800/60 bg-[#121212] p-5 text-left transition hover:border-zinc-700"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-white">{ticket.subject}</p>
                        <p className="mt-1 text-sm text-zinc-400">{ticket.name || ticket.login} • {ticket.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <span className="rounded-full border border-zinc-800/60 bg-zinc-900/40 px-3 py-1 text-xs text-zinc-300">{ticket.category}</span>
                        <span className={`rounded-full border px-3 py-1 text-xs ${ticket.status === 'closed' ? 'border-zinc-700 bg-zinc-900/50 text-zinc-400' : 'border-emerald-500/25 bg-emerald-500/15 text-emerald-100'}`}>
                          {ticket.status === 'closed' ? 'Закрыт' : 'Открыт'}
                        </span>
                        {ticket.admin_unread ? (
                          <span className="rounded-full border border-blue-500 bg-blue-500 px-3 py-1 text-xs text-white">
                            Новое сообщение
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                )) : (
                  <div className="rounded-2xl border border-zinc-800/60 bg-[#121212] p-6 text-sm text-zinc-400">
                    Запросов в поддержку пока нет.
                  </div>
                )}
              </section>
            ) : activeSection === 'labels' ? (
              <section className="space-y-5">
                <div className="rounded-2xl border border-zinc-800/60 bg-[#121212] p-5">
                  <h3 className="text-lg font-semibold text-white">Добавить лейбл</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <input
                      value={labelForm.userQuery}
                      onChange={(e) => setLabelForm((prev) => ({ ...prev, userQuery: e.target.value }))}
                      placeholder="Логин аккаунта или email"
                      className="field-input"
                    />
                    <input
                      value={labelForm.labelName}
                      onChange={(e) => setLabelForm((prev) => ({ ...prev, labelName: e.target.value }))}
                      placeholder="Название лейбла"
                      className="field-input"
                    />
                  </div>
                  <button type="button" onClick={saveLabel} className="primary-button mt-4">
                    Сохранить
                  </button>
                </div>
                <div className="grid gap-4">
                  {labels.length ? labels.map((label) => (
                    <div key={label.id} className="rounded-2xl border border-zinc-800/60 bg-[#121212] p-5">
                      <p className="text-lg font-semibold text-white">{label.label_name}</p>
                      <p className="mt-1 text-sm text-zinc-400">{label.name || label.login} • {label.email}</p>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-zinc-800/60 bg-[#121212] p-6 text-sm text-zinc-400">
                      Лейблы пока не добавлены.
                    </div>
                  )}
                </div>
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
        actionButtons={canModerateSelectedRelease ? buildActionButtons(selectedRelease) : null}
        onRecall={(release) => setCommentModal({ open: true, release, status: 'revoked', comment: '' })}
        onDelete={canDeleteSelectedRelease ? (release) => deleteRelease(release.id) : undefined}
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

      {userModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6" onClick={() => setUserModal({ open: false, loading: false, user: null, releases: [] })}>
          <div
            className="w-full max-w-4xl rounded-3xl border border-zinc-800 bg-[#121212] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">{userModal.user?.name || userModal.user?.login || 'Пользователь'}</h2>
                <p className="mt-1 text-sm text-zinc-400">{userModal.user?.email || 'email не указан'}</p>
              </div>
              <button type="button" onClick={() => setUserModal({ open: false, loading: false, user: null, releases: [] })} className="secondary-button">
                Закрыть
              </button>
            </div>

            {userModal.loading ? (
              <div className="py-10 text-center text-sm text-zinc-400">Загружаем данные пользователя...</div>
            ) : (
              <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Профиль</p>
                    <div className="mt-4 grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
                      <p>Логин: <span className="text-white">@{userModal.user?.login}</span></p>
                      <p>Email: <span className="text-white">{userModal.user?.email || 'Не указан'}</span></p>
                      <p>Роль: <span className="text-white">{ROLE_LABELS[userModal.user?.role] || 'Артист'}</span></p>
                      <p>Telegram: <span className="text-white">{userModal.user?.telegram || 'Не указан'}</span></p>
                    </div>
                    {userModal.user?.status_reason ? (
                      <div className="mt-4 rounded-2xl border border-zinc-800 bg-[#0f0f0f] px-4 py-3 text-sm text-zinc-300">
                        Причина: {userModal.user.status_reason}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Релизы</p>
                      <span className="text-sm text-zinc-400">{userModal.releases.length}</span>
                    </div>
                    <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1">
                      {userModal.releases.length ? userModal.releases.map((release) => {
                        const statusMeta = STATUS_META[release.status] || STATUS_META.draft;
                        return (
                          <button
                            key={release.id}
                            type="button"
                            onClick={() => setSelectedRelease(release)}
                            className="flex w-full items-center gap-3 rounded-2xl border border-zinc-800/60 bg-[#121212] p-3 text-left transition hover:border-zinc-700"
                          >
                            <img src={release.cover} alt={release.title} className="h-16 w-16 rounded-xl object-cover" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-white">{release.title}</p>
                              <p className="truncate text-xs text-zinc-400">{release.artists || 'Артист не указан'}</p>
                            </div>
                            <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusMeta.badgeClass}`}>
                              {statusMeta.label}
                            </span>
                          </button>
                        );
                      }) : (
                        <div className="rounded-2xl border border-zinc-800/60 bg-[#121212] px-4 py-5 text-sm text-zinc-400">
                          У пользователя пока нет релизов.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Действия</p>
                  <div className="mt-4 space-y-3">
                    <button type="button" onClick={() => resetUserPassword(userModal.user)} className="secondary-button w-full justify-center">
                      <KeyRound size={16} />
                      Сбросить пароль
                    </button>
                    {userModal.user?.role !== 'moderator' ? (
                      <button type="button" onClick={() => updateUserRole(userModal.user, 'moderator')} className="secondary-button w-full justify-center">
                        <Shield size={16} />
                        Выдать модератора
                      </button>
                    ) : (
                      <button type="button" onClick={() => updateUserRole(userModal.user, 'artist')} className="secondary-button w-full justify-center">
                        <Shield size={16} />
                        Снять модератора
                      </button>
                    )}
                    {userModal.user?.role !== 'admin' ? (
                      <button type="button" onClick={() => promoteUser(userModal.user)} className="secondary-button w-full justify-center">
                        <ShieldCheck size={16} />
                        Выдать админку
                      </button>
                    ) : (
                      <button type="button" onClick={() => updateUserRole(userModal.user, 'artist')} className="secondary-button w-full justify-center">
                        <ShieldCheck size={16} />
                        Снять админку
                      </button>
                    )}
                    {userModal.user?.account_status === 'blocked' ? (
                      <button type="button" onClick={() => unblockUser(userModal.user)} className="primary-button w-full justify-center">
                        Разблокировать
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setUserActionModal({ open: true, type: 'block', user: userModal.user, reason: '' })}
                        className="secondary-button w-full justify-center border-red-400/20 bg-red-400/10 text-red-100 hover:bg-red-400/20"
                      >
                        <Ban size={16} />
                        Заблокировать
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {userActionModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setUserActionModal({ open: false, type: '', user: null, reason: '' })}>
          <div
            className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-[#121212] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-bold text-white">
              {userActionModal.type === 'block' ? 'Блокировка пользователя' : 'Отклонение заявки'}
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              {userActionModal.type === 'block'
                ? 'Укажите причину блокировки. Пользователь увидит её при входе в аккаунт.'
                : 'Укажите причину отклонения. Она будет показана пользователю при входе.'}
            </p>
            <textarea
              rows={5}
              value={userActionModal.reason}
              onChange={(e) => setUserActionModal((prev) => ({ ...prev, reason: e.target.value }))}
              className="field-textarea mt-4"
              placeholder="Причина"
            />
            <div className="mt-4 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setUserActionModal({ open: false, type: '', user: null, reason: '' })} className="secondary-button">
                Отмена
              </button>
              <button type="button" onClick={submitUserAction} className="primary-button">
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {supportModal.open && supportModal.ticket ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setSupportModal({ open: false, ticket: null, messages: [], reply: '', attachment: null })}>
          <div className="w-full max-w-3xl rounded-3xl border border-zinc-800 bg-[#121212] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-2xl font-bold text-white">{supportModal.ticket.subject}</h3>
                <p className="mt-1 text-sm text-zinc-400">{supportModal.ticket.name || supportModal.ticket.login} • {supportModal.ticket.category}</p>
              </div>
              <button type="button" onClick={() => setSupportModal({ open: false, ticket: null, messages: [], reply: '', attachment: null })} className="secondary-button">
                Закрыть
              </button>
            </div>
            <div className="mt-5 max-h-[52vh] space-y-3 overflow-y-auto pr-1">
              {supportModal.messages.map((entry) => (
                <div key={entry.id} className={`rounded-2xl border p-4 ${entry.author_role === 'admin' ? 'border-blue-500/20 bg-blue-500/10' : 'border-zinc-800/60 bg-zinc-900/40'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{['admin', 'moderator'].includes(entry.author_role) ? 'Команда CDCULT' : (entry.name || entry.login || 'Артист')}</p>
                    <p className="text-xs text-zinc-500">{formatDateTime(entry.created_at)}</p>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm text-zinc-300">{entry.message}</p>
                  {entry.attachment_url ? (
                    <a href={entry.attachment_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-medium text-white">
                      Открыть вложение
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
            {supportModal.ticket.status !== 'closed' ? (
              <div className="mt-5 space-y-4 border-t border-zinc-800 pt-4">
                <textarea
                  className="field-textarea"
                  rows={4}
                  value={supportModal.reply}
                  onChange={(e) => setSupportModal((prev) => ({ ...prev, reply: e.target.value }))}
                  placeholder="Ответить на запрос..."
                />
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf,.doc,.docx"
                  onChange={(e) => setSupportModal((prev) => ({ ...prev, attachment: e.target.files?.[0] || null }))}
                  className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2.5 file:font-semibold file:text-black"
                />
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={replySupportTicket} className="primary-button">
                    Ответить
                  </button>
                  <button type="button" onClick={closeSupportTicket} className="secondary-button">
                    Закрыть тикет
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {dmbLogsModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setDmbLogsModal({ open: false, release: null, logs: [], loading: false })}>
          <div className="w-full max-w-4xl rounded-3xl border border-zinc-800 bg-[#121212] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-2xl font-bold text-white">Логи DMB</h3>
                <p className="mt-1 text-sm text-zinc-400">{dmbLogsModal.release?.title || 'Релиз'}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => openDmbLogs(dmbLogsModal.release)} className="secondary-button">
                  Обновить
                </button>
                <button type="button" onClick={() => setDmbLogsModal({ open: false, release: null, logs: [], loading: false })} className="secondary-button">
                  Закрыть
                </button>
              </div>
            </div>
            <div className="mt-5 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {dmbLogsModal.loading ? (
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5 text-sm text-zinc-400">Загружаем логи...</div>
              ) : dmbLogsModal.logs.length ? dmbLogsModal.logs.map((entry) => (
                <div key={entry.id} className={`rounded-2xl border p-4 ${
                  entry.level === 'error'
                    ? 'border-red-500/25 bg-red-500/10'
                    : entry.level === 'success'
                      ? 'border-emerald-500/25 bg-emerald-500/10'
                      : 'border-zinc-800/60 bg-zinc-900/40'
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{entry.message}</p>
                    <span className="text-xs text-zinc-500">{formatDateTime(entry.created_at)}</span>
                  </div>
                  {entry.details ? (
                    <pre className="mt-3 max-h-44 overflow-auto rounded-xl bg-black/40 p-3 text-xs leading-5 text-zinc-300">
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  ) : null}
                </div>
              )) : (
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5 text-sm text-zinc-400">Логов по этому релизу пока нет.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {adminMessage ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-zinc-800/60 bg-[#121212] px-4 py-3 text-sm text-white shadow-2xl">
          {adminMessage}
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800/60 bg-[#0f0f0f]/95 px-2 py-2 backdrop-blur-xl md:hidden">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>
          {navItems.map(({ label, icon: Icon, key }) => {
            const isActive = activeSection === key;
            const unread = key === 'support' && hasUnreadSupport;
            return (
              <button
                key={key}
                type="button"
                title={label}
                onClick={() => setActiveSection(key)}
                className={`relative flex h-12 items-center justify-center rounded-2xl border transition ${
                  isActive
                    ? 'border-white bg-white text-black'
                    : 'border-zinc-800/60 bg-zinc-900/40 text-zinc-300'
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <Icon size={18} />
                </span>
                {unread ? (
                  <span className="absolute -right-1 -top-1 rounded-full border border-blue-500 bg-blue-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                    New
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
