import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';

export default function Login() {
  const [form, setForm] = useState({ login: '', password: '' });
  const [err, setErr] = useState('');
  const { login: authLogin } = useAuth();
  const nav = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); setErr('');
    try {
      const res = await api.post('/auth/login', form);
      authLogin(res.data);
      nav(res.data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (e) { setErr(e.response?.data?.error || 'Ошибка входа'); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-gray-900 p-8 rounded-2xl border border-white/10 space-y-4">
        <h2 className="text-2xl font-bold text-center">Вход в аккаунт</h2>
        {err && <p className="text-red-400 text-sm text-center">{err}</p>}
        <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white" placeholder="Логин или Email" value={form.login} onChange={e => setForm({...form, login: e.target.value})} required />
        <input type="password" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white" placeholder="Пароль" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
        <button className="w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-gray-200 transition">Войти</button>
        <div className="text-center text-sm text-gray-400 mt-2">
          Нет аккаунта? <Link to="/register" className="text-white underline">Регистрация</Link> | 
          <Link to="/admin/login" className="text-white underline ml-1">Вход для админов</Link>
        </div>
      </form>
    </div>
  );
}
