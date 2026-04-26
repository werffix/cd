import { BarChart3, ChevronDown, CircleHelp, Home, Link2, Menu, MessageSquare, Plus, User2 } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import siteLogo from '../assets/site-logo.png';

const NAV_ITEMS = [
  { label: 'Главная страница', icon: Home, to: '/dashboard' },
  { label: 'Новый релиз', icon: Plus, to: '/dashboard/new' },
  { label: 'Аналитика', icon: BarChart3, to: '/dashboard/analytics', dividerBefore: true },
  { label: 'Смарт-Линк', icon: Link2, to: '/dashboard/smart-link' },
  { label: 'FAQ', icon: CircleHelp, to: '/dashboard/faq' },
  { label: 'Поддержка', icon: MessageSquare, to: '/dashboard/support', dividerBefore: true },
];

export default function ArtistShell({ user, avatarPreview, avatarFallback, menuOpen, setMenuOpen, logout, setSettingsOpen, actionSlot, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
                <button type="button" onClick={() => navigate('/dashboard')} className="text-sm font-bold tracking-wide text-white">
                  Меню
                </button>
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
            {NAV_ITEMS.map(({ label, icon: Icon, to, dividerBefore }) => {
              const isActive = location.pathname === to;
              return (
                <div key={to} className="space-y-3">
                  {dividerBefore ? <div className="border-t border-zinc-800/70" /> : null}
                  <NavLink
                    to={to}
                    title={label}
                    className={`flex h-12 items-center rounded-2xl transition ${
                      sidebarOpen
                        ? `w-full gap-3 px-3 text-sm font-semibold ${isActive ? 'bg-white text-black' : 'bg-zinc-900/40 text-zinc-200 hover:bg-zinc-800/60'}`
                        : `w-12 justify-center self-center ${isActive ? 'bg-white text-black' : 'bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800/60'}`
                    }`}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                      <Icon size={18} />
                    </span>
                    {sidebarOpen ? <span>{label}</span> : null}
                  </NavLink>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="flex-1">
          <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-zinc-800/60 bg-black/45 px-5 backdrop-blur-xl sm:px-7">
            <div className="flex items-center gap-3 pl-5 sm:pl-8">
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
                <ChevronDown size={15} className="text-zinc-400" />
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
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800/60 bg-[#0f0f0f]/95 px-2 py-2 backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-6 gap-2">
          {NAV_ITEMS.map(({ label, icon: Icon, to }) => {
            const isActive = location.pathname === to;
            return (
              <NavLink
                key={to}
                to={to}
                title={label}
                className={`flex h-12 items-center justify-center rounded-2xl border transition ${
                  isActive
                    ? 'border-white bg-white text-black'
                    : 'border-zinc-800/60 bg-zinc-900/40 text-zinc-300'
                }`}
              >
                <Icon size={18} />
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
