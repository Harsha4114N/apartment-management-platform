import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    const toastId = toast.loading('Authenticating...');

    try {
      // Validate credentials with the backend
      const response = await axios.post('https://apartment-management-platform.onrender.com/api/auth/login', { 
        email, 
        password 
      });

      // Save the JWT token so the user stays logged in
      localStorage.setItem('token', response.data.token);
      
      toast.success('Welcome back!', { id: toastId });
      navigate('/dashboard'); // Grant access to the app
    } catch (error) {
      console.error(error);
      const errorMessage = error.response?.data?.message || 'Invalid email or password.';
      toast.error(errorMessage, { id: toastId });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">Welcome Back</h1>
          <p className="text-slate-500 text-sm">Access your resident dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
            <input
              type="email"
              placeholder="resident@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              required
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold tracking-wide shadow-lg shadow-blue-200 transition-all duration-200 hover:-translate-y-0.5 mt-4"
          >
            Secure Login
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm text-slate-500">
          Don't have an account? <Link to="/register" className="text-blue-600 font-semibold cursor-pointer hover:underline">Register here</Link>
        </div>

      </div>
    </div>
  );
}