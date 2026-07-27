import AuthPage from './pages/AuthPage';
import RegisterSociety from './pages/RegisterSociety';
import AdminNotifications from './pages/AdminNotifications';
import BillingDashboard from './pages/BillingDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <BrowserRouter>
      {/* Non-blocking UI Notifications */}
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      
      <Routes>
        {/* ── Auth routes ── */}
        <Route path="/" element={<AuthPage />} />
        <Route path="/auth" element={<AuthPage />} />

        {/* ── Legacy auth routes (kept for backward compatibility) ── */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register-society" element={<RegisterSociety />} />

        {/* ── App routes ── */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/billing" element={<BillingDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/notifications" element={<AdminNotifications />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
