import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import API_BASE from '../config/api';

const API_URL = `${API_BASE}/api`;

// ── Helper: read user from localStorage ──
function useUser() {
  return useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user')); }
    catch { return null; }
  }, []);
}

// ── Category Configuration ──
const CATEGORIES = {
  Emergency: {
    borderColor: 'border-l-red-500',
    bgColor: 'bg-red-50/60',
    badgeStyle: 'bg-red-50 text-red-700 ring-1 ring-red-200/50',
    iconBg: 'bg-red-100 text-red-600',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
    flashBadge: 'bg-red-500 text-white animate-pulse',
  },
  Notice: {
    borderColor: 'border-l-blue-500',
    bgColor: 'bg-blue-50/40',
    badgeStyle: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/50',
    iconBg: 'bg-blue-100 text-blue-600',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    flashBadge: null,
  },
  Maintenance: {
    borderColor: 'border-l-amber-500',
    bgColor: 'bg-amber-50/40',
    badgeStyle: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/50',
    iconBg: 'bg-amber-100 text-amber-600',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    flashBadge: null,
  },
  General: {
    borderColor: 'border-l-slate-400',
    bgColor: 'bg-slate-50/40',
    badgeStyle: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/50',
    iconBg: 'bg-slate-100 text-slate-500',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    ),
    flashBadge: null,
  },
};

// ── Shared styles ──
const inputClass =
  'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all';
const selectClass =
  'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer appearance-none';
const labelClass = 'block text-sm font-semibold text-slate-700 mb-1.5';
const cardClass = 'bg-white rounded-2xl border border-slate-200 shadow-sm';

// ── Time-ago helper ──
function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
}

// ── Author badge color ──
const authorStyles = {
  'RWA': 'bg-indigo-50 text-indigo-600',
  'Security': 'bg-amber-50 text-amber-600',
  'Admin': 'bg-slate-100 text-slate-600',
};

export default function Announcements() {
  const user = useUser();
  const isAdmin = user?.role === 'SuperAdmin' || user?.role === 'Admin';

  if (isAdmin) return <AdminView />;
  return <ResidentView />;
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN VIEW — Post + Management Table
   ═══════════════════════════════════════════════════════════════ */
function AdminView() {
  const [announcements, setAnnouncements] = useState([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('Notice');
  const [target, setTarget] = useState('All Residents');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchAnnouncements = async () => {
    try {
      const response = await axios.get(`${API_URL}/announcements`, {
        headers: getAuthHeaders(),
      });
      setAnnouncements(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
  };

  useEffect(() => {
    fetchAnnouncements();

    // ── Real-time socket listener (no race condition) ──
    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
    });

    const joinSociety = () => {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (storedUser.societyId) {
        socket.emit('join-society', storedUser.societyId);
        console.log('[Socket AdminView] join-society emitted:', storedUser.societyId);
      }
    };

    // Wait for confirmed connection before joining the room
    socket.on('connect', () => {
      console.log('[Socket AdminView] Connected:', socket.id);
      joinSociety();
    });

    // Re-join room if the server restarts / socket reconnects
    socket.on('reconnect', () => {
      console.log('[Socket AdminView] Reconnected:', socket.id);
      joinSociety();
    });

    socket.on('new_announcement', (data) => {
      console.log('[Socket AdminView] new_announcement received:', data?.title, data?._id);
      setAnnouncements((prev) => {
        // Guard against duplicates (fetch + socket arriving at the same time)
        if (prev.some((a) => a._id === data._id)) return prev;
        return [data, ...prev];
      });
    });

    return () => {
      console.log('[Socket AdminView] Cleaning up listeners...');
      socket.off('connect');
      socket.off('reconnect');
      socket.off('new_announcement');
      socket.disconnect();
    };
  }, []);

  const filtered = useMemo(() => {
    return announcements.filter((a) => {
      const matchesSearch =
        search === '' ||
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.message.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || a.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [announcements, search, categoryFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const toastId = toast.loading('Publishing announcement...');

    try {
      await axios.post(`${API_URL}/announcements`, {
        title,
        message,
        category,
        target,
      }, { headers: getAuthHeaders() });

      toast.success(
        <div className="flex items-center gap-2">
          <span className="text-lg">📢</span>
          <span className="font-semibold">Announcement published!</span>
        </div>,
        { duration: 3000 }
      );
      setTitle('');
      setMessage('');
      setCategory('Notice');
      setTarget('All Residents');
      fetchAnnouncements();
    } catch (error) {
      console.error('Error creating announcement:', error);
      const serverMsg = error.response?.data?.message || 'Failed to publish announcement.';
      toast.error(serverMsg, { id: toastId });
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/announcements/${id}`, {
        headers: getAuthHeaders(),
      });
      toast.success('Announcement deleted.');
      fetchAnnouncements();
    } catch (error) {
      console.error('Error deleting announcement:', error);
      toast.error('Failed to delete announcement.');
    }
  };

  // Stats
  const stats = useMemo(() => ({
    total: announcements.length,
    emergency: announcements.filter((a) => a.category === 'Emergency').length,
    notices: announcements.filter((a) => a.category === 'Notice').length,
    maintenance: announcements.filter((a) => a.category === 'Maintenance').length,
  }), [announcements]);

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Announcements</h1>
        <p className="text-slate-500 text-sm mt-1">Create and manage community announcements</p>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Total</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-2xl font-bold text-red-600">{stats.emergency}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Emergency</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-2xl font-bold text-blue-600">{stats.notices}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Notices</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-2xl font-bold text-amber-600">{stats.maintenance}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Maintenance</p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          TOP: Post New Announcement Form
          ═══════════════════════════════════════════════════════ */}
      <div className={cardClass + ' p-6 border-l-4 border-l-indigo-500'}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Post New Announcement</h2>
            <p className="text-xs text-slate-400">Reach all residents or target a specific block</p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Title */}
            <div className="sm:col-span-2">
              <label className={labelClass}>Title <span className="text-red-400">*</span></label>
              <input
                type="text"
                placeholder="e.g., Emergency Maintenance Notice, Event Reminder"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className={labelClass}>Category <span className="text-red-400">*</span></label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={selectClass}
                required
              >
                <option value="Emergency">🚨 Emergency</option>
                <option value="Notice">📋 Notice</option>
                <option value="Maintenance">🔧 Maintenance</option>
                <option value="General">📰 General</option>
              </select>
            </div>

            {/* Target Audience */}
            <div>
              <label className={labelClass}>Target Audience</label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className={selectClass}
              >
                <option>All Residents</option>
                <option>Block A</option>
                <option>Block B</option>
                <option>Block C</option>
              </select>
            </div>

            {/* Message */}
            <div className="sm:col-span-2">
              <label className={labelClass}>Message <span className="text-red-400">*</span></label>
              <textarea
                rows="4"
                placeholder="Type the announcement details here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className={`${inputClass} resize-y`}
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-200 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Publish Announcement
            </button>
            <p className="text-xs text-slate-400">
              {category === 'Emergency' && '🚨 Will be highlighted as urgent'}
              {category === 'Notice' && '📋 Standard community notice'}
              {category === 'Maintenance' && '🔧 Maintenance-related update'}
              {category === 'General' && '📰 General information'}
            </p>
          </div>
        </form>
      </div>

      {/* ═══════════════════════════════════════════════════════
          BOTTOM: Management Table
          ═══════════════════════════════════════════════════════ */}
      <div className={cardClass + ' overflow-hidden'}>
        <div className="p-6 pb-0">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Manage Announcements</h2>
          <p className="text-xs text-slate-400 mb-4">
            {filtered.length} of {announcements.length} announcements
          </p>

          {/* ── Search & Filters ── */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search announcements..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={`${selectClass} sm:w-44`}
            >
              <option value="All">All Categories</option>
              <option value="Emergency">🚨 Emergency</option>
              <option value="Notice">📋 Notice</option>
              <option value="Maintenance">🔧 Maintenance</option>
              <option value="General">📰 General</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <p className="text-slate-400 text-sm font-medium">No announcements match your filters.</p>
            <button
              onClick={() => { setSearch(''); setCategoryFilter('All'); }}
              className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-y border-slate-100">
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Title</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Category</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Audience</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Author</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Date</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((a) => (
                  <tr key={a._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-5 py-4 max-w-xs">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${CATEGORIES[a.category]?.iconBg || 'bg-slate-100 text-slate-500'}`}>
                          {CATEGORIES[a.category]?.icon || CATEGORIES.General.icon}
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-800 block truncate">{a.title}</span>
                          <span className="text-xs text-slate-400 block truncate">{a.message.substring(0, 50)}...</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase ${CATEGORIES[a.category]?.badgeStyle || 'bg-slate-100 text-slate-600'}`}>
                        {a.category}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-lg uppercase">
                        {a.target}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase ${authorStyles[a.author] || 'bg-slate-100 text-slate-600'}`}>
                        {a.author}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-slate-700">
                        {a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : new Date(a.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                      <div className="text-xs text-slate-400">{timeAgo(a.createdAt || a.date)}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleDelete(a._id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
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
   RESIDENT VIEW — Category-based Announcement Feed
   ═══════════════════════════════════════════════════════════════ */
function ResidentView() {
  const [announcements, setAnnouncements] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchAnnouncements = async () => {
    try {
      const response = await axios.get(`${API_URL}/announcements`, {
        headers: getAuthHeaders(),
      });
      setAnnouncements(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
  };

  useEffect(() => {
    fetchAnnouncements();

    // ── Real-time socket listener (no race condition) ──
    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
    });

    const joinSociety = () => {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (storedUser.societyId) {
        socket.emit('join-society', storedUser.societyId);
        console.log('[Socket ResidentView] join-society emitted:', storedUser.societyId);
      }
    };

    // Wait for confirmed connection before joining the room
    socket.on('connect', () => {
      console.log('[Socket ResidentView] Connected:', socket.id);
      joinSociety();
    });

    // Re-join room if the server restarts / socket reconnects
    socket.on('reconnect', () => {
      console.log('[Socket ResidentView] Reconnected:', socket.id);
      joinSociety();
    });

    socket.on('new_announcement', (data) => {
      console.log('[Socket ResidentView] new_announcement received:', data?.title, data?._id);
      setAnnouncements((prev) => {
        // Guard against duplicates (fetch + socket arriving at the same time)
        if (prev.some((a) => a._id === data._id)) return prev;
        return [data, ...prev];
      });
    });

    return () => {
      console.log('[Socket ResidentView] Cleaning up listeners...');
      socket.off('connect');
      socket.off('reconnect');
      socket.off('new_announcement');
      socket.disconnect();
    };
  }, []);

  // Sort by date descending, emergency first
  const sortedAnnouncements = useMemo(() => {
    return [...announcements].sort((a, b) => {
      // Emergency first
      if (a.category === 'Emergency' && b.category !== 'Emergency') return -1;
      if (b.category === 'Emergency' && a.category !== 'Emergency') return 1;
      // Then by date
      return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date);
    });
  }, [announcements]);

  // Separate emergencies for top banner
  const emergencies = sortedAnnouncements.filter((a) => a.category === 'Emergency');
  const others = sortedAnnouncements.filter((a) => a.category !== 'Emergency');

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Announcements</h1>
        <p className="text-slate-500 text-sm mt-1">Latest updates from your society management</p>
      </div>

      {/* ── Category Legend ── */}
      <div className="flex flex-wrap items-center gap-3">
        {Object.entries(CATEGORIES).map(([key, config]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className={`w-3 h-3 rounded-full ${config.borderColor.replace('border-l-', 'bg-')}`} />
            <span className="font-medium">{key}</span>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════
          EMERGENCY BANNER (if any)
          ═══════════════════════════════════════════════════════ */}
      {emergencies.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-sm font-bold text-red-700 uppercase tracking-wider">Emergency Alerts</h2>
          </div>

          {emergencies.map((a) => {
            const config = CATEGORIES[a.category];
            const isExpanded = expandedId === a._id;

            return (
              <div
                key={a._id}
                className={`bg-white rounded-2xl shadow-sm p-6 transition-all hover:shadow-md border border-red-100 border-l-4 ${config.borderColor}`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${config.iconBg}`}>
                    {config.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Title + Badge */}
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-slate-800 text-lg">{a.title}</h3>
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase ${config.flashBadge || config.badgeStyle}`}>
                        {config.flashBadge ? '🚨 URGENT' : a.category}
                      </span>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(a.createdAt || a.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-400">{timeAgo(a.createdAt || a.date)}</span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${authorStyles[a.author] || 'bg-slate-100 text-slate-600'}`}>
                        {a.author}
                      </span>
                      <span className={`px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded uppercase`}>
                        {a.target}
                      </span>
                    </div>

                    {/* Message */}
                    <p className={`text-sm text-slate-600 leading-relaxed ${!isExpanded ? 'line-clamp-2' : ''}`}>
                      {a.message}
                    </p>

                    {a.message.length > 120 && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : a._id)}
                        className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
                      >
                        {isExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          OTHER ANNOUNCEMENTS FEED
          ═══════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        {others.length > 0 && emergencies.length > 0 && (
          <div className="flex items-center gap-2 pt-2">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">All Announcements</h2>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
        )}

        {sortedAnnouncements.length === 0 ? (
          <div className={cardClass + ' p-12 text-center'}>
            <div className="text-4xl mb-3">📢</div>
            <p className="text-slate-400 font-medium text-sm">No announcements yet.</p>
            <p className="text-slate-300 text-xs mt-1">Check back later for updates!</p>
          </div>
        ) : (
          sortedAnnouncements.map((a) => {
            const config = CATEGORIES[a.category] || CATEGORIES.General;
            const isExpanded = expandedId === a._id;

            return (
              <div
                key={a._id}
                className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-6 transition-all hover:shadow-md border-l-4 ${config.borderColor} ${config.bgColor}`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${config.iconBg}`}>
                    {config.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Title + Category Badge */}
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-slate-800 text-lg">{a.title}</h3>
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase ${config.badgeStyle}`}>
                        {a.category}
                      </span>
                    </div>

                    {/* Meta Row */}
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(a.createdAt || a.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-400">{timeAgo(a.createdAt || a.date)}</span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${authorStyles[a.author] || 'bg-slate-100 text-slate-600'}`}>
                        {a.author}
                      </span>
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded uppercase">
                        {a.target}
                      </span>
                    </div>

                    {/* Message */}
                    <p className={`text-sm text-slate-600 leading-relaxed ${!isExpanded ? 'line-clamp-2' : ''}`}>
                      {a.message}
                    </p>

                    {a.message.length > 120 && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : a._id)}
                        className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
                      >
                        {isExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
