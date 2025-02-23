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
} from "lucide-react";
//import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

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
// TAP TEMPO COMPONENT
//==============================================
const TapTempo = ({ onBPMChange }) => {
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
        Tap Tempo: {currentBPM > 0 ? `${currentBPM} BPM` : "Tap to rhythm"}
      </button>
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
  musicStartPoint 
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const controlsRef = useRef(null);
  

  const handleTimeUpdate = () => {
    if (controlsRef.current) {  
      setCurrentTime(controlsRef.current.currentTime);
    }
  };

  useEffect(() => {
    if (controlsRef.current && audioRef.current) {
      // Add listeners to both audio elements
      controlsRef.current.addEventListener('timeupdate', handleTimeUpdate);
      
      // Sync control audio with main audio
      controlsRef.current.addEventListener('timeupdate', (e) => {
        audioRef.current.currentTime = e.target.currentTime;
      });
    }
  
    return () => {
      if (controlsRef.current && audioRef.current) {
        // Clean up listeners from both elements
        controlsRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        controlsRef.current.removeEventListener('timeupdate', (e) => {
          audioRef.current.currentTime = e.target.currentTime;
        });
      }
    };
  }, [audioRef, controlsRef]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSetStartPoint = () => {
    if (controlsRef.current) {
      const newTime = controlsRef.current.currentTime;
      onStartPointChange(newTime);
      if (audioRef.current) {
        audioRef.current.currentTime = newTime;
      }
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
                  onUpload(url);
                }
              }}
              className="hidden-input"
            />
          </label>
        </div>

        <div className="bpm-control">
          <TapTempo onBPMChange={onBPMChange} />
          <div className="manual-bpm">
            <label>Manual BPM:</label>
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
            controls 
            onTimeUpdate={handleTimeUpdate}
          />
          <div className="start-point-controls">
            <div className="time-display">
              Current Time: {formatTime(currentTime)}
            </div>
            <div className="start-point-display">
              Start Point: {formatTime(musicStartPoint)}
            </div>
            <button
              className="set-start-point-button"
              onClick={handleSetStartPoint}
            >
              Set Start Point
            </button>
          </div>
          {musicUrl && (
            <div className="music-info">
              <span>Current Track: {musicUrl.split('/').pop()}</span>
            </div>
          )}
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
          <button onClick={() => window.open('https://instagram.com', '_blank')} className="share-button instagram">
            Share to Instagram
          </button>
          <button onClick={() => window.open('https://tiktok.com', '_blank')} className="share-button tiktok">
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
                onClick={() => onExport(resolution)}
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
const EditPanel = ({ stories, onClose, onReorder, onDelete }) => {
  const handleDragStart = (e, index) => {
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const dragIndex = Number(e.dataTransfer.getData("text/plain"));
    if (dragIndex === dropIndex) return;

    const newStories = [...stories];
    const [movedItem] = newStories.splice(dragIndex, 1);
    newStories.splice(dropIndex, 0, movedItem);
    onReorder(newStories);
  };

  return (
    <div className="edit-panel">
      <div className="edit-panel-header">
        <h3>Edit Image Order</h3>
        <button className="edit-panel-close" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="thumbnails-container">
        {stories.map((story, index) => (
          <div
            key={index}
            draggable={true}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            className="thumbnail"
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
  setIsLoopingEnabled 
}) => {
  const [showDurationPanel, setShowDurationPanel] = useState(false);
  const [showMusicPanel, setShowMusicPanel] = useState(false);
  const [selectedBar, setSelectedBar] = useState(1);

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

  return (
    <div className="bottom-menu">
      {showDurationPanel && (
        <div className="duration-panel">
          <div className="duration-controls">
            <h3>Slide Duration</h3>
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
                    const newDuration = (option.value * 4 * 60) / bpm;
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

      <div className="bottom-menu-buttons">
        <button
          className="bottom-menu-button"
          onClick={() => {
            setShowDurationPanel(!showDurationPanel);
            setShowMusicPanel(false);
          }}
        >
          <Clock className="bottom-menu-icon" />
          <span className="bottom-menu-text">Speed</span>
        </button>

        <button
          className="bottom-menu-button"
          onClick={() => {
            setShowMusicPanel(!showMusicPanel);
            setShowDurationPanel(false);
          }}
        >
          <Music className="bottom-menu-icon" />
          <span className="bottom-menu-text">Music</span>
        </button>

        <button className="bottom-menu-button" onClick={onPlayPause}>
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
          <button className="bottom-menu-button" onClick={onEdit}>
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
      url: URL.createObjectURL(file)
    }));

    setStories((prevStories) => [...prevStories, ...newStories]);
    event.target.value = "";
  };

  // Music handlers
  const handleMusicUpload = (url) => {
    setMusicUrl(url);
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.currentTime = musicStartPoint;
    }
  };

  const handleBPMChange = (newBPM) => {
    setBpm(newBPM);
    const slideDuration = (60 / newBPM) * 4; // 4 beats per slide
    setDuration(slideDuration);
  };

  // Playback control
  const startAutoRotation = () => {
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        if (!isLoopingEnabled && prevIndex >= stories.length - 1) {
          stopAutoRotation();
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
        audioRef.current.currentTime = musicStartPoint; // Use the stored start point
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
    // Force stop any playback
    stopAutoRotation();
    setIsPlaying(false);

    // Update state synchronously
    setCurrentIndex(0); // Reset to first position
    setStories(newStories);
  };

  // Hande Delete
  const handleDelete = (index) => {
    const newStories = stories.filter((_, i) => i !== index);
    setStories(newStories);
    if (currentIndex >= index) {
      setCurrentIndex(Math.max(0, currentIndex - 1));
    }
  };

  // Export functionality
  const handleSaveSession = async (resolution = "1080x1920") => {
    try {
      let fileHandle;
      let fileName = "slideshow.mp4";

      // Check if we're on mobile/unsupported browser
      if (!("showSaveFilePicker" in window)) {
        // Mobile fallback - file will download automatically
        // Create a temporary anchor element
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
        // Desktop - use file picker
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

      // 🔹 Process Images into Video Segments
      for (let i = 0; i < stories.length; i++) {
        const story = stories[i];
        setProgressMessage(`Processing image ${i + 1}/${stories.length}`);
        const inputName = `input${i}.png`;
        const outputName = `processed${i}.mp4`;

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
        setSaveProgress(((i + 1) / stories.length) * 75);
      }

      // 🔹 Concatenate All Videos
      await ffmpeg.writeFile(
        "list.txt",
        processedFiles.map((f) => `file '${f.name}'`).join("\n")
      );
      tempFiles.push("list.txt");

      setProgressMessage("Creating final video...");
      setSaveProgress(85);

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

      // 🔹 Add Background Music If Needed
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

      // 🔹 Read Final File
      const data = await ffmpeg.readFile("final_output.mp4");
      setSaveProgress(100);

      // 🔹 Save the File (Now Safe to Use the File Handle)
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
    <div className="app-container">
      <div className="app-content">
        <div className="slider-container">
          <h1 className="slider-title">Groove Gallery #14</h1>
          <audio 
        ref={audioRef}
        src={musicUrl}
        loop={true}
      />
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
      alt={`Slide ${currentIndex + 1}`}  // Changed from caption to slide number
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
            onEdit={() => setShowEditPanel(true)}
            onMusicUpload={handleMusicUpload}
            onBPMChange={handleBPMChange}
            musicUrl={musicUrl}
            bpm={bpm}
            onStartPointChange={setMusicStartPoint}
            musicStartPoint={musicStartPoint}
            onMusicPanelToggle={() => setShowMusicPanel(!showMusicPanel)}
            isLoopingEnabled={isLoopingEnabled}
            setIsLoopingEnabled={setIsLoopingEnabled}
          />

          {showEditPanel && (
            <EditPanel
              stories={stories}
              onClose={() => setShowEditPanel(false)}
              onReorder={setStories}
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
  );
};

export default StorySlider;
