import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE from '../config/api';

const API_URL = `${API_BASE}/api`;

export default function AdminDashboard() {
  const navigate = useNavigate();

  // ── Section state ──
  const [activeSection, setActiveSection] = useState('overview');

  // ── Metrics state ──
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  // ── Pending users state ──
  const [pendingUsers, setPendingUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);

  // ── Tickets state ──
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [updatingTicketId, setUpdatingTicketId] = useState(null);

  // ── Bill form state ──
  const [flatNumber, setFlatNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');

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

  // ── Fetch all tickets (maintenance queue) ──
  const fetchTickets = async () => {
    try {
      setTicketsLoading(true);
      const headers = getAuthHeaders();
      const response = await axios.get(`${API_URL}/admin/tickets`, { headers });
      setTickets(response.data);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      const msg = error.response?.data?.message || error.message || 'Failed to load tickets.';
      toast.error(msg);
    } finally {
      setTicketsLoading(false);
    }
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
    fetchPendingUsers();
    fetchTickets();
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

  // ── Update ticket status ──
  const handleUpdateStatus = async (ticketId, newStatus) => {
    setUpdatingTicketId(ticketId);
    const toastId = toast.loading(`Updating status to "${newStatus}"...`);
    try {
      await axios.put(
        `${API_URL}/admin/tickets/${ticketId}/status`,
        { status: newStatus },
        { headers: getAuthHeaders() }
      );
      toast.success(`Status updated to "${newStatus}".`, { id: toastId });
      // Update the ticket in the local state
      setTickets((prev) =>
        prev.map((t) => (t._id === ticketId ? { ...t, status: newStatus } : t))
      );
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update status.', { id: toastId });
    } finally {
      setUpdatingTicketId(null);
    }
  };

  // ── Issue a bill ──
  const handleIssueBill = async (e) => {
    e.preventDefault();
    const toastId = toast.loading('Creating bill...');
    try {
      await axios.post(
        `${API_URL}/bills/create-bill`,
        {
          flatNumber,
          amount: parseFloat(amount),
          title,
          dueDate,
          receiptUrl: receiptUrl || undefined,
        },
        { headers: getAuthHeaders() }
      );
      toast.success('Bill issued successfully!', { id: toastId });
      setFlatNumber('');
      setAmount('');
      setTitle('');
      setDueDate('');
      setReceiptUrl('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to issue bill.', { id: toastId });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    toast.success('Logged out successfully');
    navigate('/');
  };

  const inputClass =
    'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm';

  // ── Status color helper ──
  const statusColors = {
    Open: 'bg-amber-100 text-amber-700',
    'In-Progress': 'bg-blue-100 text-blue-700',
    Resolved: 'bg-emerald-100 text-emerald-700',
  };

  // ── Priority color helper ──
  const priorityColors = {
    Low: 'bg-slate-100 text-slate-600',
    Medium: 'bg-amber-100 text-amber-700',
    High: 'bg-rose-100 text-rose-700',
    Emergency: 'bg-red-100 text-red-800',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 md:p-12 font-sans">
      {/* ── Header ── */}
      <div className="max-w-5xl mx-auto flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Admin Command Center</h1>
          <p className="text-slate-500 text-sm mt-1">Manage residents, billing, and maintenance for your society</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-slate-600 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-md text-sm"
          >
            Dashboard
          </button>
          <button
            onClick={handleLogout}
            className="bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-md shadow-rose-200 text-sm"
          >
            Logout
          </button>
        </div>
      </div>

      {/* ── Section Tabs ── */}
      <div className="max-w-5xl mx-auto mb-8">
        <div className="flex gap-2 bg-white rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-slate-100 p-2">
          <button
            onClick={() => setActiveSection('overview')}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 ${
              activeSection === 'overview'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            📊 Overview
          </button>
          <button
            onClick={() => setActiveSection('approvals')}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 ${
              activeSection === 'approvals'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            🏠 Resident Approvals
            {pendingUsers.length > 0 && (
              <span className="ml-2 bg-amber-400 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {pendingUsers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSection('tickets')}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 ${
              activeSection === 'tickets'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            🔧 Maintenance Queue
            {tickets.filter((t) => t.status !== 'Resolved').length > 0 && (
              <span className="ml-2 bg-amber-400 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {tickets.filter((t) => t.status !== 'Resolved').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSection('billing')}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 ${
              activeSection === 'billing'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            💳 Issue Bill
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-10">
        {/* ═══════════════════════════════════════════ */}
        {/* SECTION: Overview (KPI Metrics)            */}
        {/* ═══════════════════════════════════════════ */}
        {activeSection === 'overview' && (
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
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION: Resident Approvals                */}
        {/* ═══════════════════════════════════════════ */}
        {activeSection === 'approvals' && (
          <section className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Resident Approvals</h2>
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
                          Flat: <span className="font-semibold text-slate-600">{user.flatNumber || 'N/A'}</span>
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
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION: Maintenance Queue (Tickets)        */}
        {/* ═══════════════════════════════════════════ */}
        {activeSection === 'tickets' && (
          <section className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Maintenance Queue</h2>
                <p className="text-slate-500 text-xs mt-0.5">
                  {tickets.length} total ticket{tickets.length !== 1 ? 's' : ''}
                  {' · '}
                  <span className="text-amber-600 font-semibold">
                    {tickets.filter((t) => t.status !== 'Resolved').length} active
                  </span>
                </p>
              </div>
              <div className="flex gap-1.5">
                <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2.5 py-1 rounded-full">Open</span>
                <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2.5 py-1 rounded-full">In-Progress</span>
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full">Resolved</span>
              </div>
            </div>

            <div className="p-8">
              {ticketsLoading ? (
                <p className="text-slate-400 text-center py-8">Loading tickets...</p>
              ) : tickets.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🔧</div>
                  <p className="text-slate-500 font-medium">No maintenance tickets reported yet.</p>
                  <p className="text-slate-400 text-sm mt-1">Tickets submitted by residents will appear here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tickets.map((ticket) => (
                    <div
                      key={ticket._id}
                      className={`p-5 bg-slate-50 rounded-xl border transition-all ${
                        ticket.status === 'Resolved'
                          ? 'border-emerald-200 opacity-70'
                          : ticket.status === 'In-Progress'
                          ? 'border-blue-200'
                          : 'border-slate-200'
                      }`}
                    >
                      {/* ── Ticket Header ── */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-slate-800">{ticket.title}</h3>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${statusColors[ticket.status] || 'bg-slate-100 text-slate-600'}`}>
                            {ticket.status}
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${priorityColors[ticket.priority] || 'bg-slate-100 text-slate-600'}`}>
                            {ticket.priority}
                          </span>
                        </div>
                        <p className="text-base font-bold text-indigo-600 shrink-0">
                          {ticket.category}
                        </p>
                      </div>

                      {/* ── Ticket Details ── */}
                      <p className="text-sm text-slate-600 leading-relaxed mb-3">{ticket.description}</p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mb-4">
                        <span>
                          Resident: <span className="font-semibold text-slate-700">{ticket.resident?.fullName || 'Unknown'}</span>
                        </span>
                        <span>
                          Flat: <span className="font-semibold text-slate-700">{ticket.flatNumber}</span>
                        </span>
                        <span>
                          Submitted: <span className="text-slate-600">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                        </span>
                      </div>

                      {/* ── Ticket Image ── */}
                      {ticket.imageUrl && (
                        <div className="mb-4">
                          <img
                            src={ticket.imageUrl}
                            alt="Ticket issue"
                            className="max-w-full h-40 object-cover rounded-xl border border-slate-200 shadow-sm"
                          />
                        </div>
                      )}

                      {/* ── Status Change Buttons ── */}
                      {ticket.status !== 'Resolved' && (
                        <div className="flex gap-2 pt-2 border-t border-slate-200">
                          {ticket.status === 'Open' && (
                            <button
                              onClick={() => handleUpdateStatus(ticket._id, 'In-Progress')}
                              disabled={updatingTicketId === ticket._id}
                              className="px-4 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              {updatingTicketId === ticket._id ? '...' : '▶ Start Progress'}
                            </button>
                          )}
                          {ticket.status === 'In-Progress' && (
                            <button
                              onClick={() => handleUpdateStatus(ticket._id, 'Resolved')}
                              disabled={updatingTicketId === ticket._id}
                              className="px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              {updatingTicketId === ticket._id ? '...' : '✓ Mark Resolved'}
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdateStatus(ticket._id, 'Open')}
                            disabled={updatingTicketId === ticket._id}
                            className="px-4 py-2 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {updatingTicketId === ticket._id ? '...' : '↺ Reopen'}
                          </button>
                        </div>
                      )}

                      {/* ── Resolved Badge ── */}
                      {ticket.status === 'Resolved' && (
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-200 text-emerald-600 text-sm font-semibold">
                          <span>✅</span>
                          <span>Resolved</span>
                          <button
                            onClick={() => handleUpdateStatus(ticket._id, 'Open')}
                            disabled={updatingTicketId === ticket._id}
                            className="ml-4 px-3 py-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {updatingTicketId === ticket._id ? '...' : '↺ Reopen'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION: Issue Bill to Flat                */}
        {/* ═══════════════════════════════════════════ */}
        {activeSection === 'billing' && (
          <section className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Issue Bill to Flat</h2>
              <p className="text-slate-500 text-xs mt-0.5">Create a new maintenance or utility bill for a flat</p>
            </div>

            <div className="p-8">
              <form onSubmit={handleIssueBill} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Flat Number</label>
                    <input
                      type="text"
                      placeholder="e.g. A-101"
                      value={flatNumber}
                      onChange={(e) => setFlatNumber(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Amount (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 2500"
                      min="1"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Title / Reason</label>
                  <input
                    type="text"
                    placeholder="e.g. July Maintenance"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Receipt / Invoice URL <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={receiptUrl}
                    onChange={(e) => setReceiptUrl(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-blue-200 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                >
                  Issue Bill
                </button>
              </form>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
