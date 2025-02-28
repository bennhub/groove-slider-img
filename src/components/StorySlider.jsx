//==============================================
// IMPORTS
//==============================================
import React, { useState, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  X,
  Save,
  Loader,
  ImagePlus,
  Clock,
  Play,
  Pause,
  Edit,
  Share,
  Download,
  Music,
  Volume,
  Info,
} from "lucide-react";
//import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

// WavformVisualizer
import WaveformVisualizer from './WaveformVisualizer';

// Beat detect
import { analyze } from "web-audio-beat-detector";

//==============================================
// DEVICE DETECTION
//==============================================
const useDeviceType = () => {
  const [isTablet, setIsTablet] = useState(false);
  
  useEffect(() => {
    const checkDevice = () => {
      // Check if device is likely a tablet (width >= 768px or tablet in user agent)
      const tabletWidth = window.innerWidth >= 768;
      const tabletUserAgent = /iPad|Android(?!.*Mobile)|Tablet/i.test(navigator.userAgent);
      setIsTablet(tabletWidth || tabletUserAgent);
    };
    
    // Check initially
    checkDevice();
    
    // Check on resize
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);
  
  return isTablet;
};

//==============================================
// UTILITIES / SERVICES
//==============================================
const ffmpeg = new FFmpeg({
  log: true,
  corePath: "https://unpkg.com/@ffmpeg/core@0.12.4/dist/ffmpeg-core.js",
  wasmPath: "https://unpkg.com/@ffmpeg/core@0.12.4/dist/ffmpeg-core.wasm",
});

// Add this function right after the ffmpeg configuration
const loadFFmpeg = async () => {
  try {
    console.log("Starting FFmpeg load...");

    // Explicitly set full URLs for core and wasm
    await ffmpeg.load({
      corePath:
        "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.15/dist/ffmpeg-core.js",
      wasmPath:
        "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.15/dist/ffmpeg-core.wasm",
    });

    console.log("FFmpeg loaded successfully");
  } catch (error) {
    console.error("FFmpeg load error:", error);

    // More detailed error logging
    if (error instanceof Error) {
      console.error({
        message: error.message,
        name: error.name,
        stack: error.stack,
        cause: error.cause,
      });
    }

    // Optionally, show a user-friendly error
    alert("Failed to load FFmpeg. Please check your internet connection.");

    throw error;
  }
};

//==============================================
// LANDING PAGE COMPONENT
//==============================================
const GrooveGalleryLanding = ({ onCreateSlideshow }) => {
  return (
    <div className="landing-wrapper">
      <div className="landing-container">
        {/* Header with app title and info button only */}
        <div className="landing-header">
          <button className="info-button">
            <span
              style={{
                width: 24,
                height: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                border: "1px solid white",
                fontSize: "16px",
              }}
            >
              i
            </span>
          </button>
          <h1 className="app-title">The Groove Gallery</h1>
          {/* No clear button here */}
        </div>

        {/* Main background with 70's style patterns */}
        <div className="retro-background">
          <div className="wave-pattern top"></div>
          <div className="wave-pattern bottom"></div>

          {/* Central action button */}
          <button className="create-button" onClick={onCreateSlideshow}>
            CREATE A SLIDESHOW
          </button>
        </div>

        {/* Featured Style Section */}
        <div className="featured-section">
          <h2 className="section-title">Slide Shows that Groove to the Beat</h2>

          <div className="style-card">
            <div className="style-preview">
              <div className="style-overlay">
                <div className="style-name">Welcome to The Groove Gallery</div>
              </div>
            </div>
            <button className="use-style-button">
              <Music size={18} />
              <span>Beat match music to your photo gallery</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
//==============================================
// TAP TEMPO COMPONENT
//==============================================
const TapTempo = ({ onBPMChange, isAnalyzing }) => {
  const [taps, setTaps] = useState([]);
  const [currentBPM, setCurrentBPM] = useState(0);

  const handleTap = () => {
    const now = Date.now();
    const newTaps = [...taps, now].slice(-4); // Keep last 4 taps
    setTaps(newTaps);

    if (newTaps.length > 1) {
      const intervals = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }
      const averageInterval =
        intervals.reduce((a, b) => a + b) / intervals.length;
      const bpm = Math.round(60000 / averageInterval);

      if (bpm >= 60 && bpm <= 180) {
        setCurrentBPM(bpm);
        onBPMChange(bpm);
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (taps.length > 0 && Date.now() - taps[taps.length - 1] > 2000) {
        setTaps([]);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [taps]);
  
  return (
    <div className="tap-tempo">
      <button onClick={handleTap} className="tap-button">
        Tap Tempo
        <span className="bpm-text">
          {currentBPM > 0 ? `${currentBPM} BPM` : ""}
        </span>
      </button>
      
      {isAnalyzing && (
        <div className="bpm-analyzer">
          <div className="spinner"></div>
          <span>Analyzing beat...</span>
        </div>
      )}
    </div>
  );
};

//==============================================
// MUSIC PANEL COMPONENT
//==============================================
const MusicPanel = ({
  onUpload,
  onBPMChange,
  currentBPM,
  onStartPointChange,
  audioRef,
  musicUrl,
  musicStartPoint,
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [duration, setDuration] = useState(0);
  const controlsRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  //BPM detection handler
  const detectBPM = async (audioUrl) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Get the initial tempo
      const detectedTempo = await analyze(audioBuffer);
      
      // If the detected tempo is above 140, it's likely double-time
      // Adjust these thresholds based on your typical music library
      if (detectedTempo > 140) {
        return Math.round(detectedTempo / 2);
      }
      
      return Math.round(detectedTempo);
    } catch (error) {
      console.error("BPM detection failed:", error);
      return 120; // Default fallback BPM
    }
  };

  // Time Update handler
  const handleTimeUpdate = () => {
    if (controlsRef.current) {
      setCurrentTime(controlsRef.current.currentTime);
    }
  };

  useEffect(() => {
    if (controlsRef.current && audioRef.current) {
      controlsRef.current.addEventListener("timeupdate", handleTimeUpdate);
      controlsRef.current.addEventListener("timeupdate", (e) => {
        audioRef.current.currentTime = e.target.currentTime;
      });

      controlsRef.current.addEventListener("loadedmetadata", () => {
        setDuration(controlsRef.current.duration);
      });
    }

    return () => {
      if (controlsRef.current && audioRef.current) {
        controlsRef.current.removeEventListener("timeupdate", handleTimeUpdate);
        controlsRef.current.removeEventListener("timeupdate", (e) => {
          audioRef.current.currentTime = e.target.currentTime;
        });
      }
    };
  }, [audioRef, controlsRef]);

  const handlePlayPause = () => {
    if (controlsRef.current) {
      if (isPlaying) {
        controlsRef.current.pause();
      } else {
        controlsRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="music-panel">
      <div className="music-controls">
        <div className="music-upload">
          <label className="upload-button">
            <Music className="icon" />
            <span>Upload Music</span>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const url = URL.createObjectURL(file);
                  setFileName(file.name);
                  setIsAnalyzing(true); // Show analyzing indicator
                  
                  // Start BPM detection
                  detectBPM(url)
                    .then((detectedBPM) => {
                      console.log(`Detected BPM: ${detectedBPM}`);
                      onBPMChange(detectedBPM);
                      setIsAnalyzing(false); // Hide analyzing indicator
                    })
                    .catch(err => {
                      console.error("BPM detection failed:", err);
                      setIsAnalyzing(false); // Hide analyzing indicator
                    });
                  
                  onUpload(url);
                }
              }}
              className="hidden-input"
            />
          </label>
        </div>

        <div className="bpm-control">
          <TapTempo onBPMChange={onBPMChange} />
          {isAnalyzing && (
            <div className="bpm-analyzer">
              <Loader className="spinner" size={18} />
              <span>Analyzing beat...</span>
            </div>
          )}
          <div className="manual-bpm">
          <label>
          <span>AUTO-BPM</span>
          <span>DETECTION:</span>
          </label>
            <input
              type="number"
              min="60"
              max="180"
              value={currentBPM}
              onChange={(e) => onBPMChange(parseInt(e.target.value))}
              className="bpm-input"
            />
          </div>
        </div>

        <div className="music-player">
          <audio
            ref={controlsRef}
            src={musicUrl}
            onTimeUpdate={handleTimeUpdate}
          />

          {musicUrl && (
            <div className="music-info">
              <span>{fileName || "Track Title"}</span>
            </div>
          )}

          <button className="audio-control-button" onClick={handlePlayPause}>
            {isPlaying ? <Pause size={32} /> : <Play size={32} />}
          </button>

          {/* Add waveform visualizer here */}
          {musicUrl && (
    <WaveformVisualizer 
    audioUrl={musicUrl}
    audioRef={audioRef}
    onStartPointChange={(time) => {
      onStartPointChange(time);
      if (controlsRef.current) {
        controlsRef.current.currentTime = time;
      }
    }}
    musicStartPoint={musicStartPoint}
  />
  )}

          {/* Simple audio progress display - without start point marker */}
          <div className="audio-progress">
            <div className="time-display">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={(e) => {
                const time = parseFloat(e.target.value);
                if (controlsRef.current) {
                  controlsRef.current.currentTime = time;
                }
              }}
              className="progress-slider"
            />
          </div>

          <div className="volume-control">
            <Volume size={20} />
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => {
                const vol = parseFloat(e.target.value);
                if (controlsRef.current) {
                  controlsRef.current.volume = vol;
                }
                setVolume(vol);
              }}
              className="volume-slider"
            />
          </div>

          {/* Removed the old start-point-controls section */}
        </div>
      </div>
    </div>
  );
};

//==============================================
// PROGRESS BAR COMPONENT
//==============================================
const ProgressBar = ({ currentIndex, totalSlides, onProgressClick }) => {
  return (
    <div className="progress-container">
      {[...Array(totalSlides)].map((_, index) => (
        <div
          key={index}
          className={`progress-bar ${index === currentIndex ? "active" : ""}`}
          onClick={() => onProgressClick(index)}
        />
      ))}
    </div>
  );
};

//==============================================
// NAVIGATION BUTTONS
//==============================================
const NavigationButtons = ({
  onPrevious,
  onNext,
  isFirstSlide,
  isLastSlide,
}) => {
  return (
    <>
      <button
        onClick={onPrevious}
        className="nav-button prev"
        disabled={isFirstSlide}
      >
        <ChevronLeft />
      </button>

      <button
        onClick={onNext}
        className="nav-button next"
        disabled={isLastSlide}
      >
        <ChevronRight />
      </button>
    </>
  );
};

//==============================================
// EMPTY STATE COMPONENT
//==============================================
const EmptyState = ({ onFileUpload }) => {
  return (
    <div className="empty-state">
      <label htmlFor="file-upload" className="file-upload-label">
        <PlusCircle size={48} />
        <span>Add Images</span>
        <input
          type="file"
          id="file-upload"
          accept="image/*"
          multiple
          onChange={onFileUpload}
          className="hidden-input"
        />
      </label>
    </div>
  );
};

//==============================================
// MODAL COMPONENTS
//==============================================

//--------------------------------------------
// Progress Modal
//--------------------------------------------
const ProgressModal = ({ isOpen, progress, message }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content export-progress">
        <div className="loading-container">
          <h3 className="progress-title">{message}</h3>
          <div className="progress-bar-container">
            <div
              className="progress-bar-fill"
              style={{
                width: `${progress || 0}%`,
                transition: "width 0.3s ease-in-out",
              }}
            />
          </div>
          <div className="progress-percentage">
            {Math.round(progress || 0)}%
          </div>
        </div>
      </div>
    </div>
  );
};

//--------------------------------------------
// Caption Modal
//--------------------------------------------
const ShareNotification = ({ isVisible, onClose }) => {
  if (!isVisible) return null;

  return (
    <div className="share-notification">
      <div className="share-content">
        <h3>Export Complete! 🎉</h3>
        <p>Share your creation:</p>
        <div className="share-buttons">
          <button
            onClick={() => window.open("https://instagram.com", "_blank")}
            className="share-button instagram"
          >
            Share to Instagram
          </button>
          <button
            onClick={() => window.open("https://tiktok.com", "_blank")}
            className="share-button tiktok"
          >
            Share to TikTok
          </button>
        </div>
        <button onClick={onClose} className="close-notification">
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

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
}) => {
  const [resolution, setResolution] = useState("1080x1920");
  const [isExportLoopEnabled, setIsExportLoopEnabled] = useState(false);
  const [exportLoopDuration, setExportLoopDuration] = useState(30);

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
                onClick={() =>
                  onExport({
                    resolution,
                    isExportLoopEnabled,
                    exportLoopDuration,
                  })
                }
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

//--------------------------------------------
// Edit Panel Component
//--------------------------------------------
// Edit Panel Component
const EditPanel = ({ stories, onClose, onReorder, onDelete }) => {
  const [positions, setPositions] = useState(
    stories.map((_, index) => index + 1)
  );
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Handle tap selection
  const handleTapSelect = (index) => {
    setSelectedIndex(selectedIndex === index ? null : index);
  };

  // Enhanced drag handlers
  const handleDragStart = (e, index) => {
    if (selectedIndex === index) {
      setIsDragging(true);
      e.currentTarget.style.cursor = 'grabbing';
    }
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (isDragging && selectedIndex !== null && selectedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (targetIndex) => {
    if (selectedIndex !== null && selectedIndex !== targetIndex) {
      // Perform the reorder
      const newStories = [...stories];
      const [movedItem] = newStories.splice(selectedIndex, 1);
      newStories.splice(targetIndex, 0, movedItem);
      
      // Update positions
      const updatedPositions = newStories.map((_, i) => i + 1);
      setPositions(updatedPositions);
      onReorder(newStories);
      
      // Reset states
      setSelectedIndex(null);
      setDragOverIndex(null);
      setIsDragging(false);
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDragOverIndex(null);
  };

  return (
    <div className="edit-panel">
      <div className="edit-panel-header">
        <h3>Re-order (select, drag, drop, tap)</h3>
        <button className="edit-panel-close" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="thumbnails-container">
        {stories.map((story, index) => (
          <div 
            key={index} 
            className={`thumbnail ${selectedIndex === index ? 'selected' : ''} 
                       ${dragOverIndex === index ? 'drag-over' : ''}`}
            onClick={() => handleTapSelect(index)}
            onMouseDown={(e) => handleDragStart(e, index)}
            onTouchStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onMouseOver={(e) => isDragging && handleDragOver(e, index)}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              const target = document.elementFromPoint(touch.clientX, touch.clientY);
              const thumbnailEl = target.closest('.thumbnail');
              if (thumbnailEl) {
                const idx = Array.from(thumbnailEl.parentNode.children).indexOf(thumbnailEl);
                handleDragOver(e, idx);
              }
            }}
            onMouseUp={() => handleDrop(index)}
            onTouchEnd={() => dragOverIndex !== null && handleDrop(dragOverIndex)}
            draggable={selectedIndex === index}
          >
            <div className="thumbnail-content">
              <button
                className="delete-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(index);
                }}
              >
                <X size={16} />
              </button>
              <div className="image-thumbnail">
                <img src={story.url} alt={`Slide ${index + 1}`} />
                {selectedIndex === index && (
                  <div className="selection-dot" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

//==============================================
// BOTTOM MENU COMPONENT
//==============================================
const BottomMenu = ({
  onFileUpload,
  onSaveSession,
  onPlayPause,
  isPlaying,
  duration,
  onDurationChange,
  onEdit,
  onMusicUpload,
  onBPMChange,
  musicUrl,
  bpm,
  onStartPointChange,
  musicStartPoint,
  audioRef,
  isLoopingEnabled,
  setIsLoopingEnabled,
  showEditPanel,
  setShowEditPanel,
  stories,
  setStories,
  handleDelete,
  handleReorder,
}) => {
  const [showDurationPanel, setShowDurationPanel] = useState(false);
  const [showMusicPanel, setShowMusicPanel] = useState(false);
  const [selectedBar, setSelectedBar] = useState(1);

  useEffect(() => {
    const barOptions = [0.125, 0.25, 0.5, 1, 2, 4, 8, 16];
    const matchedBar = barOptions.find(
      (option) => Math.abs((duration * bpm) / (4 * 60) - option) < 0.01
    );
    if (matchedBar) {
      setSelectedBar(matchedBar);
    }
  }, [duration, bpm]);

  // Calculate duration based on BPM and selected bar length
  const calculateDuration = (bars, bpm) => {
    // Duration = (bars * beats per bar * seconds per beat)
    // 4 beats per bar (assuming 4/4 time)
    // seconds per beat = 60/bpm
    return (bars * 4 * 60) / bpm;
  };

  const handleBarChange = (bars) => {
    setSelectedBar(bars);
    const newDuration = calculateDuration(bars, currentBPM);
    onDurationChange(newDuration);
  };

  const barOptions = [
    { value: 0.125, label: "⅛ Bar" },
    { value: 0.25, label: "¼ Bar" },
    { value: 0.5, label: "½ Bar" },
    { value: 1, label: "1 Bar" },
    { value: 2, label: "2 Bars" },
    { value: 4, label: "4 Bars" },
    { value: 8, label: "8 Bars" },
    { value: 16, label: "16 Bars" },
  ];

  // Function to toggle duration panel
  const toggleDurationPanel = () => {
    setShowDurationPanel(!showDurationPanel);
    if (showMusicPanel) setShowMusicPanel(false);
    if (showEditPanel) setShowEditPanel(false);
  };

  // Function to toggle music panel
  const toggleMusicPanel = () => {
    setShowMusicPanel(!showMusicPanel);
    if (showDurationPanel) setShowDurationPanel(false);
    if (showEditPanel) setShowEditPanel(false);
  };

  // Function to toggle edit panel
  const toggleEditPanel = () => {
    setShowEditPanel(!showEditPanel);
    if (showDurationPanel) setShowDurationPanel(false);
    if (showMusicPanel) setShowMusicPanel(false);
  };

  return (
    <div className="bottom-menu w-full flex flex-col items-stretch">
      {showDurationPanel && (
        <div className="duration-panel">
          <div className="duration-controls">
            <h3>Bar-Based Slide Transitions</h3>
            <div className="bar-options">
              {[
                { value: 0.125, label: "⅛ Bar" },
                { value: 0.25, label: "¼ Bar" },
                { value: 0.5, label: "½ Bar" },
                { value: 1, label: "1 Bar" },
                { value: 2, label: "2 Bars" },
                { value: 4, label: "4 Bars" },
                { value: 8, label: "8 Bars" },
                { value: 16, label: "16 Bars" },
              ].map((option) => (
                <button
                  key={option.value}
                  className={`bar-option ${
                    selectedBar === option.value ? "selected" : ""
                  }`}
                  onClick={() => {
                    const newDuration = calculateDuration(option.value, bpm);
                    setSelectedBar(option.value);
                    onDurationChange(newDuration);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="duration-info">
              <span>Current Duration: {duration.toFixed(2)}s</span>
              <span className="bpm-info">at {bpm} BPM</span>
            </div>
            <div className="loop-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={isLoopingEnabled}
                  onChange={() => setIsLoopingEnabled(!isLoopingEnabled)}
                />
                Loop Slideshow
              </label>
            </div>
          </div>
        </div>
      )}

      {showMusicPanel && (
        <MusicPanel
        audioRef={audioRef}
        onUpload={onMusicUpload}
        onBPMChange={onBPMChange}
        currentBPM={bpm}
        onStartPointChange={onStartPointChange}
        musicStartPoint={musicStartPoint}
        musicUrl={musicUrl}
      />
      )}

      {showEditPanel && (
        <EditPanel
          stories={stories}
          onClose={() => setShowEditPanel(false)}
          onReorder={(newStories) => {
            setStories(newStories);
            handleReorder(newStories);  // This will trigger the auto-restart
          }}
          onDelete={handleDelete}
        />
      )}

      <div className="bottom-menu-buttons">
        <button
          className={`bottom-menu-button ${showDurationPanel ? "active" : ""}`}
          onClick={toggleDurationPanel}
        >
          <Clock className="bottom-menu-icon" />
          <span className="bottom-menu-text">Speed</span>
        </button>

        <button
          className={`bottom-menu-button ${showMusicPanel ? "active" : ""}`}
          onClick={toggleMusicPanel}
        >
          <Music className="bottom-menu-icon" />
          <span className="bottom-menu-text">Music</span>
        </button>

        <button
          className={`bottom-menu-button ${isPlaying ? "active" : ""}`}
          onClick={onPlayPause}
        >
          {isPlaying ? (
            <Pause className="bottom-menu-icon" />
          ) : (
            <Play className="bottom-menu-icon" />
          )}
          <span className="bottom-menu-text">
            {isPlaying ? "Pause" : "Play"}
          </span>
        </button>

        <div className="bottom-menu-right-group">
          <button
            className={`bottom-menu-button ${showEditPanel ? "active" : ""}`}
            onClick={toggleEditPanel}
          >
            <Edit className="bottom-menu-icon" />
            <span className="bottom-menu-text">Edit</span>
          </button>

          <label className="bottom-menu-button">
            <ImagePlus className="bottom-menu-icon" />
            <span className="bottom-menu-text">Add</span>
            <input
              type="file"
              id="file-upload-bottom"
              accept="image/*"
              multiple
              onChange={onFileUpload}
              className="hidden-input"
            />
          </label>

          <button className="bottom-menu-button" onClick={onSaveSession}>
            <Save className="bottom-menu-icon" />
            <span className="bottom-menu-text">Export</span>
          </button>
        </div>
      </div>
    </div>
  );
};

//==============================================
// STORY SLIDER COMPONENT - State & Handlers
//==============================================
const StorySlider = () => {
  const [showLanding, setShowLanding] = useState(true);
  // Core State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stories, setStories] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(2);

  // UI State
  const [modalOpen, setModalOpen] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);

  // Notifications State
  const [showShareNotification, setShowShareNotification] = useState(false);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [saveProgress, setSaveProgress] = useState(null);
  const [progressMessage, setProgressMessage] = useState("");
  const [showProgress, setShowProgress] = useState(false);

  // Music State
  const [musicUrl, setMusicUrl] = useState(null);
  const [bpm, setBpm] = useState(120);
  const [musicStartPoint, setMusicStartPoint] = useState(0);

  // Looping State
  const [isLoopingEnabled, setIsLoopingEnabled] = useState(false);

  // Image Preload
  const [preloadedImages, setPreloadedImages] = useState({});

  // Touch State
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Refs
  const audioRef = useRef(null);
  const intervalRef = useRef(null);

  //Slieshow a
  const handleStartSlideshow = () => {
    setShowLanding(false);
  };

  // Image Preload
  const preloadImage = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = reject;
      img.src = url;
    });
  };

  // Add this useEffect to preload adjacent images
  useEffect(() => {
    const preloadAdjacentImages = async () => {
      const indicesToPreload = [
        currentIndex - 1,
        currentIndex,
        currentIndex + 1,
      ].filter((index) => index >= 0 && index < stories.length);

      for (const index of indicesToPreload) {
        if (!preloadedImages[stories[index].url]) {
          try {
            await preloadImage(stories[index].url);
            setPreloadedImages((prev) => ({
              ...prev,
              [stories[index].url]: true,
            }));
          } catch (error) {
            console.error("Failed to preload image:", error);
          }
        }
      }
    };

    if (stories.length > 0) {
      preloadAdjacentImages();
    }
  }, [currentIndex, stories]);

  // Load FFmpeg on mount
  useEffect(() => {
    loadFFmpeg().catch(console.error);
  }, []);

  // Handle file uploads
  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files).filter((file) =>
      file.type.startsWith("image/")
    );

    if (files.length === 0) {
      alert("Please select image files only.");
      return;
    }

    const newStories = files.map((file) => ({
      type: "image",
      url: URL.createObjectURL(file),
    }));

    setStories((prevStories) => [...prevStories, ...newStories]);
    event.target.value = "";
  };

  // Music handlers
  const handleMusicUpload = (url) => {
    setMusicUrl(url);
    setMusicStartPoint(0); // Reset start point to beginning
    
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.currentTime = 0; // Ensure audio starts from beginning
    }
  };

  const handleBPMChange = (newBPM) => {
    setBpm(newBPM);
    const barOptions = [0.125, 0.25, 0.5, 1, 2, 4, 8, 16];
    const currentBarOption =
      barOptions.find(
        (option) => Math.abs((duration * newBPM) / (4 * 60) - option) < 0.01
      ) || 1;
    const newDuration = (currentBarOption * 4 * 60) / newBPM;
    setDuration(newDuration);
  };

  // Playback control
  const startAutoRotation = () => {
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        // If we're not looping and at the last slide
        if (!isLoopingEnabled && prevIndex >= stories.length - 1) {
          stopAutoRotation();
          setIsPlaying(false);
          // Stop music if it's playing
          if (audioRef.current) {
            audioRef.current.pause();
          }
          return prevIndex;
        }
        return (prevIndex + 1) % stories.length;
      });
    }, duration * 1000);
  };

  const stopAutoRotation = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      stopAutoRotation();
      if (audioRef.current) {
        audioRef.current.pause();
      }
    } else {
      if (currentIndex === stories.length - 1) {
        setCurrentIndex(0);
      }
      startAutoRotation();
      if (audioRef.current && musicUrl) {
        // Start from the stored musicStartPoint
        audioRef.current.currentTime = musicStartPoint;
        audioRef.current.play().catch((err) => console.log("Play error:", err));
      }
    }
    setIsPlaying((prev) => !prev);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAutoRotation();
  }, []);

  // Sync duration changes
  useEffect(() => {
    if (isPlaying) {
      stopAutoRotation();
      startAutoRotation();
    }
  }, [duration]);

  // Clear Session
  const handleClearSession = () => {
    if (
      window.confirm(
        "Are you sure you want to clear all content and start fresh?"
      )
    ) {
      // Clear images
      setStories([]);
      // Reset index
      setCurrentIndex(0);
      // Clear music
      setMusicUrl(null);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      // Reset playback state
      setIsPlaying(false);
      // Reset other states
      setBpm(120);
      setMusicStartPoint(0);
      setDuration(2);
      setIsLoopingEnabled(false);
    }
  };

  //==============================================
  // STORY SLIDER COMPONENT - Render & Export Logic
  //==============================================

  // Navigation handlers
  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Touch handlers
  const handleTouchStart = (e) => setTouchStart(e.touches[0].clientX);
  const handleTouchMove = (e) => setTouchEnd(e.touches[0].clientX);
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentIndex < stories.length - 1) handleNext();
    if (isRightSwipe && currentIndex > 0) handlePrevious();

    setTouchStart(null);
    setTouchEnd(null);
  };

  // Handle Reorder
  const handleReorder = (newStories) => {
    // Stop current playback if it's playing
    if (isPlaying) {
      stopAutoRotation();
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }

    // Update state synchronously
    setCurrentIndex(0); // Reset to first position
    setStories(newStories);
  };

  // Handle Delete
const handleDelete = (index) => {
  const newStories = stories.filter((_, i) => i !== index);
  setStories(newStories);
  if (currentIndex >= index) {
    setCurrentIndex(Math.max(0, currentIndex - 1));
  }
};

  // Export functionality
  const handleSaveSession = async (exportSettings) => {
    // Destructure export settings with default values
    const {
      resolution = "1080x1920",
      isExportLoopEnabled = false,
      exportLoopDuration = 0,
    } = exportSettings;

    try {
      let fileHandle;
      let fileName = "slideshow.mp4";

      // Existing file handle logic remains the same
      if (!("showSaveFilePicker" in window)) {
        const link = document.createElement("a");
        link.download = fileName;
        fileHandle = {
          createWritable: async () => {
            return {
              write: async (data) => {
                const url = URL.createObjectURL(
                  new Blob([data], { type: "video/mp4" })
                );
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
              },
              close: async () => {},
            };
          },
        };
      } else {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [
            { description: "MP4 Video", accept: { "video/mp4": [".mp4"] } },
          ],
        });
      }

      setIsExporting(true);
      setShowProgress(true);
      setProgressMessage("Preparing to export video...");
      setSaveProgress(0);

      if (!ffmpeg.loaded) {
        await loadFFmpeg();
      }

      let tempFiles = [];
      const processedFiles = [];
      const [width, height] = resolution.split("x").map(Number);

      // Calculate total slideshow duration and loop parameters
      const totalSlideshowDuration = stories.length * duration;
      const loopCount =
        isExportLoopEnabled && exportLoopDuration > 0
          ? Math.ceil(exportLoopDuration / totalSlideshowDuration)
          : 1;

      // Process images multiple times based on loop settings
      for (let loop = 0; loop < loopCount; loop++) {
        for (let i = 0; i < stories.length; i++) {
          const story = stories[i];
          setProgressMessage(
            `Processing image ${i + 1}/${stories.length} (Loop ${
              loop + 1
            }/${loopCount})`
          );

          const inputName = `input_${loop}_${i}.png`;
          const outputName = `processed_${loop}_${i}.mp4`;

          await ffmpeg.writeFile(inputName, await fetchFile(story.url));
          tempFiles.push(inputName);

          await ffmpeg.exec([
            "-loop",
            "1",
            "-i",
            inputName,
            "-c:v",
            "libx264",
            "-t",
            `${duration}`,
            "-pix_fmt",
            "yuv420p",
            "-vf",
            `scale=${width}:${height}:force_original_aspect_ratio=1,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
            "-r",
            "30",
            "-preset",
            "ultrafast",
            outputName,
          ]);

          tempFiles.push(outputName);
          processedFiles.push({ name: outputName });

          // Update progress, accounting for multiple loops
          setSaveProgress(
            ((loop * stories.length + i + 1) / (loopCount * stories.length)) *
              75
          );
        }
      }

      // Write concatenation list
      await ffmpeg.writeFile(
        "list.txt",
        processedFiles.map((f) => `file '${f.name}'`).join("\n")
      );
      tempFiles.push("list.txt");

      setProgressMessage("Creating final video...");
      setSaveProgress(85);

      // Concatenate processed files
      await ffmpeg.exec([
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        "list.txt",
        "-c:v",
        "copy",
        "temp_output.mp4",
      ]);
      tempFiles.push("temp_output.mp4");

      // Add Background Music (existing logic remains the same)
      if (musicUrl) {
        setProgressMessage("Adding background music...");
        try {
          await ffmpeg.writeFile("background.mp3", await fetchFile(musicUrl));
          await ffmpeg.exec([
            "-i",
            "temp_output.mp4",
            "-ss",
            String(musicStartPoint),
            "-i",
            "background.mp3",
            "-shortest",
            "-map",
            "0:v",
            "-map",
            "1:a",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "final_output.mp4",
          ]);

          await ffmpeg.deleteFile("background.mp3");
          await ffmpeg.deleteFile("temp_output.mp4");
        } catch (error) {
          console.error("Music error:", error);
          await ffmpeg.exec([
            "-i",
            "temp_output.mp4",
            "-c",
            "copy",
            "final_output.mp4",
          ]);
        }
      } else {
        await ffmpeg.exec([
          "-i",
          "temp_output.mp4",
          "-c",
          "copy",
          "final_output.mp4",
        ]);
      }

      setProgressMessage("Preparing download...");
      setSaveProgress(95);

      // Read and save final file (existing logic remains the same)
      const data = await ffmpeg.readFile("final_output.mp4");
      setSaveProgress(100);

      const writable = await fileHandle.createWritable();
      await writable.write(new Blob([data.buffer], { type: "video/mp4" }));
      await writable.close();

      setShowProgress(false);
      setIsExporting(false);
      setShowShareNotification(true);
    } catch (error) {
      console.error("Export error:", error);
      setShowProgress(false);
      setIsExporting(false);
      alert(`Export failed: ${error.message}`);
    }
  };

  // Render logic
  return (
    <>
      {showLanding ? (
        <GrooveGalleryLanding onCreateSlideshow={handleStartSlideshow} />
      ) : (
        <div className="app-container">
          <div className="app-content">
            <div className="slider-container">
              <div className="title-bar">
                <h1 className="slider-title">The Groove Gallery</h1>
                <button onClick={handleClearSession} className="clear-button">
                  Clear
                </button>
              </div>
              <audio ref={audioRef} src={musicUrl} loop={true} />
              {stories.length === 0 ? (
                <EmptyState onFileUpload={handleFileUpload} />
              ) : (
                <div
                  className="story-container"
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <div className="story-slide">
                    <div className="media-wrapper">
                      <img
                        src={stories[currentIndex].url}
                        alt={`Slide ${currentIndex + 1}`}
                        className="media-content"
                        style={{
                          display: "block",
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }}
                        loading="eager"
                      />
                    </div>
                  </div>
                  <NavigationButtons
                    onPrevious={handlePrevious}
                    onNext={handleNext}
                    isFirstSlide={currentIndex === 0}
                    isLastSlide={currentIndex === stories.length - 1}
                  />
                  <ProgressBar
                    currentIndex={currentIndex}
                    totalSlides={stories.length}
                    onProgressClick={setCurrentIndex}
                  />
                </div>
              )}

              <BottomMenu
                audioRef={audioRef}
                onFileUpload={handleFileUpload}
                onSaveSession={() => setShowExportModal(true)}
                onPlayPause={handlePlayPause}
                isPlaying={isPlaying}
                duration={duration}
                onDurationChange={setDuration}
                onEdit={() => setShowEditPanel(!showEditPanel)}
                onMusicUpload={handleMusicUpload}
                onBPMChange={handleBPMChange}
                musicUrl={musicUrl}
                bpm={bpm}
                onStartPointChange={setMusicStartPoint}
                musicStartPoint={musicStartPoint}
                onMusicPanelToggle={() => setShowMusicPanel(!showMusicPanel)}
                isLoopingEnabled={isLoopingEnabled}
                setIsLoopingEnabled={setIsLoopingEnabled}
                showEditPanel={showEditPanel}
                setShowEditPanel={setShowEditPanel}
                stories={stories}
                setStories={setStories}
                handleDelete={handleDelete}
                handleReorder={handleReorder}
              />

              {showEditPanel && (
                <EditPanel
                  stories={stories}
                  onClose={() => setShowEditPanel(!showEditPanel)}
                  onReorder={handleReorder}
                  onDelete={handleDelete}
                />
              )}

              <ExportModal
                isOpen={showExportModal}
                progress={saveProgress}
                message={progressMessage}
                onClose={() => setShowExportModal(false)}
                onExport={handleSaveSession}
                isExporting={isExporting}
              />

              <ProgressModal
                isOpen={showProgress}
                progress={saveProgress}
                message={progressMessage}
              />
              <ShareNotification
                isVisible={showShareNotification}
                onClose={() => setShowShareNotification(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StorySlider;
