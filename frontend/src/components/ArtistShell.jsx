import { BarChart3, CircleHelp, Headphones, Home, Link2, Menu, MessageCircle, Plus, User2 } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import siteLogo from '../assets/site-logo.png';

const NAV_ITEMS = [
  { label: 'Главная страница', icon: Home, to: '/dashboard' },
  { label: 'Новый релиз', icon: Plus, to: '/dashboard/new' },
  { label: 'Аналитика', icon: BarChart3, to: '/dashboard/analytics' },
  { label: 'Смарт-Линк', icon: Link2, to: '/dashboard/smart-link' },
  { label: 'FAQ', icon: CircleHelp, to: '/dashboard/faq' },
  { label: 'Поддержка', icon: Headphones, to: '/dashboard/support' },
];

export default function ArtistShell({ user, avatarPreview, avatarFallback, menuOpen, setMenuOpen, logout, setSettingsOpen, actionSlot, children }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="app-shell min-h-screen bg-[#0a0a0a]">
      <div className="flex min-h-screen">
        <aside className="w-20 border-r border-zinc-800/60 bg-[#0f0f0f]">
          <div className="flex h-20 items-center justify-center border-b border-zinc-800/60">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800/60 bg-zinc-900/40 text-zinc-300">
              <Menu size={16} />
            </div>
          </div>
          <div className="flex flex-col items-center gap-3 p-3">
            {NAV_ITEMS.map(({ label, icon: Icon, to }) => {
              const isActive = location.pathname === to;
              return (
                <NavLink
                  key={to}
                  to={to}
                  title={label}
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition ${
                    isActive
                      ? 'border-white bg-white text-black'
                      : 'border-zinc-800/60 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800/60'
                  }`}
                >
                  <Icon size={18} />
                </NavLink>
              );
            })}
          </div>
        </aside>

        <div className="flex-1">
          <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-zinc-800/60 bg-[#0a0a0a]/90 px-6 backdrop-blur-xl sm:px-8">
            <div className="flex items-center gap-5">
              <button type="button" onClick={() => navigate('/dashboard')} className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-transparent">
                <img src={siteLogo} alt="CDCULT" className="h-full w-full object-contain" />
              </button>
              <div>
                <h1 className="text-lg font-bold leading-tight tracking-wide text-white">CDCULT Distribution</h1>
              </div>
            </div>

            <div className="relative flex items-center gap-4">
              {actionSlot}
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
              </button>

              {menuOpen ? (
                <div className="absolute right-0 top-14 z-20 w-64 rounded-xl border border-zinc-800/60 bg-[#121212] p-2 shadow-2xl">
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
                      <p className="text-sm font-semibold text-white">{user?.name || 'Аккаунт'}</p>
                      <p className="text-xs text-zinc-400">{user?.email || 'email не указан'}</p>
                    </div>
                  </div>
                  {setSettingsOpen ? (
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
                  ) : null}
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

          {children}
        </div>
      </div>
    </div>
  );
}
