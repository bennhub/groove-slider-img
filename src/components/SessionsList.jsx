import React, { useState, useEffect } from 'react';
import { ChevronRight, Trash2, Clock } from 'lucide-react';
import { getAllSessions, deleteSession } from './indexedDBService';

/**
 * Component to display the list of saved sessions
 * 
 * @param {Object} props
 * @param {Function} props.onLoadSession Function to call when a session is selected for loading
 * @param {boolean} props.visible Whether the sessions list is visible
 */
const SessionsList = ({ onLoadSession, visible }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load sessions on component mount or when visibility changes
  useEffect(() => {
    if (visible) {
      loadSessions();
    }
  }, [visible]);

  // Function to load all sessions from IndexedDB
  const loadSessions = async () => {
    try {
      setLoading(true);
      const allSessions = await getAllSessions();
      
      // Filter out auto-save sessions
      const userSessions = allSessions.filter(session => 
        !session.name.startsWith("auto_save_")
      );
      
      // Sort sessions by creation date (newest first)
      userSessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setSessions(userSessions);
      setError(null);
    } catch (err) {
      console.error('Error loading sessions:', err);
      setError('Failed to load saved sessions');
    } finally {
      setLoading(false);
    }
  };

  // Function to handle session deletion
  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation(); // Prevent triggering the session load
    
    if (window.confirm('Are you sure you want to delete this session?')) {
      try {
        await deleteSession(sessionId);
        // Update the list after deletion
        setSessions(sessions.filter(session => session.id !== sessionId));
      } catch (err) {
        console.error('Error deleting session:', err);
        alert('Failed to delete session');
      }
    }
  };

  // Format the date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!visible) return null;

  return (
    <div className="sessions-list">
      <h3 className="sessions-title">Saved Sessions</h3>
      
      {loading && <div className="sessions-loading">Loading saved sessions...</div>}
      
      {error && <div className="sessions-error">{error}</div>}
      
      {!loading && sessions.length === 0 && (
        <div className="sessions-empty">
          <p>No saved sessions yet</p>
          <p className="sessions-hint">Create a slideshow and click Save to add one</p>
        </div>
      )}
      
      {!loading && sessions.length > 0 && (
        <ul className="sessions-items">
          {sessions.map(session => (
            <li 
              key={session.id} 
              className="session-item"
              onClick={() => onLoadSession(session.id)}
            >
              <div className="session-info">
                <div className="session-name">{session.name}</div>
                <div className="session-date">
                  <Clock size={12} />
                  <span>{formatDate(session.createdAt)}</span>
                </div>
                <div className="session-details">
                  <span>{session.bpm} BPM</span>
                  <span>{session.duration.toFixed(1)}s/slide</span>
                </div>
              </div>
              <div className="session-actions">
                <button 
                  className="session-delete-btn"
                  onClick={(e) => handleDeleteSession(e, session.id)}
                  title="Delete session"
                >
                  <Trash2 size={16} />
                </button>
                <ChevronRight size={16} className="session-arrow" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SessionsList;