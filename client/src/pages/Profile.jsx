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

export default function Profile() {
  const localUser = useUser();
  const [loading, setLoading] = useState(true);

  // ── Form state ──
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
  });

  const [saving, setSaving] = useState(false);

  // ── Family members state ──
  const [familyMembers, setFamilyMembers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', age: '', relation: '' });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  // ── Fetch profile from API ──
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/users/profile`, getAuthHeaders());
      const user = res.data.user;
      setForm({
        fullName: user.fullName || '',
        phone: user.phoneNumber || '',
        email: user.email || '',
      });
      setFamilyMembers(Array.isArray(user.familyMembers) ? user.familyMembers : []);
    } catch (err) {
      console.error('Error fetching profile:', err);
      const msg = err.response?.data?.message || 'Failed to load profile.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchProfile();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    // Simulate profile update (placeholder — backend route can be added later)
    setTimeout(() => {
      toast.success('Profile updated successfully!');
      setSaving(false);
    }, 500);
  };

  // ── Family member handlers ──
  const handleAddMember = async () => {
    if (!newMember.name.trim() || !newMember.age || !newMember.relation.trim()) {
      toast.error('Please fill in name, age, and relation.');
      return;
    }
    const age = parseInt(newMember.age, 10);
    if (isNaN(age) || age < 0) {
      toast.error('Please enter a valid age.');
      return;
    }

    const updatedMembers = [
      ...familyMembers,
      { name: newMember.name.trim(), age, relation: newMember.relation.trim() },
    ];

    const toastId = toast.loading('Adding family member...');
    try {
      await axios.put(`${API_URL}/users/profile/family`, { familyMembers: updatedMembers }, getAuthHeaders());
      setFamilyMembers(updatedMembers);
      setNewMember({ name: '', age: '', relation: '' });
      setShowAddForm(false);
      toast.success('Family member added!', { id: toastId });
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to add family member.';
      toast.error(msg, { id: toastId });
    }
  };

  const handleRemoveMember = async (index) => {
    const memberName = familyMembers[index].name;
    const confirmed = window.confirm(`Remove "${memberName}" from family members?`);
    if (!confirmed) return;

    const updatedMembers = familyMembers.filter((_, i) => i !== index);

    const toastId = toast.loading(`Removing ${memberName}...`);
    try {
      await axios.put(`${API_URL}/users/profile/family`, { familyMembers: updatedMembers }, getAuthHeaders());
      setFamilyMembers(updatedMembers);
      toast.success(`"${memberName}" removed.`, { id: toastId });
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to remove family member.';
      toast.error(msg, { id: toastId });
    }
  };

  const inputClass =
    'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm';

  const labelClass = 'block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5';

  // ── Guard: Resident only ──
  if (localUser?.role !== 'Resident') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white p-10 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Access Restricted</h2>
          <p className="text-slate-500 text-sm">
            Only Residents can access Profile settings.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      {/* ── Header ── */}
      <div className="max-w-6xl mx-auto mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">
          My Profile
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage your personal information and view family details
        </p>
      </div>

      {/* ── Two-Column Layout ── */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT COLUMN: Settings Form ── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 md:px-8 py-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Personal Information</h2>
              <p className="text-slate-400 text-xs mt-0.5">
                Update your contact details and preferences
              </p>
            </div>

            <form onSubmit={handleSave} className="px-6 md:px-8 py-6 space-y-5">
              {/* Full Name */}
              <div>
                <label className={labelClass}>Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Your full name"
                  required
                />
              </div>

              {/* Phone + Email row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="+91 98765 43210"
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="email@example.com"
                    required
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Family Members ── */}
        <div className="space-y-6">
          {/* ── Family Members Card ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Family Members</h3>
              <span className="text-xs text-slate-400 font-medium">
                {familyMembers.length} member{familyMembers.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="px-6 py-5 space-y-4">
              {familyMembers.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">
                  No family members added yet.
                </p>
              ) : (
                familyMembers.map((member, idx) => (
                  <div key={idx}>
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0 ${
                          [
                            'bg-rose-400',
                            'bg-sky-400',
                            'bg-violet-400',
                            'bg-emerald-400',
                            'bg-amber-400',
                            'bg-cyan-400',
                            'bg-pink-400',
                            'bg-teal-400',
                          ][idx % 8] || 'bg-slate-400'
                        }`}
                      >
                        {member.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {member.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {member.relation} · {member.age} yrs
                        </p>
                      </div>

                      {/* Remove button */}
                      <button
                        onClick={() => handleRemoveMember(idx)}
                        title={`Remove ${member.name}`}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all duration-200 cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    {idx < familyMembers.length - 1 && (
                      <div className="border-t border-slate-100 mt-4" />
                    )}
                  </div>
                ))
              )}

              {/* ── Divider before Add button ── */}
              <div className="border-t border-slate-100" />

              {/* ── Add Member Button / Form ── */}
              {!showAddForm ? (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Member
                </button>
              ) : (
                <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">New Member</p>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sneha Sharma"
                      value={newMember.name}
                      onChange={(e) => setNewMember((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Age</label>
                      <input
                        type="number"
                        placeholder="e.g. 30"
                        min="0"
                        value={newMember.age}
                        onChange={(e) => setNewMember((prev) => ({ ...prev, age: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Relation</label>
                      <select
                        value={newMember.relation}
                        onChange={(e) => setNewMember((prev) => ({ ...prev, relation: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                      >
                        <option value="">Select</option>
                        <option value="Spouse">Spouse</option>
                        <option value="Son">Son</option>
                        <option value="Daughter">Daughter</option>
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Brother">Brother</option>
                        <option value="Sister">Sister</option>
                        <option value="Parent">Parent</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleAddMember}
                      className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-all cursor-pointer"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setShowAddForm(false);
                        setNewMember({ name: '', age: '', relation: '' });
                      }}
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold rounded-lg transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
