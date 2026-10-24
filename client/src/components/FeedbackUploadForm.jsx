import { useState } from 'react';
import './FeedbackUploadForm.css';

const FEEDBACK_API = 'http://localhost:5000/api/feedback';
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read the selected file'));
    reader.readAsDataURL(file);
  });
}

export default function FeedbackUploadForm({ token, onCreated }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError('');

    if (selectedFile && selectedFile.size > MAX_FILE_SIZE) {
      setError('Choose a file smaller than 5 MB.');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        guestName: formData.get('guestName'),
        source: formData.get('source'),
        rating: Number(formData.get('rating')),
        comment: formData.get('comment'),
      };
      if (selectedFile) {
        payload.attachment = {
          fileName: selectedFile.name,
          data: await readFileAsDataUrl(selectedFile),
        };
      }

      const response = await fetch(FEEDBACK_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to save feedback');

      onCreated(result.data);
      form.reset();
      setSelectedFile(null);
    } catch (requestError) {
      setError(requestError.message || 'Unable to upload the selected file');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="feedback-upload" aria-labelledby="feedback-upload-title">
      <div className="feedback-upload-heading">
        <div>
          <p className="feedback-upload-eyebrow">NEW ENTRY</p>
          <h3 id="feedback-upload-title">Add guest feedback</h3>
        </div>
        <span className="feedback-upload-limit">Optional attachment · PNG, JPEG or PDF · 5 MB max</span>
      </div>

      <form className="feedback-upload-form" onSubmit={handleSubmit}>
        <label>
          Guest name
          <input name="guestName" type="text" maxLength={120} required />
        </label>
        <label>
          Source
          <select name="source" defaultValue="Internal Survey">
            <option>Internal Survey</option>
            <option>Google</option>
            <option>TripAdvisor</option>
            <option>Booking.com</option>
          </select>
        </label>
        <label>
          Rating
          <select name="rating" defaultValue="5">
            <option value="5">5 stars</option>
            <option value="4">4 stars</option>
            <option value="3">3 stars</option>
            <option value="2">2 stars</option>
            <option value="1">1 star</option>
          </select>
        </label>
        <label className="feedback-upload-comment">
          Guest comment
          <textarea name="comment" rows="3" maxLength={2000} required />
        </label>
        <label className="feedback-upload-file">
          Attach file
          <input
            name="attachment"
            type="file"
            accept="image/png,image/jpeg,application/pdf"
            onChange={(event) => setSelectedFile(event.target.files[0] || null)}
          />
          {selectedFile && <span className="feedback-upload-filename">{selectedFile.name}</span>}
        </label>
        {error && <p className="feedback-upload-error" role="alert">{error}</p>}
        <div className="feedback-upload-actions">
          <button type="submit" disabled={busy}>
            {busy ? 'Saving...' : 'Save feedback'}
          </button>
        </div>
      </form>
    </section>
  );
}