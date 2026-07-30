import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE from '../config/api';

const API_URL = `${API_BASE}/api`;

export default function AdminApprovals() {
  const navigate = useNavigate();

  // ── Pending users state ──
  const [pendingUsers, setPendingUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // ── Fetch pending users ──
  const fetchPendingUsers = async () => {
    try {
      setUsersLoading(true);
      const headers = getAuthHeaders();
      const response = await axios.get(`${API_URL}/admin/pending-users`, { headers });
      setPendingUsers(response.data);
    } catch (error) {
      console.error('Error fetching pending users:', error);
      const msg = error.response?.data?.message || error.message || 'Failed to load pending users.';
      toast.error(msg);
    } finally {
      setUsersLoading(false);
    }
  };

  // ── Fetch on mount ──
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please log in to access approvals.');
      navigate('/login');
      return;
    }
    fetchPendingUsers();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Approve or Reject a user ──
  const handleApproval = async (userId, userName, action) => {
    const toastId = toast.loading(`${action === 'Approved' ? 'Approving' : 'Rejecting'} ${userName}...`);
    try {
      await axios.post(
        `${API_URL}/admin/approve-user`,
        { userId, action },
        { headers: getAuthHeaders() }
      );
      toast.success(`${userName} has been ${action.toLowerCase()}.`, { id: toastId });
      setPendingUsers((prev) => prev.filter((u) => u._id !== userId));
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to ${action.toLowerCase()} user.`, { id: toastId });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 md:p-12 font-sans">
      {/* ── Header ── */}
      <div className="max-w-5xl mx-auto flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Resident Approvals</h1>
          <p className="text-slate-500 text-sm mt-1">Review and approve pending registration requests</p>
        </div>
        <button
          onClick={() => navigate('/admin-dashboard')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-md shadow-indigo-200 text-sm cursor-pointer"
        >
          ← Back to Dashboard
        </button>
      </div>

      <div className="max-w-5xl mx-auto">
        <section className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Pending Approvals</h2>
              <p className="text-slate-500 text-xs mt-0.5">Review and approve pending registration requests</p>
            </div>
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-full">
              {pendingUsers.length} pending
            </span>
          </div>

          <div className="p-8">
            {usersLoading ? (
              <p className="text-slate-400 text-center py-8">Loading pending users...</p>
            ) : pendingUsers.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-slate-500 font-medium">All caught up! No pending approvals.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingUsers.map((user) => (
                  <div
                    key={user._id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold text-slate-800 truncate">{user.fullName}</h3>
                        <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
                          Pending
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 truncate">{user.email}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {user.role === 'Security' ? (
                          <>Role: <span className="font-semibold text-slate-600">Security Guard</span></>
                        ) : (
                          <>Flat: <span className="font-semibold text-slate-600">{user.flatNumber || 'N/A'}</span></>
                        )}
                        {' · '}Requested: <span className="text-slate-500">{new Date(user.createdAt).toLocaleDateString()}</span>
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleApproval(user._id, user.fullName, 'Approved')}
                        className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-200 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleApproval(user._id, user.fullName, 'Rejected')}
                        className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-rose-200 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
