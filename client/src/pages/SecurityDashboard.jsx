import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import API_BASE from '../config/api';

const API_URL = `${API_BASE}/api`;

export default function SecurityDashboard() {
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [showWalkInForm, setShowWalkInForm] = useState(false);
  const [recentVisitors, setRecentVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const html5QrCodeRef = useRef(null);

  // ── Walk-in form state ──
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInPurpose, setWalkInPurpose] = useState('');
  const [walkInVehicle, setWalkInVehicle] = useState('');
  const [walkInFlat, setWalkInFlat] = useState('');
  const [walkInFlatId, setWalkInFlatId] = useState('');
  const [walkInResidentName, setWalkInResidentName] = useState('');
  const [walkInSubmitting, setWalkInSubmitting] = useState(false);

  // ── Flats directory state (for searchable dropdown) ──
  const [flatsList, setFlatsList] = useState([]);
  const [flatSearch, setFlatSearch] = useState('');
  const [flatDropdownOpen, setFlatDropdownOpen] = useState(false);
  const flatDropdownRef = useRef(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // ── Fetch recent visitors ──
  const fetchRecentVisitors = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/visitors`, {
        headers: getAuthHeaders(),
      });
      // Show today's visitors sorted by most recent
      const today = new Date().toISOString().split('T')[0];
      const todayVisitors = (response.data || []).filter(
        (v) => v.expectedDate === today
      );
      setRecentVisitors(todayVisitors.slice(0, 20));
    } catch (error) {
      console.error('Error fetching visitors:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch flats directory (for walk-in destination dropdown) ──
  const fetchFlatsDirectory = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/directory`, {
        headers: getAuthHeaders(),
      });
      if (Array.isArray(response.data)) {
        // Filter to only residents with flats, and sort by flat number
        const residents = response.data.filter(r => r.unit && r.unit !== 'N/A');
        residents.sort((a, b) => a.unit.localeCompare(b.unit, undefined, { numeric: true }));
        setFlatsList(residents);
      }
    } catch (error) {
      console.error('Error fetching directory:', error);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchRecentVisitors();
    fetchFlatsDirectory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Real-time socket listener for visitor status changes ──
  useEffect(() => {
    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
    });

    const joinSociety = () => {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (storedUser.societyId) {
        socket.emit('join-society', storedUser.societyId);
        console.log('[Socket Security] join-society emitted:', storedUser.societyId);
      }
    };

    socket.on('connect', () => {
      console.log('[Socket Security] Connected:', socket.id);
      joinSociety();
    });

    socket.on('reconnect', () => {
      console.log('[Socket Security] Reconnected:', socket.id);
      joinSociety();
    });

    // New walk-in visitor logged → prepend to list
    socket.on('visitor:walkin', (visitor) => {
      console.log('[Socket Security] visitor:walkin received:', visitor.name);
      const today = new Date().toISOString().split('T')[0];
      if (visitor.expectedDate === today) {
        setRecentVisitors((prev) => {
          if (prev.some((v) => v._id === visitor._id)) return prev;
          return [visitor, ...prev].slice(0, 20);
        });
      }
    });

    // Visitor status updated (approved/rejected) → update in-place
    socket.on('visitor:status', (updated) => {
      console.log('[Socket Security] visitor:status received:', updated.name, updated.status);
      setRecentVisitors((prev) =>
        prev.map((v) => (v._id === updated._id ? { ...v, ...updated } : v))
      );
    });

    return () => {
      console.log('[Socket Security] Cleaning up listeners...');
      socket.off('connect');
      socket.off('reconnect');
      socket.off('visitor:walkin');
      socket.off('visitor:status');
      socket.disconnect();
    };
  }, []);

  // ── Close flat dropdown when clicking outside ──
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (flatDropdownRef.current && !flatDropdownRef.current.contains(e.target)) {
        setFlatDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Start QR Scanner ──
  const startScanner = useCallback(async () => {
    setScanning(true);
    setScanResult(null);

    try {
      // Dynamically import html5-qrcode
      const { Html5Qrcode } = await import('html5-qrcode');

      const scannerId = 'qr-scanner-element';
      const html5QrCode = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          // Stop scanner on successful decode
          await html5QrCode.stop();

          // Parse the QR data
          let visitorId = decodedText;
          try {
            const parsed = JSON.parse(decodedText);
            visitorId = parsed.visitorId || parsed._id || decodedText;
          } catch {
            // It's just a plain ID string
          }

          // Verify the QR code
          try {
            const response = await axios.post(
              `${API_URL}/visitors/verify-qr`,
              { visitorId },
              { headers: getAuthHeaders() }
            );

            const { visitor, message } = response.data;
            setScanResult({ type: 'granted', visitor, message });
            toast.success('✅ ACCESS GRANTED', { duration: 5000 });
            fetchRecentVisitors();
          } catch (error) {
            const errData = error.response?.data;
            const msg = errData?.message || 'ACCESS DENIED';
            const visitor = errData?.visitor;

            setScanResult({
              type: 'denied',
              message: msg,
              visitor: visitor || null,
            });
            toast.error(`❌ ${msg}`, { duration: 5000 });
          }

          setScanning(false);
        },
        () => {
          // Ignore continuous scan errors
        }
      );
    } catch (error) {
      console.error('Scanner error:', error);
      toast.error('Failed to start camera scanner. Check permissions.');
      setScanning(false);
    }
  }, [getAuthHeaders, fetchRecentVisitors]);

  // ── Stop Scanner ──
  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch {
        // Ignore stop errors
      }
      html5QrCodeRef.current = null;
    }
    setScanning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        try {
          html5QrCodeRef.current.stop();
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  // ── Handle Walk-in Submit ──
  const handleWalkIn = async (e) => {
    e.preventDefault();
    setWalkInSubmitting(true);
    const toastId = toast.loading('Logging walk-in visitor...');

    try {
      await axios.post(
        `${API_URL}/visitors/walk-in`,
        {
          name: walkInName,
          phone: walkInPhone,
          purpose: walkInPurpose,
          vehicle: walkInVehicle,
          flat: walkInFlat,
          flatId: walkInFlatId || undefined,
        },
        { headers: getAuthHeaders() }
      );

      toast.success('✅ Walk-in visitor logged — awaiting resident approval!', {
        id: toastId,
        duration: 4000,
      });

      // Reset form
      setWalkInName('');
      setWalkInPhone('');
      setWalkInPurpose('');
      setWalkInVehicle('');
      setWalkInFlat('');
      setWalkInFlatId('');
      setWalkInResidentName('');
      setFlatSearch('');
      setShowWalkInForm(false);
      fetchRecentVisitors();
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Failed to log walk-in.',
        { id: toastId }
      );
    } finally {
      setWalkInSubmitting(false);
    }
  };

  // ── Status badge colors ──
  const statusColors = {
    Expected: 'bg-amber-100 text-amber-700',
    'Checked-In': 'bg-emerald-100 text-emerald-700',
    'Checked-Out': 'bg-slate-100 text-slate-600',
    'Pending Approval': 'bg-yellow-100 text-yellow-700',
    Approved: 'bg-emerald-100 text-emerald-700',
    Rejected: 'bg-rose-100 text-rose-700',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 md:p-10 font-sans">
      {/* ── Header ── */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
              🛡️ Security Dashboard
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Scan visitor QR codes or log walk-in entries
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={startScanner}
              disabled={scanning}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm shadow-md transition-all duration-200 cursor-pointer ${
                scanning
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 hover:-translate-y-0.5'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              {scanning ? 'Scanning...' : 'Scan QR Code'}
            </button>
            <button
              onClick={() => {
                setShowWalkInForm(true);
                stopScanner();
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-200 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              New Walk-in
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── LEFT: Scanner / Walk-in Form ── */}
        <div className="lg:col-span-3 space-y-6">
          {/* ── QR Scanner ── */}
          {scanning && (
            <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800">📷 Scanning...</h2>
                <button
                  onClick={stopScanner}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Stop Scanner
                </button>
              </div>
              <div className="p-6 flex justify-center">
                <div
                  id="qr-scanner-element"
                  className="w-full max-w-md aspect-square bg-slate-900 rounded-xl overflow-hidden"
                />
              </div>
            </div>
          )}

          {/* ── Scan Result ── */}
          {scanResult && (
            <div
              className={`rounded-2xl border-2 overflow-hidden transition-all duration-500 ${
                scanResult.type === 'granted'
                  ? 'border-emerald-400 bg-emerald-50 shadow-[0_8px_30px_rgb(16,185,129,0.15)]'
                  : 'border-rose-400 bg-rose-50 shadow-[0_8px_30px_rgb(244,63,94,0.15)]'
              }`}
            >
              <div className="p-6 text-center">
                {scanResult.type === 'granted' ? (
                  <>
                    <div className="text-6xl mb-3">✅</div>
                    <h2 className="text-3xl font-extrabold text-emerald-700 tracking-tight">
                      ACCESS GRANTED
                    </h2>
                  </>
                ) : (
                  <>
                    <div className="text-6xl mb-3">🚫</div>
                    <h2 className="text-3xl font-extrabold text-rose-700 tracking-tight">
                      ACCESS DENIED
                    </h2>
                  </>
                )}
                <p className="text-slate-600 mt-2 font-medium">
                  {scanResult.message}
                </p>
              </div>

              {scanResult.visitor && (
                <div className="px-6 pb-6">
                  <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Name</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {scanResult.visitor.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Flat</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {scanResult.visitor.flat}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Purpose</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {scanResult.visitor.purpose}
                      </span>
                    </div>
                    {scanResult.visitor.host && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Host</span>
                        <span className="text-sm font-semibold text-slate-800">
                          {scanResult.visitor.host}
                        </span>
                      </div>
                    )}
                    {scanResult.visitor.phone && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Phone</span>
                        <span className="text-sm font-semibold text-slate-800">
                          {scanResult.visitor.phone}
                        </span>
                      </div>
                    )}
                    {scanResult.visitor.vehicle && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Vehicle</span>
                        <span className="text-sm font-semibold text-slate-800">
                          {scanResult.visitor.vehicle}
                        </span>
                      </div>
                    )}
                    {scanResult.visitor.entryTime && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">
                          {scanResult.type === 'granted' ? 'Entry Time' : 'Status'}
                        </span>
                        <span className="text-sm font-semibold text-slate-800">
                          {scanResult.type === 'granted'
                            ? new Date(scanResult.visitor.entryTime).toLocaleTimeString()
                            : scanResult.visitor.status}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="px-6 pb-6">
                <button
                  onClick={() => {
                    setScanResult(null);
                    startScanner();
                  }}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all cursor-pointer"
                >
                  Scan Next Visitor
                </button>
              </div>
            </div>
          )}

          {/* ── Walk-in Form ── */}
          {showWalkInForm && (
            <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800">📝 Log Walk-in Visitor</h2>
                <button
                  onClick={() => setShowWalkInForm(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleWalkIn} className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Visitor Name *
                    </label>
                    <input
                      type="text"
                      placeholder="Full name"
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Phone
                    </label>
                    <input
                      type="text"
                      placeholder="Phone number"
                      value={walkInPhone}
                      onChange={(e) => setWalkInPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Purpose *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Delivery, Guest, Service"
                    value={walkInPurpose}
                    onChange={(e) => setWalkInPurpose(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Vehicle
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., MH-01-AB-1234"
                      value={walkInVehicle}
                      onChange={(e) => setWalkInVehicle(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div ref={flatDropdownRef} className="relative">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Destination Flat <span className="text-slate-400 font-normal">(search resident or flat)</span>
                    </label>
                    {/* ── Selected resident display ── */}
                    {walkInFlatId && walkInFlat ? (
                      <div className="flex items-center gap-2 w-full px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
                        <span className="font-semibold">{walkInFlat}</span>
                        <span className="text-emerald-500">·</span>
                        <span>{walkInResidentName}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setWalkInFlatId('');
                            setWalkInFlat('');
                            setWalkInResidentName('');
                            setFlatSearch('');
                          }}
                          className="ml-auto text-emerald-400 hover:text-emerald-600 cursor-pointer text-base leading-none"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search flat or resident name..."
                          value={flatSearch}
                          onChange={(e) => {
                            setFlatSearch(e.target.value);
                            setFlatDropdownOpen(true);
                          }}
                          onFocus={() => setFlatDropdownOpen(true)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                        {flatDropdownOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-52 overflow-y-auto">
                            {flatsList
                              .filter(
                                (r) =>
                                  r.unit.toLowerCase().includes(flatSearch.toLowerCase()) ||
                                  r.name.toLowerCase().includes(flatSearch.toLowerCase())
                              )
                              .slice(0, 50)
                              .map((r) => (
                                <button
                                  key={r.id}
                                  type="button"
                                  onClick={() => {
                                    setWalkInFlat(r.unit);
                                    setWalkInFlatId(r.flatId);
                                    setWalkInResidentName(r.name);
                                    setFlatSearch('');
                                    setFlatDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors border-b border-slate-50 last:border-b-0 cursor-pointer flex items-center gap-3"
                                >
                                  <span className="font-semibold text-xs bg-slate-100 px-2 py-0.5 rounded">{r.unit}</span>
                                  <span>{r.name}</span>
                                </button>
                              ))}
                            {flatsList.filter(
                              (r) =>
                                r.unit.toLowerCase().includes(flatSearch.toLowerCase()) ||
                                r.name.toLowerCase().includes(flatSearch.toLowerCase())
                            ).length === 0 && (
                              <div className="px-4 py-3 text-sm text-slate-400 text-center">
                                No matching flats found
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={walkInSubmitting}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all duration-200 shadow-md shadow-emerald-200 disabled:opacity-60 cursor-pointer"
                >
                  {walkInSubmitting ? 'Logging...' : '✅ Log Walk-in Entry'}
                </button>
              </form>
            </div>
          )}

          {/* ── Scanning & Walk-in CTA (when idle) ── */}
          {!scanning && !scanResult && !showWalkInForm && (
            <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 overflow-hidden">
              <div className="p-10 text-center">
                <div className="text-6xl mb-4">🛡️</div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">
                  Ready for Duty
                </h2>
                <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
                  Click <strong>"Scan QR Code"</strong> to start the live scanner, or{' '}
                  <strong>"New Walk-in"</strong> to manually log an unannounced visitor.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={startScanner}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-200 transition-all hover:-translate-y-0.5 cursor-pointer"
                  >
                    📷 Start Scanning
                  </button>
                  <button
                    onClick={() => setShowWalkInForm(true)}
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-md shadow-emerald-200 transition-all hover:-translate-y-0.5 cursor-pointer"
                  >
                    ➕ New Walk-in
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Recent Visitors ── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 overflow-hidden h-full">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Today's Visitors</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {recentVisitors.length} visitor{recentVisitors.length !== 1 ? 's' : ''} today
              </p>
            </div>

            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-slate-400">Loading...</div>
              ) : recentVisitors.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-3xl mb-2">🚪</div>
                  <p className="text-slate-400 text-sm">No visitors recorded today yet.</p>
                </div>
              ) : (
                recentVisitors.map((visitor) => (
                  <div key={visitor._id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {visitor.name}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Flat {visitor.flat} · {visitor.purpose}
                        </p>
                        {visitor.entryTime && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Entry: {new Date(visitor.entryTime).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                          statusColors[visitor.status] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {visitor.status === 'Checked-In' ? 'IN' : visitor.status === 'Checked-Out' ? 'OUT' : visitor.status === 'Approved' ? 'APRVD' : visitor.status === 'Rejected' ? 'REJ' : visitor.status === 'Pending Approval' ? 'PENDING' : 'EXP'}
                      </span>
                    </div>
                    {visitor.vehicle && visitor.vehicle !== '—' && (
                      <p className="text-[11px] text-slate-400 mt-1 ml-0">
                        🚗 {visitor.vehicle}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
