// src/components/ExportModal.jsx
import React, { useState } from 'react';
import { X, Share, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { initiateExport } from '../services/exportService';

// Custom Resolution Dropdown Component
const CustomResolutionDropdown = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const resolutions = [
    { value: "720x1280", label: "720p" },
    { value: "1080x1920", label: "1080p" },
    { value: "1440x2560", label: "2K" }
  ];

  const handleSelect = (newValue) => {
    onChange(newValue);
    setIsOpen(false);
  };

  return (
    <div className="custom-resolution-dropdown">
      <div 
        className="dropdown-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        {resolutions.find(res => res.value === value)?.label || value}
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
      {isOpen && (
        <div className="dropdown-list">
          {resolutions.map((resolution) => (
            <div
              key={resolution.value}
              className="dropdown-item"
              onClick={() => handleSelect(resolution.value)}
            >
              {resolution.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Export Modal Component
const ExportModal = ({
    isOpen,
    progress,
    message,
    onClose,
    onExport,
    isExporting,
    storyData,
  }) => {
    const [resolution, setResolution] = useState("1080x1920");
    const [isExportLoopEnabled, setIsExportLoopEnabled] = useState(false);
    const [exportLoopDuration, setExportLoopDuration] = useState(30);
    const [exportError, setExportError] = useState(null);
  
    // Export handler
    const handleExport = async () => {
      const exportConfig = {
        resolution,
        isExportLoopEnabled,
        exportLoopDuration,
      };
  
      try {
        setExportError(null);
  
        const exportData = {
          storyData,
          resolution,
          isExportLoopEnabled,
          exportLoopDuration,
        };
  
        const exportedFile = await initiateExport(exportData, exportConfig);
        
        onExport(exportedFile);
      } catch (error) {
        console.error('Export failed', error);
        
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
                <CustomResolutionDropdown
                  value={resolution}
                  onChange={setResolution}
                />
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