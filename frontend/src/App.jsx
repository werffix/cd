import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminPanel from './pages/AdminPanel';
import DistributionDashboard from './DistributionDashboard';
import ReleaseFormPage from './pages/ReleaseFormPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import ArtistPlaceholderPage from './pages/ArtistPlaceholderPage';
import SupportPage from './pages/SupportPage';

const Protect = ({ children, role }) => {
  const { user, token } = useAuth();
  if (!token) return <Navigate to="/login" />;
  if (role && user?.role !== role) return <Navigate to="/login" />;
  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/admin" element={<Protect role="admin"><AdminPanel /></Protect>} />
          <Route path="/dashboard" element={<Protect><DistributionDashboard /></Protect>} />
          <Route path="/dashboard/new" element={<Protect><ReleaseFormPage /></Protect>} />
          <Route path="/dashboard/analytics" element={<Protect><ArtistPlaceholderPage title="Аналитика" /></Protect>} />
          <Route path="/dashboard/smart-link" element={<Protect><ArtistPlaceholderPage title="Смарт-Линк" /></Protect>} />
          <Route path="/dashboard/faq" element={<Protect><ArtistPlaceholderPage title="FAQ" /></Protect>} />
          <Route path="/dashboard/support" element={<Protect><SupportPage /></Protect>} />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
