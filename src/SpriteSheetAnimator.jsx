import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Play, Pause, Download, Trash2, Settings, Grid, Image as ImageIcon, Check, ArrowLeft, AlertCircle } from 'lucide-react';
import gifshot from 'gifshot';

// --- Main Component ---
export default function SpriteSheetAnimator() {
  const gifshotStatus = 'ready'; // gifshot is now imported directly

  // State
  const [imageSrc, setImageSrc] = useState(null);
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(4);
  const [frames, setFrames] = useState([]); // Array of dataURLs
  const [selectedIndices, setSelectedIndices] = useState([]); // Indices of frames to play
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [fps, setFps] = useState(8);
  const [isExporting, setIsExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState(null);
  const [showResult, setShowResult] = useState(false); // Toggle between editor and result view
  const [frameDimensions, setFrameDimensions] = useState({ width: 0, height: 0 });
  const [errorMsg, setErrorMsg] = useState(null);

  const fileInputRef = useRef(null);
  const animationIntervalRef = useRef(null);

  // --- Image Processing ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const processFile = (file) => {
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImageSrc(img.src);
        sliceImage(img, rows, cols);
        setShowResult(false);
        setExportUrl(null);
      };
      img.onerror = () => setErrorMsg("Failed to load image.");
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const sliceImage = (img, r, c) => {
    // FORCE INTEGERS: Floating point dimensions crash GIF generators
    const frameW = Math.floor(img.width / c);
    const frameH = Math.floor(img.height / r);
    
    setFrameDimensions({ width: frameW, height: frameH });

    const newFrames = [];
    for (let y = 0; y < r; y++) {
      for (let x = 0; x < c; x++) {
        const canvas = document.createElement('canvas');
        canvas.width = frameW;
        canvas.height = frameH;
        const ctx = canvas.getContext('2d');
        
        // Draw slice
        ctx.drawImage(
          img,
          x * frameW, y * frameH, frameW, frameH, // Source
          0, 0, frameW, frameH // Destination
        );
        newFrames.push(canvas.toDataURL('image/png'));
      }
    }
    setFrames(newFrames);
    // If no previous selection or reset needed, select first row
    if (selectedIndices.length === 0 || newFrames.length !== frames.length) {
        const row1 = Array.from({ length: Math.min(c, newFrames.length) }, (_, i) => i);
        setSelectedIndices(row1);
    }
  };

  // Re-slice if grid settings change
  useEffect(() => {
    if (imageSrc) {
      const img = new Image();
      img.onload = () => sliceImage(img, rows, cols);
      img.src = imageSrc;
    }
  }, [rows, cols]);

  // --- Animation Loop ---
  useEffect(() => {
    if (isPlaying && selectedIndices.length > 0 && !showResult) {
      animationIntervalRef.current = setInterval(() => {
        setCurrentFrameIndex((prev) => (prev + 1) % selectedIndices.length);
      }, 1000 / fps);
    } else {
      clearInterval(animationIntervalRef.current);
    }

    return () => clearInterval(animationIntervalRef.current);
  }, [isPlaying, fps, selectedIndices, showResult]);

  // --- Handlers ---
  const toggleFrameSelection = (index) => {
    if (showResult) return; 
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter((i) => i !== index));
    } else {
      setSelectedIndices([...selectedIndices, index].sort((a, b) => a - b));
    }
    setCurrentFrameIndex(0);
  };

  const selectRow = (rowIndex) => {
    if (showResult) setShowResult(false);
    const start = rowIndex * cols;
    const end = start + cols;
    const newSelection = [];
    for (let i = start; i < end; i++) {
      if (i < frames.length) newSelection.push(i);
    }
    setSelectedIndices(newSelection);
    setCurrentFrameIndex(0);
    setIsPlaying(true);
  };

  const selectAll = () => {
    if (showResult) setShowResult(false);
    setSelectedIndices(frames.map((_, i) => i));
    setCurrentFrameIndex(0);
    setIsPlaying(true);
  };

  const handleExport = () => {
    if (selectedIndices.length === 0) return;

    setErrorMsg(null);
    setIsExporting(true);
    setExportUrl(null);
    setShowResult(false);

    const imagesToExport = selectedIndices.map(i => frames[i]);

    // Ensure dimensions are valid integers
    const gifW = Math.max(1, Math.floor(frameDimensions.width));
    const gifH = Math.max(1, Math.floor(frameDimensions.height));

    gifshot.createGIF({
      images: imagesToExport,
      gifWidth: gifW,
      gifHeight: gifH,
      interval: 1 / fps,
      numFrames: imagesToExport.length,
      frameDuration: 1,
      sampleInterval: 10, // Relaxed from 1 to 10 for better compatibility
      numWorkers: 2,
    }, (obj) => {
      if (!obj.error) {
        setExportUrl(obj.image);
        setIsPlaying(false); // Stop loop
        setShowResult(true); // Switch to result view
      } else {
        console.error("GIF Export Error:", obj.errorMsg);
        setErrorMsg(`Error generating GIF: ${obj.errorMsg || 'Unknown error'}`);
      }
      setIsExporting(false);
    });
  };

  const triggerDownload = () => {
    if (!exportUrl) return;
    const a = document.createElement('a');
    a.href = exportUrl;
    a.download = 'sprite-animation.gif';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // --- UI Components ---

  if (!imageSrc) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div 
          className="bg-white p-12 rounded-2xl shadow-xl border-2 border-dashed border-indigo-200 flex flex-col items-center text-center max-w-lg w-full transition-all hover:border-indigo-400 cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) processFile(file);
          }}
        >
          <div className="bg-indigo-50 p-6 rounded-full mb-6">
            <Upload className="w-12 h-12 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Sprite Sheet Animator</h1>
          <p className="text-slate-500 mb-8">Upload your 4x4 sprite sheet to start animating. <br/> Supports JPG, PNG.</p>
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-semibold transition-colors shadow-lg shadow-indigo-200">
            Select Image
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            accept="image/*" 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Grid className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 hidden sm:block">Sprite Animator</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
            <span className="text-xs font-bold text-slate-500 px-3 uppercase tracking-wider">Rows</span>
            <input 
              type="number" 
              value={rows} 
              onChange={(e) => setRows(Number(e.target.value))} 
              className="w-12 bg-white border border-slate-300 rounded px-2 py-1 text-sm text-center focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <span className="text-slate-300 mx-2">×</span>
            <span className="text-xs font-bold text-slate-500 px-3 uppercase tracking-wider">Cols</span>
            <input 
              type="number" 
              value={cols} 
              onChange={(e) => setCols(Number(e.target.value))} 
              className="w-12 bg-white border border-slate-300 rounded px-2 py-1 text-sm text-center focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          
          <button 
            onClick={() => setImageSrc(null)} 
            className="text-slate-500 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
            title="Clear Image"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Preview & Controls */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Animation Preview Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  {showResult ? (
                    <><Check className="w-4 h-4 text-emerald-500" /> Result Ready</>
                  ) : (
                    <><Play className="w-4 h-4 text-indigo-500" /> Live Preview</>
                  )}
                </h3>
                {!showResult && selectedIndices.length > 0 && (
                  <span className="text-xs font-mono text-slate-400">
                    Frame {currentFrameIndex + 1}/{selectedIndices.length}
                  </span>
                )}
              </div>
              
              {/* CANVAS / DISPLAY AREA */}
              <div className="aspect-square flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-slate-100 p-8 relative">
                 {showResult && exportUrl ? (
                    /* --- RESULT GIF VIEW --- */
                    <div className="flex flex-col items-center justify-center w-full h-full animate-fade-in relative">
                        <img 
                          src={exportUrl} 
                          alt="Generated GIF" 
                          className="max-w-full max-h-full object-contain pixelated shadow-xl border-4 border-emerald-500 rounded-lg bg-white"
                          style={{ 
                            imageRendering: 'pixelated',
                            transform: 'scale(1.5)' 
                          }}
                        />
                         <div className="absolute bottom-4 bg-emerald-600/90 text-white text-[10px] uppercase font-bold px-3 py-1 rounded-full shadow backdrop-blur-sm">
                           Right-click to Save
                         </div>
                    </div>
                 ) : (
                   /* --- EDITING VIEW --- */
                   selectedIndices.length > 0 ? (
                     <img 
                       src={frames[selectedIndices[currentFrameIndex]]} 
                       alt="Animation Preview" 
                       className="max-w-full max-h-full object-contain pixelated shadow-xl"
                       style={{ 
                         imageRendering: 'pixelated',
                         transform: 'scale(1.5)' // Slight zoom for better visibility
                       }}
                     />
                   ) : (
                     <div className="text-slate-400 text-sm">Select frames to preview</div>
                   )
                 )}
              </div>

              <div className="p-6 bg-white space-y-6">
                
                {/* Error Message */}
                {errorMsg && (
                    <div className="bg-red-50 border border-red-100 p-3 rounded-lg flex items-start gap-2 text-sm text-red-700">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                {showResult ? (
                   /* --- DOWNLOAD CONTROLS --- */
                   <div className="space-y-4">
                      <button 
                        onClick={triggerDownload}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-semibold transition-colors shadow-lg shadow-emerald-100"
                      >
                         <Download className="w-5 h-5" /> Download GIF
                      </button>
                      
                      <button 
                        onClick={() => setShowResult(false)}
                        className="w-full flex items-center justify-center gap-2 py-2 text-slate-500 hover:text-slate-700 font-medium transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" /> Back to Editor
                      </button>

                      <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg text-xs text-emerald-800 text-center">
                         <strong>Troubleshooting:</strong> If the button above doesn't work, Right-Click the image with the green border and select "Save Image As...".
                      </div>
                   </div>
                ) : (
                  /* --- EDITOR CONTROLS --- */
                  <>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold transition-all ${
                          isPlaying 
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                        }`}
                      >
                        {isPlaying ? <><Pause className="w-5 h-5" /> Pause</> : <><Play className="w-5 h-5" /> Play</>}
                      </button>
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-slate-600 flex items-center gap-2">
                          <Settings className="w-4 h-4" /> Speed (FPS)
                        </label>
                        <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 rounded">{fps}</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="24" 
                        value={fps} 
                        onChange={(e) => setFps(Number(e.target.value))} 
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                      <div className="flex justify-between text-xs text-slate-400 mt-1">
                        <span>1 fps</span>
                        <span>12 fps</span>
                        <span>24 fps</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                      <button 
                        onClick={handleExport}
                        disabled={isExporting || selectedIndices.length === 0 || gifshotStatus !== 'ready'}
                        className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-colors shadow-lg shadow-slate-200"
                      >
                         {isExporting ? (
                           <span className="animate-pulse">Generating GIF...</span>
                         ) : gifshotStatus !== 'ready' ? (
                           <span className="animate-pulse">Loading Library...</span>
                         ) : (
                           <><Download className="w-5 h-5" /> Generate GIF</>
                         )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Grid & Sequencer */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Quick Select Actions */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-2 items-center">
               <span className="text-sm font-semibold text-slate-500 mr-2 uppercase tracking-wide text-xs">Quick Select:</span>
               {[...Array(rows)].map((_, idx) => (
                 <button 
                   key={idx}
                   onClick={() => selectRow(idx)}
                   className="px-3 py-1.5 text-sm font-medium bg-slate-100 text-slate-600 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                 >
                   Row {idx + 1}
                 </button>
               ))}
               <div className="w-px h-6 bg-slate-200 mx-2"></div>
               <button 
                 onClick={selectAll}
                 className="px-3 py-1.5 text-sm font-medium bg-slate-100 text-slate-600 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
               >
                 All Frames
               </button>
               <button 
                 onClick={() => setSelectedIndices([])}
                 className="px-3 py-1.5 text-sm font-medium bg-slate-100 text-red-500 rounded-lg hover:bg-red-50 transition-colors ml-auto"
               >
                 Clear
               </button>
            </div>

            {/* Frame Grid */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-semibold text-slate-700">Frame Selection</h3>
                <span className="text-sm text-slate-400">Click frames to include in loop</span>
              </div>
              
              <div 
                className={`grid gap-3 transition-opacity duration-200 ${showResult ? 'opacity-50 pointer-events-none grayscale' : ''}`}
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
              >
                {frames.map((frame, idx) => {
                   const isSelected = selectedIndices.includes(idx);
                   const isPlayingFrame = selectedIndices[currentFrameIndex] === idx && isPlaying && !showResult;
                   
                   return (
                    <div 
                      key={idx}
                      onClick={() => toggleFrameSelection(idx)}
                      className={`
                        aspect-square relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-200 group
                        ${isPlayingFrame ? 'ring-4 ring-amber-400 ring-offset-2 z-10' : ''}
                        ${isSelected 
                          ? 'border-indigo-500 bg-indigo-50' 
                          : 'border-slate-200 bg-white hover:border-indigo-300'
                        }
                      `}
                    >
                      <div className="absolute inset-0 flex items-center justify-center p-2">
                         <img 
                           src={frame} 
                           alt={`Frame ${idx}`} 
                           className="max-w-full max-h-full object-contain pixelated"
                           style={{ imageRendering: 'pixelated' }}
                         />
                      </div>
                      
                      <div className="absolute top-1 left-1 bg-white/90 backdrop-blur text-[10px] font-mono text-slate-500 px-1.5 rounded border border-slate-200">
                        {idx + 1}
                      </div>

                      {isSelected && (
                        <div className="absolute top-1 right-1 bg-indigo-500 text-white p-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                      
                      {/* Selection order indicator if multiple */}
                      {isSelected && selectedIndices.length > 1 && (
                         <div className="absolute bottom-1 right-1 bg-slate-800/80 text-white text-[10px] px-1.5 rounded-full font-bold">
                           #{selectedIndices.indexOf(idx) + 1}
                         </div>
                      )}
                    </div>
                   );
                })}
              </div>
            </div>

            <div className="bg-indigo-900 text-indigo-200 p-4 rounded-xl text-sm flex gap-3">
               <div className="bg-indigo-800 p-2 rounded-lg h-fit">
                 <ImageIcon className="w-5 h-5 text-indigo-400" />
               </div>
               <div>
                 <p className="font-semibold text-white mb-1">Tips for best results</p>
                 <ul className="list-disc list-inside space-y-1 opacity-80 text-xs">
                   <li>Ensure your sprite sheet is evenly spaced.</li>
                   <li>For standard RPG characters, try selecting just one row.</li>
                   <li>You can click frames in any order to create custom remix animations.</li>
                 </ul>
               </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}