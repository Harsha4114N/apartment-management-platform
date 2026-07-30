import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

import API_BASE from '../config/api';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [apartment, setApartment] = useState('');
  const [password, setPassword] = useState('');
  const [societyId, setSocietyId] = useState('');
  const [societies, setSocieties] = useState([]);
  const [role, setRole] = useState('Resident');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSocieties = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/societies`);
        setSocieties(response.data);
      } catch (error) {
        console.error('Failed to load societies:', error);
      }
    };
    fetchSocieties();
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    const toastId = toast.loading('Creating account...');

    try {
      if (role === 'Security') {
        await axios.post(`${API_BASE}/api/auth/register-security`, {
          fullName: name,
          email,
          password,
          uniqueJoinCode: societyId
        });
      } else {
        await axios.post(`${API_BASE}/api/auth/register`, {
          fullName: name,
          email,
          flatNumber: apartment,
          password,
          societyId
        });
      }

      toast.success('Account created successfully!', { id: toastId });
      navigate('/login');
    } catch (error) {
      console.error(error);
      const errorMessage = error.response?.data?.message || 'Failed to create account.';
      toast.error(errorMessage, { id: toastId });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">Create Account</h1>
          <p className="text-slate-500 text-sm">Join your apartment society</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Role Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Registering as</label>
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
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              {role === 'Security' ? 'Society Join Code' : 'Society / Building'}
            </label>
            {role === 'Security' ? (
              <input
                type="text"
                placeholder="e.g., ABC123"
                value={societyId}
                onChange={(e) => setSocietyId(e.target.value.toUpperCase())}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                required
              />
            ) : (
              <select
                value={societyId}
                onChange={(e) => setSocietyId(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                required
              >
                <option value="">Select your building</option>
                {societies.map((society) => (
                  <option key={society._id} value={society._id}>
                    {society.name} — {society.address}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
            <input
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                required
              />
            </div>
            {role === 'Resident' && (
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Apt Number</label>
                <input
                  type="text"
                  placeholder="e.g., 402B"
                  value={apartment}
                  onChange={(e) => setApartment(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  required
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              required
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold tracking-wide shadow-lg shadow-blue-200 transition-all duration-200 hover:-translate-y-0.5 mt-2"
          >
            Create Account
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm text-slate-500 space-y-2">
          <p>
            Already have an account? <Link to="/login" className="text-blue-600 font-semibold cursor-pointer hover:underline">Log in</Link>
          </p>
          <p>
            Setting up a new building? <Link to="/register-society" className="text-blue-600 font-semibold cursor-pointer hover:underline">Register your society</Link>
          </p>
        </div>

      </div>
    </div>
  );
}
