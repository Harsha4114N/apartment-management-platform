import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';
import API_BASE from './config/api';

// ── Auth Pages ──
import UnifiedLogin from './pages/UnifiedLogin';
import RegisterSociety from './pages/RegisterSociety';
import JoinSociety from './pages/JoinSociety';
import Login from './pages/Login';
import Register from './pages/Register';

// ── Layout & Guards ──
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// ── App Pages ──
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminApprovals from './pages/AdminApprovals';
import BillingDashboard from './pages/BillingDashboard';
import AdminNotifications from './pages/AdminNotifications';
import Maintenance from './pages/Maintenance';
import Visitors from './pages/Visitors';
import Announcements from './pages/Announcements';
import Events from './pages/Events';
import Directory from './pages/Directory';
import Profile from './pages/Profile';
import SecurityDashboard from './pages/SecurityDashboard';

function App() {
  // ── Push Notification Subscription ──
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    let user = null;
    try { user = storedUser ? JSON.parse(storedUser) : null; } catch { /* ignore */ }

    if (!user || !('Notification' in window)) return;

    const subscribe = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('[Push] Notification permission denied.');
          return;
        }

        // Register service worker (vite-plugin-pwa auto-generates one)
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY || '',
        });

        const token = localStorage.getItem('token');
        if (!token) return;

        await axios.post(
          `${API_BASE}/api/users/push-subscribe`,
          { endpoint: sub.endpoint, keys: sub.toJSON().keys },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('[Push] Subscribed successfully.');
      } catch (err) {
        console.error('[Push] Subscription error:', err.message);
      }
    };

    // Wait a beat for the service worker to be ready
    const timer = setTimeout(subscribe, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <BrowserRouter>
      {/* Non-blocking UI Notifications */}
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />

      <Routes>
        {/* ── Public / Auth Routes (no sidebar) ── */}
        <Route path="/" element={<UnifiedLogin />} />
        <Route path="/auth" element={<UnifiedLogin />} />

        {/* ── Legacy auth routes (backward compatibility) ── */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register-society" element={<RegisterSociety />} />
        <Route path="/join-society" element={<JoinSociety />} />

        {/* ═══════════════════════════════════════════════
           RESIDENT-ONLY ROUTES
           ═══════════════════════════════════════════════ */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['Resident']}>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing"
          element={
            <ProtectedRoute allowedRoles={['Resident']}>
              <Layout>
                <BillingDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/directory"
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'Admin']}>
              <Layout>
                <Directory />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute allowedRoles={['Resident']}>
              <Layout>
                <Profile />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* ═══════════════════════════════════════════════
           ADMIN / SUPERADMIN-ONLY ROUTES
           ═══════════════════════════════════════════════ */}
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'Admin']}>
              <Layout>
                <AdminDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/notifications"
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'Admin']}>
              <Layout>
                <AdminNotifications />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-approvals"
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin', 'Admin']}>
              <Layout>
                <AdminApprovals />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Legacy /admin → redirect */}
        <Route
          path="/admin"
          element={<Navigate to="/admin-dashboard" replace />}
        />

        {/* ═══════════════════════════════════════════════
           SHARED ROUTES (role-aware via component)
           Both Resident and Admin users can access these.
           The component itself renders different views.
           ═══════════════════════════════════════════════ */}
        <Route
          path="/announcements"
          element={
            <ProtectedRoute allowedRoles={['Resident', 'SuperAdmin', 'Admin']}>
              <Layout>
                <Announcements />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/events"
          element={
            <ProtectedRoute allowedRoles={['Resident', 'SuperAdmin', 'Admin']}>
              <Layout>
                <Events />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/maintenance"
          element={
            <ProtectedRoute allowedRoles={['Resident', 'SuperAdmin', 'Admin']}>
              <Layout>
                <Maintenance />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/visitors"
          element={
            <ProtectedRoute allowedRoles={['Resident', 'SuperAdmin', 'Admin']}>
              <Layout>
                <Visitors />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bills"
          element={
            <ProtectedRoute allowedRoles={['Resident', 'SuperAdmin', 'Admin']}>
              <Layout>
                <BillingDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* ═══════════════════════════════════════════════
           SECURITY-ONLY ROUTES
           ═══════════════════════════════════════════════ */}
        <Route
          path="/security-dashboard"
          element={
            <ProtectedRoute allowedRoles={['Security']}>
              <Layout>
                <SecurityDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* ═══════════════════════════════════════════════
           CATCH-ALL
           ═══════════════════════════════════════════════ */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
