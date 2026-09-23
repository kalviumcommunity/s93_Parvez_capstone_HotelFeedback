import { useEffect, useState } from 'react';
import Navbar from './components/navbar';
import FeedbackCard from './components/FeedbackCard';

function App() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [form, setForm] = useState({
    guestName: '',
    source: 'Google',
    rating: 5,
    comment: '',
  });
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState('Loading feedback...');

  useEffect(() => {
    fetch('http://localhost:5000/api/feedback')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load feedback');
        return response.json();
      })
      .then((result) => {
        setFeedbacks(result.data);
        setStatus('');
      })
      .catch((error) => setStatus(error.message));
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const isEditing = Boolean(editingId);
    setStatus(isEditing ? 'Updating feedback...' : 'Saving feedback...');

    try {
      const response = await fetch(`http://localhost:5000/api/feedback${isEditing ? `/${editingId}` : ''}`, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to save feedback');

      setFeedbacks((currentFeedbacks) => isEditing
        ? currentFeedbacks.map((item) => item._id === result.data._id ? result.data : item)
        : [result.data, ...currentFeedbacks]);
      setForm({ guestName: '', source: 'Google', rating: 5, comment: '' });
      setEditingId(null);
      setStatus(isEditing ? 'Feedback updated.' : 'Feedback saved to the database.');
    } catch (error) {
      setStatus(error.message);
    }
  };

  const handleEdit = (feedback) => {
    setEditingId(feedback._id);
    setForm({
      guestName: feedback.guestName,
      source: feedback.source,
      rating: feedback.rating,
      comment: feedback.comment,
    });
    setStatus('Editing feedback...');
  };

  const handleDelete = async (feedbackId) => {
    if (!window.confirm('Delete this feedback?')) return;
    setStatus('Deleting feedback...');

    try {
      const response = await fetch(`http://localhost:5000/api/feedback/${feedbackId}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to delete feedback');

      setFeedbacks((currentFeedbacks) => currentFeedbacks.filter((item) => item._id !== feedbackId));
      if (editingId === feedbackId) {
        setEditingId(null);
        setForm({ guestName: '', source: 'Google', rating: 5, comment: '' });
      }
      setStatus('Feedback deleted.');
    } catch (error) {
      setStatus(error.message);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ guestName: '', source: 'Google', rating: 5, comment: '' });
    setStatus('');
  };

  return (
    <div>
      <Navbar />
      <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <h3>Recent Guest Feedback</h3>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem', marginBottom: '2rem' }}>
          <input required placeholder="Guest name" value={form.guestName} onChange={(event) => setForm({ ...form, guestName: event.target.value })} />
          <select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })}>
            <option>Google</option>
            <option>TripAdvisor</option>
            <option>Booking.com</option>
            <option>Internal Survey</option>
          </select>
          <input required type="number" min="1" max="5" value={form.rating} onChange={(event) => setForm({ ...form, rating: Number(event.target.value) })} />
          <textarea required placeholder="Guest comment" value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} />
          <button type="submit">{editingId ? 'Update feedback' : 'Save feedback'}</button>
          {editingId && <button type="button" onClick={cancelEdit}>Cancel</button>}
        </form>
        {status && <p>{status}</p>}
        {feedbacks.map((item) => (
          <FeedbackCard key={item._id} {...item} onEdit={() => handleEdit(item)} onDelete={() => handleDelete(item._id)} />
        ))}
      </main>
    </div>
  );
}

export default App;