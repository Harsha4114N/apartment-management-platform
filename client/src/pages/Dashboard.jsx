import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE from '../config/api';

const API_URL = `${API_BASE}/api`;

// ── Razorpay SDK loader (shared with BillingDashboard) ──
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

const TABS = [
  { key: 'tickets', label: 'Maintenance Tickets' },
  { key: 'bills',   label: 'My Bills' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('tickets');

  // ── Tickets state ──
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Plumbing');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(null);
  const [tickets, setTickets] = useState([]);

  // ── Bills state ──
  const [bills, setBills] = useState([]);
  const [processing, setProcessing] = useState(false);

  // ══════════════════════════════════════════════════
  //  DATA FETCHING
  // ══════════════════════════════════════════════════


  const fetchTickets = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get(`${API_URL}/tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setTickets(response.data);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    }
  };

  const fetchBills = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get(`${API_URL}/payments/bills`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBills(response.data);
    } catch (error) {
      console.error('Error fetching bills:', error);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchTickets();
    fetchBills();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ══════════════════════════════════════════════════
  //  TICKET HANDLERS
  // ══════════════════════════════════════════════════

  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    const toastId = toast.loading('Submitting ticket with image (this may take a few seconds)...');

    try {
      const token = localStorage.getItem('token');

      const formData = new FormData();
      formData.append('title', title);
      formData.append('category', category);
      formData.append('description', description);
      if (image) {
        formData.append('image', image);
      }

      await axios.post(`${API_URL}/tickets`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Ticket submitted successfully!', { id: toastId });

      setTitle('');
      setDescription('');
      setImage(null);
      document.getElementById('file-upload').value = '';

      fetchTickets();
    } catch (error) {
      console.error('Ticket submission failed — full error:', error);
      console.error('Ticket submission failed — server response:', error.response?.data);
      const serverMsg = error.response?.data?.message || error.message || 'Failed to submit ticket. Please try again.';
      toast.error(serverMsg, { id: toastId });
    }
  };

  const handleResolveTicket = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/tickets/${ticketId}`,
        { status: 'Resolved' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTickets(tickets.map(ticket =>
        ticket._id === ticketId ? { ...ticket, status: 'Resolved' } : ticket
      ));
      toast.success('Ticket marked as resolved!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to resolve ticket.');
    }
  };

  const handleDeleteTicket = async (ticketId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/tickets/${ticketId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTickets(tickets.filter(ticket => ticket._id !== ticketId));
      toast.success('Ticket deleted!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete ticket.');
    }
  };

  // ══════════════════════════════════════════════════
  //  RAZORPAY PAYMENT HANDLER
  // ══════════════════════════════════════════════════

  const handlePayment = async (billId, billAmount) => {
    const toastId = toast.loading('Initializing payment...');
    setProcessing(true);

    try {
      // Step 1: Dynamically load the Razorpay checkout script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error('Failed to load Razorpay SDK. Please try again.', { id: toastId });
        setProcessing(false);
        return;
      }

      // Step 2: Call POST /api/payments/create-order to get the order_id
      const token = localStorage.getItem('token');
      const orderResponse = await axios.post(
        `${API_URL}/payments/create-order`,
        { amount: billAmount, currency: 'INR', billId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { id: order_id, amount: orderAmount, currency } = orderResponse.data;

      // Step 3: Initialize window.Razorpay with order details
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        amount: orderAmount,
        currency,
        name: 'Apartment Management',
        description: `Payment for Bill ${billId}`,
        order_id,
        handler: async function (response) {
          // Step 4: Send response data to POST /api/payments/verify-payment
          try {
            const verifyResponse = await axios.post(
              `${API_URL}/payments/verify-payment`,
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
      console.error('Payment initiation failed — full error:', error);
      console.error('Payment initiation failed — server response:', error.response?.data);
      const serverMsg = error.response?.data?.message || error.message || 'Failed to initiate payment. Please try again.';
      toast.error(serverMsg, { id: toastId });
      setProcessing(false);
    }
  };

  // ══════════════════════════════════════════════════
  //  SHARED STYLES
  // ══════════════════════════════════════════════════

  const handleLogout = () => {
    localStorage.removeItem('token');
    toast.success('Logged out successfully');
    navigate('/');
  };

  const inputClass =
    'w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all';

  // ══════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">

      {/* ── Header ── */}
      <div className="max-w-4xl mx-auto flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Resident Dashboard</h1>
        <button
          onClick={handleLogout}
          className="bg-rose-500 hover:bg-rose-600 text-white px-5 py-2 rounded-xl font-medium transition-colors shadow-md shadow-rose-200"
        >
          Logout
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex gap-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              {tab.key === 'bills' && bills.length > 0 && (
                <span className="ml-2 bg-indigo-500/20 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-full">
                  {bills.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">

        {/* ═══════════════════════════════════════════ */}
        {/* TAB: Maintenance Tickets                   */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === 'tickets' && (
          <>
            {/* ── Report Issue Form ── */}
            <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
              <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">Report an Issue</h2>

              <form onSubmit={handleSubmitTicket} className="space-y-5">
                <div>
                  <input
                    type="text"
                    placeholder="Issue Title (e.g., Leaking Faucet)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={`${inputClass} cursor-pointer`}
                  >
                    <option value="Plumbing">Plumbing</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Carpentry">Carpentry</option>
                    <option value="Security">Security</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <textarea
                    rows="4"
                    placeholder="Describe the issue in detail..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={`${inputClass} resize-y`}
                    required
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Attach a Photo (Optional)</label>
                  <input
                    id="file-upload"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImage(e.target.files[0])}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold tracking-wide shadow-lg shadow-blue-200 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                >
                  Submit Ticket
                </button>
              </form>
            </div>

            {/* ── Tickets List ── */}
            <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 border-l-4 border-l-blue-600">
              {tickets.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No tickets found. Submit one above!</p>
              ) : (
                tickets.map(ticket => (
                  <div key={ticket._id} className="space-y-3 mb-8 pb-8 border-b border-slate-100 last:border-0 last:mb-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-slate-800">{ticket.title}</h3>
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-md uppercase tracking-wider ${ticket.status === 'Resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        ({ticket.status || 'Open'})
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-indigo-600">{ticket.category}</p>
                    <p className="text-slate-600 leading-relaxed">{ticket.description}</p>

                    {ticket.imageUrl && (
                      <div className="mt-4">
                        <img
                          src={ticket.imageUrl}
                          alt="Ticket issue"
                          className="max-w-full h-48 md:h-64 object-cover rounded-xl border border-slate-200 shadow-sm"
                        />
                      </div>
                    )}

                    <div className="flex gap-3 pt-4">
                      {ticket.status !== 'Resolved' && (
                        <button
                          onClick={() => handleResolveTicket(ticket._id)}
                          className="px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                        >
                          Mark as Resolved
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteTicket(ticket._id)}
                        className="px-4 py-2 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                      >
                        Delete Ticket
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* TAB: My Bills                              */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === 'bills' && (
          <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 mb-6">Your Bills</h2>

            {bills.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-slate-500 font-medium">No bills found. You're all clear!</p>
              </div>
            ) : (
              bills.map((bill) => (
                <div
                  key={bill._id}
                  className="space-y-3 mb-6 pb-6 border-b border-slate-100 last:border-0 last:mb-0 last:pb-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-slate-800">{bill.title || 'Maintenance Bill'}</h3>
                      <span
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md uppercase tracking-wider ${
                          bill.status === 'Paid'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {bill.status}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-indigo-600">₹{bill.amount}</p>
                  </div>

                  <p className="text-sm text-slate-500">
                    Due: <span className="font-semibold text-slate-700">{new Date(bill.dueDate).toLocaleDateString()}</span>
                  </p>

                  {bill.status === 'Pending' && (
                    <button
                      onClick={() => handlePayment(bill._id, bill.amount)}
                      disabled={processing}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold tracking-wide shadow-lg shadow-blue-200 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                    >
                      {processing ? 'Processing...' : `Pay ₹${bill.amount}`}
                    </button>
                  )}

                  {bill.status === 'Paid' && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
                        <span>✅</span>
                        <span>Paid</span>
                      </div>
                      {bill.receiptUrl && (
                        <a
                          href={`${API_BASE}${bill.receiptUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold tracking-wide shadow-lg shadow-emerald-200 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 no-underline"
                        >
                          📄 Download Receipt
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
