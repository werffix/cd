import axios from 'axios';
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Функция для загрузки обложки и создания релиза
export const createReleaseWithCover = async (formData) => {
  return api.post('/releases', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

// Функция для загрузки трека
export const uploadTrackToRelease = async (releaseId, formData) => {
  return api.post(`/releases/${releaseId}/tracks`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export default api;
