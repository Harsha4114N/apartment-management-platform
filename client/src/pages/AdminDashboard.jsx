import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE from '../config/api';

const API_URL = `${API_BASE}/api`;

export default function AdminDashboard() {
  const navigate = useNavigate();

  // ── Metrics state ──
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // ── Fetch metrics overview ──
  const fetchMetrics = async () => {
    try {
      setMetricsLoading(true);
      const headers = getAuthHeaders();
      const response = await axios.get(`${API_URL}/admin/metrics`, { headers });
      setMetrics(response.data);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      const msg = error.response?.data?.message || error.message || 'Failed to load metrics.';
      toast.error(msg);
    } finally {
      setMetricsLoading(false);
    }
  };

  // ── Fetch on mount ──
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please log in to access the admin dashboard.');
      navigate('/login');
      return;
    }
    fetchMetrics();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleLogout = () => {
    localStorage.removeItem('token');
    toast.success('Logged out successfully');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 md:p-12 font-sans">
      {/* ── Header ── */}
      <div className="max-w-5xl mx-auto flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Admin Command Center</h1>
          <p className="text-slate-500 text-sm mt-1">Overview of your society at a glance</p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-md shadow-rose-200 text-sm cursor-pointer"
        >
          Logout
        </button>
      </div>

      <div className="max-w-5xl mx-auto space-y-10">
        {/* ═══════════════════════════════════════════ */}
        {/* SECTION: Overview (KPI Metrics)            */}
        {/* ═══════════════════════════════════════════ */}
        <section className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-800">Society Overview</h2>
            <p className="text-slate-500 text-xs mt-0.5">Key metrics at a glance for your society</p>
          </div>

          <div className="p-8">
            {metricsLoading ? (
              /* ── Skeleton Loading Grid ── */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="p-6 rounded-xl bg-slate-50 border border-slate-100 animate-pulse">
                    <div className="h-3 w-20 bg-slate-200 rounded mb-4" />
                    <div className="h-8 w-28 bg-slate-200 rounded mb-2" />
                    <div className="h-2 w-16 bg-slate-200 rounded" />
                  </div>
                ))}
              </div>
            ) : (
              /* ── KPI Card Grid ── */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Total Revenue */}
                <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white text-lg shadow-md shadow-emerald-200">
                      💰
                    </div>
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Total Revenue</p>
                  </div>
                  <p className="text-3xl font-extrabold text-emerald-800 tracking-tight">
                    ₹{(metrics?.totalRevenue || 0).toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">from paid bills</p>
                </div>

                {/* Outstanding Dues */}
                <div className="p-6 rounded-xl bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center text-white text-lg shadow-md shadow-rose-200">
                      🧾
                    </div>
                    <p className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Outstanding Dues</p>
                  </div>
                  <p className="text-3xl font-extrabold text-rose-800 tracking-tight">
                    ₹{(metrics?.outstandingDues || 0).toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-rose-600 mt-1">pending collection</p>
                </div>

                {/* Active Tickets */}
                <div className="p-6 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white text-lg shadow-md shadow-amber-200">
                      🔧
                    </div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Active Tickets</p>
                  </div>
                  <p className="text-3xl font-extrabold text-amber-800 tracking-tight">
                    {metrics?.activeTickets || 0}
                  </p>
                  <p className="text-xs text-amber-600 mt-1">open or in-progress</p>
                </div>

                {/* Pending Approvals */}
                <div className="p-6 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white text-lg shadow-md shadow-blue-200">
                      👥
                    </div>
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Pending Approvals</p>
                  </div>
                  <p className="text-3xl font-extrabold text-blue-800 tracking-tight">
                    {metrics?.pendingApprovals || 0}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">awaiting review</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
