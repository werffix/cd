import { useEffect, useState } from 'react';
import api from '../api';

const STATUS = { draft: 'Черновик', moderation: 'На модерации', delivered: 'Одобрен', rejected: 'Отклонён' };
const COLORS = { draft: 'text-gray-400', moderation: 'text-yellow-400', delivered: 'text-emerald-400', rejected: 'text-red-400' };

export default function AdminPanel() {
  const [releases, setReleases] = useState([]);
  const fetchReleases = async () => setReleases((await api.get('/admin/releases')).data);
  useEffect(() => { fetchReleases(); }, []);

  const updateStatus = async (id, status) => {
    await api.put(`/admin/releases/${id}`, { status });
    fetchReleases();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 pt-20">
      <h1 className="text-3xl font-bold mb-6">Админ-панель <span className="text-yellow-400">CDCULT</span></h1>
      <div className="overflow-x-auto bg-gray-900/60 border border-white/10 rounded-xl">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-800 text-gray-300">
            <tr><th className="p-4">Релиз</th><th className="p-4">Артист</th><th className="p-4">Статус</th><th className="p-4">Дата</th><th className="p-4">Файлы</th><th className="p-4">Действия</th></tr>
          </thead>
          <tbody>
            {releases.map(r => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="p-4 font-medium">{r.title}<div className="text-xs text-gray-500">{r.release_type}</div></td>
                <td className="p-4">{r.artist_login}<div className="text-xs text-gray-500">{r.artist_email}</div></td>
                <td className={`p-4 font-medium ${COLORS[r.status]}`}>{STATUS[r.status]}</td>
                <td className="p-4 text-gray-400">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="p-4 space-y-1">
                  {r.cover_url && <a href={r.cover_url} target="_blank" className="block text-blue-400 hover:underline text-xs">🖼 Обложка</a>}
                  {r.archive_url && <a href={r.archive_url} target="_blank" className="block text-blue-400 hover:underline text-xs">📦 Архив треков</a>}
                </td>
                <td className="p-4 flex gap-2">
                  {r.status !== 'delivered' && <button onClick={() => updateStatus(r.id, 'delivered')} className="bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded text-xs">Одобрить</button>}
                  {r.status !== 'rejected' && <button onClick={() => updateStatus(r.id, 'rejected')} className="bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded text-xs">Отклонить</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
