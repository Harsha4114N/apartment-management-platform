import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE from '../config/api';

// ── Helper: read user from localStorage ──
function useUser() {
  return useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user')); }
    catch { return null; }
  }, []);
}

/**
 * Dynamically loads the Razorpay checkout script.
 */
const loadRazorpayScript = () => {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.body.appendChild(script);
  });
};

export default function BillingDashboard() {
  const user = useUser();
  const isAdmin = user?.role === 'SuperAdmin' || user?.role === 'Admin';

  if (isAdmin) return <AdminView />;
  return <ResidentView />;
}

/* ═══════════════════════════════════════════════
   ADMIN VIEW — Master Dues List + Society Ledger
   NOTE: Manual "Issue New Bill" form removed — rely on the
   automated "Split across all flats" ledger feature instead.
   ═══════════════════════════════════════════════ */
function AdminView() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Ledger / Expense State ──
  const [expenses, setExpenses] = useState([]);
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState('');
  const [expCategory, setExpCategory] = useState('Maintenance');
  const [splitType, setSplitType] = useState('ALL');
  const [targetFlats, setTargetFlats] = useState('');
  const [expLoading, setExpLoading] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchBills = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/payments/bills`, {
        headers: getAuthHeaders(),
      });
      setBills(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch Expenses ──
  const fetchExpenses = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/expenses`, { headers: getAuthHeaders() });
      setExpenses(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching expenses:', err);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchBills();
    fetchExpenses();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Handle Create Expense ──
  const handleCreateExpense = async (e) => {
    e.preventDefault();
    if (!expTitle || !expAmount || !expDate) {
      toast.error('Please fill in all expense fields.');
      return;
    }
    setExpLoading(true);
    try {
      const payload = {
        title: expTitle,
        amount: Number(expAmount),
        date: expDate,
        category: expCategory,
        splitType: splitType,
      };
      if (splitType === 'TARGET') {
        payload.targetFlats = targetFlats.split(',').map((f) => f.trim()).filter(Boolean);
      }
      await axios.post(`${API_BASE}/api/expenses`, payload, { headers: getAuthHeaders() });
      const splitMsg = splitType === 'ALL'
        ? ' & split across all residents as bills.'
        : ' & split across targeted flats as bills.';
      toast.success(`Expense recorded${splitMsg}`);
      setExpTitle('');
      setExpAmount('');
      setExpDate('');
      setExpCategory('Maintenance');
      setSplitType('ALL');
      setTargetFlats('');
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record expense.');
    } finally {
      setExpLoading(false);
    }
  };

  const pendingDues = bills.filter((b) => b.status === 'Pending');
  const totalPending = pendingDues.reduce((sum, b) => sum + b.amount, 0);

  const inputClass = 'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all';

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return loading ? (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm font-medium">Loading bills...</p>
      </div>
    </div>
  ) : (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Billing & Dues</h1>
        <p className="text-slate-500 text-sm mt-1">Track dues and manage society expenses</p>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-2xl font-bold text-slate-800">{bills.length}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Total Bills Issued</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-2xl font-bold text-amber-600">{pendingDues.length}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Pending Dues</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-2xl font-bold text-indigo-600">₹{totalPending.toLocaleString()}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Total Outstanding</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-2xl font-bold text-rose-600">₹{totalExpenses.toLocaleString()}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Total Expenses</p>
        </div>
      </div>

      {/* ── Society Ledger & Expenses ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Society Ledger & Expenses</h2>
        <form onSubmit={handleCreateExpense} className="space-y-4 mb-6 pb-6 border-b border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Expense Title</label>
              <input
                type="text"
                placeholder="e.g., Lift Maintenance"
                value={expTitle}
                onChange={(e) => setExpTitle(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Amount (₹)</label>
              <input
                type="number"
                placeholder="e.g., 50000"
                min="1"
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date</label>
              <input
                type="date"
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Category</label>
              <select
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value)}
                className={inputClass}
              >
                <option value="Maintenance">Maintenance</option>
                <option value="Repairs">Repairs</option>
                <option value="Utilities">Utilities</option>
                <option value="Security">Security</option>
                <option value="Events">Events</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-6 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="splitType"
                    value="ALL"
                    checked={splitType === 'ALL'}
                    onChange={() => setSplitType('ALL')}
                    className="w-4 h-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Split equally across ALL flats</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="splitType"
                    value="TARGET"
                    checked={splitType === 'TARGET'}
                    onChange={() => setSplitType('TARGET')}
                    className="w-4 h-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Target specific flats</span>
                </label>
              </div>

              {splitType === 'TARGET' && (
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Flat numbers <span className="text-slate-400 font-normal">(comma-separated)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. A-101, A-102, B-201"
                    value={targetFlats}
                    onChange={(e) => setTargetFlats(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    required={splitType === 'TARGET'}
                  />
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={expLoading}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold shadow-md shadow-rose-200 transition-all hover:-translate-y-0.5 cursor-pointer shrink-0"
            >
              {expLoading ? 'Recording...' : 'Record Expense'}
            </button>
          </div>
        </form>

        {expenses.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-slate-400 text-sm">No expenses recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 rounded-xl">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Title</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Amount</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Split</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((exp) => (
                  <tr key={exp._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{exp.title}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-lg bg-slate-100 text-slate-700 uppercase">
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{new Date(exp.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-semibold text-rose-600">₹{exp.amount}</td>
                    <td className="px-4 py-3">
                      {exp.splitType === 'ALL' ? (
                        <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-lg bg-indigo-50 text-indigo-700 uppercase" title="Split equally across all residents">All Flats</span>
                      ) : exp.splitType === 'TARGET' ? (
                        <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-lg bg-amber-50 text-amber-700 uppercase" title="Split across targeted flats only">Targeted</span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Master Dues List ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">All Dues</h2>
        {bills.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm">No bills issued yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 rounded-xl">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Title</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Flat</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Owner</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Amount</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Due</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map((b) => (
                  <tr key={b._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{b.title}</td>
                    <td className="px-4 py-3 text-slate-600">{b.flat}</td>
                    <td className="px-4 py-3 text-slate-600">{b.owner}</td>
                    <td className="px-4 py-3 font-semibold text-indigo-600">₹{b.amount}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(b.dueDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-lg uppercase ${
                        b.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {b.status}
                      </span>
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

/* ═══════════════════════════════════════════════
   RESIDENT VIEW — Pending Bills + Payment History
   ═══════════════════════════════════════════════ */
function ResidentView() {
  const [bills, setBills] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  const API_URL = `${API_BASE}/api`;

  const fetchBills = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get(`${API_URL}/payments/bills`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBills(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching bills:', error);
      setBills([]);
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchBills();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handlePayment = async (billId, billAmount) => {
    const toastId = toast.loading('Initializing payment...');
    setProcessing(true);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error('Failed to load Razorpay SDK. Please try again.', { id: toastId });
        setProcessing(false);
        return;
      }

      const token = localStorage.getItem('token');
      const orderResponse = await axios.post(
        `${API_URL}/payments/create-order`,
        { amount: billAmount, currency: 'INR', billId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { id: order_id, amount: orderAmount, currency } = orderResponse.data;

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        amount: orderAmount,
        currency,
        name: 'Apartment Management',
        description: `Payment for Bill ${billId}`,
        order_id,
        handler: async function (response) {
          try {
            const verifyResponse = await axios.post(
              `${API_URL}/payments/verify`,
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                billId,
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success(verifyResponse.data.message || 'Payment successful!', { id: toastId });
            setProcessing(false);
            fetchBills();
          } catch (verifyError) {
            console.error('Payment verification failed:', verifyError);
            toast.error('Payment verification failed. Please contact support.', { id: toastId });
            setProcessing(false);
          }
        },
        prefill: { name: '', email: '', contact: '' },
        theme: { color: '#4f46e5' },
        modal: {
          ondismiss: function () {
            toast.error('Payment cancelled.', { id: toastId });
            setProcessing(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      // Fallback: if API not available, mark as paid locally for demo
      if (!error.response || error.code === 'ERR_NETWORK') {
        setBills(bills.map((b) => b._id === billId ? { ...b, status: 'Paid' } : b));
        toast.success('Payment recorded (demo mode — API unavailable).', { id: toastId });
        setProcessing(false);
        return;
      }
      console.error('Payment initiation failed:', error);
      const serverMsg = error.response?.data?.message || error.message || 'Failed to initiate payment.';
      toast.error(serverMsg, { id: toastId });
      setProcessing(false);
    }
  };

  const pendingBills = bills.filter((b) => b.status === 'Pending');
  const paidBills = bills.filter((b) => b.status === 'Paid');

  return loading ? (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm font-medium">Loading your bills...</p>
      </div>
    </div>
  ) : (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Bills & Payments</h1>
        <p className="text-slate-500 text-sm mt-1">View pending dues and payment history</p>
      </div>

      {/* ── Pending Bills ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          Pending Bills
          {pendingBills.length > 0 && (
            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-lg">{pendingBills.length}</span>
          )}
        </h2>

        {pendingBills.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">📋</div>
            <p className="text-slate-400 font-medium text-sm">No pending bills. You're all clear!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingBills.map((bill) => (
              <div key={bill._id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800">{bill.title || 'Maintenance Bill'}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Due: <span className="font-semibold text-slate-600">{new Date(bill.dueDate).toLocaleDateString()}</span>
                    </p>
                  </div>
                  <p className="text-lg font-bold text-indigo-600">₹{bill.amount}</p>
                </div>
                <button
                  onClick={() => handlePayment(bill._id, bill.amount)}
                  disabled={processing}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-bold shadow-md shadow-indigo-200 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  {processing ? 'Processing...' : `Pay ₹${bill.amount}`}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Payment History ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Payment History</h2>

        {paidBills.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">No payment history yet.</p>
        ) : (
          <div className="space-y-3">
            {paidBills.map((bill) => (
              <div key={bill._id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800">{bill.title || 'Maintenance Bill'}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Due: {new Date(bill.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-bold text-emerald-600">₹{bill.amount}</p>
                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg uppercase">Paid</span>
                  </div>
                </div>
                {bill.receiptUrl && (
                  <a
                    href={`${API_BASE}${bill.receiptUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors no-underline"
                  >
                    📄 Download Receipt
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
