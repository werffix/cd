import React, { useState, useEffect } from 'react';
import { MusicNoteIcon, UploadIcon, CheckCircleIcon, XCircleIcon, InfoIcon, ArrowLeftIcon, ArrowRightIcon, SaveIcon, SendIcon, CalendarIcon, BarcodeIcon, UserIcon, PlusIcon, TrashIcon, XIcon } from 'hugeicons-react';
import api from './api';
import { useAuth } from './AuthContext';

const STATUS_CONFIG = { delivered: { label: 'Одобрен', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' }, moderation: { label: 'На модерации', bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' }, draft: { label: 'Черновик', bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' }, rejected: { label: 'Отклонён', bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' } };

const INITIAL_FORM = { release_title: '', subtitle: '', release_type: 'single', artists: '', genre: '', release_date_type: 'asap', release_date: '', upc: '', tracks: [{ track_title: '', track_artists: '', lyrics_authors: '', music_authors: '', explicit: false, isrc: '', lyrics_text: '' }], audio_archive_url: '', project_demo_link: '', telegram: '', spotify_profile: 'create', apple_music_profile: 'create', comment: '', agreement: false };

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

  useEffect(() => {
    api.get('/releases').then(res => setReleases(res.data.map(r => ({ ...r, date: new Date(r.created_at).toLocaleDateString(), cover: r.cover_url || 'https://via.placeholder.com/500', tracks: r.metadata?.tracks || [] })))).catch(() => setReleases([]));
  }, []);

  const handleChange = (e) => { const { name, value, type, checked } = e.target; setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value })); if (errors[name]) setErrors(prev => ({ ...prev, [name]: null })); };
  const handleTrackChange = (index, field, value) => { const newTracks = [...formData.tracks]; newTracks[index] = { ...newTracks[index], [field]: value }; setFormData(prev => ({ ...prev, tracks: newTracks })); };
  const addTrack = () => setFormData(prev => ({ ...prev, tracks: [...prev.tracks, { track_title: '', track_artists: '', lyrics_authors: '', music_authors: '', explicit: false, isrc: '', lyrics_text: '' }] }));
  const removeTrack = (index) => setFormData(prev => ({ ...prev, tracks: prev.tracks.filter((_, i) => i !== index).length ? prev.tracks.filter((_, i) => i !== index) : [{ track_title: '', track_artists: '', lyrics_authors: '', music_authors: '', explicit: false, isrc: '', lyrics_text: '' }] }));

  const validateStep = (currentStep) => {
    const newErrors = {};
    if (currentStep === 1) { if (!formData.release_title) newErrors.release_title = 'Обязательно'; if (!formData.artists) newErrors.artists = 'Обязательно'; if (!formData.genre) newErrors.genre = 'Обязательно'; if (formData.release_date_type === 'exact_date' && !formData.release_date) newErrors.release_date = 'Обязательно'; }
    else if (currentStep === 2) { if (!formData.audio_archive_url) newErrors.audio_archive_url = 'Ссылка обязательна'; formData.tracks.forEach((track, i) => { if (!track.track_title) newErrors[`track_${i}_title`] = 'Название обязательно'; if (!track.track_artists) newErrors[`track_${i}_artists`] = 'Артисты обязательны'; }); }
    else if (currentStep === 3) { if (!formData.project_demo_link) newErrors.project_demo_link = 'Обязательно'; if (!formData.telegram) newErrors.telegram = 'Обязательно'; }
    else if (currentStep === 4) { if (!formData.agreement) newErrors.agreement = 'Необходимо согласие'; }
    setErrors(newErrors); setStepErrors(prev => ({ ...prev, [currentStep]: Object.keys(newErrors).length > 0 })); return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => { if (validateStep(step)) setStep(s => Math.min(s + 1, 4)); };
  const prevStep = () => setStep(s => Math.max(s - 1, 1));
  
  const submitToApi = async (status) => {
    const payload = { title: formData.release_title, subtitle: formData.subtitle, type: formData.release_type, artists: formData.artists, genre: formData.genre, status, cover_url: formData.cover_image?.name || '', archive_url: formData.audio_archive_url, metadata: { tracks: formData.tracks, telegram: formData.telegram, demo: formData.project_demo_link } };
    await api.post('/releases', payload);
    setIsWizardOpen(false); setStep(1); setFormData(INITIAL_FORM); setErrors({});
    setReleases(await (await api.get('/releases')).then(r => r.data.map(d => ({ ...d, date: new Date(d.created_at).toLocaleDateString(), cover: d.cover_url || 'https://via.placeholder.com/500', tracks: d.metadata?.tracks || [] }))));
  };

  const Input = ({ label, name, error, ...props }) => (<div className="flex flex-col gap-1.5"><label className="text-sm text-gray-300 font-medium">{label}</label><input name={name} {...props} className={`bg-gray-900/80 border rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 transition ${error ? 'border-red-500/50 focus:ring-red-500/30' : 'border-gray-700 focus:border-white/30 focus:ring-white/10'}`} />{error && <span className="text-xs text-red-400">{error}</span>}</div>);

  return (
    <div className="min-h-screen bg-gray-950 text-white font-['Montserrat'] selection:bg-white/20">
      <header className="fixed top-0 left-0 right-0 z-40 px-6 py-4 flex items-center justify-between bg-gray-950/60 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center"><MusicNoteIcon size={18} className="text-black" /></div><span className="text-lg font-bold tracking-tight">CDCULT Distribution</span></div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{user?.name || user?.login}</span>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-white border border-gray-700 px-3 py-1.5 rounded-lg transition">Выйти</button>
          <button onClick={() => setIsWizardOpen(true)} className="bg-white text-black px-5 py-2.5 rounded-lg font-semibold hover:bg-gray-200 transition active:scale-95 flex items-center gap-2"><PlusIcon size={18} /> Новый релиз</button>
        </div>
      </header>

      <main className="pt-24 px-4 sm:px-6 lg:px-8 pb-20 max-w-[1600px] mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {releases.map((rel) => (
            <div key={rel.id} onClick={() => { setSelectedRelease(rel); setIsModalOpen(true); }} className="group bg-gray-900/80 rounded-xl overflow-hidden border border-white/5 hover:border-white/20 cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-black/50">
              <div className="relative aspect-square overflow-hidden bg-gray-800"><img src={rel.cover} alt={rel.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" /></div>
              <div className="p-4"><h3 className="font-semibold truncate">{rel.title}</h3><p className="text-sm text-gray-400 truncate">{rel.artists}</p><div className="flex items-center justify-between mt-3"><span className="text-xs text-gray-500 flex items-center gap-1"><CalendarIcon size={12} /> {rel.date}</span><span className={`text-xs px-2 py-1 rounded-full border ${STATUS_CONFIG[rel.status].bg} ${STATUS_CONFIG[rel.status].text} ${STATUS_CONFIG[rel.status].border}`}>{STATUS_CONFIG[rel.status].label}</span></div></div>
            </div>
          ))}
        </div>
      </main>

      {/* Модальное окно деталей */}
      {isModalOpen && selectedRelease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative shadow-2xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition"><XIcon size={18} /></button>
            <div className="flex flex-col md:flex-row gap-6 p-6">
              <img src={selectedRelease.cover} alt="Cover" className="w-full md:w-64 h-64 object-cover rounded-xl shadow-lg" />
              <div className="flex-1 space-y-4">
                <div className="flex items-start justify-between"><div><h2 className="text-2xl font-bold">{selectedRelease.title}</h2><p className="text-gray-400">{selectedRelease.artists}</p></div><span className={`mt-1 text-sm px-2.5 py-1 rounded-full border ${STATUS_CONFIG[selectedRelease.status].bg} ${STATUS_CONFIG[selectedRelease.status].text} ${STATUS_CONFIG[selectedRelease.status].border}`}>{STATUS_CONFIG[selectedRelease.status].label}</span></div>
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-300">
                  <p className="flex items-center gap-2"><CalendarIcon size={14} /> Дата: {selectedRelease.date}</p>
                  <p className="flex items-center gap-2"><BarcodeIcon size={14} /> UPC: {selectedRelease.metadata?.upc || 'Не указан'}</p>
                  <p className="flex items-center gap-2"><InfoIcon size={14} /> Жанр: {selectedRelease.genre}</p>
                  <p className="flex items-center gap-2"><MusicNoteIcon size={14} /> Тип: {selectedRelease.release_type}</p>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4 border border-white/5">
                  <h4 className="font-medium mb-3 flex items-center gap-2"><MusicNoteIcon size={16} /> Треклист</h4>
                  <div className="space-y-2">{selectedRelease.tracks?.map(t => (<div key={t.num} className="flex justify-between text-sm py-2 border-b border-white/5 last:border-0"><span className="text-gray-400 w-8">{t.num}.</span><span className="flex-1">{t.track_title}</span><span className="text-gray-500">{t.duration || '-'}</span></div>))}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Мастер создания релиза */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 bg-gray-950 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-6 pt-24 pb-10">
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold">Создание релиза</h2><button onClick={() => setIsWizardOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition"><XIcon size={20} /></button></div>
            <div className="flex items-center justify-center mb-8 gap-2">{[1, 2, 3, 4].map((s) => (<React.Fragment key={s}><button onClick={() => setStep(s)} className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all border ${s === step ? 'bg-white text-black border-white scale-110' : stepErrors[s] ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>{stepErrors[s] ? <XIcon size={16} /> : <CheckCircleIcon size={16} />}</button>{s < 4 && <div className={`w-12 h-0.5 ${s < step ? 'bg-emerald-500' : 'bg-gray-700'}`} />}</React.Fragment>))}</div>

            <div className="bg-gray-900/60 border border-white/10 rounded-2xl p-6 md:p-8 space-y-6 min-h-[400px]">
              {step === 1 && (<div className="grid grid-cols-1 md:grid-cols-2 gap-5"><Input label="Название релиза *" name="release_title" value={formData.release_title} onChange={handleChange} error={errors.release_title} /><Input label="Подзаголовок" name="subtitle" value={formData.subtitle} onChange={handleChange} /><div className="flex flex-col gap-1.5"><label className="text-sm text-gray-300 font-medium">Тип релиза *</label><select name="release_type" value={formData.release_type} onChange={handleChange} className="bg-gray-900/80 border border-gray-700 rounded-lg px-3 py-2.5 text-white"><option value="single">Сингл</option><option value="ep">EP</option><option value="album">Альбом</option></select></div><Input label="Артисты *" name="artists" value={formData.artists} onChange={handleChange} error={errors.artists} /><Input label="Жанр *" name="genre" value={formData.genre} onChange={handleChange} error={errors.genre} /><div className="flex flex-col gap-1.5"><label className="text-sm text-gray-300 font-medium">Дата релиза</label><div className="flex gap-2 mb-2"><button onClick={() => setFormData(p => ({ ...p, release_date_type: 'asap' }))} className={`px-3 py-1.5 rounded-lg text-sm border ${formData.release_date_type === 'asap' ? 'bg-white text-black border-white' : 'bg-gray-800 border-gray-700'}`}>ASAP</button><button onClick={() => setFormData(p => ({ ...p, release_date_type: 'exact_date' }))} className={`px-3 py-1.5 rounded-lg text-sm border ${formData.release_date_type === 'exact_date' ? 'bg-white text-black border-white' : 'bg-gray-800 border-gray-700'}`}>Точная дата</button></div>{formData.release_date_type === 'exact_date' && <Input name="release_date" type="date" value={formData.release_date} onChange={handleChange} error={errors.release_date} />}</div><Input label="UPC" name="upc" value={formData.upc} onChange={handleChange} /><div className="flex flex-col gap-1.5"><label className="text-sm text-gray-300 font-medium">Обложка</label><input name="cover_image" type="file" accept="image/jpeg,image/png" onChange={handleChange} className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-800 file:text-white hover:file:bg-gray-700" /></div></div>)}
              {step === 2 && (<div className="space-y-4"><div className="flex items-center justify-between"><h3 className="font-semibold">Треклист</h3><button onClick={addTrack} className="flex items-center gap-1 text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition"><PlusIcon size={14} /> Добавить</button></div>{formData.tracks.map((t, i) => (<div key={i} className="bg-gray-800/40 p-4 rounded-xl border border-white/5 space-y-3 relative">{formData.tracks.length > 1 && <button onClick={() => removeTrack(i)} className="absolute top-3 right-3 text-gray-500 hover:text-red-400"><TrashIcon size={16} /></button>}<h4 className="text-sm font-medium text-gray-300">Трек #{i + 1}</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Input label="Название *" name="track_title" value={t.track_title} onChange={e => handleTrackChange(i, 'track_title', e.target.value)} error={errors[`track_${i}_title`]} /><Input label="Артисты *" name="track_artists" value={t.track_artists} onChange={e => handleTrackChange(i, 'track_artists', e.target.value)} error={errors[`track_${i}_artists`]} /><Input label="Авторы текста *" name="lyrics_authors" value={t.lyrics_authors} onChange={e => handleTrackChange(i, 'lyrics_authors', e.target.value)} /><Input label="Авторы музыки *" name="music_authors" value={t.music_authors} onChange={e => handleTrackChange(i, 'music_authors', e.target.value)} /><div className="flex items-center gap-4 pt-2"><label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer"><input type="checkbox" checked={t.explicit} onChange={e => handleTrackChange(i, 'explicit', e.target.checked)} className="rounded bg-gray-800 border-gray-600" /> Explicit</label><Input label="ISRC" name="isrc" value={t.isrc} onChange={e => handleTrackChange(i, 'isrc', e.target.value)} /></div></div></div>))}<Input label="Ссылка на ZIP-архив (WAV/FLAC) *" name="audio_archive_url" value={formData.audio_archive_url} onChange={handleChange} error={errors.audio_archive_url} /></div>)}
              {step === 3 && (<div className="space-y-5"><Input label="Ссылка на демо / договор *" name="project_demo_link" value={formData.project_demo_link} onChange={handleChange} error={errors.project_demo_link} /><Input label="Telegram (контакт) *" name="telegram" value={formData.telegram} onChange={handleChange} error={errors.telegram} /><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{['spotify', 'apple_music'].map(p => (<div key={p} className="flex flex-col gap-1.5"><label className="text-sm text-gray-300 font-medium capitalize">{p.replace('_', ' ')} профиль</label><select name={`${p}_profile`} value={formData[`${p}_profile`]} onChange={handleChange} className="bg-gray-900/80 border border-gray-700 rounded-lg px-3 py-2.5 text-white"><option value="exists">Есть</option><option value="create">Создать</option><option value="already_submitted">Отправлен</option></select></div>))}</div><div className="flex flex-col gap-1.5"><label className="text-sm text-gray-300 font-medium">Комментарий</label><textarea name="comment" value={formData.comment} onChange={handleChange} rows={3} className="bg-gray-900/80 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none" /></div></div>)}
              {step === 4 && (<div className="space-y-6"><div className="bg-gray-800/50 p-4 rounded-xl border border-white/10 space-y-3 text-sm"><h4 className="font-semibold text-lg mb-2">Финальная проверка</h4><div className="grid grid-cols-2 gap-2 text-gray-300"><p>🎵 Релиз: <span className="text-white">{formData.release_title}</span></p><p>👤 Артист: <span className="text-white">{formData.artists}</span></p><p>📦 Тип: <span className="text-white capitalize">{formData.release_type}</span></p><p>🎸 Жанр: <span className="text-white">{formData.genre}</span></p></div><p className="mt-2 text-gray-400">Треков: {formData.tracks.length}</p></div><div className="bg-gray-800/50 p-4 rounded-xl border border-white/10"><h5 className="font-medium mb-2">Треклист</h5><ul className="list-disc list-inside text-sm text-gray-400 space-y-1">{formData.tracks.map((t, i) => <li key={i}>{t.track_title} {t.explicit ? '(E)' : ''}</li>)}</ul></div><label className={`flex items-start gap-3 cursor-pointer select-none ${errors.agreement ? 'text-red-400' : 'text-gray-300'}`}><input type="checkbox" checked={formData.agreement} onChange={handleChange} name="agreement" className="mt-1 w-5 h-5 rounded border-gray-600 bg-gray-800 text-white focus:ring-0" /><span className="text-sm">Я подтверждаю корректность данных, права на материалы и соглашаюсь с <span className="underline hover:text-white transition">офертой</span> и <span className="underline hover:text-white transition">политикой</span>.</span></label></div>}
            </div>

            <div className="flex items-center justify-between mt-6"><div className="flex gap-3">{step > 1 && <button onClick={prevStep} className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-700 hover:bg-white/5 transition text-gray-300"><ArrowLeftIcon size={16} /> Назад</button>}</div>{step < 4 ? <button onClick={nextStep} className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white text-black font-semibold hover:bg-gray-200 transition">Далее <ArrowRightIcon size={16} /></button> : <button onClick={() => submitToApi('moderation')} className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition active:scale-95">Отправить <SendIcon size={16} /></button>}</div>
          </div>
        </div>
      )}
    </div>
  );
}
