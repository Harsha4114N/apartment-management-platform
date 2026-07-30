import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE from '../config/api';

export default function JoinSociety() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [uniqueJoinCode, setUniqueJoinCode] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [role, setRole] = useState('Resident');
  const [isLoading, setIsLoading] = useState(false);

  const handleJoinSociety = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const toastId = toast.loading('Submitting registration...');
    try {
      if (role === 'Security') {
        await axios.post(`${API_BASE}/api/auth/register-security`, {
          fullName,
          email,
          password,
          uniqueJoinCode,
        });
      } else {
        await axios.post(`${API_BASE}/api/auth/register-resident`, {
          fullName,
          email,
          password,
          uniqueJoinCode,
          flatNumber,
        });
      }
      toast.success('Registration submitted. Please wait for admin approval.', {
        id: toastId,
        duration: 5000,
      });
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed.', { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm';

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="w-full max-w-md">
        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Login
        </button>

        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 overflow-hidden">
          <div className="px-8 pt-8 pb-2">
            <h2 className="text-2xl font-bold text-slate-800">Join a Society</h2>
            <p className="text-slate-500 text-sm mt-1">
              Enter your join code to register
            </p>
          </div>

          <form onSubmit={handleJoinSociety} className="p-8 space-y-4">
            {/* Role Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Registering as</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRole('Resident')}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                    role === 'Resident'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  🏠 Resident
                </button>
                <button
                  type="button"
                  onClick={() => setRole('Security')}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                    role === 'Security'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  🛡️ Security Guard
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Society Join Code</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="e.g., ABC123"
                  value={uniqueJoinCode}
                  onChange={(e) => setUniqueJoinCode(e.target.value.toUpperCase())}
                  className={inputClass}
                  required
                />
              </div>
            </div>

            {role === 'Resident' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Flat Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g., 402B"
                    value={flatNumber}
                    onChange={(e) => setFlatNumber(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide text-white bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Submitting...' : 'Submit Registration'}
            </button>
          </form>

          <div className="px-8 pb-8 pt-2 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <button
              onClick={() => navigate('/')}
              className="text-blue-600 font-semibold hover:text-blue-700 cursor-pointer"
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
