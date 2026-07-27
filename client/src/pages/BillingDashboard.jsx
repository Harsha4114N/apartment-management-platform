import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import API_BASE from '../config/api';

/**
 * Dynamically loads the Razorpay checkout script.
 * Returns a Promise that resolves once the script is ready.
 */
const loadRazorpayScript = () => {
  return new Promise((resolve, reject) => {
    // If already loaded, resolve immediately
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
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [processing, setProcessing] = useState(false);

  const API_URL = `${API_BASE}/api`;

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
    fetchBills();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  /**
   * Initiates the Razorpay checkout flow:
   * 1. Loads the Razorpay script
   * 2. Creates an order via POST /api/payments/create-order
   * 3. Opens the Razorpay payment modal
   * 4. On success, verifies the payment via POST /api/payments/verify-payment
   */
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
        {
          amount: billAmount,
          currency: 'INR',
          billId,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { id: order_id, amount: orderAmount, currency } = orderResponse.data;

      // Step 3: Initialize window.Razorpay with order details
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        amount: orderAmount,
        currency: currency,
        name: 'Apartment Management',
        description: `Payment for Bill ${billId}`,
        order_id: order_id,
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
            fetchBills(); // Refresh the bills list
          } catch (verifyError) {
            console.error('Payment verification failed:', verifyError);
            toast.error('Payment verification failed. Please contact support.', { id: toastId });
            setProcessing(false);
          }
        },
        prefill: {
          name: '',
          email: '',
          contact: '',
        },
        theme: {
          color: '#4f46e5',
        },
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    toast.success('Logged out successfully');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-3xl mx-auto flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Billing Dashboard</h1>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-slate-600 hover:bg-slate-700 text-white px-5 py-2 rounded-xl font-medium transition-colors shadow-md"
          >
            Dashboard
          </button>
          <button
            onClick={handleLogout}
            className="bg-rose-500 hover:bg-rose-600 text-white px-5 py-2 rounded-xl font-medium transition-colors shadow-md shadow-rose-200"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto space-y-8">
        {/* Bills List */}
        <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Your Bills</h2>

          {bills.length === 0 ? (
            <p className="text-slate-500 text-center py-4">No bills found.</p>
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

                {bill.status === 'Pending' && (
                  <button
                    onClick={() => handlePayment(bill._id, bill.amount)}
                    disabled={processing}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold tracking-wide shadow-lg shadow-blue-200 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    {processing ? 'Processing...' : `Pay ₹${bill.amount}`}
                  </button>
                )}

                {bill.status === 'Paid' && bill.receiptUrl && (
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}
