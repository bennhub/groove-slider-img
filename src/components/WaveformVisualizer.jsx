import React, { useRef, useEffect, useState } from 'react';

const WaveformVisualizer = ({ audioUrl, onStartPointChange, audioRef, musicStartPoint = 0 }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(800); 
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(musicStartPoint);
  const [waveformOffset, setWaveformOffset] = useState(() => {
    const width = canvasRef.current?.width || 800;
    return -(musicStartPoint / duration) * width;
  });

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
        
        // Calculate initial offset based on musicStartPoint
        const width = canvasRef.current?.width || 800;
        setCanvasWidth(width);
        
        const initialOffset = (musicStartPoint / buffer.duration) * width;
        setWaveformOffset(-initialOffset);
        
        setIsLoading(false);
      })
      .catch(error => {
        console.error("Error decoding audio data", error);
        setIsLoading(false);
      });
  }, [audioUrl]);

  useEffect(() => {
  const audioElement = audioRef?.current;
  if (!audioElement) return;

  const updatePlaybackTime = () => {
    setCurrentPlaybackTime(audioElement.currentTime);
  };

  audioElement.addEventListener('timeupdate', updatePlaybackTime);

  return () => {
    audioElement.removeEventListener('timeupdate', updatePlaybackTime);
  };
}, [audioRef]);
  
  // Update canvas width on mount
  useEffect(() => {
    if (canvasRef.current) {
      setCanvasWidth(canvasRef.current.width);
    }
  }, [canvasRef.current]);
  
  // Draw waveform
  // In the waveform drawing useEffect
useEffect(() => {
    if (!audioBuffer || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvasWidth;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw background
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, width, height);
    
    // Get audio data
    const channelData = audioBuffer.getChannelData(0); // Use first channel
    
    // Zoom in: select a portion of the samples
    const totalSamplesToShow = Math.floor(channelData.length * 0.01);
    const startSampleIndex = Math.floor(channelData.length * 0.4);
    
    // Draw waveform bars
    const barWidth = 5;
    const barGap = 3;
    const totalBars = Math.floor(width / (barWidth + barGap));
    const samplesPerBar = Math.floor(totalSamplesToShow / totalBars);
    
    ctx.fillStyle = '#FFFFFF';
    
    // Calculate waveform offset based on current time
    const playbackOffset = (currentPlaybackTime / duration) * width;
    
    for (let i = 0; i < totalBars; i++) {
      // Adjust sample position to use the zoomed-in portion
      const samplePosition = startSampleIndex + (i / totalBars) * totalSamplesToShow;
      const startSample = Math.floor(samplePosition);
      let peak = 0;
      
      // Find the peak amplitude in this segment
      for (let j = 0; j < samplesPerBar; j++) {
        const sampleIndex = startSample + j;
        if (sampleIndex < channelData.length) {
          const amplitude = Math.abs(channelData[sampleIndex]);
          if (amplitude > peak) {
            peak = amplitude;
          }
        }
      }
      
      // Scale the peak to fit the canvas height
      const scaledPeak = Math.min(2, peak * 0.9) * (height / 2);
      
      // Calculate bar positions
      const barPosition = i * (barWidth + barGap);
      const offsetPosition = barPosition - playbackOffset;
      const x = offsetPosition;
      const y = (height / 2) - scaledPeak;
      const barHeight = scaledPeak * 2; // Symmetric around center
      
      // Draw the bar
      ctx.fillRect(x, y, barWidth, barHeight);
    }
    
    // Draw playhead (fixed position marker)
    ctx.fillStyle = '#FFD700'; // Gold color
    ctx.fillRect(0, 0, 20, height);
    
  }, [audioBuffer, currentPlaybackTime, canvasWidth, duration]);
  
  // Mouse event handlers
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
    
    // Constrain the waveform offset
    const maxOffset = 0; // Can't drag right beyond start
    const minOffset = -(audioBuffer.duration / audioBuffer.duration) * canvasWidth; // Can't drag left beyond end
    
    setWaveformOffset(prev => {
      const newOffset = prev + dx;
      return Math.max(minOffset, Math.min(maxOffset, newOffset));
    });
    
    setDragStartX(e.clientX);
  };
  
  const handleMouseUp = (e) => {
    setIsDragging(false);
    e.currentTarget.style.cursor = 'grab';
  };
  
  // Format time as MM:SS
  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Fallback for audioRef if not provided
  const handleChooseSegment = () => {
    const currentAudioRef = audioRef?.current || 
      (containerRef.current?.closest('.music-panel')?.querySelector('audio') || 
       document.querySelector('audio'));
    
    if (currentAudioRef) {
      // Use the current time directly from the audio element
      const startTime = currentAudioRef.currentTime;
      
      // Set the start point
      onStartPointChange(startTime);
    } else {
      console.error('No audio element found to set start time');
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
  onMouseDown={handleMouseDown}
  onMouseMove={handleMouseMove}
  onMouseUp={handleMouseUp}
  onMouseLeave={handleMouseUp}
  style={{ 
    cursor: 'default', // Changed from 'grab'
    pointerEvents: 'none' // Prevents interaction
  }}
>
  <canvas 
    ref={canvasRef} 
    width={800} 
    height={80} 
    className="waveform-canvas"
  />
</div>
          <div className="waveform-timestamps">
            <span className="start-time">{formatTime(0)}</span>
            <span className="play-from">
  Play from: {formatTime(currentPlaybackTime)}
</span>
            <span className="end-time">{formatTime(duration)}</span>
          </div>
          <div className="waveform-controls">
            <button 
              className="choose-segment" 
              onClick={handleChooseSegment}
            >
              Set Start Point
            </button>
          </div>
        </>
      )}
    </div>
  );a
};

export default WaveformVisualizer;