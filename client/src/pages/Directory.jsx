import { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE from '../config/api';

const API_URL = `${API_BASE}/api`;

// ── Helper: extract user from localStorage ──
function useUser() {
  return useMemo(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);
}

// ── Status Badge Colors ──
const statusStyles = {
  Owner: 'bg-emerald-100 text-emerald-700',
  Tenant: 'bg-blue-100 text-blue-700',
  Security: 'bg-sky-100 text-sky-700',
};

// ── Avatar color palette ──
const avatarColors = [
  'bg-indigo-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-cyan-500',
  'bg-violet-500',
  'bg-pink-500',
  'bg-teal-500',
];

export default function Directory() {
  const user = useUser();
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Auth headers helper ──
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      headers: { Authorization: `Bearer ${token}` },
    };
  };

  // ── Remove a user from the society ──
  const handleRemoveUser = async (userId, userName) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently remove "${userName}" from the society? This action cannot be undone.`
    );
    if (!confirmed) return;

    const toastId = toast.loading(`Removing ${userName}...`);
    try {
      await axios.delete(`${API_URL}/admin/users/${userId}`, getAuthHeaders());
      toast.success(`"${userName}" has been removed from the society.`, { id: toastId });
      // Remove from local state
      setResidents((prev) => prev.filter((r) => r.id !== userId));
      // Deselect if the removed user was selected
      setSelectedId((prev) => (prev === userId ? null : prev));
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Failed to remove user.';
      toast.error(msg, { id: toastId });
    }
  };

  // ── Fetch residents from API ──
  const fetchResidents = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await axios.get(`${API_URL}/directory`, getAuthHeaders());
      setResidents(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching directory:', error);
      setResidents([]);
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchResidents();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Filtered residents ──
  const filteredResidents = useMemo(() => {
    return residents.filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.unit.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.tower.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.phone.includes(searchQuery);
      const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter, residents]);

  const selectedResident = useMemo(
    () => filteredResidents.find((r) => r.id === selectedId) || null,
    [selectedId, filteredResidents]
  );

  // ── Get consistent avatar color per resident (works with any string id) ──
  const getAvatarColor = (id) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % avatarColors.length;
    return avatarColors[idx];
  };

  // ── Guard: Admin/SuperAdmin only ──
  if (user?.role !== 'SuperAdmin' && user?.role !== 'Admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white p-10 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Access Restricted</h2>
          <p className="text-slate-500 text-sm">
            Only Administrators can access the Resident Directory.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      {/* ── Header ── */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">
          Resident Directory
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Browse all registered residents in your society
        </p>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by name, unit, tower, or phone..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedId(null);
              }}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-sm text-sm"
            />
          </div>
          <div className="flex gap-2">
            {['All', 'Owner', 'Tenant', 'Security'].map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  setStatusFilter(opt);
                  setSelectedId(null);
                }}
                className={`px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  statusFilter === opt
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm'
                }`}
              >
                {opt === 'All' ? 'All' : opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Split Pane ── */}
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6">
        {/* ── Left Pane: Resident Table ── */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="ml-3 text-slate-500 text-sm">Loading directory...</span>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Resident
                      </th>
                      <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Unit
                      </th>
                      <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                        Tower
                      </th>
                      <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                        Contact
                      </th>
                      <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-center px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredResidents.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-5 py-12 text-center text-slate-400"
                        >
                          No residents match your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredResidents.map((r) => (
                        <tr
                          key={r.id}
                          onClick={() => setSelectedId(r.id)}
                          className={`cursor-pointer transition-all duration-150 ${
                            selectedId === r.id
                              ? 'bg-indigo-50 border-l-4 border-l-indigo-500'
                              : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                          }`}
                        >
                          {/* Name + Avatar */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-full ${getAvatarColor(
                                  r.id
                                )} flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0`}
                              >
                                {r.avatar}
                              </div>
                              <span
                                className={`text-sm font-semibold ${
                                  selectedId === r.id
                                    ? 'text-indigo-700'
                                    : 'text-slate-800'
                                }`}
                              >
                                {r.name}
                              </span>
                            </div>
                          </td>

                          {/* Unit */}
                          <td className="px-5 py-4 text-sm text-slate-600 font-medium">
                            {r.unit}
                          </td>

                          {/* Tower */}
                          <td className="px-5 py-4 text-sm text-slate-500 hidden md:table-cell">
                            {r.tower}
                          </td>

                          {/* Contact */}
                          <td className="px-5 py-4 hidden sm:table-cell">
                            <a
                              href={`tel:${r.phone.replace(/\s/g, '')}`}
                              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {r.phone}
                            </a>
                          </td>

                          {/* Status Badge — explicit role-based check */}
                          <td className="px-5 py-4">
                            <span
                              className={`inline-block px-2.5 py-1 text-[11px] font-bold rounded-md uppercase tracking-wider ${
                                r.role === 'Security'
                                  ? 'bg-sky-100 text-sky-700'
                                  : statusStyles[r.status] || 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {r.role === 'Security' ? 'SECURITY' : r.status}
                            </span>
                          </td>

                          {/* Remove Button */}
                          <td className="px-5 py-4 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveUser(r.id, r.name);
                              }}
                              title="Remove user from society"
                              className="p-2 rounded-lg text-rose-400 hover:text-white hover:bg-rose-500 transition-all duration-200 cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Table Footer ── */}
            {!loading && (
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
                <span>
                  {filteredResidents.length} of {residents.length} residents
                  {statusFilter !== 'All' && ` (${statusFilter})`}
                </span>
                <span className="text-rose-400 text-[10px]">
                  🗑 Click trash icon to remove a user
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Pane: Detail Card ── */}
        <div className="w-full lg:w-80 xl:w-96 shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-6">
            {selectedResident ? (
              <>
                {/* ── Card Header ── */}
                <div className="p-6 text-center border-b border-slate-100">
                  <div
                    className={`w-16 h-16 rounded-full ${getAvatarColor(
                      selectedResident.id
                    )} flex items-center justify-center text-white text-xl font-bold shadow-md mx-auto mb-3`}
                  >
                    {selectedResident.avatar}
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {selectedResident.name}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {selectedResident.unit} · {selectedResident.tower}
                  </p>
                  <span
                    className={`inline-block mt-2 px-3 py-1 text-[11px] font-bold rounded-md uppercase tracking-wider ${
                      selectedResident.role === 'Security'
                        ? 'bg-sky-100 text-sky-700'
                        : statusStyles[selectedResident.status] || 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {selectedResident.role === 'Security' ? 'SECURITY' : selectedResident.status}
                  </span>
                </div>

                {/* ── Card Details ── */}
                <div className="p-6 space-y-4">
                  {/* Phone */}
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Phone
                    </p>
                    <a
                      href={`tel:${selectedResident.phone.replace(/\s/g, '')}`}
                      className="text-sm font-semibold text-slate-800 hover:text-indigo-600 transition-colors"
                    >
                      {selectedResident.phone}
                    </a>
                  </div>

                  {/* Email */}
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Email
                    </p>
                    <p className="text-sm text-slate-700">
                      {selectedResident.email}
                    </p>
                  </div>

                  {/* Move-in Date */}
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Move-in Date
                    </p>
                    <p className="text-sm text-slate-700">
                      {new Date(selectedResident.moveInDate).toLocaleDateString(
                        'en-IN',
                        {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        }
                      )}
                    </p>
                  </div>

                  {/* Vehicle */}
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Vehicle Registered
                    </p>
                    <p className="text-sm text-slate-700">
                      {selectedResident.vehicle}
                    </p>
                  </div>
                </div>

                {/* ── Action Buttons ── */}
                <div className="p-6 pt-0 flex gap-3">
                  <a
                    href={`tel:${selectedResident.phone.replace(/\s/g, '')}`}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-md shadow-emerald-200 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Call
                  </a>
                  <a
                    href={`sms:${selectedResident.phone.replace(/\s/g, '')}`}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-md shadow-indigo-200 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    Message
                  </a>
                </div>
              </>
            ) : (
              /* ── Empty State ── */
              <div className="p-10 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-slate-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <p className="text-slate-500 font-medium mb-1">
                  Select a Resident
                </p>
                <p className="text-slate-400 text-xs">
                  Click on a row in the table to view full details here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
