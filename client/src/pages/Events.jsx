import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE from '../config/api';

const API_URL = `${API_BASE}/api`;

function useUser() {
  return useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user')); }
    catch { return null; }
  }, []);
}

const categoryStyles = {
  'Meeting': 'bg-indigo-50 text-indigo-700',
  'Festival': 'bg-amber-50 text-amber-700',
  'Workshop': 'bg-purple-50 text-purple-700',
  'Wellness': 'bg-emerald-50 text-emerald-700',
  'Sports': 'bg-blue-50 text-blue-700',
  'Social': 'bg-rose-50 text-rose-700',
};

const categoryIcons = {
  'Meeting': '📋',
  'Festival': '🎉',
  'Workshop': '🎨',
  'Wellness': '🧘',
  'Sports': '🏏',
  'Social': '🎬',
};

// ── Shared styles ──
const inputClass =
  'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all';
const selectClass =
  'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer appearance-none';
const labelClass = 'block text-sm font-semibold text-slate-700 mb-1.5';
const cardClass = 'bg-white rounded-2xl border border-slate-200 shadow-sm';

export default function Events() {
  const user = useUser();
  const isAdmin = user?.role === 'SuperAdmin' || user?.role === 'Admin';

  if (isAdmin) return <AdminView />;
  return <ResidentView />;
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN VIEW — Create + Manage Events (Split View)
   ═══════════════════════════════════════════════════════════════ */
function AdminView() {
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('Meeting');
  const [description, setDescription] = useState('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API_URL}/events`, {
        headers: getAuthHeaders(),
      });
      setEvents(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const resetForm = () => {
    setTitle(''); setDate(''); setTime(''); setLocation('');
    setCategory('Meeting'); setDescription('');
    setEditingId(null);
    setShowForm(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const toastId = toast.loading(editingId ? 'Updating event...' : 'Creating event...');

    try {
      if (editingId) {
        await axios.put(`${API_URL}/events/${editingId}`, {
          title, date, time, location, category, description,
        }, { headers: getAuthHeaders() });
        toast.success('Event updated successfully!', { id: toastId });
      } else {
        await axios.post(`${API_URL}/events`, {
          title, date, time, location, category, description,
        }, { headers: getAuthHeaders() });
        toast.success('Event created successfully!', { id: toastId });
      }
      resetForm();
      fetchEvents();
    } catch (error) {
      console.error('Error saving event:', error);
      const serverMsg = error.response?.data?.message || 'Failed to save event.';
      toast.error(serverMsg, { id: toastId });
    }
  };

  const handleEdit = (evt) => {
    setTitle(evt.title);
    setDate(evt.date ? evt.date.split('T')[0] : evt.date);
    setTime(evt.time);
    setLocation(evt.location);
    setCategory(evt.category);
    setDescription(evt.description);
    setEditingId(evt._id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/events/${id}`, {
        headers: getAuthHeaders(),
      });
      toast.success('Event cancelled and removed.');
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event.');
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Events</h1>
          <p className="text-slate-500 text-sm mt-1">Create and manage community events</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-200 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Event
          </button>
        )}
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: events.length, color: 'text-slate-800' },
          { label: 'Total RSVPs', value: events.reduce((s, e) => s + (e.rsvpCount || 0), 0), color: 'text-emerald-600' },
          { label: 'Categories', value: new Set(events.map((e) => e.category)).size, color: 'text-purple-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════
          TOP: Create / Edit Event Form
          ═══════════════════════════════════════════════════════ */}
      {showForm && (
        <div className={cardClass + ' p-6 border-l-4 border-l-indigo-500'}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {editingId ? 'Edit Event' : 'Create New Event'}
                </h2>
                <p className="text-xs text-slate-400">
                  {editingId ? 'Update the event details below' : 'Fill in the details to create a new community event'}
                </p>
              </div>
            </div>
            <button
              onClick={resetForm}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleCreate} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Title */}
              <div className="sm:col-span-2">
                <label className={labelClass}>Event Title <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  placeholder="e.g., Community Picnic, Yoga Session"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              {/* Date */}
              <div>
                <label className={labelClass}>Date <span className="text-red-400">*</span></label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required />
              </div>

              {/* Time */}
              <div>
                <label className={labelClass}>Time <span className="text-red-400">*</span></label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} required />
              </div>

              {/* Location */}
              <div>
                <label className={labelClass}>Location <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  placeholder="e.g., Community Hall, Garden"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className={labelClass}>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={selectClass}
                >
                  {Object.keys(categoryStyles).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label className={labelClass}>Description <span className="text-red-400">*</span></label>
                <textarea
                  rows="3"
                  placeholder="Describe the event details, instructions, or any other information..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={`${inputClass} resize-y`}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-200 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                {editingId ? 'Update Event' : 'Create Event'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          BOTTOM: Active Events List / Table
          ═══════════════════════════════════════════════════════ */}
      <div className={cardClass + ' overflow-hidden'}>
        <div className="p-6 pb-0">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Active Events</h2>
          <p className="text-xs text-slate-400 mb-4">Manage all upcoming and scheduled events</p>
        </div>

        {events.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-slate-400 font-medium text-sm">No events created yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-y border-slate-100">
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Event</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Date & Time</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Location</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Category</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">RSVPs</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((evt) => (
                  <tr key={evt._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex flex-col items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-indigo-400 uppercase leading-none">
                            {new Date(evt.date).toLocaleDateString('en-US', { month: 'short' })}
                          </span>
                          <span className="text-sm font-bold text-indigo-700 leading-none">
                            {new Date(evt.date).getDate()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-800 block truncate">{evt.title}</span>
                          <span className="text-xs text-slate-400 truncate block">{evt.description.substring(0, 60)}...</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-slate-700">
                        {new Date(evt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="text-xs text-slate-400">{evt.time}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{evt.location}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase ${categoryStyles[evt.category] || 'bg-slate-50 text-slate-600'}`}>
                        {categoryIcons[evt.category] || ''} {evt.category}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{evt.rsvpCount || 0}</span>
                        <span className="text-xs text-slate-400">/ {evt.maxCapacity || 0}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 max-w-[80px]">
                        <div
                          className="bg-indigo-500 rounded-full h-1.5 transition-all"
                          style={{ width: `${Math.min(((evt.rsvpCount || 0) / (evt.maxCapacity || 1)) * 100, 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(evt)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                          title="Edit event"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(evt._id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                          title="Cancel event"
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
   RESIDENT VIEW — Upcoming Events Card Grid
   ═══════════════════════════════════════════════════════════════ */
function ResidentView() {
  const [events, setEvents] = useState([]);
  const [rsvpd, setRsvpd] = useState({});
  const [loading, setLoading] = useState(true);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API_URL}/events`, {
        headers: getAuthHeaders(),
      });
      const data = Array.isArray(response.data) ? response.data : [];
      setEvents(data);
      // Build RSVP state from server data
      const rsvpMap = {};
      data.forEach((evt) => {
        if (evt.isUserAttending) {
          rsvpMap[evt._id] = true;
        }
      });
      setRsvpd(rsvpMap);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleRsvp = async (id, title) => {
    try {
      await axios.post(`${API_URL}/events/${id}/rsvp`, {}, {
        headers: getAuthHeaders(),
      });
      setRsvpd({ ...rsvpd, [id]: true });
      toast.success(
        <div className="flex items-center gap-2">
          <span className="text-lg">🎉</span>
          <span className="font-semibold">RSVP confirmed for "{title}"!</span>
        </div>,
        { duration: 3000 }
      );
      fetchEvents();
    } catch (error) {
      console.error('Error RSVPing for event:', error);
      toast.error('Failed to RSVP. Please try again.');
    }
  };

  const handleCancelRsvp = async (id, title) => {
    try {
      await axios.delete(`${API_URL}/events/${id}/rsvp`, {
        headers: getAuthHeaders(),
      });
      setRsvpd({ ...rsvpd, [id]: false });
      toast(`RSVP cancelled for "${title}"`, { icon: '👋' });
      fetchEvents();
    } catch (error) {
      console.error('Error cancelling RSVP:', error);
      toast.error('Failed to cancel RSVP. Please try again.');
    }
  };

  // Sort events by date
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [events]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Upcoming Events</h1>
        <p className="text-slate-500 text-sm mt-1">Stay updated on community happenings</p>
      </div>

      {/* ── Quick Stats ── */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <div className="w-2 h-2 rounded-full bg-indigo-500" />
          <span className="font-semibold">{events.length}</span> Upcoming
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="font-semibold">{Object.values(rsvpd).filter(Boolean).length}</span> RSVP'd
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          EVENT CARDS GRID
          ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {sortedEvents.map((evt) => {
          const isRsvpd = rsvpd[evt._id];
          const spotsLeft = (evt.maxCapacity || 0) - (evt.rsvpCount || 0);
          const fillPercent = Math.min(((evt.rsvpCount || 0) / (evt.maxCapacity || 1)) * 100, 100);
          const isAlmostFull = spotsLeft <= 5 && spotsLeft > 0;

          return (
            <div
              key={evt._id}
              className={`bg-white rounded-2xl border shadow-sm p-6 transition-all hover:shadow-md hover:-translate-y-0.5 flex flex-col ${
                isRsvpd ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-200'
              }`}
            >
              {/* ── Top: Category + Date Badge ── */}
              <div className="flex items-center justify-between mb-4">
                <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase ${categoryStyles[evt.category] || 'bg-slate-50 text-slate-600'}`}>
                  {categoryIcons[evt.category] || '📌'} {evt.category}
                </span>
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-indigo-400 uppercase leading-none">
                    {new Date(evt.date).toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                  <span className="text-lg font-bold text-indigo-700 leading-none">
                    {new Date(evt.date).getDate()}
                  </span>
                </div>
              </div>

              {/* ── Title ── */}
              <h3 className="font-bold text-slate-800 text-lg leading-tight mb-2">{evt.title}</h3>

              {/* ── Meta: Time + Location ── */}
              <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {evt.time}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {evt.location}
                </span>
              </div>

              {/* ── Description ── */}
              <p className="text-sm text-slate-600 leading-relaxed mb-4 flex-1">{evt.description}</p>

              {/* ── Capacity Bar ── */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-400">
                    <span className="font-semibold text-slate-600">{evt.rsvpCount || 0}</span> attending
                  </span>
                  <span className={`text-xs font-semibold ${isAlmostFull ? 'text-amber-600' : 'text-slate-400'}`}>
                    {isAlmostFull ? `Only ${spotsLeft} spots left!` : `${spotsLeft} spots left`}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className={`rounded-full h-2 transition-all duration-500 ${
                      fillPercent >= 90 ? 'bg-amber-500' : fillPercent >= 70 ? 'bg-indigo-400' : 'bg-indigo-500'
                    }`}
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
              </div>

              {/* ── RSVP Button ── */}
              {isRsvpd ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-xl border border-emerald-100">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    You're Attending
                  </div>
                  <button
                    onClick={() => handleCancelRsvp(evt._id, evt.title)}
                    className="px-3 py-2.5 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 text-sm font-semibold rounded-xl transition-all cursor-pointer"
                    title="Cancel RSVP"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleRsvp(evt._id, evt.title)}
                  className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md shadow-indigo-200 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  RSVP / Register
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Empty State ── */}
      {events.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-slate-400 font-medium text-sm">No upcoming events at the moment.</p>
          <p className="text-slate-300 text-xs mt-1">Check back later for community events!</p>
        </div>
      )}
    </div>
  );
}
