import React, { useRef, useEffect, useState } from 'react';

const WaveformVisualizer = ({ audioUrl, onStartPointChange, audioRef, musicStartPoint = 0 }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(800); 
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = full waveform visible
  const [waveformOffset, setWaveformOffset] = useState(0); // Horizontal scroll position
  
  // Load and decode audio data
  useEffect(() => {
    if (!audioUrl) return;
    
    setIsLoading(true);
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    fetch(audioUrl)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
      .then(buffer => {
        setAudioBuffer(buffer);
        setDuration(buffer.duration);
        setIsLoading(false);
      })
      .catch(error => {
        console.error("Error decoding audio data", error);
        setIsLoading(false);
      });
  }, [audioUrl]);

  // Update canvas width on mount
  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      setCanvasWidth(canvas.width);
    }
  }, [canvasRef.current]);
  
  // Enhanced time update handler with millisecond precision
  useEffect(() => {
    const audioElement = audioRef?.current;
    if (!audioElement) return;

    const updatePlaybackTime = () => {
      // Set with full precision
      setCurrentPlaybackTime(audioElement.currentTime);
    };

    audioElement.addEventListener('timeupdate', updatePlaybackTime);

    return () => {
      audioElement.removeEventListener('timeupdate', updatePlaybackTime);
    };
  }, [audioRef]);
  
  // Effect to center the view on the start point when it changes
  useEffect(() => {
    if (!audioBuffer || duration === 0) return;
    
    // Center the view on the start point when zoomed in
    if (zoomLevel > 1) {
      const visibleDuration = duration / zoomLevel;
      const newOffset = Math.max(0, Math.min(duration - visibleDuration, musicStartPoint - (visibleDuration / 2)));
      setWaveformOffset(newOffset);
    }
  }, [musicStartPoint, zoomLevel, audioBuffer, duration]);
  
  // Draw waveform
  useEffect(() => {
    if (!audioBuffer || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw background
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, width, height);
    
    // Get audio data
    const channelData = audioBuffer.getChannelData(0); // Use first channel
    
    // Calculate visible portion based on zoom and offset
    const visibleDuration = duration / zoomLevel;
    const startTime = Math.max(0, Math.min(duration - visibleDuration, waveformOffset));
    const endTime = startTime + visibleDuration;
    
    // Calculate sample indices
    const totalSamples = channelData.length;
    const startSample = Math.floor((startTime / duration) * totalSamples);
    const endSample = Math.floor((endTime / duration) * totalSamples);
    const visibleSamples = endSample - startSample;
    
    // Draw waveform
    const barWidth = 1;
    const barGap = 0;
    const totalBars = Math.floor(width / (barWidth + barGap));
    const samplesPerBar = Math.floor(visibleSamples / totalBars);
    
    ctx.fillStyle = '#FFFFFF';
    
    for (let i = 0; i < totalBars; i++) {
      const barPosition = i * (barWidth + barGap);
      
      // Calculate sample position
      const barStartSample = startSample + Math.floor((i / totalBars) * visibleSamples);
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
      const y = (height / 2) - scaledPeak;
      const barHeight = scaledPeak * 2; // Symmetric around center
      
      ctx.fillRect(x, y, barWidth, barHeight);
    }
    
    // Draw time markers
    ctx.fillStyle = '#777';
    ctx.font = '10px Arial';
    
    // Determine appropriate time step based on zoom level
    let timeStep = 1.0; // Default 1 second
    if (zoomLevel >= 8) timeStep = 0.1; // 100ms
    else if (zoomLevel >= 4) timeStep = 0.25; // 250ms
    else if (zoomLevel >= 2) timeStep = 0.5; // 500ms
    
    for (let time = Math.ceil(startTime / timeStep) * timeStep; time <= endTime; time += timeStep) {
      // Convert time to x position
      const timeX = ((time - startTime) / visibleDuration) * width;
      
      // Draw time marker line
      ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
      ctx.fillRect(timeX, 0, 1, height);
      
      // Draw time label
      if (timeStep >= 0.5 || Math.round(time * 10) % 10 === 0) { // Only show some labels when zoomed in
        ctx.fillStyle = '#AAA';
        ctx.textAlign = 'center';
        ctx.fillText(formatTime(time, false), timeX, height - 5);
      }
    }
    
    // Draw playhead position
    if (currentPlaybackTime >= startTime && currentPlaybackTime <= endTime) {
      const playheadX = ((currentPlaybackTime - startTime) / visibleDuration) * width;
      ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.fillRect(playheadX - 1, 0, 2, height);
    }
    
    // Draw start point marker
    if (musicStartPoint >= startTime && musicStartPoint <= endTime) {
      const markerX = ((musicStartPoint - startTime) / visibleDuration) * width;
      ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
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
    ctx.fillStyle = 'rgba(100, 100, 255, 0.5)';
    ctx.fillRect(0, height - zoomIndicatorHeight, width * (visibleDuration / duration), zoomIndicatorHeight);
    
  }, [audioBuffer, currentPlaybackTime, zoomLevel, waveformOffset, canvasWidth, duration, musicStartPoint]);
  
  // Format time with or without milliseconds
  const formatTime = (timeInSeconds, showMs = true) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    
    if (showMs) {
      const milliseconds = Math.floor((timeInSeconds % 1) * 1000);
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  };
  
  // Handle waveform click to set playback position
  const handleWaveformClick = (e) => {
    if (!audioBuffer || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    
    // Calculate visible duration based on zoom level
    const visibleDuration = duration / zoomLevel;
    const startTime = Math.max(0, Math.min(duration - visibleDuration, waveformOffset));
    
    // Calculate click time
    const clickTime = startTime + (clickX / canvas.width) * visibleDuration;
    const preciseTime = Math.round(clickTime * 1000) / 1000; // Round to milliseconds
    
    // Update audio position
    if (audioRef?.current) {
      audioRef.current.currentTime = preciseTime;
    }
    
    // Update playback position
    setCurrentPlaybackTime(preciseTime);
  };
  
  // Zoom controls - focus on start point or current position
  const handleZoomIn = () => {
    setZoomLevel(prev => {
      const newZoom = Math.min(32, prev * 2);
      
      // When zooming in, center the view on start point
      // If playback is far from start point, use current playback position instead
      if (audioBuffer) {
        const visibleDuration = duration / newZoom;
        const focusTime = Math.abs(currentPlaybackTime - musicStartPoint) > visibleDuration ? 
                          currentPlaybackTime : musicStartPoint;
        
        const newOffset = Math.max(0, Math.min(duration - visibleDuration, 
                                              focusTime - (visibleDuration / 2)));
        setWaveformOffset(newOffset);
      }
      
      return newZoom;
    });
  };
  
  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const newZoom = Math.max(1, prev / 2);
      
      // When fully zoomed out, reset offset
      if (newZoom === 1) {
        setWaveformOffset(0);
      } else if (audioBuffer) {
        // Keep the view centered on the start point
        const visibleDuration = duration / newZoom;
        const newOffset = Math.max(0, Math.min(duration - visibleDuration, 
                                              musicStartPoint - (visibleDuration / 2)));
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
    const newOffset = Math.max(0, Math.min(duration - visibleDuration, 
                                          musicStartPoint - (visibleDuration / 2)));
    setWaveformOffset(newOffset);
  };
  
  // Scroll waveform horizontally
  const handleScroll = (e) => {
    if (!audioBuffer) return;
    
    // Prevent default scroll behavior
    e.preventDefault();
    
    const visibleDuration = duration / zoomLevel;
    const maxOffset = Math.max(0, duration - visibleDuration);
    
    // Adjust scroll speed based on zoom level
    const scrollSpeed = 0.1 * visibleDuration;
    
    if (e.deltaY > 0) {
      // Scroll right
      setWaveformOffset(prev => Math.min(maxOffset, prev + scrollSpeed));
    } else {
      // Scroll left
      setWaveformOffset(prev => Math.max(0, prev - scrollSpeed));
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
    e.currentTarget.style.cursor = 'grabbing';
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
    setWaveformOffset(prev => {
      const newOffset = Math.max(0, Math.min(maxOffset, prev - timeChange));
      return newOffset;
    });
    
    setDragStartX(e.clientX);
  };
  
  const handleMouseUp = (e) => {
    setIsDragging(false);
    e.currentTarget.style.cursor = 'grab';
  };
  
  // Set start point to current playback position
  const handleSetStartPoint = () => {
    if (!audioRef?.current) return;
    
    // Round to millisecond precision
    const startTime = Math.round(currentPlaybackTime * 1000) / 1000;
    
    // Notify parent component
    onStartPointChange(startTime);
    
    // If zoomed in, make sure start point is visible
    if (zoomLevel > 1) {
      const visibleDuration = duration / zoomLevel;
      const startTime = waveformOffset;
      const endTime = startTime + visibleDuration;
      
      // If start point is outside visible area, center the view on it
      if (startTime > currentPlaybackTime || endTime < currentPlaybackTime) {
        const newOffset = Math.max(0, Math.min(duration - visibleDuration, 
                                              currentPlaybackTime - (visibleDuration / 2)));
        setWaveformOffset(newOffset);
      }
    }
  };
  
  // Fine tune adjustments with millisecond precision
  const adjustTimeByMs = (milliseconds) => {
    if (!audioRef?.current) return;
    
    // Calculate new time with millisecond precision
    const newTime = Math.max(0, Math.min(duration, currentPlaybackTime + (milliseconds / 1000)));
    
    // Round to 3 decimal places for consistent ms display
    const preciseTime = Math.round(newTime * 1000) / 1000;
    
    // Update audio position
    audioRef.current.currentTime = preciseTime;
    
    // Update playback position
    setCurrentPlaybackTime(preciseTime);
    
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
  
  // Direct time input
  const handleDirectTimeInput = () => {
    const timeStr = prompt("Enter time (MM:SS.mmm):", formatTime(currentPlaybackTime));
    if (!timeStr) return;
    
    try {
      // Parse time string (MM:SS.mmm)
      const [minutesPart, secondsPart] = timeStr.split(':');
      let seconds = 0;
      let milliseconds = 0;
      
      if (secondsPart.includes('.')) {
        const [secondsWhole, millisecondsStr] = secondsPart.split('.');
        seconds = parseInt(secondsWhole, 10);
        milliseconds = parseInt(millisecondsStr, 10);
      } else {
        seconds = parseInt(secondsPart, 10);
      }
      
      const minutes = parseInt(minutesPart, 10);
      
      // Calculate total time in seconds with millisecond precision
      const totalSeconds = (minutes * 60) + seconds + (milliseconds / 1000);
      
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
          const newOffset = Math.max(0, Math.min(duration - visibleDuration, 
                                                totalSeconds - (visibleDuration / 2)));
          setWaveformOffset(newOffset);
        }
      } else {
        alert(`Please enter a time between 0:00.000 and ${formatTime(duration)}`);
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
          {/* Waveform canvas with interaction handlers */}
          <div 
            className="waveform-canvas-container" 
            style={{ position: 'relative', cursor: isDragging ? 'grabbing' : 'grab' }}
            onWheel={handleScroll}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={!isDragging ? handleWaveformClick : null}
          >
            <canvas 
              ref={canvasRef} 
              width={800} 
              height={80} 
              className="waveform-canvas"
            />
            
            {/* Zoom controls overlay */}
            <div 
              className="zoom-controls" 
              style={{
                position: 'absolute',
                top: '5px',
                right: '5px',
                display: 'flex',
                gap: '5px'
              }}
            >
              <button 
                onClick={handleZoomIn}
                style={{
                  background: 'rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  cursor: 'pointer'
                }}
              >+</button>
              <button 
                onClick={handleZoomOut}
                style={{
                  background: 'rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  cursor: 'pointer'
                }}
              >-</button>
            </div>
            
            {/* Focus on start point button */}
            <button
              onClick={focusOnStartPoint}
              style={{
                position: 'absolute',
                top: '5px',
                left: '30px',
                background: 'rgba(255, 215, 0, 0.5)',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                padding: '2px 6px',
                fontSize: '10px',
                cursor: 'pointer'
              }}
              title="Focus view on start point"
            >
              Find Start
            </button>
            
            {/* Zoom level indicator */}
            <div 
              style={{
                position: 'absolute',
                top: '5px',
                left: '5px',
                background: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                borderRadius: '3px',
                padding: '2px 5px',
                fontSize: '10px'
              }}
            >
              {zoomLevel}x
            </div>
          </div>
          
          {/* Time display with millisecond precision */}
          <div 
            className="waveform-timestamps"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '5px 0',
              fontSize: '12px',
              fontFamily: 'monospace'
            }}
          >
            <span 
              className="current-time"
              style={{
                color: 'white',
                background: 'rgba(255, 0, 0, 0.2)',
                borderRadius: '3px',
                padding: '2px 5px',
                cursor: 'pointer'
              }}
              onClick={handleDirectTimeInput}
              title="Click to enter exact time"
            >
              {formatTime(currentPlaybackTime)}
            </span>
            
            <span 
              className="start-point"
              style={{
                color: 'white',
                background: 'rgba(255, 215, 0, 0.2)',
                borderRadius: '3px',
                padding: '2px 5px',
                cursor: 'pointer'
              }}
              onClick={focusOnStartPoint}
              title="Click to focus on start point"
            >
              Start: {formatTime(musicStartPoint)}
            </span>
            
            <span 
              className="duration"
              style={{
                color: 'white',
                background: 'rgba(100, 100, 100, 0.2)',
                borderRadius: '3px',
                padding: '2px 5px'
              }}
            >
              Total: {formatTime(duration)}
            </span>
          </div>
          
          {/* Controls row */}
          <div 
            className="waveform-controls"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '5px 0'
            }}
          >
            {/* Set start point button */}
            <button 
              className="set-start-point-button" 
              onClick={handleSetStartPoint}
              style={{
                background: '#FFD700',
                border: 'none',
                borderRadius: '4px',
                padding: '8px',
                color: '#333',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Set Start Point
            </button>
            
            {/* Fine tune controls */}
            <div 
              className="fine-tune-controls"
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '4px',
                flexWrap: 'wrap'
              }}
            >
              <button 
                onClick={() => adjustTimeByMs(-100)}
                style={{
                  background: '#444',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '4px 8px',
                  color: 'white',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >-100ms</button>
              <button 
                onClick={() => adjustTimeByMs(-10)}
                style={{
                  background: '#444',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '4px 8px',
                  color: 'white',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >-10ms</button>
              <button 
                onClick={() => adjustTimeByMs(-1)}
                style={{
                  background: '#444',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '4px 8px',
                  color: 'white',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >-1ms</button>
              <button 
                onClick={() => adjustTimeByMs(1)}
                style={{
                  background: '#444',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '4px 8px',
                  color: 'white',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >+1ms</button>
              <button 
                onClick={() => adjustTimeByMs(10)}
                style={{
                  background: '#444',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '4px 8px',
                  color: 'white',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >+10ms</button>
              <button 
                onClick={() => adjustTimeByMs(100)}
                style={{
                  background: '#444',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '4px 8px',
                  color: 'white',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >+100ms</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default WaveformVisualizer;