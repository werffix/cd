import { useMemo, useState } from 'react';
import ArtistShell from '../components/ArtistShell';
import { useAuth } from '../AuthContext';

export default function ArtistPlaceholderPage({ title }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const avatarFallback = useMemo(() => user?.name?.slice(0, 1)?.toUpperCase() || '', [user]);

  return (
    <ArtistShell
      user={user}
      avatarPreview={user?.avatar || ''}
      avatarFallback={avatarFallback}
      menuOpen={menuOpen}
      setMenuOpen={setMenuOpen}
      logout={logout}
    >
      <main className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[1600px] items-center justify-center px-6 py-8 sm:px-8">
        <div className="rounded-3xl border border-zinc-800/60 bg-[#121212] px-8 py-10 text-center">
          <h2 className="text-3xl font-bold text-white">{title}</h2>
          <p className="mt-3 text-sm text-zinc-400">Раздел пока в разработке.</p>
        </div>
      </main>
    </ArtistShell>
  );
}
