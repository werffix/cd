import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, LockKeyhole, User2 } from 'lucide-react';
import { useAuth } from '../AuthContext';
import api from '../api';
import AuthShell from '../components/AuthShell';

export default function Login() {
  const [form, setForm] = useState({ login: '', password: '' });
  const [err, setErr] = useState('');
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
      setErr(e.response?.data?.error || 'Ошибка входа');
    }
  };

  return (
    <AuthShell
      title="Вход в кабинет"
      subtitle=""
      compact
      footer={
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-zinc-400">
          <span>
            Нет аккаунта? <Link to="/register" className="font-semibold text-white">Регистрация</Link>
          </span>
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
    </AuthShell>
  );
}
