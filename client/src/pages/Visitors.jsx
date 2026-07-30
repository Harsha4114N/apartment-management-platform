import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import API_BASE from '../config/api';
import ImageCapture from '../components/ImageCapture';

const API_URL = `${API_BASE}/api`;

// ── Helper: read user from localStorage ──
function useUser() {
  return useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user')); }
    catch { return null; }
  }, []);
}

const statusStyles = {
  'Expected': 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/50',
  'Checked-In': 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50',
  'Checked-Out': 'bg-slate-100 text-slate-500 ring-1 ring-slate-200/50',
  'Pending Approval': 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200/50',
  'Approved': 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50',
  'Rejected': 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/50',
};

const statusIcons = {
  'Expected': (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'Checked-In': (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'Checked-Out': (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  'Pending Approval': (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'Approved': (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'Rejected': (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

export default function Visitors() {
  const user = useUser();
  const isAdmin = user?.role === 'SuperAdmin' || user?.role === 'Admin';

  if (isAdmin) return <AdminView />;
  return <ResidentView />;
}

/* ═══════════════════════════════════════════════════════════════
   SHARED STYLES
   ═══════════════════════════════════════════════════════════════ */
const inputClass =
  'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all';
const selectClass =
  'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer appearance-none';
const labelClass = 'block text-sm font-semibold text-slate-700 mb-1.5';
const cardClass = 'bg-white rounded-2xl border border-slate-200 shadow-sm';
const sectionHeaderClass = 'text-lg font-bold text-slate-800';

/* ═══════════════════════════════════════════════════════════════
   ADMIN VIEW — Master Visitor Log with Search & Filters
   ═══════════════════════════════════════════════════════════════ */
function AdminView() {
  const [visitors, setVisitors] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchVisitors = async () => {
    try {
      const response = await axios.get(`${API_URL}/visitors`, {
        headers: getAuthHeaders(),
      });
      setVisitors(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching visitors:', error);
      toast.error('Failed to load visitors.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, []);

  const filteredVisitors = useMemo(() => {
    return visitors.filter((v) => {
      const matchesSearch =
        search === '' ||
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        (v.flat || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.host || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.purpose || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.phone || '').includes(search);
      const matchesStatus = statusFilter === 'All' || v.status === statusFilter;
      const matchesDate = dateFilter === '' || (v.expectedDate || '').startsWith(dateFilter);
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [visitors, search, statusFilter, dateFilter]);

  const stats = useMemo(() => ({
    expected: visitors.filter((v) => v.status === 'Expected').length,
    checkedIn: visitors.filter((v) => v.status === 'Checked-In').length,
    checkedOut: visitors.filter((v) => v.status === 'Checked-Out').length,
  }), [visitors]);

  return loading ? (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm font-medium">Loading visitor log...</p>
      </div>
    </div>
  ) : (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Visitor Log</h1>
        <p className="text-slate-500 text-sm mt-1">Master log of all expected and past visitors across the society</p>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <p className="text-2xl font-bold text-slate-800">{stats.expected}</p>
          </div>
          <p className="text-xs font-semibold text-slate-500">Expected</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <p className="text-2xl font-bold text-slate-800">{stats.checkedIn}</p>
          </div>
          <p className="text-xs font-semibold text-slate-500">Checked-In</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            <p className="text-2xl font-bold text-slate-800">{stats.checkedOut}</p>
          </div>
          <p className="text-xs font-semibold text-slate-500">Checked-Out</p>
        </div>
      </div>

      {/* ── Search & Filters ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by name, flat, host, purpose, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`${selectClass} sm:w-40`}
          >
            <option value="All">All Status</option>
            <option value="Expected">Expected</option>
            <option value="Checked-In">Checked-In</option>
            <option value="Checked-Out">Checked-Out</option>
          </select>

          {/* Date Filter */}
          <div className="relative sm:w-44">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className={inputClass}
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Master Data Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 pb-0">
          <h2 className={`${sectionHeaderClass} mb-1`}>All Visitors</h2>
          <p className="text-xs text-slate-400 mb-4">
            {filteredVisitors.length} of {visitors.length} visitors shown
          </p>
        </div>

        {filteredVisitors.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-slate-400 text-sm font-medium">No visitors match your filters.</p>
            <button
              onClick={() => { setSearch(''); setStatusFilter('All'); setDateFilter(''); }}
              className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-y border-slate-100">
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Visitor</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Contact</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Purpose</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Flat / Host</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Vehicle</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Date / Time</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVisitors.map((v) => (
                  <tr key={v._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                          {v.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-800">{v.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {v.phone === '—' || !v.phone ? (
                        <span className="text-slate-300 italic">N/A</span>
                      ) : (
                        <a href={`tel:${v.phone}`} className="hover:text-indigo-600 transition-colors no-underline">
                          {v.phone}
                        </a>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg uppercase">
                        {v.purpose}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-slate-800 font-medium">{v.flat || '—'}</div>
                      <div className="text-xs text-slate-400">{v.host || '—'}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-500 font-mono text-xs">
                      {!v.vehicle || v.vehicle === '—' ? (
                        <span className="text-slate-300 italic">—</span>
                      ) : (
                        v.vehicle
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-slate-700">{v.expectedDate ? new Date(v.expectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</div>
                      <div className="text-xs text-slate-400">{v.expectedTime || '—'}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded-lg uppercase ${statusStyles[v.status] || statusStyles['Expected']}`}>
                        {statusIcons[v.status] || statusIcons['Expected']}
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RESIDENT VIEW — Pre-Register + Check-in History
   ═══════════════════════════════════════════════════════════════ */
function ResidentView() {
  const [visitors, setVisitors] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [expectedTime, setExpectedTime] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [visitorPhoto, setVisitorPhoto] = useState(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchVisitors = async () => {
    try {
      const response = await axios.get(`${API_URL}/visitors`, {
        headers: getAuthHeaders(),
      });
      setVisitors(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching visitors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, []);

  // ── Real-time socket listener for walk-in visitor notifications ──
  useEffect(() => {
    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
    });

    const joinSociety = () => {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (storedUser.societyId) {
        socket.emit('join-society', storedUser.societyId);
        console.log('[Socket Visitors] join-society emitted:', storedUser.societyId);
      }
    };

    socket.on('connect', () => {
      console.log('[Socket Visitors] Connected:', socket.id);
      joinSociety();
    });

    socket.on('reconnect', () => {
      console.log('[Socket Visitors] Reconnected:', socket.id);
      joinSociety();
    });

    // New walk-in visitor pending approval → refresh the list
    socket.on('visitor:walkin', (visitor) => {
      console.log('[Socket Visitors] visitor:walkin received — refreshing:', visitor.name);
      fetchVisitors();
    });

    return () => {
      console.log('[Socket Visitors] Cleaning up listeners...');
      socket.off('connect');
      socket.off('reconnect');
      socket.off('visitor:walkin');
      socket.disconnect();
    };
  }, []);

  // ── Approve walk-in visitor ──
  const handleApprove = async (visitorId, visitorName) => {
    const toastId = toast.loading(`Approving entry for ${visitorName}...`);
    try {
      await axios.put(`${API_URL}/visitors/${visitorId}/approve`, {}, {
        headers: getAuthHeaders(),
      });
      toast.success(`✅ ${visitorName} approved — entry granted!`, { id: toastId });
      fetchVisitors();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to approve visitor.', { id: toastId });
    }
  };

  // ── Reject walk-in visitor ──
  const handleReject = async (visitorId, visitorName) => {
    const toastId = toast.loading(`Rejecting ${visitorName}...`);
    try {
      await axios.put(`${API_URL}/visitors/${visitorId}/reject`, {}, {
        headers: getAuthHeaders(),
      });
      toast.error(`❌ ${visitorName} rejected — entry denied.`, { id: toastId });
      fetchVisitors();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reject visitor.', { id: toastId });
    }
  };

  // ── Separate pending approvals from history ──
  const pendingApprovals = visitors.filter(v => v.status === 'Pending Approval');
  const historyVisitors = visitors.filter(v => v.status !== 'Pending Approval');

  const handlePreRegister = async (e) => {
    e.preventDefault();
    const toastId = toast.loading('Generating visitor pass...');

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('phone', phone || '');
      formData.append('purpose', purpose);
      formData.append('expectedDate', expectedDate);
      formData.append('expectedTime', expectedTime);
      if (vehicle) formData.append('vehicle', vehicle);
      if (visitorPhoto) formData.append('photo', visitorPhoto);

      await axios.post(`${API_URL}/visitors`, formData, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success(
        <div className="flex items-center gap-3">
          <span className="text-lg">✅</span>
          <div>
            <p className="font-semibold">Pass Generated for {name}</p>
            <p className="text-xs opacity-80">{expectedDate} at {expectedTime}</p>
          </div>
        </div>,
        { duration: 4000 }
      );

      setName('');
      setPhone('');
      setPurpose('');
      setExpectedDate('');
      setExpectedTime('');
      setVehicle('');
      setVisitorPhoto(null);
      setShowForm(false);
      fetchVisitors();
    } catch (error) {
      console.error('Error registering visitor:', error);
      const serverMsg = error.response?.data?.message || 'Failed to register visitor.';
      toast.error(serverMsg, { id: toastId });
    }
  };

  return loading ? (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm font-medium">Loading visitors...</p>
      </div>
    </div>
  ) : (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Visitors</h1>
          <p className="text-slate-500 text-sm mt-1">Pre-register visitors and track their entry</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-200 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showForm ? 'M6 18L18 6M6 6l12 12' : 'M12 4v16m8-8H4'} />
          </svg>
          {showForm ? 'Cancel' : 'Pre-register Visitor'}
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════
          SECTION A: Pre-Register Form
          ════════════════════════════════════════════════════════ */}
      {showForm && (
        <div className={cardClass + ' p-6 border-l-4 border-l-indigo-500'}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Pre-register a Visitor</h2>
              <p className="text-xs text-slate-400">Fill in the details to generate a digital visitor pass</p>
            </div>
          </div>

          <form onSubmit={handlePreRegister} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Visitor Name */}
              <div>
                <label className={labelClass}>
                  Visitor Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Suresh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              {/* Phone */}
              <div>
                <label className={labelClass}>Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g., 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                />
              </div>

              {/* Visit Purpose */}
              <div>
                <label className={labelClass}>
                  Purpose of Visit <span className="text-red-400">*</span>
                </label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className={selectClass}
                  required
                >
                  <option value="" disabled>Select purpose</option>
                  <option>Guest Visit</option>
                  <option>Family Visit</option>
                  <option>Plumbing Repair</option>
                  <option>Electrical Maintenance</option>
                  <option>Carpentry Work</option>
                  <option>Package Delivery</option>
                  <option>Food Delivery</option>
                  <option>Other</option>
                </select>
              </div>

              {/* Vehicle Number */}
              <div>
                <label className={labelClass}>Vehicle Number</label>
                <input
                  type="text"
                  placeholder="e.g., MH-12-AB-1234"
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  className={inputClass}
                />
              </div>

              {/* Expected Date */}
              <div>
                <label className={labelClass}>
                  Expected Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className={inputClass}
                  required
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Expected Time */}
              <div>
                <label className={labelClass}>
                  Expected Time <span className="text-red-400">*</span>
                </label>
                <input
                  type="time"
                  value={expectedTime}
                  onChange={(e) => setExpectedTime(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            </div>

            {/* ── Image Capture for Visitor ID / Photo ── */}
            <ImageCapture
              id="visitor-photo"
              label="Visitor Photo / ID (Optional)"
              onCapture={(file) => setVisitorPhoto(file)}
              currentImage={visitorPhoto ? URL.createObjectURL(visitorPhoto) : null}
            />

            {/* ── Generate Pass Button ── */}
            <div className="flex items-center gap-4 pt-2">
              <button
                type="submit"
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
                Generate Pass
              </button>
              <p className="text-xs text-slate-400">
                A digital pass will be created for gate verification
              </p>
            </div>
          </form>

          {/* ── Pass Preview (shown after generation) ── */}
          {!showForm && visitors.length > 0 && visitors[0].status === 'Expected' && (
            <div className="mt-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-indigo-800 text-sm">Digital Pass Active</p>
                  <p className="text-xs text-indigo-600">{visitors[0].name} · {visitors[0].expectedDate}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          SECTION B: Pending Approvals (walk-in visitors)
          ════════════════════════════════════════════════════════ */}
      {pendingApprovals.length > 0 && (
        <div className={`${cardClass} overflow-hidden border-l-4 border-l-yellow-400`}>
          <div className="p-6 pb-0">
            <div className="flex items-center justify-between mb-1">
              <h2 className={sectionHeaderClass}>⏳ Pending Approvals</h2>
              <span className="px-2.5 py-1 bg-yellow-50 text-yellow-600 text-[10px] font-bold rounded-lg">
                {pendingApprovals.length} pending
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Walk-in visitors waiting for your approval to enter the society
            </p>
          </div>
          <div className="overflow-x-auto pb-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-y border-slate-100">
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Visitor</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Purpose</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Vehicle</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Time</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingApprovals.map((v) => (
                  <tr key={v._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-yellow-50 flex items-center justify-center text-yellow-600 font-bold text-sm shrink-0">
                          {v.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800 block">{v.name}</span>
                          {v.phone && v.phone !== '—' && (
                            <span className="text-xs text-slate-400">{v.phone}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg uppercase">
                        {v.purpose}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 font-mono text-xs">
                      {!v.vehicle || v.vehicle === '—' ? (
                        <span className="text-slate-300 italic">—</span>
                      ) : (
                        v.vehicle
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm text-slate-700">
                        {v.expectedTime || '—'}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(v._id, v.name)}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(v._id, v.name)}
                          className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Deny
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          SECTION C: Check-in History Table
          ════════════════════════════════════════════════════════ */}
      <div className={cardClass + ' overflow-hidden'}>
        <div className="p-6 pb-0">
          <div className="flex items-center justify-between mb-1">
            <h2 className={sectionHeaderClass}>Check-in History</h2>
            {historyVisitors.length > 0 && (
              <span className="px-2.5 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg">
                {historyVisitors.length} entries
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-4">Recent visitors and their check-in status</p>
        </div>

        {historyVisitors.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-slate-400 text-sm font-medium">No visitors registered yet.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
            >
              Pre-register your first visitor
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-y border-slate-100">
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Visitor</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Purpose</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Vehicle</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Date / Time</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyVisitors.map((v) => (
                  <tr key={v._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                          {v.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800 block">{v.name}</span>
                          {v.phone && v.phone !== '—' && (
                            <span className="text-xs text-slate-400">{v.phone}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg uppercase">
                        {v.purpose}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 font-mono text-xs">
                      {!v.vehicle || v.vehicle === '—' ? (
                        <span className="text-slate-300 italic">—</span>
                      ) : (
                        v.vehicle
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-slate-700 text-sm">
                        {v.expectedDate ? new Date(v.expectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                      </div>
                      <div className="text-xs text-slate-400">{v.expectedTime || '—'}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded-lg uppercase ${statusStyles[v.status] || statusStyles['Expected']}`}>
                        {statusIcons[v.status] || statusIcons['Expected']}
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
