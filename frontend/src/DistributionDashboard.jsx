import React, { useState, useEffect } from 'react';
import { Music, Upload, CheckCircle, XCircle, Info, ArrowLeft, ArrowRight, Save, Send, Calendar, Barcode, User, Plus, Trash, X, Clock } from 'lucide-react';
import api, { createReleaseWithCover, uploadTrackToRelease } from './apiUpload';
import { useAuth } from './AuthContext';

const STATUS_CONFIG = { 
  delivered: { label: 'Одобрен', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' }, 
  moderation: { label: 'На модерации', bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' }, 
  draft: { label: 'Черновик', bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' }, 
  rejected: { label: 'Отклонён', bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' } 
};

const INITIAL_FORM = { 
  release_title: '', subtitle: '', release_type: 'single', artists: '', genre: '', 
  release_date_type: 'asap', release_date: '', upc: '', 
  tracks: [{ track_title: '', track_artists: '', lyrics_authors: '', music_authors: '', explicit: false, isrc: '', audio_file_obj: null }], 
  audio_archive_url: '', project_demo_link: '', telegram: '', spotify_profile: 'create', apple_music_profile: 'create', comment: '', agreement: false, cover_image: null
};

export default function DistributionDashboard() {
  const { user, logout } = useAuth();
  const [releases, setReleases] = useState([]);
  const [selectedRelease, setSelectedRelease] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [stepErrors, setStepErrors] = useState({ 1: false, 2: false, 3: false, 4: false });

  useEffect(() => { fetchReleases(); }, []);

  const fetchReleases = async () => {
    try {
      const res = await api.get('/releases');
      setReleases(res.data.map(r => ({
        ...r, 
        date: new Date(r.created_at).toLocaleDateString(), 
        cover: r.cover_url ? `http://${window.location.hostname}:3000${r.cover_url}` : 'https://via.placeholder.com/500',
        tracks: r.metadata ? (typeof r.metadata === 'string' ? JSON.parse(r.metadata).tracks : r.metadata.tracks) : []
      })));
    } catch (e) { console.error(e); }
  };

  const handleChange = (e) => { 
    const { name, value, type, checked, files } = e.target; 
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : (files ? files[0] : value) })); 
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null })); 
  };

  const handleTrackChange = (index, field, value) => { 
    const newTracks = [...formData.tracks]; 
    newTracks[index] = { ...newTracks[index], [field]: value }; 
    setFormData(prev => ({ ...prev, tracks: newTracks })); 
  };

  const addTrack = () => setFormData(prev => ({ ...prev, tracks: [...prev.tracks, { track_title: '', track_artists: '', lyrics_authors: '', music_authors: '', explicit: false, isrc: '', audio_file_obj: null }] }));
  
  const removeTrack = (index) => {
    const newTracks = formData.tracks.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, tracks: newTracks.length ? newTracks : [{ track_title: '', track_artists: '', lyrics_authors: '', music_authors: '', explicit: false, isrc: '', audio_file_obj: null }] }));
  };

  const validateStep = (currentStep) => {
    const newErrors = {};
    if (currentStep === 1) { 
      if (!formData.release_title) newErrors.release_title = 'Обязательно'; 
      if (!formData.artists) newErrors.artists = 'Обязательно'; 
      if (!formData.genre) newErrors.genre = 'Обязательно'; 
      if (formData.release_date_type === 'exact_date' && !formData.release_date) newErrors.release_date = 'Обязательно'; 
    } else if (currentStep === 2) { 
      if (!formData.audio_archive_url) newErrors.audio_archive_url = 'Ссылка обязательна'; 
      formData.tracks.forEach((track, i) => { 
        if (!track.track_title) newErrors[`track_${i}_title`] = 'Название обязательно'; 
        if (!track.track_artists) newErrors[`track_${i}_artists`] = 'Артисты обязательны'; 
      }); 
    } else if (currentStep === 3) { 
      if (!formData.project_demo_link) newErrors.project_demo_link = 'Обязательно'; 
      if (!formData.telegram) newErrors.telegram = 'Обязательно'; 
    } else if (currentStep === 4) { 
      if (!formData.agreement) newErrors.agreement = 'Необходимо согласие'; 
    }
    setErrors(newErrors); 
    setStepErrors(prev => ({ ...prev, [currentStep]: Object.keys(newErrors).length > 0 })); 
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => { if (validateStep(step)) setStep(s => Math.min(s + 1, 4)); };
  const prevStep = () => setStep(s => Math.max(s - 1, 1));
  
    const submitToApi = async (status) => {
    if (!validateStep(4)) return;
    try {
      const data = new FormData();
      data.append('title', formData.release_title);
      data.append('subtitle', formData.subtitle);
      data.append('type', formData.release_type);
      data.append('artists', formData.artists);
      data.append('genre', formData.genre);
      data.append('status', status);
      data.append('archive_url', formData.audio_archive_url);
      data.append('metadata', JSON.stringify({
        tracks: formData.tracks.map(t => ({...t, audio_file: null})),
        telegram: formData.telegram,
        demo: formData.project_demo_link,
        upc: formData.upc
      }));
      
      if (formData.cover_image) {
        data.append('cover', formData.cover_image);
      }

      const res = await createReleaseWithCover(data);
      const releaseId = res.data.id;
      const returnedCoverUrl = res.data.cover_url; // Получаем путь от сервера

      // Загрузка треков
      for (let i = 0; i < formData.tracks.length; i++) {
        const track = formData.tracks[i];
        if (track.audio_file_obj) {
          const trackData = new FormData();
          trackData.append('track_audio', track.audio_file_obj);
          trackData.append('trackTitle', track.track_title);
          trackData.append('trackArtists', track.track_artists);
          trackData.append('explicit', track.explicit);
          trackData.append('isrc', track.isrc);
          await uploadTrackToRelease(releaseId, trackData);
        }
      }

      // Немедленно добавляем релиз в список локально, чтобы увидеть обложку сразу
      const newRelease = {
        id: releaseId,
        title: formData.release_title,
        artists: formData.artists,
        status: status,
        cover: returnedCoverUrl ? `http://${window.location.hostname}:3000${returnedCoverUrl}` : 'https://via.placeholder.com/500',
        date: 'Только что',
        release_type: formData.release_type,
        metadata: { tracks: formData.tracks }
      };

      setReleases(prev => [newRelease, ...prev]);
      
      setIsWizardOpen(false);
      setStep(1);
      setFormData(INITIAL_FORM);
      setErrors({});
      
      // Затем делаем фоновую синхронизацию с сервером
      setTimeout(fetchReleases, 1000); 

    } catch (err) {
      console.error("Ошибка отправки:", err);
      alert("Не удалось отправить релиз: " + (err.response?.data?.error || err.message));
    }
  };

  const Input = ({ label, name, error, ...props }) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-gray-300 font-medium">{label}</label>
      <input name={name} {...props} className={`bg-[#252525] border rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 transition ${error ? 'border-red-500/50 focus:ring-red-500/30' : 'border-gray-700 focus:border-white/30 focus:ring-white/10'}`} />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#1E1E1E] text-white font-['Montserrat'] selection:bg-white/20">
      <header className="fixed top-0 left-0 right-0 z-40 px-6 py-4 flex items-center justify-between bg-[#1E1E1E]/80 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center"><Music size={18} className="text-black" /></div>
          <span className="text-lg font-bold tracking-tight">CDCULT Distribution</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 hidden sm:inline">{user?.name || user?.login}</span>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-white border border-gray-700 px-3 py-1.5 rounded-lg transition">Выйти</button>
          <button onClick={() => setIsWizardOpen(true)} className="bg-white text-black px-5 py-2.5 rounded-lg font-semibold hover:bg-gray-200 transition active:scale-95 flex items-center gap-2"><Plus size={18} /> Новый релиз</button>
        </div>
      </header>

      <main className="pt-24 px-4 sm:px-6 lg:px-8 pb-20 max-w-[1600px] mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {releases.map((rel) => (
            <div key={rel.id} onClick={() => { setSelectedRelease(rel); setIsModalOpen(true); }} className="group bg-[#252525] rounded-xl overflow-hidden border border-white/5 hover:border-white/20 cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-black/50">
              <div className="relative aspect-square overflow-hidden bg-gray-800">
                <img src={rel.cover} alt={rel.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              </div>
              <div className="p-4">
                <h3 className="font-semibold truncate">{rel.title}</h3>
                <p className="text-sm text-gray-400 truncate">{rel.artists}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-500 flex items-center gap-1"><Calendar size={12} /> {rel.date}</span>
                  <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_CONFIG[rel.status]?.bg || 'bg-gray-500/15'} ${STATUS_CONFIG[rel.status]?.text || 'text-gray-400'} ${STATUS_CONFIG[rel.status]?.border || 'border-gray-500/30'}`}>
                    {STATUS_CONFIG[rel.status]?.label || rel.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Модальное окно деталей */}
      {isModalOpen && selectedRelease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-[#252525] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative shadow-2xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition"><X size={18} /></button>
            <div className="flex flex-col md:flex-row gap-6 p-6">
              <img src={selectedRelease.cover} alt="Cover" className="w-full md:w-64 h-64 object-cover rounded-xl shadow-lg" />
              <div className="flex-1 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedRelease.title}</h2>
                    <p className="text-gray-400">{selectedRelease.artists}</p>
                  </div>
                  <span className={`mt-1 text-sm px-2.5 py-1 rounded-full border ${STATUS_CONFIG[selectedRelease.status]?.bg} ${STATUS_CONFIG[selectedRelease.status]?.text} ${STATUS_CONFIG[selectedRelease.status]?.border}`}>
                    {STATUS_CONFIG[selectedRelease.status]?.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-300">
                  <p className="flex items-center gap-2"><Calendar size={14} /> Дата: {selectedRelease.date}</p>
                  <p className="flex items-center gap-2"><Barcode size={14} /> UPC: {selectedRelease.metadata?.upc || 'Не указан'}</p>
                  <p className="flex items-center gap-2"><Info size={14} /> Жанр: {selectedRelease.genre}</p>
                  <p className="flex items-center gap-2"><Music size={14} /> Тип: {selectedRelease.release_type}</p>
                </div>
                <div className="bg-[#1E1E1E] rounded-xl p-4 border border-white/5">
                  <h4 className="font-medium mb-3 flex items-center gap-2"><Music size={16} /> Треклист</h4>
                  <div className="space-y-2">
                    {selectedRelease.tracks?.map((t, i) => (
                      <div key={i} className="flex justify-between items-center text-sm py-2 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 w-6">{i + 1}.</span>
                          <div>
                            <div className="text-white">{t.track_title || t.title}</div>
                            {t.audio_file && <a href={`http://${window.location.hostname}:3000${t.audio_file}`} target="_blank" className="text-xs text-blue-400 hover:underline">📥 Скачать WAV/FLAC</a>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Мастер создания релиза */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 bg-[#1E1E1E] overflow-y-auto">
          <div className="max-w-3xl mx-auto p-6 pt-24 pb-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Создание релиза</h2>
              <button onClick={() => setIsWizardOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition"><X size={20} /></button>
            </div>
            
            <div className="flex items-center justify-center mb-8 gap-2">
              {[1, 2, 3, 4].map((s) => (
                <React.Fragment key={s}>
                  <button onClick={() => setStep(s)} className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all border ${
                    s === step ? 'bg-white text-black border-white scale-110' : stepErrors[s] ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-[#333] text-gray-400 border-gray-700'
                  }`}>
                    {stepErrors[s] ? <X size={16} /> : <CheckCircle size={16} />}
                  </button>
                  {s < 4 && <div className={`w-12 h-0.5 ${s < step ? 'bg-emerald-500' : 'bg-gray-700'}`} />}
                </React.Fragment>
              ))}
            </div>

            <div className="bg-[#252525] border border-white/10 rounded-2xl p-6 md:p-8 space-y-6 min-h-[400px]">
              {step === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Input label="Название релиза *" name="release_title" value={formData.release_title} onChange={handleChange} error={errors.release_title} />
                  <Input label="Подзаголовок" name="subtitle" value={formData.subtitle} onChange={handleChange} />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm text-gray-300 font-medium">Тип релиза *</label>
                    <select name="release_type" value={formData.release_type} onChange={handleChange} className="bg-[#252525] border border-gray-700 rounded-lg px-3 py-2.5 text-white">
                      <option value="single">Сингл</option><option value="ep">EP</option><option value="album">Альбом</option>
                    </select>
                  </div>
                  <Input label="Артисты *" name="artists" value={formData.artists} onChange={handleChange} error={errors.artists} />
                  <Input label="Жанр *" name="genre" value={formData.genre} onChange={handleChange} error={errors.genre} />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm text-gray-300 font-medium">Дата релиза</label>
                    <div className="flex gap-2 mb-2">
                      <button onClick={() => setFormData(p => ({ ...p, release_date_type: 'asap' }))} className={`px-3 py-1.5 rounded-lg text-sm border ${formData.release_date_type === 'asap' ? 'bg-white text-black border-white' : 'bg-[#333] border-gray-700'}`}>ASAP</button>
                      <button onClick={() => setFormData(p => ({ ...p, release_date_type: 'exact_date' }))} className={`px-3 py-1.5 rounded-lg text-sm border ${formData.release_date_type === 'exact_date' ? 'bg-white text-black border-white' : 'bg-[#333] border-gray-700'}`}>Точная дата</button>
                    </div>
                    {formData.release_date_type === 'exact_date' && <Input name="release_date" type="date" value={formData.release_date} onChange={handleChange} error={errors.release_date} />}
                  </div>
                  <Input label="UPC" name="upc" value={formData.upc} onChange={handleChange} />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm text-gray-300 font-medium">Обложка (JPG/PNG)</label>
                    <input name="cover_image" type="file" accept="image/jpeg,image/png" onChange={handleChange} className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#333] file:text-white hover:file:bg-gray-700" />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Треклист</h3>
                    <button onClick={addTrack} className="flex items-center gap-1 text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition"><Plus size={14} /> Добавить</button>
                  </div>
                  {formData.tracks.map((t, i) => (
                    <div key={i} className="bg-[#1E1E1E] p-4 rounded-xl border border-white/5 space-y-3 relative">
                      {formData.tracks.length > 1 && <button onClick={() => removeTrack(i)} className="absolute top-3 right-3 text-gray-500 hover:text-red-400"><Trash size={16} /></button>}
                      <h4 className="text-sm font-medium text-gray-300">Трек #{i + 1}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input label="Название *" name="track_title" value={t.track_title} onChange={e => handleTrackChange(i, 'track_title', e.target.value)} error={errors[`track_${i}_title`]} />
                        <Input label="Артисты *" name="track_artists" value={t.track_artists} onChange={e => handleTrackChange(i, 'track_artists', e.target.value)} error={errors[`track_${i}_artists`]} />
                        <Input label="Авторы текста *" name="lyrics_authors" value={t.lyrics_authors} onChange={e => handleTrackChange(i, 'lyrics_authors', e.target.value)} />
                        <Input label="Авторы музыки *" name="music_authors" value={t.music_authors} onChange={e => handleTrackChange(i, 'music_authors', e.target.value)} />
                        <div className="flex flex-col gap-2">
                           <div className="flex items-center gap-2 pt-2">
                              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer"><input type="checkbox" checked={t.explicit} onChange={e => handleTrackChange(i, 'explicit', e.target.checked)} className="rounded bg-[#333] border-gray-600" /> Explicit</label>
                              <Input label="ISRC" name="isrc" value={t.isrc} onChange={e => handleTrackChange(i, 'isrc', e.target.value)} />
                           </div>
                           <div className="flex flex-col gap-1">
                              <label className="text-xs text-gray-400">Аудио файл (WAV/FLAC)</label>
                              <input type="file" accept=".wav,.flac,audio/wav,audio/flac" onChange={(e) => handleTrackChange(i, 'audio_file_obj', e.target.files[0])} className="text-xs text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-[#333] file:text-white hover:file:bg-gray-700" />
                           </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Input label="Ссылка на ZIP-архив (резервная копия) *" name="audio_archive_url" value={formData.audio_archive_url} onChange={handleChange} error={errors.audio_archive_url} />
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <Input label="Ссылка на демо / договор *" name="project_demo_link" value={formData.project_demo_link} onChange={handleChange} error={errors.project_demo_link} />
                  <Input label="Telegram (контакт) *" name="telegram" value={formData.telegram} onChange={handleChange} error={errors.telegram} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {['spotify', 'apple_music'].map(p => (
                      <div key={p} className="flex flex-col gap-1.5">
                        <label className="text-sm text-gray-300 font-medium capitalize">{p.replace('_', ' ')} профиль</label>
                        <select name={`${p}_profile`} value={formData[`${p}_profile`]} onChange={handleChange} className="bg-[#252525] border border-gray-700 rounded-lg px-3 py-2.5 text-white">
                          <option value="exists">Есть</option><option value="create">Создать</option><option value="already_submitted">Отправлен</option>
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm text-gray-300 font-medium">Комментарий</label>
                    <textarea name="comment" value={formData.comment} onChange={handleChange} rows={3} className="bg-[#252525] border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none" />
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <div className="bg-[#1E1E1E] p-4 rounded-xl border border-white/10 space-y-3 text-sm">
                    <h4 className="font-semibold text-lg mb-2">Финальная проверка</h4>
                    <div className="grid grid-cols-2 gap-2 text-gray-300">
                      <p>🎵 Релиз: <span className="text-white">{formData.release_title}</span></p>
                      <p>👤 Артист: <span className="text-white">{formData.artists}</span></p>
                      <p>📦 Тип: <span className="text-white capitalize">{formData.release_type}</span></p>
                      <p>🎸 Жанр: <span className="text-white">{formData.genre}</span></p>
                    </div>
                    <p className="mt-2 text-gray-400">Треков: {formData.tracks.length}</p>
                  </div>
                  <div className="bg-[#1E1E1E] p-4 rounded-xl border border-white/10">
                    <h5 className="font-medium mb-2">Треклист</h5>
                    <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
                      {formData.tracks.map((t, i) => <li key={i}>{t.track_title} {t.explicit ? '(E)' : ''} {t.audio_file_obj ? '📁' : ''}</li>)}
                    </ul>
                  </div>
                  <label className={`flex items-start gap-3 cursor-pointer select-none ${errors.agreement ? 'text-red-400' : 'text-gray-300'}`}>
                    <input type="checkbox" checked={formData.agreement} onChange={handleChange} name="agreement" className="mt-1 w-5 h-5 rounded border-gray-600 bg-[#333] text-white focus:ring-0" />
                    <span className="text-sm">Я подтверждаю корректность данных, права на материалы и соглашаюсь с <span className="underline hover:text-white transition">офертой</span>.</span>
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-6">
              <div className="flex gap-3">
                {step > 1 && <button onClick={prevStep} className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-700 hover:bg-white/5 transition text-gray-300"><ArrowLeft size={16} /> Назад</button>}
              </div>
              {step < 4 ? (
                <button onClick={nextStep} className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white text-black font-semibold hover:bg-gray-200 transition">Далее <ArrowRight size={16} /></button>
              ) : (
                <button onClick={() => submitToApi('moderation')} className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition active:scale-95">Отправить <Send size={16} /></button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
