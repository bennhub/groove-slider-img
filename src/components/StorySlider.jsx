//==============================================
// IMPORTS
//==============================================
import React, { useState, useEffect, useRef } from 'react';
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
  Music 
} from 'lucide-react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

//==============================================
// UTILITIES / SERVICES
//==============================================
const ffmpeg = new FFmpeg({
  log: true,
  corePath: Capacitor.isNativePlatform() 
    ? '/public/ffmpeg/ffmpeg-core.js'
    : 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/ffmpeg-core.js',
  wasmPath: Capacitor.isNativePlatform()
    ? '/public/ffmpeg/ffmpeg-core.wasm'
    : 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/ffmpeg-core.wasm'
});

// Add this function right after the ffmpeg configuration
const loadFFmpeg = async () => {
  try {
    console.log('Starting FFmpeg load...');
    if (Capacitor.isNativePlatform()) {
      console.log('Loading in mobile environment');
      await ffmpeg.load({
        coreURL: './public/ffmpeg/ffmpeg-core.js',
        wasmURL: './public/ffmpeg/ffmpeg-core.wasm'
      });
    } else {
      console.log('Loading in web environment');
      await ffmpeg.load();
    }
    console.log('FFmpeg loaded successfully');
  } catch (error) {
    console.error('FFmpeg load error:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      cause: error.cause
    });
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
      const averageInterval = intervals.reduce((a, b) => a + b) / intervals.length;
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
      <button 
        onClick={handleTap}
        className="tap-button"
      >
        Tap Tempo: {currentBPM > 0 ? `${currentBPM} BPM` : 'Tap to rhythm'}
      </button>
    </div>
  );
};

//==============================================
// MUSIC PANEL COMPONENT
//==============================================
const MusicPanel = ({ onUpload, onBPMChange, currentBPM }) => {
  const audioRef = useRef(null);

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
                  if (audioRef.current) {
                    audioRef.current.src = url;
                  }
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
          <audio ref={audioRef} controls />
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
          className={`progress-bar ${index === currentIndex ? 'active' : ''}`}
          onClick={() => onProgressClick(index)}
        />
      ))}
    </div>
  );
};

//==============================================
// NAVIGATION BUTTONS
//==============================================
const NavigationButtons = ({ onPrevious, onNext, isFirstSlide, isLastSlide }) => {
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
      <div className="modal-content">
        <div className="loading-container">
          <Loader className="animate-spin" />
          <p>{message}</p>
          {progress !== null && (
            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

//--------------------------------------------
// Caption Modal
//--------------------------------------------
const CaptionModal = ({ isOpen, onClose, onSubmit, fileName }) => {
  const [caption, setCaption] = useState('');

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>
        <h3>Add a Caption</h3>
        <p className="modal-filename">{fileName}</p>
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Enter your caption..."
          className="modal-input"
          autoFocus
        />
        <div className="modal-buttons">
          <button className="modal-button cancel" onClick={onClose}>
            Skip
          </button>
          <button 
            className="modal-button submit" 
            onClick={() => onSubmit(caption)}
          >
            Add Caption
          </button>
        </div>
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
  isExporting 
}) => {
  const [resolution, setResolution] = useState('1080x1920');

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
                onClick={() => {/* Share logic */}}
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
    e.dataTransfer.setData('text/plain', String(index));
  };
 
  const handleDragOver = (e) => {
    e.preventDefault();
  };
 
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const dragIndex = Number(e.dataTransfer.getData('text/plain'));
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
                <img src={story.url} alt={story.caption} />
              </div>
            </div>
            <div className="thumbnail-caption">
              {story.caption.length > 20 
                ? `${story.caption.substring(0, 20)}...` 
                : story.caption
              }
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
  bpm
}) => {
  const [showDurationPanel, setShowDurationPanel] = useState(false);
  const [showMusicPanel, setShowMusicPanel] = useState(false);
 
  return (
    <div className="bottom-menu">
      {showDurationPanel && (
        <div className="duration-panel">
          <div className="duration-controls">
            <input 
              type="range"
              min="1"
              max="12"
              value={duration}
              onChange={(e) => onDurationChange(parseInt(e.target.value))}
              className="duration-slider"
            />
            <div className="duration-text">
              Speed: {duration}s/image
            </div>
          </div>
          <div className="duration-timeline">
            {[...Array(12)].map((_, index) => (
              <div key={index} className="timeline-marker">
                {index + 1}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {showMusicPanel && (
        <MusicPanel
          onUpload={onMusicUpload}
          onBPMChange={onBPMChange}
          currentBPM={bpm}  
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
 
        <button 
          className="bottom-menu-button"
          onClick={onPlayPause}
        >
          {isPlaying ? (
            <Pause className="bottom-menu-icon" />
          ) : (
            <Play className="bottom-menu-icon" />
          )}
          <span className="bottom-menu-text">{isPlaying ? 'Pause' : 'Play'}</span>
        </button>
 
        <div className="bottom-menu-right-group">
          <button 
            className="bottom-menu-button"
            onClick={onEdit}
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
  
  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [saveProgress, setSaveProgress] = useState(null);
  const [progressMessage, setProgressMessage] = useState('');
  const [showProgress, setShowProgress] = useState(false);
  
  // Music State
  const [musicUrl, setMusicUrl] = useState(null);
  const [bpm, setBpm] = useState(120);
  
  // Touch State
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Refs
  const musicRef = useRef(null);
  const intervalRef = useRef(null);
  const controls = useAnimation();

  // Load FFmpeg on mount
  useEffect(() => {
    loadFFmpeg().catch(console.error);
  }, []);

  // Handle file uploads
  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files).filter(file => 
      file.type.startsWith('image/')
    );

    if (files.length === 0) {
      alert('Please select image files only.');
      return;
    }

    const newStories = files.map(file => {
      const url = URL.createObjectURL(file);
      const wantCaption = window.confirm('Would you like to add a caption?');
      const caption = wantCaption ? prompt("Add a caption:", file.name) || file.name : file.name;
      
      return {
        type: 'image',
        url,
        caption
      };
    });

    setStories(prevStories => [...prevStories, ...newStories]);
    event.target.value = '';
  };

  // Music handlers
  const handleMusicUpload = (url) => {
    setMusicUrl(url);
    if (musicRef.current) {
      musicRef.current.src = url;
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
      setCurrentIndex(prevIndex => {
        if (prevIndex >= stories.length - 1) return 0;
        return prevIndex + 1;
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
      if (musicRef.current) {
        musicRef.current.pause();
      }
    } else {
      if (currentIndex === stories.length - 1) {
        setCurrentIndex(0);
      }
      startAutoRotation();
      if (musicRef.current) {
        musicRef.current.play();
      }
    }
    setIsPlaying(prev => !prev);
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
  const handleNext = async () => {
    if (currentIndex < stories.length - 1) {
      await controls.start({ opacity: 1 }, { duration: 0.5 });
      setCurrentIndex(currentIndex + 1);
      controls.set({ opacity: 0 });
      await controls.start({ opacity: 1 }, { duration: 0.5 });
    }
  };
  
  const handlePrevious = async () => {
    if (currentIndex > 0) {
      await controls.start({ opacity: 1 }, { duration: 0.5 });
      setCurrentIndex(currentIndex - 1);
      controls.set({ opacity: 0 });
      await controls.start({ opacity: 1 }, { duration: 0.5 });
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
  const handleSaveSession = async (resolution = '1080x1920') => {
    setIsExporting(true);
    let tempFiles = [];

    try {
      setShowProgress(true);
      setProgressMessage('Preparing to export video...');
      setSaveProgress(0);

      if (!ffmpeg.loaded) {
        await loadFFmpeg();
      }

      const processedFiles = [];
      const [width, height] = resolution.split('x').map(Number);

      // Process each image
      for (let i = 0; i < stories.length; i++) {
        const story = stories[i];
        setProgressMessage(`Processing image ${i + 1}/${stories.length}`);
        
        const inputName = `input${i}.png`;
        const outputName = `processed${i}.mp4`;
        
        await ffmpeg.writeFile(inputName, await fetchFile(story.url));
        tempFiles.push(inputName);
        
        // Convert image to video segment
        await ffmpeg.exec([
          '-loop', '1',
          '-i', inputName,
          '-c:v', 'libx264',
          '-t', `${duration}`,
          '-pix_fmt', 'yuv420p',
          '-vf', `scale=${width}:${height}:force_original_aspect_ratio=1,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
          '-r', '30',
          '-preset', 'ultrafast',
          outputName
        ]);

        tempFiles.push(outputName);
        processedFiles.push({ name: outputName });
        setSaveProgress((i + 1) / stories.length * 75);
      }

      // Create concat file
      const fileList = processedFiles.map(file => `file '${file.name}'`).join('\n');
      await ffmpeg.writeFile('list.txt', fileList);
      tempFiles.push('list.txt');
      
      setProgressMessage('Creating final video...');
      setSaveProgress(85);

      // Concatenate all images
      await ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'list.txt',
        '-c:v', 'copy',
        'temp_output.mp4'
      ]);
      tempFiles.push('temp_output.mp4');

      // Add background music if present
      if (musicUrl) {
        setProgressMessage('Adding background music...');
        
        try {
          // Write background music file
          await ffmpeg.writeFile('background.mp3', await fetchFile(musicUrl));
          
          // Simpler audio mixing command
          await ffmpeg.exec([
            '-i', 'temp_output.mp4',  // Video without audio
            '-stream_loop', '-1',     // Loop the audio
            '-i', 'background.mp3',   // Background music
            '-shortest',              // Match the video length
            '-map', '0:v',           // Take video from first input
            '-map', '1:a',           // Take audio from second input
            '-c:v', 'copy',          // Copy video codec
            '-c:a', 'aac',           // Audio codec
            '-b:a', '192k',          // Audio bitrate
            'final_output.mp4'
          ]);
      
          await ffmpeg.deleteFile('background.mp3');
          await ffmpeg.deleteFile('temp_output.mp4');
        } catch (error) {
          console.error('Background music error:', error);
          // If background music fails, just use the video without music
          await ffmpeg.exec([
            '-i', 'temp_output.mp4',
            '-c', 'copy',
            'final_output.mp4'
          ]);
        }
      } else {
        // If no background music, just rename temp to final
        await ffmpeg.exec([
          '-i', 'temp_output.mp4',
          '-c', 'copy',
          'final_output.mp4'
        ]);
      }

      setProgressMessage('Preparing download...');
      setSaveProgress(95);
      
      const data = await ffmpeg.readFile('final_output.mp4');
      setSaveProgress(100);

      // Handle download based on platform
      if (Capacitor.isNativePlatform()) {
        const fileName = `slideshow_${Date.now()}.mp4`;
        await Filesystem.writeFile({
          path: fileName,
          data: data.buffer,
          directory: Directory.Documents
        });
        alert(`Video saved as ${fileName}`);
      } else {
        const videoUrl = URL.createObjectURL(
          new Blob([data.buffer], { type: 'video/mp4' })
        );
        const a = document.createElement('a');
        a.href = videoUrl;
        a.download = 'slideshow.mp4';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(videoUrl);
      }

      setShowProgress(false);
      setIsExporting(false);
      alert('Export completed!');

    } catch (error) {
      console.error('Export error:', error);
      setShowProgress(false);
      setIsExporting(false);
      alert(`Export failed: ${error.message}`);
    } finally {
      // Cleanup temp files
      for (const file of tempFiles) {
        try {
          await ffmpeg.deleteFile(file);
        } catch (e) {
          console.log(`Failed to delete: ${file}`);
        }
      }
    }
  };

  // Render logic
  return (
    <div className="app-container">
      <div className="app-content">
        <div className="slider-container">
          <h1 className="slider-title">Image Groove Slider</h1>
          
          {stories.length === 0 ? (
            <EmptyState onFileUpload={handleFileUpload} />
          ) : (
            <div 
              className="story-container"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <motion.div
                className="story-slide"
                key={currentIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="media-content">
                  <img 
                    src={stories[currentIndex].url} 
                    alt={stories[currentIndex].caption} 
                    className="media-content" 
                  />
                  <div className="caption">
                    {stories[currentIndex].caption}
                  </div>
                </div>
              </motion.div>

              <NavigationButtons 
                onPrevious={handlePrevious}
                onNext={handleNext}
                isFirstSlide={currentIndex === 0}
                isLastSlide={currentIndex === stories.length - 1}
              />

              <audio 
                ref={musicRef} 
                loop={true} 
                onPlay={() => {
                  if (musicRef.current) {
                    musicRef.current.currentTime = 0;
                  }
                }} 
              />

              <ProgressBar 
                currentIndex={currentIndex}
                totalSlides={stories.length}
                onProgressClick={setCurrentIndex}
              />
            </div>
          )}

          <BottomMenu 
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
            currentBPM={bpm}
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
        </div>
      </div>
    </div>
  );
};

export default StorySlider;