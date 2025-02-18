import React from 'react';
import StorySlider from './components/StorySlider';

function App({ installPrompt, onInstallClick }) {
  return (
    <div className="app-container">
      {installPrompt && (
        <button 
          onClick={onInstallClick}
          style={{
            position: 'fixed',
            top: '10px',
            right: '10px',
            zIndex: 1000,
            padding: '10px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Install App
        </button>
      )}
      <StorySlider />
    </div>
  );
}

export default App;