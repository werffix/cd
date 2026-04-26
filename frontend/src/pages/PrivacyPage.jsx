import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <div className="app-shell min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl rounded-2xl border border-zinc-800/60 bg-[#121212] p-6 shadow-2xl sm:p-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">CDCULT Distribution</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Политика конфиденциальности</h1>
          </div>
          <Link to="/register" className="secondary-button">Назад</Link>
        </div>

        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 px-6 py-12 text-center">
          <h2 className="text-2xl font-bold text-white">Раздел в разработке</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Страница политики конфиденциальности скоро появится здесь.
          </p>
        </div>
      </div>
    </div>
  );
}
