import React from 'react';

function Navbar() {
  return (
    <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', backgroundColor: '#1e293b', color: '#fff' }}>
      <h2>HotelFeedback AI</h2>
      <ul style={{ display: 'flex', listStyle: 'none', gap: '1.5rem', margin: 0 }}>
        <li>Dashboard</li>
        <li>Reviews</li>
        <li>Action Desk</li>
        <li>Analytics</li>
      </ul>
    </nav>
  );
}

export default Navbar;