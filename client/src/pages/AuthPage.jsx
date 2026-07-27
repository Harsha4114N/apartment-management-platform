import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE from '../config/api';

const TABS = [
    { key: 'login', label: 'Login' },
    { key: 'register-society', label: 'Register Society' },
    { key: 'join-society', label: 'Join Society' },
];

export default function AuthPage() {
    const [activeTab, setActiveTab] = useState('login');
    const navigate = useNavigate();

    // ── Login fields ──
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // ── Register Society fields ──
    const [regFullName, setRegFullName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regSocietyName, setRegSocietyName] = useState('');
    const [regAddress, setRegAddress] = useState('');
    const [joinCodeModal, setJoinCodeModal] = useState(null);

    // ── Join Society fields ──
    const [joinFullName, setJoinFullName] = useState('');
    const [joinEmail, setJoinEmail] = useState('');
    const [joinPassword, setJoinPassword] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [joinFlatNumber, setJoinFlatNumber] = useState('');

    const resetFields = () => {
        setLoginEmail(''); setLoginPassword('');
        setRegFullName(''); setRegEmail(''); setRegPassword('');
        setRegSocietyName(''); setRegAddress('');
        setJoinFullName(''); setJoinEmail(''); setJoinPassword('');
        setJoinCode(''); setJoinFlatNumber('');
    };

    const switchTab = (key) => {
        resetFields();
        setJoinCodeModal(null);
        setActiveTab(key);
    };

    // ── Login handler ──
    const handleLogin = async (e) => {
        e.preventDefault();
        const toastId = toast.loading('Authenticating...');
        try {
            const { data } = await axios.post(`${API_BASE}/api/auth/login`, {
                email: loginEmail,
                password: loginPassword,
            });
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            toast.success('Welcome back!', { id: toastId });

            // Role-based redirection
            const role = data.user.role;
            console.log('AuthPage login — user role:', role);
            if (role === 'SuperAdmin' || role === 'Admin') {
                navigate('/admin');
            } else {
                navigate('/dashboard');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Login failed.', { id: toastId });
        }
    };

    // ── Register Society handler ──
    const handleRegisterSociety = async (e) => {
        e.preventDefault();
        const toastId = toast.loading('Creating society...');
        try {
            const { data } = await axios.post(`${API_BASE}/api/auth/register-society`, {
                fullName: regFullName,
                email: regEmail,
                password: regPassword,
                societyName: regSocietyName,
                address: regAddress,
            });
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            toast.success('Society created!', { id: toastId });
            setJoinCodeModal(data.society.uniqueJoinCode);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Registration failed.', { id: toastId });
        }
    };

    // ── Join Society handler ──
    const handleJoinSociety = async (e) => {
        e.preventDefault();
        const toastId = toast.loading('Submitting registration...');
        try {
            await axios.post(`${API_BASE}/api/auth/register-resident`, {
                fullName: joinFullName,
                email: joinEmail,
                password: joinPassword,
                uniqueJoinCode: joinCode,
                flatNumber: joinFlatNumber,
            });
            toast.success('Registration submitted. Please wait for admin approval.', {
                id: toastId,
                duration: 5000,
            });
            resetFields();
            switchTab('login');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Registration failed.', { id: toastId });
        }
    };

    // ── Shared input class ──
    const inputClass =
        'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm';

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 font-sans">
            <div className="w-full max-w-md">
                {/* ── Header ── */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white text-2xl font-bold shadow-lg shadow-blue-200 mb-4">
                        AP
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
                        Apartment Platform
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Multi-tenant management system</p>
                </div>

                {/* ── Card ── */}
                <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 overflow-hidden">
                    {/* ── Tab bar ── */}
                    <div className="flex border-b border-slate-100">
                        {TABS.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => switchTab(tab.key)}
                                className={`flex-1 py-3.5 text-sm font-semibold transition-all duration-200 cursor-pointer ${
                                    activeTab === tab.key
                                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/40'
                                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* ── Tab content ── */}
                    <div className="p-6">
                        {/* ===== LOGIN TAB ===== */}
                        {activeTab === 'login' && (
                            <form onSubmit={handleLogin} className="space-y-4">
                                <h2 className="text-lg font-bold text-slate-800 mb-1">Welcome back</h2>
                                <p className="text-slate-500 text-xs mb-4">Sign in to your account</p>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="you@example.com"
                                        value={loginEmail}
                                        onChange={(e) => setLoginEmail(e.target.value)}
                                        className={inputClass}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={loginPassword}
                                        onChange={(e) => setLoginPassword(e.target.value)}
                                        className={inputClass}
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-blue-200 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                                >
                                    Sign In
                                </button>
                            </form>
                        )}

                        {/* ===== REGISTER SOCIETY TAB ===== */}
                        {activeTab === 'register-society' && (
                            <form onSubmit={handleRegisterSociety} className="space-y-4">
                                <h2 className="text-lg font-bold text-slate-800 mb-1">Register a Society</h2>
                                <p className="text-slate-500 text-xs mb-4">
                                    Create a new society and become the SuperAdmin
                                </p>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="John Doe"
                                        value={regFullName}
                                        onChange={(e) => setRegFullName(e.target.value)}
                                        className={inputClass}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="admin@society.com"
                                        value={regEmail}
                                        onChange={(e) => setRegEmail(e.target.value)}
                                        className={inputClass}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={regPassword}
                                        onChange={(e) => setRegPassword(e.target.value)}
                                        className={inputClass}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                        Society Name
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Sunrise Apartments"
                                        value={regSocietyName}
                                        onChange={(e) => setRegSocietyName(e.target.value)}
                                        className={inputClass}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                        Address
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="123 Main Street, City"
                                        value={regAddress}
                                        onChange={(e) => setRegAddress(e.target.value)}
                                        className={inputClass}
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-blue-200 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                                >
                                    Create Society
                                </button>
                            </form>
                        )}

                        {/* ===== JOIN SOCIETY TAB ===== */}
                        {activeTab === 'join-society' && (
                            <form onSubmit={handleJoinSociety} className="space-y-4">
                                <h2 className="text-lg font-bold text-slate-800 mb-1">Join a Society</h2>
                                <p className="text-slate-500 text-xs mb-4">
                                    Enter your join code to register as a resident
                                </p>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Jane Smith"
                                        value={joinFullName}
                                        onChange={(e) => setJoinFullName(e.target.value)}
                                        className={inputClass}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="resident@example.com"
                                        value={joinEmail}
                                        onChange={(e) => setJoinEmail(e.target.value)}
                                        className={inputClass}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={joinPassword}
                                        onChange={(e) => setJoinPassword(e.target.value)}
                                        className={inputClass}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                        Join Code
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. GRN849"
                                        value={joinCode}
                                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                        className={`${inputClass} tracking-widest font-mono`}
                                        maxLength={6}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                        Flat Number
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. A-101"
                                        value={joinFlatNumber}
                                        onChange={(e) => setJoinFlatNumber(e.target.value)}
                                        className={inputClass}
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-blue-200 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                                >
                                    Submit Registration
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                <p className="text-center text-xs text-slate-400 mt-6">
                    &copy; {new Date().getFullYear()} Apartment Platform. All rights reserved.
                </p>
            </div>

            {/* ── Join Code Success Modal ── */}
            {joinCodeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 max-w-sm w-full text-center">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 text-green-600 text-2xl mb-4">
                            ✓
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Society Created!</h3>
                        <p className="text-slate-500 text-sm mb-5">
                            Share this unique join code with your residents so they can register.
                        </p>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl py-4 px-6 mb-6">
                            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">
                                Join Code
                            </p>
                            <p className="text-3xl font-mono font-bold text-blue-600 tracking-[0.3em]">
                                {joinCodeModal}
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(joinCodeModal);
                                toast.success('Join code copied to clipboard!');
                            }}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer mb-3"
                        >
                            Copy to Clipboard
                        </button>
                        <button
                            onClick={() => {
                                setJoinCodeModal(null);
                                switchTab('login');
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer"
                        >
                            Go to Login
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
