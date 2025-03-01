// src/components/ExportModal.jsx
import React, { useState } from 'react';
import { X, Share, Download } from 'lucide-react';
import { initiateExport } from '../services/exportService';

//--------------------------------------------
// Export Modal
//--------------------------------------------
const ExportModal = ({
    isOpen,
    progress,
    message,
    onClose,
    onExport,
    isExporting,
    // Add any additional props you might need for export
    storyData, // Assuming you pass the story data needed for export
  }) => {
    const [resolution, setResolution] = useState("1080x1920");
    const [isExportLoopEnabled, setIsExportLoopEnabled] = useState(false);
    const [exportLoopDuration, setExportLoopDuration] = useState(30);
    const [exportError, setExportError] = useState(null);
  
    // New export handler using Web Worker
    const handleExport = async () => {
      // Prepare export configuration
      const exportConfig = {
        resolution,
        isExportLoopEnabled,
        exportLoopDuration,
      };
  
      try {
        // Clear any previous errors
        setExportError(null);
  
        // Collect necessary data for export
        const exportData = {
          // Include all necessary data for export
          storyData, // Pass the full story data
          resolution,
          isExportLoopEnabled,
          exportLoopDuration,
          // Add any other required export parameters
        };
  
        // Start the export process
        const exportedFile = await initiateExport(exportData, exportConfig);
        
        // Call the original onExport with the exported file
        // This allows the parent component to handle final steps like download
        onExport(exportedFile);
      } catch (error) {
        console.error('Export failed', error);
        
        // Set error state to show user
        setExportError(error.message || 'Export failed. Please try again.');
      }
    };
  
    if (!isOpen) return null;
  
    return (
      <div className="modal-overlay">
        <div className="modal-content export-modal">
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
          {!isExporting ? (
            <>
              <h3 className="modal-title">Export Settings</h3>
  
              <div className="resolution-selector">
                <label>Resolution:</label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="resolution-select"
                >
                  <option value="720x1280">720p</option>
                  <option value="1080x1920">1080p</option>
                  <option value="1440x2560">2K</option>
                </select>
              </div>
  
              <div className="export-loop-settings">
                <div className="loop-toggle">
                  <label>
                    <span>Export as Loop</span>
                    <input
                      type="checkbox"
                      checked={isExportLoopEnabled}
                      onChange={() =>
                        setIsExportLoopEnabled(!isExportLoopEnabled)
                      }
                    />
                  </label>
                </div>
  
                {isExportLoopEnabled && (
                  <div className="input-container">
                    <label>Loop Duration (seconds):</label>
                    <input
                      type="number"
                      min="5"
                      max="300"
                      value={exportLoopDuration}
                      onChange={(e) =>
                        setExportLoopDuration(Number(e.target.value))
                      }
                      className="loop-duration-input"
                    />
                  </div>
                )}
              </div>
  
              {/* Error display */}
              {exportError && (
                <div className="export-error-message">
                  {exportError}
                </div>
              )}
  
              <div className="export-actions">
                <button
                  className="action-button share"
                  onClick={() => {
                    /* Share logic */
                  }}
                >
                  <Share className="button-icon" />
                  Share
                </button>
  
                <button
                  className="action-button download"
                  onClick={handleExport}
                >
                  <Download className="button-icon" />
                  Export
                </button>
              </div>
            </>
          ) : (
            <div className="loading-container">
              <h3>Exporting Video</h3>
              <p>{message}</p>
              <div className="progress-container">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="progress-text">{Math.round(progress)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };
  export default ExportModal;