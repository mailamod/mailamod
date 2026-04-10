'use client';
import { useState, useEffect } from 'react';
import { initGoogleAuth, requestAccessToken, fetchUpcomingEvents, GOOGLE_CLIENT_ID } from '../lib/gcal';

export default function CalendarImportModal({ open, onClose, onImport, targetGroupName }) {
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setStatus('idle');
      setEvents([]);
      setSelected(new Set());
      setError('');
    }
  }, [open]);

  const isPlaceholder = GOOGLE_CLIENT_ID.startsWith('YOUR_GOOGLE_CLIENT_ID');

  const handleConnect = async () => {
    setStatus('loading');
    setError('');
    try {
      await initGoogleAuth();
      await requestAccessToken();
      const items = await fetchUpcomingEvents();
      setEvents(items);
      setStatus('ready');
    } catch (err) {
      setError(err.message || 'Failed to connect to Google Calendar');
      setStatus('error');
    }
  };

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleImport = () => {
    const picked = events.filter((e) => selected.has(e.id));
    onImport(picked);
    onClose();
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Import from Google Calendar</h3>
          <button className="close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {isPlaceholder && (
            <div className="note">
              <strong>Setup required:</strong> Set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in
              <code> .env.local</code> to your Google OAuth Client ID, or edit
              <code> app/lib/gcal.js</code>.
            </div>
          )}

          {status === 'idle' && (
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              Connect your Google account to import upcoming calendar events as tasks in
              <strong> {targetGroupName || 'the current group'}</strong>.
            </p>
          )}

          {status === 'loading' && <p>Loading events…</p>}

          {status === 'error' && (
            <p style={{ color: '#e74c3c', fontSize: '0.9rem' }}>Error: {error}</p>
          )}

          {status === 'ready' && events.length === 0 && (
            <p style={{ color: '#888' }}>No upcoming events found.</p>
          )}

          {status === 'ready' && events.length > 0 && (
            <ul className="event-list">
              {events.map((e) => (
                <li key={e.id}>
                  <input
                    type="checkbox"
                    checked={selected.has(e.id)}
                    onChange={() => toggle(e.id)}
                  />
                  <div className="event-text">
                    <div>{e.summary}</div>
                    <div className="event-time">{formatTime(e.start)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="modal-footer">
          <button className="secondary" onClick={onClose}>Cancel</button>
          {status === 'ready' ? (
            <button
              className="primary"
              onClick={handleImport}
              disabled={selected.size === 0}
            >
              Add {selected.size} task{selected.size === 1 ? '' : 's'}
            </button>
          ) : (
            <button
              className="primary"
              onClick={handleConnect}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Connecting…' : 'Connect Google'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
