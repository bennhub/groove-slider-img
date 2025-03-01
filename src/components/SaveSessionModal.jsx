import React, { useState } from 'react';
import { X, Save } from 'lucide-react';

/**
 * Modal dialog for saving a session
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen Whether the modal is open
 * @param {Function} props.onClose Function to call when the modal is closed
 * @param {Function} props.onSave Function to call when the save button is clicked
 */
const SaveSessionModal = ({ isOpen, onClose, onSave }) => {
  const [sessionName, setSessionName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate input
    if (!sessionName.trim()) {
      setError('Please enter a session name');
      return;
    }
    
    try {
      setIsSaving(true);
      setError(null);
      
      // Call the onSave function with the session name
      await onSave(sessionName);
      
      // Reset form and close modal
      setSessionName('');
      onClose();
    } catch (err) {
      console.error('Error saving session:', err);
      setError('Failed to save session: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content save-session-modal">
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>
        
        <h3 className="modal-title">Save Session</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="session-name">Session Name:</label>
            <input
              type="text"
              id="session-name"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Enter a name for your session"
              autoFocus
              maxLength={50}
              className="session-name-input"
            />
          </div>
          
          {error && <div className="save-error">{error}</div>}
          
          <div className="modal-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            
            <button
              type="submit"
              className="save-button"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="spinner small"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Session
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SaveSessionModal;