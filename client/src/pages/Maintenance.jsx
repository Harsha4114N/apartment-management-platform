import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
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

const CATEGORIES = ['Plumbing', 'Electrical', 'Carpentry', 'Security', 'General'];

const statusStyles = {
  'Open': 'bg-amber-50 text-amber-700',
  'In-Progress': 'bg-blue-50 text-blue-700',
  'Resolved': 'bg-emerald-50 text-emerald-700',
};

export default function Maintenance() {
  const user = useUser();
  const isAdmin = user?.role === 'SuperAdmin' || user?.role === 'Admin';

  if (isAdmin) return <AdminView />;
  return <ResidentView />;
}

/* ═══════════════════════════════════════════════
   ADMIN VIEW — Maintenance Queue + Resolve/Delete
   ═══════════════════════════════════════════════ */
function AdminView() {
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchTickets = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/tickets`, {
        headers: getAuthHeaders(),
      });
      setTickets(response.data);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to load tickets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const filteredTickets = filter === 'All'
    ? tickets
    : tickets.filter((t) => t.status === filter);

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await axios.put(`${API_URL}/admin/tickets/${id}/status`,
        { status: newStatus },
        { headers: getAuthHeaders() }
      );
      toast.success(`Ticket marked as ${newStatus}.`);
      fetchTickets();
    } catch (error) {
      console.error('Error updating ticket status:', error);
      toast.error('Failed to update ticket status.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/tickets/${id}`, {
        headers: getAuthHeaders(),
      });
      toast.success('Ticket deleted.');
      fetchTickets();
    } catch (error) {
      console.error('Error deleting ticket:', error);
      toast.error('Failed to delete ticket.');
    }
  };

  return loading ? (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm font-medium">Loading tickets...</p>
      </div>
    </div>
  ) : (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Maintenance Queue</h1>
        <p className="text-slate-500 text-sm mt-1">Review, resolve, or delete society maintenance tickets</p>
      </div>

      {/* ── Status Filter ── */}
      <div className="flex gap-2 flex-wrap">
        {['All', 'Open', 'In-Progress', 'Resolved'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              filter === s
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {s}
            {s !== 'All' && (
              <span className="ml-1.5 text-xs opacity-70">
                ({tickets.filter((t) => t.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tickets List ── */}
      <div className="space-y-4">
        {filteredTickets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
            <p className="text-slate-400 text-sm">No tickets match this filter.</p>
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <div key={ticket._id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 group hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-slate-800">{ticket.title}</h3>
                    <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-lg uppercase ${statusStyles[ticket.status] || 'bg-slate-100 text-slate-500'}`}>
                      {ticket.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-semibold rounded">{ticket.category}</span>
                    <span>{ticket.flatNumber || ticket.flat}</span>
                    <span>·</span>
                    <span>{ticket.submittedBy || ticket.resident?.name || 'Unknown'}</span>
                    <span>·</span>
                    <span>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ticket.date}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(ticket._id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                  title="Delete ticket"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed mb-4">{ticket.description}</p>

              {/* ── Admin Actions ── */}
              {ticket.status !== 'Resolved' && (
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  {ticket.status === 'Open' && (
                    <button
                      onClick={() => handleUpdateStatus(ticket._id, 'In-Progress')}
                      className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      Mark In-Progress
                    </button>
                  )}
                  <button
                    onClick={() => handleUpdateStatus(ticket._id, 'Resolved')}
                    className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Mark Resolved
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   RESIDENT VIEW — Submit Ticket + Own Ticket List
   ═══════════════════════════════════════════════ */
function ResidentView() {
  const [tickets, setTickets] = useState([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Plumbing');
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [loading, setLoading] = useState(true);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchTickets = async () => {
    try {
      const response = await axios.get(`${API_URL}/tickets`, {
        headers: getAuthHeaders(),
      });
      setTickets(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    const toastId = toast.loading('Submitting ticket...');

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('category', category);
      formData.append('description', description);
      if (photoFile) {
        formData.append('image', photoFile);
      }

      await axios.post(`${API_URL}/tickets`, formData, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Ticket submitted successfully!', { id: toastId });
      setTitle('');
      setCategory('Plumbing');
      setDescription('');
      setPhotoFile(null);
      fetchTickets();
    } catch (error) {
      console.error('Error submitting ticket:', error);
      const serverMsg = error.response?.data?.message || 'Failed to submit ticket.';
      toast.error(serverMsg, { id: toastId });
    }
  };

  const inputClass = 'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all';

  const statusIndicator = (status) => {
    if (status === 'Resolved') return <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold"><span>✅</span> Resolved</span>;
    if (status === 'In-Progress') return <span className="flex items-center gap-1.5 text-blue-600 text-xs font-semibold"><span>🔧</span> In Progress</span>;
    return <span className="flex items-center gap-1.5 text-amber-600 text-xs font-semibold"><span>⏳</span> Open — Awaiting review</span>;
  };

  return loading ? (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm font-medium">Loading your tickets...</p>
      </div>
    </div>
  ) : (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Maintenance</h1>
        <p className="text-slate-500 text-sm mt-1">Submit and track your maintenance requests</p>
      </div>

      {/* ── Submit Ticket Form ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Submit a Ticket</h2>
        <form onSubmit={handleSubmitTicket} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Issue Title</label>
            <input
              type="text"
              placeholder="e.g., Leaking Faucet"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`${inputClass} cursor-pointer`}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
            <textarea
              rows="3"
              placeholder="Describe the issue in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} resize-y`}
              required
            />
          </div>

          {/* ── Image Capture — Replace old file upload ── */}
          <ImageCapture
            id="maintenance-photo"
            label="Attach a Photo (Optional)"
            onCapture={(file) => setPhotoFile(file)}
            currentImage={photoFile ? URL.createObjectURL(photoFile) : null}
          />

          <button
            type="submit"
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-200 transition-all hover:-translate-y-0.5 cursor-pointer"
          >
            Submit Ticket
          </button>
        </form>
      </div>

      {/* ── My Tickets ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">My Tickets</h2>
        {tickets.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm">You haven't submitted any tickets yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <div key={ticket._id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-slate-800">{ticket.title}</h3>
                      <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-lg uppercase ${statusStyles[ticket.status] || 'bg-slate-100 text-slate-500'}`}>
                        {ticket.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400">{ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ticket.date}</span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase">{ticket.category}</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{ticket.description}</p>
                <div className="mt-3 pt-3 border-t border-slate-100">
                  {statusIndicator(ticket.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
