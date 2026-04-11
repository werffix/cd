import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';

export default function Register() {
  const [form, setForm] = useState({ login: '', email: '', name: '', password: '', confirmPassword: '' });
  const [err, setErr] = useState('');
  const { login } = useAuth();
  const nav = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); setErr('');
    try {
      const res = await api.post('/auth/register', form);
      login(res.data); nav('/dashboard');
    } catch (e) { setErr(e.response?.data?.error || 'Ошибка регистрации'); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-gray-900 p-8 rounded-2xl border border-white/10 space-y-4">
        <h2 className="text-2xl font-bold text-center">Регистрация артиста</h2>
        {err && <p className="text-red-400 text-sm text-center">{err}</p>}
        <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white" placeholder="Логин" value={form.login} onChange={e => setForm({...form, login: e.target.value})} required />
        <input type="email" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
        <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white" placeholder="Имя / Название проекта" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
        <input type="password" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white" placeholder="Пароль" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
        <input type="password" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white" placeholder="Подтвердите пароль" value={form.confirmPassword} onChange={e => setForm({...form, confirmPassword: e.target.value})} required />
        <button className="w-full bg-emerald-500 text-white font-semibold py-3 rounded-lg hover:bg-emerald-600 transition">Создать аккаунт</button>
        <p className="text-center text-sm text-gray-400 mt-2">Уже есть аккаунт? <Link to="/login" className="text-white underline">Войти</Link></p>
      </form>
    </div>
  );
}
