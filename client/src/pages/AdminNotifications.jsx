import React, { useState } from 'react';

export default function AdminNotifications() {
  // State for form inputs
  const [sendTo, setSendTo] = useState('all'); // 'all' or 'specific'
  const [selectedResident, setSelectedResident] = useState('');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [message, setMessage] = useState('');

  // Dummy data for the right column (will eventually come from MongoDB)
  const recentNotifications = [
    {
      id: 1,
      title: 'Water Supply Maintenance',
      target: 'All Residents',
      date: '20/07/2026',
      message: 'Water supply will be interrupted between 2 PM and 4 PM.',
    }
  ];

  const handleSendNotification = (e) => {
    e.preventDefault();
    // This will later be connected to your Axios POST request
    console.log({ sendTo, selectedResident, notificationTitle, message });
    alert('Notification queued for delivery!');
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f3f4f6', minHeight: '100vh', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
      
      {/* LEFT COLUMN: Create Notification Form */}
      <div style={{ flex: '1 1 500px', backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '16px' }}>Create Notification</h2>
        
        <form onSubmit={handleSendNotification}>
          {/* Send To Toggle */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '8px', color: '#374151' }}>Send To</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setSendTo('all')}
                style={{
                  padding: '8px 16px', borderRadius: '4px', border: '1px solid #d1d5db', cursor: 'pointer',
                  backgroundColor: sendTo === 'all' ? '#2563eb' : '#ffffff',
                  color: sendTo === 'all' ? '#ffffff' : '#374151'
                }}
              >
                All Residents
              </button>
              <button
                type="button"
                onClick={() => setSendTo('specific')}
                style={{
                  padding: '8px 16px', borderRadius: '4px', border: '1px solid #d1d5db', cursor: 'pointer',
                  backgroundColor: sendTo === 'specific' ? '#2563eb' : '#ffffff',
                  color: sendTo === 'specific' ? '#ffffff' : '#374151'
                }}
              >
                Specific Resident
              </button>
            </div>
          </div>

          {/* Conditional Dropdown for Specific Resident */}
          {sendTo === 'specific' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '8px', color: '#374151' }}>Select Resident</label>
              <select 
                value={selectedResident}
                onChange={(e) => setSelectedResident(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                required
              >
                <option value="">Choose a resident...</option>
                <option value="flat_101">Flat 101 - John Doe</option>
                <option value="flat_102">Flat 102 - Jane Smith</option>
              </select>
            </div>
          )}

          {/* Title Input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '8px', color: '#374151' }}>Notification Title</label>
            <input
              type="text"
              placeholder="Enter a short notification title"
              value={notificationTitle}
              onChange={(e) => setNotificationTitle(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
              required
            />
          </div>

          {/* Message Textarea */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '8px', color: '#374151' }}>Message</label>
            <textarea
              rows="4"
              placeholder="Write the notification message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box', resize: 'vertical' }}
              required
            ></textarea>
          </div>

          {/* Submit Button */}
          <button type="submit" style={{ backgroundColor: '#2563eb', color: 'white', padding: '10px 24px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
            Send Notification
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: Recent Notifications */}
      <div style={{ flex: '1 1 400px', backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '4px' }}>Recent Notifications</h2>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '24px' }}>View notifications previously sent.</p>
        
        <div>
          {recentNotifications.map((note) => (
            <div key={note.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontWeight: 'bold', margin: 0 }}>{note.title}</h3>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{note.date}</span>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: '0 0 8px 0' }}>{note.target}</p>
              <p style={{ fontSize: '0.875rem', color: '#374151', margin: 0 }}>{note.message}</p>
              
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button style={{ padding: '4px 12px', fontSize: '0.75rem', color: '#2563eb', backgroundColor: '#eff6ff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Edit</button>
                <button style={{ padding: '4px 12px', fontSize: '0.75rem', color: '#dc2626', backgroundColor: '#fef2f2', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}   