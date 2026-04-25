import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, LockKeyhole, User2 } from 'lucide-react';
import { useAuth } from '../AuthContext';
import api from '../api';
import AuthShell from '../components/AuthShell';

export default function Login() {
  const [form, setForm] = useState({ login: '', password: '' });
  const [err, setErr] = useState('');
  const [statusModal, setStatusModal] = useState({ open: false, title: '', reason: '' });
  const [devModalOpen, setDevModalOpen] = useState(false);
  const { login: authLogin } = useAuth();
  const nav = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const res = await api.post('/auth/login', form);
      authLogin(res.data);
      nav(res.data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (e) {
      const response = e.response?.data;
      if (response?.code === 'pending_review' || response?.code === 'registration_rejected' || response?.code === 'account_blocked') {
        setStatusModal({
          open: true,
          title: response.title || 'Доступ временно ограничен',
          reason: response.reason || response.error || 'Попробуйте позже или свяжитесь с поддержкой.',
        });
        return;
      }
      setErr(response?.error || 'Ошибка входа');
    }
  };

  return (
    <AuthShell
      title="Вход в кабинет"
      subtitle=""
      compact
      footer={
        <div className="space-y-3 text-sm text-zinc-400">
          <div className="flex items-center justify-center gap-2">
            <span>Нет аккаунта?</span>
            <Link to="/register" className="font-semibold text-white">Регистрация</Link>
            <span className="text-zinc-600">-</span>
            <button type="button" onClick={() => setDevModalOpen(true)} className="font-semibold text-white">Забыли пароль?</button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {err && (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        <label className="block space-y-2">
          <span className="field-label">Логин или email</span>
          <div className="relative">
            <User2 className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              className="field-input pl-11"
              placeholder="artist@example.com"
              value={form.login}
              onChange={(e) => setForm({ ...form, login: e.target.value })}
              required
            />
          </div>
        </label>

        <label className="block space-y-2">
          <span className="field-label">Пароль</span>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="password"
              className="field-input pl-11"
              placeholder="Введите пароль"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
        </label>

        <button className="primary-button w-full">
          Войти
          <ArrowRight size={17} />
        </button>
      </form>

      {statusModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setStatusModal({ open: false, title: '', reason: '' })}>
          <div
            className="w-full max-w-md rounded-3xl border border-zinc-800 bg-[#121212] p-6 text-center shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-white">{statusModal.title}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{statusModal.reason}</p>
            <button
              type="button"
              onClick={() => setStatusModal({ open: false, title: '', reason: '' })}
              className="primary-button mt-6 w-full justify-center"
            >
              Закрыть
            </button>
          </div>
        </div>
      ) : null}

      {devModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setDevModalOpen(false)}>
          <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-[#121212] p-6 text-center shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white">Раздел пока в разработке</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">Если нужно восстановить доступ, напишите в поддержку CDCULT.</p>
            <a href="https://t.me/cdcult_records" target="_blank" rel="noreferrer" className="primary-button mt-6 w-full justify-center">
              Перейти
            </a>
          </div>
        </div>
      ) : null}
    </AuthShell>
  );
}
