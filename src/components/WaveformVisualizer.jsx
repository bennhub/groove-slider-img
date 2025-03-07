import React, { useRef, useEffect, useState, useCallback } from "react";

// Enhanced IndexedDB helper functions
const initIndexedDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("AudioVisualizerDB", 2);

    request.onerror = (event) =>
      reject("IndexedDB error: " + event.target.errorCode);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("audioPositions")) {
        db.createObjectStore("audioPositions", { keyPath: "audioUrl" });
      }
      if (!db.objectStoreNames.contains("visualizerStates")) {
        db.createObjectStore("visualizerStates", { keyPath: "audioUrl" });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
  });
};

// Store audio positions in IndexedDB
const storeAudioPositions = async (audioUrl, positionData) => {
  try {
    const db = await initIndexedDB();
    const transaction = db.transaction(["audioPositions"], "readwrite");
    const store = transaction.objectStore("audioPositions");

    return new Promise((resolve, reject) => {
      const request = store.put({
        audioUrl,
        ...positionData,
        timestamp: Date.now(),
      });

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(false);
    });
  } catch (error) {
    console.error("Error storing audio positions:", error);
    return false;
  }
};

// Store visualizer state in IndexedDB
const storeVisualizerState = async (audioUrl, state) => {
  try {
    const db = await initIndexedDB();
    const transaction = db.transaction(["visualizerStates"], "readwrite");
    const store = transaction.objectStore("visualizerStates");

    return new Promise((resolve, reject) => {
      const request = store.put({
        audioUrl,
        ...state,
        timestamp: Date.now(),
      });

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(false);
    });
  } catch (error) {
    console.error("Error storing visualizer state:", error);
    return false;
  }
};

// Retrieve visualizer state from IndexedDB
const getVisualizerState = async (audioUrl) => {
  try {
    const db = await initIndexedDB();
    const transaction = db.transaction(["visualizerStates"], "readonly");
    const store = transaction.objectStore("visualizerStates");

    return new Promise((resolve, reject) => {
      const request = store.get(audioUrl);

      request.onsuccess = (event) => {
        resolve(event.target.result || null);
      };

      request.onerror = () => reject(null);
    });
  } catch (error) {
    console.error("Error retrieving visualizer state:", error);
    return null;
  }
};

const WaveformVisualizer = ({
  audioUrl,
  onStartPointChange,
  audioRef,
  musicStartPoint = 0,
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(800);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [waveformOffset, setWaveformOffset] = useState(0);
  const [followPlayhead, setFollowPlayhead] = useState(false);

  // Refs for tracking
  const loadedAudioUrlRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isPlayingRef = useRef(false);

  // Load audio data and retrieve positions from IndexedDB
  useEffect(() => {
    if (!audioUrl || loadedAudioUrlRef.current === audioUrl) return;

    loadedAudioUrlRef.current = audioUrl;
    setIsLoading(true);

    const loadAudioAndPositions = async () => {
      try {
        // First check if we have cached visualizer state
        const cachedState = await getVisualizerState(audioUrl);

        // Initialize audio context and decode the audio file
        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await audioContext.decodeAudioData(arrayBuffer);

        setAudioBuffer(buffer);
        setDuration(buffer.duration);

        // Restore cached state if available
        if (cachedState) {
          // Restore zoom level and waveform offset
          if (cachedState.zoomLevel) {
            setZoomLevel(cachedState.zoomLevel);
          }
          if (cachedState.waveformOffset !== undefined) {
            setWaveformOffset(cachedState.waveformOffset);
          }
          if (cachedState.followPlayhead !== undefined) {
            setFollowPlayhead(cachedState.followPlayhead);
          }

          // Restore start point if different
          if (
            onStartPointChange &&
            cachedState.startPoint !== undefined &&
            Math.abs(cachedState.startPoint - musicStartPoint) > 0.001
          ) {
            onStartPointChange(cachedState.startPoint);
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Error loading audio:", error);
        setIsLoading(false);
      }
    };

    loadAudioAndPositions();
  }, [audioUrl, onStartPointChange, musicStartPoint]);

  // Save visualizer state when key properties change
  useEffect(() => {
    if (!audioUrl || !audioBuffer) return;

    // Debounce saving to avoid excessive writes
    const saveTimer = setTimeout(() => {
      storeVisualizerState(audioUrl, {
        zoomLevel,
        waveformOffset,
        followPlayhead,
        startPoint: musicStartPoint,
      }).catch((err) => console.error("Error saving to IndexedDB:", err));
    }, 1000);

    return () => clearTimeout(saveTimer);
  }, [
    zoomLevel,
    waveformOffset,
    followPlayhead,
    musicStartPoint,
    audioUrl,
    audioBuffer,
  ]);

  // Enhanced time update handler with improved follow playhead logic
  useEffect(() => {
    const audioElement = audioRef?.current;
    if (!audioElement) return;

    const updatePlaybackTime = () => {
      const currentTime = audioElement.currentTime;

      // Update state with precise timing
      setCurrentPlaybackTime(currentTime);

      // Update isPlaying ref based on audio element state
      isPlayingRef.current = !audioElement.paused;

      // Improved follow playhead logic
      if (followPlayhead && isPlayingRef.current) {
        const visibleDuration = duration / zoomLevel;
        const startTime = waveformOffset;
        const endTime = startTime + visibleDuration;
        const visibilityThreshold = visibleDuration * 0.2; // 20% from edge

        // Dynamically scroll to keep playhead in view
        if (currentTime > endTime - visibilityThreshold) {
          // Scroll to keep playhead on right side
          const newOffset = Math.max(
            0,
            Math.min(
              duration - visibleDuration,
              currentTime - visibleDuration * 0.8
            )
          );
          setWaveformOffset(newOffset);
        } else if (currentTime < startTime + visibilityThreshold) {
          // Scroll to keep playhead on left side
          const newOffset = Math.max(
            0,
            Math.min(
              duration - visibleDuration,
              currentTime - visibleDuration * 0.2
            )
          );
          setWaveformOffset(newOffset);
        }
      }
    };

    // Use both timeupdate and requestAnimationFrame for smooth updates
    const animatePlayhead = () => {
      if (isPlayingRef.current && audioElement) {
        updatePlaybackTime();
      }
      animationFrameRef.current = requestAnimationFrame(animatePlayhead);
    };

    // Start animation loop
    animatePlayhead();

    // Event listeners
    audioElement.addEventListener("timeupdate", updatePlaybackTime);
    audioElement.addEventListener("play", () => {
      isPlayingRef.current = true;
    });
    audioElement.addEventListener("pause", () => {
      isPlayingRef.current = false;
    });
    audioElement.addEventListener("seeking", updatePlaybackTime);

    return () => {
      audioElement.removeEventListener("timeupdate", updatePlaybackTime);
      audioElement.removeEventListener("play", () => {
        isPlayingRef.current = true;
      });
      audioElement.removeEventListener("pause", () => {
        isPlayingRef.current = false;
      });
      audioElement.removeEventListener("seeking", updatePlaybackTime);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioRef, followPlayhead, zoomLevel, waveformOffset, duration]);

  // Effect to center the view on the start point when it changes
  useEffect(() => {
    if (!audioBuffer || duration === 0 || !audioUrl) return;

    // Center the view on the start point when zoomed in
    if (zoomLevel > 1) {
      const visibleDuration = duration / zoomLevel;
      const newOffset = Math.max(
        0,
        Math.min(
          duration - visibleDuration,
          musicStartPoint - visibleDuration / 2
        )
      );
      setWaveformOffset(newOffset);
    }

    // Avoid excessive IndexedDB writes - use debouncing
    const saveTimer = setTimeout(() => {
      // Store positions in IndexedDB
      storeAudioPositions(audioUrl, {
        startPoint: musicStartPoint,
      }).catch((err) => console.error("Error saving to IndexedDB:", err));
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(saveTimer);
  }, [musicStartPoint, zoomLevel, audioBuffer, duration, audioUrl]);

  // Format time with or without milliseconds
  const formatTime = (timeInSeconds, showMs = true) => {
    if (isNaN(timeInSeconds)) return "00:00.000";

    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);

    if (showMs) {
      const milliseconds = Math.floor((timeInSeconds % 1) * 1000);
      return `${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
    } else {
      return `${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }
  };

  // Draw waveform - use useCallback to prevent excessive redraws
  const drawWaveform = useCallback(() => {
    if (!audioBuffer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, width, height);

    // Get audio data
    const channelData = audioBuffer.getChannelData(0); // Use first channel

    // Calculate visible portion based on zoom and offset
    const visibleDuration = duration / zoomLevel;
    const startTime = Math.max(
      0,
      Math.min(duration - visibleDuration, waveformOffset)
    );
    const endTime = startTime + visibleDuration;

    // Calculate sample indices
    const totalSamples = channelData.length;
    const startSample = Math.floor((startTime / duration) * totalSamples);
    const endSample = Math.floor((endTime / duration) * totalSamples);
    const visibleSamples = endSample - startSample;

    // Draw waveform with higher resolution for better detail
    const barWidth = 1;
    const barGap = 0;
    const totalBars = Math.floor(width / (barWidth + barGap));
    const samplesPerBar = Math.floor(visibleSamples / totalBars);

    ctx.fillStyle = "#FFFFFF";

    for (let i = 0; i < totalBars; i++) {
      const barPosition = i * (barWidth + barGap);

      // Calculate sample position
      const barStartSample =
        startSample + Math.floor((i / totalBars) * visibleSamples);
      let peak = 0;

      // Find the peak amplitude in this segment
      for (let j = 0; j < samplesPerBar; j++) {
        const sampleIndex = barStartSample + j;
        if (sampleIndex < channelData.length) {
          const amplitude = Math.abs(channelData[sampleIndex]);
          if (amplitude > peak) {
            peak = amplitude;
          }
        }
      }

      // Scale the peak to fit the canvas height
      const scaledPeak = Math.min(2, peak * 0.9) * (height / 2);

      // Draw the bar
      const x = barPosition;
      const y = height / 2 - scaledPeak;
      const barHeight = scaledPeak * 2; // Symmetric around center

      ctx.fillRect(x, y, barWidth, barHeight);
    }

    // Add amplitude level guide lines
    ctx.strokeStyle = "rgba(100, 100, 100, 0.3)";
    ctx.lineWidth = 1;
    // Center line
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    // 25% and 75% amplitude lines
    ctx.beginPath();
    ctx.moveTo(0, height / 4);
    ctx.lineTo(width, height / 4);
    ctx.moveTo(0, (3 * height) / 4);
    ctx.lineTo(width, (3 * height) / 4);
    ctx.stroke();

    // Draw time markers
    ctx.fillStyle = "#777";
    ctx.font = "10px Arial";

    // Determine appropriate time step based on zoom level
    let timeStep = 1.0; // Default 1 second
    if (zoomLevel >= 32) timeStep = 0.05; // 50ms
    else if (zoomLevel >= 16) timeStep = 0.1; // 100ms
    else if (zoomLevel >= 8) timeStep = 0.25; // 250ms
    else if (zoomLevel >= 4) timeStep = 0.5; // 500ms
    else if (zoomLevel >= 2) timeStep = 1.0; // 1 second

    for (
      let time = Math.ceil(startTime / timeStep) * timeStep;
      time <= endTime;
      time += timeStep
    ) {
      // Convert time to x position
      const timeX = ((time - startTime) / visibleDuration) * width;

      // Draw time marker line
      ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
      ctx.fillRect(timeX, 0, 1, height);

      // Draw time label (only on certain intervals to prevent overcrowding)
      const shouldShowLabel =
        timeStep >= 1.0 ||
        (timeStep >= 0.5 && (time * 2) % 2 === 0) ||
        (timeStep >= 0.25 && (time * 4) % 4 === 0) ||
        (timeStep >= 0.1 && (time * 10) % 10 === 0) ||
        (timeStep >= 0.05 && (time * 20) % 20 === 0);

      if (shouldShowLabel) {
        ctx.fillStyle = "#AAA";
        ctx.textAlign = "center";
        ctx.fillText(formatTime(time, false), timeX, height - 5);
      }
    }

    // Draw playhead position with improved accuracy
    if (currentPlaybackTime >= startTime && currentPlaybackTime <= endTime) {
      const playheadX =
        ((currentPlaybackTime - startTime) / visibleDuration) * width;

      // Draw playhead line
      ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
      ctx.fillRect(playheadX - 1, 0, 2, height);

      // Add playhead marker at top for better visibility
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX - 4, -4);
      ctx.lineTo(playheadX + 4, -4);
      ctx.closePath();
      ctx.fill();
    }

    // Draw start point marker
    if (musicStartPoint >= startTime && musicStartPoint <= endTime) {
      const markerX = ((musicStartPoint - startTime) / visibleDuration) * width;
      ctx.fillStyle = "rgba(255, 215, 0, 0.8)";
      ctx.fillRect(markerX - 1, 0, 2, height);

      // Triangle at top
      ctx.beginPath();
      ctx.moveTo(markerX, 0);
      ctx.lineTo(markerX - 6, -6);
      ctx.lineTo(markerX + 6, -6);
      ctx.closePath();
      ctx.fill();
    }

    // Draw zoom range indicators at bottom of waveform
    const zoomIndicatorHeight = 3;
    ctx.fillStyle = "rgba(100, 100, 255, 0.5)";
    ctx.fillRect(
      0,
      height - zoomIndicatorHeight,
      width * (visibleDuration / duration),
      zoomIndicatorHeight
    );
  }, [
    audioBuffer,
    currentPlaybackTime,
    zoomLevel,
    waveformOffset,
    duration,
    musicStartPoint,
    canvasWidth,
  ]);

  // Effect to trigger waveform drawing
  useEffect(() => {
    // Use requestAnimationFrame for smoother rendering
    if (audioBuffer && !isLoading) {
      const animationId = requestAnimationFrame(drawWaveform);
      return () => cancelAnimationFrame(animationId);
    }
  }, [
    audioBuffer,
    currentPlaybackTime,
    zoomLevel,
    waveformOffset,
    duration,
    musicStartPoint,
    isLoading,
    drawWaveform,
  ]);

  // Handle waveform click to set playback position with improved accuracy

  const handleWaveformClick = (e) => {
    // Prevent default behavior
    e.preventDefault();
    e.stopPropagation();
  
    if (!audioBuffer || !canvasRef.current || isDragging) return;
  
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Get coordinates for both mouse and touch events
    const clientX = e.type.includes('touch') 
      ? (e.touches ? e.touches[0].clientX : e.changedTouches[0].clientX)
      : e.clientX;
    
    const clickX = clientX - rect.left;
  
    // Calculate click time based on total duration, not just visible duration
    const clickRatio = clickX / canvas.width;
    const preciseTime = Math.max(0, Math.min(duration, duration * clickRatio));
  
    // Update audio position
    if (audioRef?.current) {
      audioRef.current.currentTime = preciseTime;
    }
  
    // Update playback position immediately
    setCurrentPlaybackTime(preciseTime);
  
    console.log({
      eventType: e.type,
      clickX,
      canvasWidth: canvas.width,
      totalDuration: duration,
      clickRatio,
      clickTime: preciseTime
    });
  };

  // Zoom controls with improved behavior
  const handleZoomIn = () => {
    setZoomLevel((prev) => {
      // Max zoom is 64x
      if (prev >= 64) return prev;

      const newZoom = Math.min(64, prev * 2);

      // When zooming in, preserve the center view
      if (audioBuffer) {
        // Calculate the center time of the current view
        const visibleDuration = duration / prev;
        const currentCenterTime = waveformOffset + visibleDuration / 2;

        // Calculate new visible duration with new zoom
        const newVisibleDuration = duration / newZoom;

        // Center the new view on the same time point
        const newOffset = Math.max(
          0,
          Math.min(
            duration - newVisibleDuration,
            currentCenterTime - newVisibleDuration / 2
          )
        );
        setWaveformOffset(newOffset);
      }

      return newZoom;
    });
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      if (prev <= 1) return 1;

      const newZoom = Math.max(1, prev / 2);

      // When fully zoomed out, reset offset
      if (newZoom === 1) {
        setWaveformOffset(0);
      } else if (audioBuffer) {
        // Calculate the center time of the current view
        const visibleDuration = duration / prev;
        const currentCenterTime = waveformOffset + visibleDuration / 2;

        // Calculate new visible duration with new zoom
        const newVisibleDuration = duration / newZoom;

        // Center the new view on the same time point
        const newOffset = Math.max(
          0,
          Math.min(
            duration - newVisibleDuration,
            currentCenterTime - newVisibleDuration / 2
          )
        );
        setWaveformOffset(newOffset);
      }

      return newZoom;
    });
  };

  // Focus on start point button
  const focusOnStartPoint = () => {
    if (!audioBuffer) return;

    // Center the view on the start point
    const visibleDuration = duration / zoomLevel;
    const newOffset = Math.max(
      0,
      Math.min(
        duration - visibleDuration,
        musicStartPoint - visibleDuration / 2
      )
    );
    setWaveformOffset(newOffset);
  };

  // Scroll waveform horizontally with improved precision
  const handleScroll = (e) => {
    if (!audioBuffer) return;

    // Prevent default scroll behavior
    e.preventDefault();

    const visibleDuration = duration / zoomLevel;
    const maxOffset = Math.max(0, duration - visibleDuration);

    // Adjust scroll speed based on zoom level for better fine control
    const scrollSpeed = 0.05 * visibleDuration; // Lower factor for more precise control

    if (e.deltaY > 0) {
      // Scroll right
      setWaveformOffset((prev) => Math.min(maxOffset, prev + scrollSpeed));
    } else {
      // Scroll left
      setWaveformOffset((prev) => Math.max(0, prev - scrollSpeed));
    }
  };

  // Handle dragging for horizontal scrolling
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);

  const handleMouseDown = (e) => {
    if (!audioBuffer) return;

    e.preventDefault();
    setIsDragging(true);
    setDragStartX(e.clientX);
    e.currentTarget.style.cursor = "grabbing";
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !audioBuffer) return;

    const dx = e.clientX - dragStartX;
    const visibleDuration = duration / zoomLevel;
    const pixelsPerSecond = canvasWidth / visibleDuration;

    // Convert pixel drag to time
    const timeChange = dx / pixelsPerSecond;

    // Update offset
    const maxOffset = Math.max(0, duration - visibleDuration);
    setWaveformOffset((prev) => {
      const newOffset = Math.max(0, Math.min(maxOffset, prev - timeChange));
      return newOffset;
    });

    setDragStartX(e.clientX);
  };

  const handleMouseUp = (e) => {
    setIsDragging(false);
    e.currentTarget.style.cursor = "grab";
  };

  // Set start point to current playback position
  const handleSetStartPoint = () => {
    if (!audioRef?.current || !onStartPointChange) return;

    // Get current position with high precision
    const startTime = audioRef.current.currentTime;

    // Round to millisecond precision
    const preciseTime = Math.round(startTime * 1000) / 1000;

    // Notify parent component
    onStartPointChange(preciseTime);
  };

  // Frame forward/backward navigation with improved precision
  const adjustStartPointByMs = (milliseconds) => {
    if (!audioBuffer || !onStartPointChange) return;
    
    // Convert ms to seconds (1ms = 0.001s)
    const timeChange = milliseconds * 0.001;
    
    // Calculate new start point time with millisecond precision
    const newTime = Math.max(0, Math.min(duration, musicStartPoint + timeChange));
    
    // Round to millisecond precision
    const preciseTime = Math.round(newTime * 1000) / 1000;
    
    // Update start point
    onStartPointChange(preciseTime);
    
    // If zoomed in, make sure adjusted position is visible
    if (zoomLevel > 1) {
      const visibleDuration = duration / zoomLevel;
      const startTime = waveformOffset;
      const endTime = startTime + visibleDuration;
      
      // If new position is outside visible area, adjust the view
      if (newTime < startTime || newTime > endTime) {
        const newOffset = Math.max(0, Math.min(duration - visibleDuration, 
                                            newTime - (visibleDuration / 2)));
        setWaveformOffset(newOffset);
      }
    }
  };
  
  // Direct time input with improved validation
  const handleDirectTimeInput = () => {
    const timeStr = prompt(
      "Enter time (MM:SS.mmm):",
      formatTime(currentPlaybackTime)
    );
    if (!timeStr) return;

    try {
      // Parse time string (MM:SS.mmm)
      const [minutesPart, secondsPart] = timeStr.split(":");
      let seconds = 0;
      let milliseconds = 0;

      if (secondsPart.includes(".")) {
        const [secondsWhole, millisecondsStr] = secondsPart.split(".");
        seconds = parseInt(secondsWhole, 10);
        milliseconds = parseInt(millisecondsStr.padEnd(3, "0").slice(0, 3), 10);
      } else {
        seconds = parseInt(secondsPart, 10);
      }

      const minutes = parseInt(minutesPart, 10);

      // Calculate total time in seconds with millisecond precision
      const totalSeconds = minutes * 60 + seconds + milliseconds / 1000;

      // Validate range
      if (totalSeconds >= 0 && totalSeconds <= duration) {
        // Update audio position
        if (audioRef?.current) {
          audioRef.current.currentTime = totalSeconds;
        }

        // Update playback position
        setCurrentPlaybackTime(totalSeconds);

        // Center the view on this position if zoomed in
        if (zoomLevel > 1) {
          const visibleDuration = duration / zoomLevel;
          const newOffset = Math.max(
            0,
            Math.min(
              duration - visibleDuration,
              totalSeconds - visibleDuration / 2
            )
          );
          setWaveformOffset(newOffset);
        }
      } else {
        alert(
          `Please enter a time between 0:00.000 and ${formatTime(duration)}`
        );
      }
    } catch (error) {
      alert("Invalid time format. Please use MM:SS.mmm");
    }
  };

  return (
    <div className="waveform-container" ref={containerRef}>
      {isLoading ? (
        <div className="waveform-loading">Loading waveform...</div>
      ) : (
        <>
<div
  className="waveform-canvas-container"
  style={{
    position: "relative",
    cursor: isDragging ? "grabbing" : "grab",
  }}
  onWheel={handleScroll}
  onMouseDown={handleMouseDown}
  onMouseMove={handleMouseMove}
  onMouseUp={handleMouseUp}
  onMouseLeave={handleMouseUp}
  onClick={handleWaveformClick}
  onTouchStart={(e) => {
    if (!audioBuffer) return;
    e.preventDefault(); // Prevent default touch behavior
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStartX(touch.clientX);
    e.currentTarget.style.cursor = "grabbing";
  }}
  onTouchMove={(e) => {
    if (!isDragging || !audioBuffer) return;
    e.preventDefault(); // Prevent scrolling while dragging

    const touch = e.touches[0];
    const dx = touch.clientX - dragStartX;
    const visibleDuration = duration / zoomLevel;
    const pixelsPerSecond = canvasWidth / visibleDuration;

    // Convert pixel drag to time
    const timeChange = dx / pixelsPerSecond;

    // Update offset
    const maxOffset = Math.max(0, duration - visibleDuration);
    setWaveformOffset((prev) => {
      const newOffset = Math.max(0, Math.min(maxOffset, prev - timeChange));
      return newOffset;
    });

    setDragStartX(touch.clientX);
  }}
  onTouchEnd={(e) => {
    if (!isDragging) {
      handleWaveformClick(e);
    }
    setIsDragging(false);
    e.currentTarget.style.cursor = "grab";
  }}
  onTouchCancel={(e) => {
    setIsDragging(false);
    e.currentTarget.style.cursor = "grab";
  }}
>
  <canvas
    ref={canvasRef}
    width={800}
    height={80}
    className="waveform-canvas"
  />

            {/* Focus on start point button */}
            <button
              onClick={focusOnStartPoint}
              style={{
                position: "absolute",
                top: "5px",
                left: "30px",
                background: "rgba(255, 215, 0, 0.5)",
                color: "white",
                border: "none",
                borderRadius: "3px",
                padding: "2px 6px",
                fontSize: "10px",
                cursor: "pointer",
              }}
              title="Focus view on start point"
            >
              Find Start
            </button>

            {/* Zoom level indicator */}
            <div
              style={{
                position: "absolute",
                top: "5px",
                left: "5px",
                background: "rgba(0, 0, 0, 0.5)",
                color: "white",
                borderRadius: "3px",
                padding: "2px 5px",
                fontSize: "10px",
              }}
            >
              {zoomLevel}x
            </div>
          </div>

          {/* Time display with millisecond precision */}
          <div
            className="waveform-timestamps"
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "5px 0",
              fontSize: "12px",
              fontFamily: "monospace",
            }}
          >
            <span
              className="current-time"
              style={{
                color: "white",
                background: "rgba(255, 0, 0, 0.2)",
                borderRadius: "3px",
                padding: "2px 5px",
                cursor: "pointer",
              }}
              onClick={handleDirectTimeInput}
              title="Click to enter exact time"
            >
              {formatTime(currentPlaybackTime)}
            </span>

            <span
              className="start-point"
              style={{
                color: "white",
                background: "rgba(255, 215, 0, 0.2)",
                borderRadius: "3px",
                padding: "2px 5px",
                cursor: "pointer",
              }}
              onClick={focusOnStartPoint}
              title="Click to focus on start point"
            >
              Start: {formatTime(musicStartPoint)}
            </span>

            <span
              className="duration"
              style={{
                color: "white",
                background: "rgba(100, 100, 100, 0.2)",
                borderRadius: "3px",
                padding: "2px 5px",
              }}
            >
              Total: {formatTime(duration)}
            </span>
          </div>

          {/* Zoom controls and Follow Playhead in same row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "5px 0",
              margin: "5px 0",
            }}
          >
            {/* Zoom controls */}
            <div style={{ display: "flex", gap: "5px" }}>
              <button
                onClick={handleZoomOut}
                disabled={zoomLevel <= 1}
                style={{
                  background: zoomLevel <= 1 ? "#555" : "#333",
                  color: "white",
                  border: "none",
                  borderRadius: "3px",
                  padding: "3px 8px",
                  fontSize: "12px",
                  cursor: zoomLevel <= 1 ? "not-allowed" : "pointer",
                }}
              >
                Zoom Out
              </button>
              <button
                onClick={handleZoomIn}
                disabled={zoomLevel >= 64}
                style={{
                  background: zoomLevel >= 64 ? "#555" : "#333",
                  color: "white",
                  border: "none",
                  borderRadius: "3px",
                  padding: "3px 8px",
                  fontSize: "12px",
                  cursor: zoomLevel >= 64 ? "not-allowed" : "pointer",
                }}
              >
                Zoom In
              </button>
            </div>

            {/* Follow Playhead checkbox 
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <input
                type="checkbox"
                id="follow-playhead"
                checked={followPlayhead}
                onChange={() => {
                  // Toggle follow playhead and save to IndexedDB
                  const newFollowPlayhead = !followPlayhead;
                  setFollowPlayhead(newFollowPlayhead);

                  // Optionally, save to IndexedDB immediately
                  if (audioUrl) {
                    storeVisualizerState(audioUrl, {
                      zoomLevel,
                      waveformOffset,
                      followPlayhead: newFollowPlayhead,
                      startPoint: musicStartPoint,
                    }).catch((err) =>
                      console.error("Error saving follow playhead state:", err)
                    );
                  }
                }}
              />
              <label
                htmlFor="follow-playhead"
                style={{ color: "white", fontSize: "12px" }}
              >
                Follow Playhead
              </label>
            </div>*/}
          </div>

          <div 
  className="navigation-controls"
  style={{
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 0'
  }}
>
  {/* Millisecond navigation buttons for start point adjustment */}
  <button
    onClick={() => adjustStartPointByMs(-5)}
    style={{
      background: '#DAA520',
      border: 'none',
      borderRadius: '4px',
      padding: '6px 12px',
      color: 'white',
      cursor: 'pointer'
    }}
  >
    -5 ms (Start)
  </button>
  
  <button
    onClick={() => adjustStartPointByMs(-1)}
    style={{
      background: '#DAA520',
      border: 'none',
      borderRadius: '4px',
      padding: '6px 12px',
      color: 'white',
      cursor: 'pointer'
    }}
  >
    -1 ms (Start)
  </button>
  
  <button
    onClick={() => adjustStartPointByMs(1)}
    style={{
      background: '#DAA520',
      border: 'none',
      borderRadius: '4px',
      padding: '6px 12px',
      color: 'white',
      cursor: 'pointer'
    }}
  >
    +1 ms (Start)
  </button>
  
  <button
    onClick={() => adjustStartPointByMs(5)}
    style={{
      background: '#DAA520',
      border: 'none',
      borderRadius: '4px',
      padding: '6px 12px',
      color: 'white',
      cursor: 'pointer'
    }}
  >
    +5 ms (Start)
  </button>
</div>

          {/* Set start point button */}
          <button
            className="set-start-point-button"
            onClick={handleSetStartPoint}
            style={{
              background: "#FFD700",
              border: "none",
              borderRadius: "4px",
              padding: "10px",
              margin: "5px 0",
              color: "#333",
              fontWeight: "bold",
              cursor: "pointer",
              width: "100%",
            }}
          >
            Set Start Point
          </button>
        </>
      )}
    </div>
  );
};

export default WaveformVisualizer;
