import { useRef, useState } from 'react';
import './FeedbackUploadForm.css';

const API_BASE = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? window.location.origin
    : 'http://localhost:5000'
);
const FEEDBACK_API = `${API_BASE}/api/feedback`;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'application/pdf'];

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
  const fileInputRef = useRef(null);

  function validateFile(file) {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return 'Unsupported file type. Choose a PNG, JPEG, or PDF file.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File is too large. Choose a file no larger than 5 MB.';
    }
    return '';
  }

  function handleFileChange(event) {
    const file = event.currentTarget.files?.[0] || null;
    setError('');
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      event.currentTarget.value = '';
      setSelectedFile(null);
      setError(validationError);
      return;
    }
    setSelectedFile(file);
  }

  function clearSelectedFile() {
    if (fileInputRef.current) fileInputRef.current.value = '';
    setSelectedFile(null);
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError('');

    if (selectedFile) {
      const validationError = validateFile(selectedFile);
      if (validationError) {
        setError(validationError);
        return;
      }
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
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.message || `Upload failed (${response.status}). Check the file and try again.`);
      }
      if (!result?.data) throw new Error('The server response was incomplete. Please try again.');

      onCreated(result.data);
      form.reset();
      setSelectedFile(null);
    } catch (requestError) {
      setError(requestError instanceof TypeError
        ? 'Unable to reach the API. Check that the server is running and try again.'
        : requestError.message || 'Unable to upload the selected file');
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
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          {selectedFile && <span className="feedback-upload-filename">{selectedFile.name}</span>}
          {selectedFile && (
            <button className="feedback-upload-clear" type="button" onClick={clearSelectedFile}>
              Remove selected file
            </button>
          )}
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