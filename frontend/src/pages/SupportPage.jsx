import { Paperclip, Plus, Send, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import api from '../apiUpload';
import ArtistShell from '../components/ArtistShell';
import { useAuth } from '../AuthContext';
import { formatDate, formatDateTime } from '../lib/releases';

const CATEGORIES = ['Модерация', 'UPC', 'Технический вопрос', 'Другое'];

export default function SupportPage() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [ticketForm, setTicketForm] = useState({ category: '', subject: '', message: '', attachment: null });
  const [reply, setReply] = useState({ message: '', attachment: null });
  const [message, setMessage] = useState('');
  const avatarFallback = useMemo(() => user?.name?.slice(0, 1)?.toUpperCase() || '', [user]);

  const fetchTickets = async () => {
    const res = await api.get('/support/tickets');
    setTickets(res.data);
  };

  const openTicket = async (ticket) => {
    const res = await api.get(`/support/tickets/${ticket.id}`);
    setSelectedTicket(res.data.ticket);
    setMessages(res.data.messages);
    setDetailOpen(true);
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const createTicket = async () => {
    const data = new FormData();
    data.append('category', ticketForm.category);
    data.append('subject', ticketForm.subject);
    data.append('message', ticketForm.message);
    if (ticketForm.attachment) data.append('attachment', ticketForm.attachment);
    await api.post('/support/tickets', data);
    setCreateOpen(false);
    setTicketForm({ category: '', subject: '', message: '', attachment: null });
    setMessage('Запрос отправлен');
    setTimeout(() => setMessage(''), 1800);
    fetchTickets();
  };

  const sendReply = async () => {
    if (!selectedTicket) return;
    const data = new FormData();
    data.append('message', reply.message);
    if (reply.attachment) data.append('attachment', reply.attachment);
    await api.post(`/support/tickets/${selectedTicket.id}/messages`, data);
    setReply({ message: '', attachment: null });
    openTicket(selectedTicket);
    fetchTickets();
  };

  const closeTicket = async () => {
    if (!selectedTicket) return;
    await api.put(`/support/tickets/${selectedTicket.id}/close`);
    openTicket(selectedTicket);
    fetchTickets();
  };

  return (
    <ArtistShell
      user={user}
      avatarPreview={user?.avatar || ''}
      avatarFallback={avatarFallback}
      menuOpen={menuOpen}
      setMenuOpen={setMenuOpen}
      logout={logout}
      actionSlot={(
        <button type="button" onClick={() => setCreateOpen(true)} className="primary-button">
          <Plus size={16} />
          Создать запрос
        </button>
      )}
    >
      <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-5xl">
        <h2 className="text-3xl font-bold text-white">Поддержка</h2>
        <div className="mt-6 grid gap-4">
          {tickets.length ? tickets.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              onClick={() => openTicket(ticket)}
              className="rounded-2xl border border-zinc-800/60 bg-[#121212] p-5 text-left transition hover:border-zinc-700"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-white">{ticket.subject}</p>
                  <p className="mt-1 text-sm text-zinc-400">{formatDate(ticket.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full border border-zinc-800/60 bg-zinc-900/40 px-3 py-1 text-xs text-zinc-300">{ticket.category}</span>
                  <span className={`rounded-full border px-3 py-1 text-xs ${ticket.status === 'closed' ? 'border-zinc-700 bg-zinc-900/50 text-zinc-400' : 'border-emerald-500/25 bg-emerald-500/15 text-emerald-100'}`}>
                    {ticket.status === 'closed' ? 'Закрыт' : 'Открыт'}
                  </span>
                  {ticket.artist_unread ? (
                    <span className="rounded-full border border-blue-500/25 bg-blue-500/15 px-3 py-1 text-xs text-blue-100">
                      Новое сообщение
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          )) : (
            <div className="rounded-2xl border border-zinc-800/60 bg-[#121212] p-8 text-center text-sm text-zinc-400">
              У вас пока нет запросов в поддержку.
            </div>
          )}
        </div>
        </div>
      </main>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setCreateOpen(false)}>
          <div className="w-full max-w-xl rounded-3xl border border-zinc-800 bg-[#121212] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Новый запрос</h3>
              <button type="button" onClick={() => setCreateOpen(false)} className="secondary-button px-3 py-2"><X size={16} /></button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block space-y-2">
                <span className="field-label">Раздел</span>
                <select className="field-input" value={ticketForm.category} onChange={(e) => setTicketForm((prev) => ({ ...prev, category: e.target.value }))}>
                  <option value="">Выберите раздел</option>
                  {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="field-label">Тема обращения</span>
                <input className="field-input" value={ticketForm.subject} onChange={(e) => setTicketForm((prev) => ({ ...prev, subject: e.target.value }))} placeholder="Кратко опишите проблему" />
              </label>
              <label className="block space-y-2">
                <span className="field-label">Сообщение</span>
                <textarea className="field-textarea" rows={5} value={ticketForm.message} onChange={(e) => setTicketForm((prev) => ({ ...prev, message: e.target.value }))} placeholder="Подробно опишите вашу проблему..." />
              </label>
              <label className="block space-y-2">
                <span className="field-label">Вложения</span>
                <div className="rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/40 p-4">
                  <input type="file" accept=".png,.jpg,.jpeg,.pdf,.doc,.docx" onChange={(e) => setTicketForm((prev) => ({ ...prev, attachment: e.target.files?.[0] || null }))} className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2.5 file:font-semibold file:text-black" />
                </div>
              </label>
              <button type="button" onClick={createTicket} className="primary-button w-full justify-center">Отправить</button>
            </div>
          </div>
        </div>
      ) : null}

      {detailOpen && selectedTicket ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setDetailOpen(false)}>
          <div className="w-full max-w-3xl rounded-3xl border border-zinc-800 bg-[#121212] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-2xl font-bold text-white">{selectedTicket.subject}</h3>
                <p className="mt-1 text-sm text-zinc-400">{selectedTicket.category} • {selectedTicket.status === 'closed' ? 'Закрыт' : 'Открыт'}</p>
              </div>
              <button type="button" onClick={() => setDetailOpen(false)} className="secondary-button">Закрыть</button>
            </div>
            <div className="mt-5 max-h-[52vh] space-y-3 overflow-y-auto pr-1">
              {messages.map((entry) => (
                <div key={entry.id} className={`rounded-2xl border p-4 ${entry.author_role === 'admin' ? 'border-blue-500/20 bg-blue-500/10' : 'border-zinc-800/60 bg-zinc-900/40'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{entry.author_role === 'admin' ? 'Поддержка CDCULT' : (entry.name || entry.login || 'Вы')}</p>
                    <p className="text-xs text-zinc-500">{formatDateTime(entry.created_at)}</p>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm text-zinc-300">{entry.message}</p>
                  {entry.attachment_url ? (
                    <a href={entry.attachment_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-white">
                      <Paperclip size={14} />
                      Открыть вложение
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
            {selectedTicket.status !== 'closed' ? (
              <div className="mt-5 space-y-4 border-t border-zinc-800 pt-4">
                <textarea className="field-textarea" rows={4} value={reply.message} onChange={(e) => setReply((prev) => ({ ...prev, message: e.target.value }))} placeholder="Ответить в тикет..." />
                <input type="file" accept=".png,.jpg,.jpeg,.pdf,.doc,.docx" onChange={(e) => setReply((prev) => ({ ...prev, attachment: e.target.files?.[0] || null }))} className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2.5 file:font-semibold file:text-black" />
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={sendReply} className="primary-button">
                    <Send size={16} />
                    Отправить ответ
                  </button>
                  <button type="button" onClick={closeTicket} className="secondary-button">
                    Закрыть тикет
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-zinc-800/60 bg-[#121212] px-4 py-3 text-sm text-white shadow-2xl">
          {message}
        </div>
      ) : null}
    </ArtistShell>
  );
}
