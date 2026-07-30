import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import API_BASE from '../config/api';

const API_URL = `${API_BASE}/api`;

export default function Dashboard() {

  // ── Events, Announcements & Visitors state ──
  const [events, setEvents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [visitors, setVisitors] = useState([]);

  // ── Loading state ──
  const [loading, setLoading] = useState(true);

  // ── Auth headers helper ──
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  // ══════════════════════════════════════════════════
  //  DATA FETCHING
  // ══════════════════════════════════════════════════

  const fetchEvents = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEvents(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const response = await axios.get(`${API_URL}/announcements`, getAuthHeaders());
      setAnnouncements(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
  };

  const fetchVisitors = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/visitors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setVisitors(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching visitors:', error);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const loadAll = async () => {
      await Promise.allSettled([
        fetchEvents(),
        fetchAnnouncements(),
        fetchVisitors(),
      ]);
      setLoading(false);
    };
    loadAll();

    // ── Real-time socket listener for new announcements (no race condition) ──
    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
    });

    const joinSociety = () => {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (storedUser.societyId) {
        socket.emit('join-society', storedUser.societyId);
        console.log('[Socket Dashboard] join-society emitted:', storedUser.societyId);
      }
    };

    // Wait for confirmed connection before joining the room
    socket.on('connect', () => {
      console.log('[Socket Dashboard] Connected:', socket.id);
      joinSociety();
    });

    // Re-join room if the server restarts / socket reconnects
    socket.on('reconnect', () => {
      console.log('[Socket Dashboard] Reconnected:', socket.id);
      joinSociety();
    });

    socket.on('new_announcement', (data) => {
      console.log('[Socket Dashboard] new_announcement received:', data?.title, data?._id);
      setAnnouncements((prev) => {
        // Guard against duplicates (fetch + socket arriving at the same time)
        if (prev.some((a) => a._id === data._id)) return prev;
        return [data, ...prev];
      });
    });

    return () => {
      console.log('[Socket Dashboard] Cleaning up listeners...');
      socket.off('connect');
      socket.off('reconnect');
      socket.off('new_announcement');
      socket.disconnect();
    };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ══════════════════════════════════════════════════
  //  COMPUTED METRICS
  // ══════════════════════════════════════════════════

  const metrics = useMemo(() => ({
    visitorsToday: visitors.filter((v) => {
      const today = new Date();
      const vDate = new Date(v.createdAt || v.expectedDate);
      return vDate.toDateString() === today.toDateString();
    }).length,
    upcomingEvents: events.filter((e) => new Date(e.date) >= new Date()).length,
  }), [visitors, events]);

  // ══════════════════════════════════════════════════
  //  CATEGORY STYLES FOR ANNOUNCEMENTS
  // ══════════════════════════════════════════════════

  const announcementStyles = {
    Emergency: 'bg-rose-100 text-rose-700 border-l-4 border-l-rose-500',
    Notice: 'bg-blue-100 text-blue-700 border-l-4 border-l-blue-500',
    Maintenance: 'bg-amber-100 text-amber-700 border-l-4 border-l-amber-500',
    General: 'bg-slate-100 text-slate-600 border-l-4 border-l-slate-400',
  };

  // ══════════════════════════════════════════════════
  //  SHARED STYLES
  // ══════════════════════════════════════════════════

  const handleLogout = () => {
    localStorage.removeItem('token');
    toast.success('Logged out successfully');
    window.location.href = '/login';
  };

  // ══════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">

      {/* ── Header ── */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Resident Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Welcome back! Here's what's happening in your society.</p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-rose-500 hover:bg-rose-600 text-white px-5 py-2 rounded-xl font-medium transition-colors shadow-md shadow-rose-200 text-sm"
        >
          Logout
        </button>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/*  METRIC CARDS GRID                             */}
      {/* ═══════════════════════════════════════════════ */}
      {loading ? (
        <div className="max-w-6xl mx-auto mb-8 flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 text-sm font-medium">Loading your dashboard...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {/* ── Metric: Visitors Today ── */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-6">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl shrink-0">
                🚶
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">Visitors Today</p>
                <p className="text-2xl font-extrabold text-slate-800 mt-0.5">{metrics.visitorsToday}</p>
              </div>
            </div>

            {/* ── Metric: Upcoming Events ── */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-6">
              <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-2xl shrink-0">
                🎉
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">Upcoming Events</p>
                <p className="text-2xl font-extrabold text-slate-800 mt-0.5">{metrics.upcomingEvents}</p>
              </div>
            </div>

            {/* ── Metric: Announcements ── */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-6">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-2xl shrink-0">
                📢
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">Announcements</p>
                <p className="text-2xl font-extrabold text-slate-800 mt-0.5">{announcements.length}</p>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════ */}
          {/*  SPLIT LAYOUT: EVENTS + ANNOUNCEMENTS           */}
          {/* ═══════════════════════════════════════════════ */}
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

            {/* ── LEFT: Upcoming Events Feed ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800">📅 Upcoming Events</h2>
                <span className="text-xs text-slate-400">{events.length} upcoming</span>
              </div>
              <div className="px-6 py-4 space-y-4">
                {events.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-6">No upcoming events.</p>
                ) : (
                  events.map((evt) => (
                    <div
                      key={evt._id}
                      className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all"
                    >
                      {/* Date Badge */}
                      <div className="shrink-0 w-14 h-14 rounded-xl bg-indigo-100 flex flex-col items-center justify-center text-center shadow-sm">
                        <span className="text-xs font-bold text-indigo-600 uppercase leading-tight">
                          {new Date(evt.date).toLocaleDateString('en-IN', { month: 'short' })}
                        </span>
                        <span className="text-lg font-extrabold text-indigo-800 leading-tight">
                          {new Date(evt.date).getDate()}
                        </span>
                      </div>

                      {/* Event Info */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 truncate">{evt.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {evt.time} · {evt.location}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                evt.rsvpCount / evt.maxCapacity >= 0.9
                                  ? 'bg-rose-500'
                                  : evt.rsvpCount / evt.maxCapacity >= 0.7
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${(evt.rsvpCount / evt.maxCapacity) * 100}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                            {evt.rsvpCount}/{evt.maxCapacity}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ── RIGHT: Recent Announcements Feed ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800">📢 Recent Announcements</h2>
                <span className="text-xs text-slate-400">{announcements.length} updates</span>
              </div>
              <div className="px-6 py-4 space-y-3">
                {announcements.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-6">No announcements yet.</p>
                ) : (
                  announcements.map((ann) => (
                    <div
                      key={ann._id}
                      className={`p-4 rounded-xl bg-slate-50 border border-slate-100 transition-all ${
                        announcementStyles[ann.category] || 'border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-white bg-opacity-70 shadow-sm">
                          {ann.category}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(ann.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-800 mb-0.5">{ann.title}</p>
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{ann.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
