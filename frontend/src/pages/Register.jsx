import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, AtSign, KeyRound, UserRound } from 'lucide-react';
import api from '../api';
import AuthShell from '../components/AuthShell';

export default function Register() {
  const [form, setForm] = useState({ login: '', email: '', name: '', password: '', confirmPassword: '' });
  const [err, setErr] = useState('');
  const [successModal, setSuccessModal] = useState({ open: false, title: '', description: '' });
  const nav = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const res = await api.post('/auth/register', form);
      setSuccessModal({
        open: true,
        title: res.data.title || 'Мы рассмотрим вашу заявку в течение 2 дней',
        description: res.data.description || 'Проверим данные аккаунта и активируем доступ к кабинету после модерации.',
      });
      setForm({ login: '', email: '', name: '', password: '', confirmPassword: '' });
    } catch (e) {
      setErr(e.response?.data?.error || 'Ошибка регистрации');
    }
  };

  return (
    <AuthShell
      title="Создание аккаунта"
      subtitle=""
      compact
      footer={
        <div className="space-y-3 text-sm text-slate-400">
          <p>
            Нажимая на кнопку Создать аккаунт, вы принимаете условия{' '}
            <Link to="/terms" className="font-semibold text-white">Пользовательского соглашения</Link>{' '}
            и{' '}
            <Link to="/privacy" className="font-semibold text-white">Политики конфиденциальности</Link>
          </p>
          <p>
            Уже есть аккаунт? <Link to="/login" className="font-semibold text-white">Войти</Link>
          </p>
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
          <span className="field-label">Логин</span>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input className="field-input pl-11" placeholder="stage_name" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} required />
          </div>
        </label>

        <label className="block space-y-2">
          <span className="field-label">Email</span>
          <div className="relative">
            <AtSign className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input type="email" className="field-input pl-11" placeholder="artist@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
        </label>

        <label className="block space-y-2">
          <span className="field-label">Имя / название проекта</span>
          <input className="field-input" placeholder="CDCULT Artist" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="field-label">Пароль</span>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input type="password" className="field-input pl-11" placeholder="Минимум 6 символов" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
          </label>

          <label className="block space-y-2">
            <span className="field-label">Подтверждение</span>
            <input type="password" className="field-input" placeholder="Повторите пароль" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required />
          </label>
        </div>

        <button className="primary-button w-full">
          Создать аккаунт
          <ArrowRight size={17} />
        </button>
      </form>

      {successModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setSuccessModal({ open: false, title: '', description: '' })}>
          <div
            className="w-full max-w-md rounded-3xl border border-zinc-800 bg-[#121212] p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-white">{successModal.title}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{successModal.description}</p>
            <button
              type="button"
              onClick={() => {
                setSuccessModal({ open: false, title: '', description: '' });
                nav('/login');
              }}
              className="primary-button mt-6 w-full justify-center"
            >
              Понятно
            </button>
          </div>
        </div>
      ) : null}
    </AuthShell>
  );
}
