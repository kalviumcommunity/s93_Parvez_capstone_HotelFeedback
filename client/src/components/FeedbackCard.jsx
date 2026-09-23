import React from 'react';

function FeedbackCard({ guestName, source, rating, comment, sentiment, onEdit, onDelete }) {
  const getBadgeColor = (type) => {
    if (type === 'Positive') return '#22c55e';
    if (type === 'Negative') return '#ef4444';
    return '#f59e0b';
  };

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', margin: '1rem 0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0 }}>{guestName} <span style={{ fontSize: '0.8rem', color: '#64748b' }}>({source})</span></h4>
        <span style={{ backgroundColor: getBadgeColor(sentiment), color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem' }}>
          {sentiment}
        </span>
      </div>
      <p style={{ margin: '0.5rem 0', color: '#334155' }}>"{comment}"</p>
      <small style={{ color: '#64748b' }}>Rating: {rating} / 5</small>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <button type="button" onClick={onEdit}>Edit</button>
        <button type="button" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

export default FeedbackCard;