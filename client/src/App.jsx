import React from 'react';
import Navbar from './components/Navbar';
import FeedbackCard from './components/FeedbackCard';

function App() {
  const mockFeedbacks = [
    { id: 1, guestName: 'Sarah Jenkins', source: 'Google', rating: 5, comment: 'The check-in was seamless and housekeeping was exceptional!', sentiment: 'Positive' },
    { id: 2, guestName: 'Michael Brown', source: 'TripAdvisor', rating: 2, comment: 'Air conditioning was noisy and breakfast cold.', sentiment: 'Negative' },
    { id: 3, guestName: 'Anita Roy', source: 'Booking.com', rating: 3, comment: 'Average stay, good location but parking was tight.', sentiment: 'Neutral' },
  ];

  return (
    <div>
      <Navbar />
      <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <h3>Recent Guest Feedback</h3>
        {mockFeedbacks.map((item) => (
          <FeedbackCard key={item.id} {...item} />
        ))}
      </main>
    </div>
  );
}

export default App;