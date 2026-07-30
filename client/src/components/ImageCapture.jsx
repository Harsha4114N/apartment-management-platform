import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * ImageCapture — Reusable component for uploading or live-capturing photos.
 *
 * Props:
 *   onCapture   : (file: File | null) => void   — called when a photo is taken/uploaded/removed
 *   currentImage: string | null                 — optional initial preview URL
 *   id          : string                        — unique element ID prefix (for multiple instances)
 *   label       : string                        — optional heading label (default: "Attach a Photo")
 */
export default function ImageCapture({
  onCapture,
  currentImage = null,
  id = 'img-capture',
  label = 'Attach a Photo',
}) {
  // ── State ──
  const [mode, setMode] = useState('upload');        // 'upload' | 'camera'
  const [preview, setPreview] = useState(currentImage);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [snapshotFlash, setSnapshotFlash] = useState(false);

  // ── Refs ──
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);

  // ── Cleanup camera on unmount ──
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ── Start camera ──
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.error('Camera access denied:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access or use Upload mode.'
          : 'Camera unavailable. Please use Upload mode instead.'
      );
    }
  }, []);

  // ── Stop camera ──
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // ── Switch to camera mode ──
  const handleCameraMode = () => {
    setMode('camera');
    setCameraError(null);
    // Camera will be started when video element is mounted (via onCanPlay)
  };

  // ── Switch back to upload mode ──
  const handleUploadMode = () => {
    stopCamera();
    setMode('upload');
    setCameraError(null);
  };

  // ── Snap photo from video feed ──
  const handleSnap = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    // Flash effect
    setSnapshotFlash(true);
    setTimeout(() => setSnapshotFlash(false), 200);

    // Convert canvas to Blob → File
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `snapshot-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        const url = URL.createObjectURL(file);
        setPreview(url);
        onCapture(file);
        stopCamera();
      },
      'image/jpeg',
      0.85
    );
  };

  // ── Handle file upload from input ──
  const handleFileSelect = (file) => {
    if (!file) return;
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    onCapture(file);
  };

  // ── Handle file input change ──
  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  // ── Drag-and-drop handlers ──
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelect(file);
  };

  // ── Remove photo ──
  const handleRemove = () => {
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
    setPreview(null);
    onCapture(null);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isPreviewing = preview !== null;

  return (
    <div className="space-y-3">
      {/* ── Label ── */}
      <label className="block text-sm font-semibold text-slate-700 mb-1">{label}</label>

      {/* ── Mode Toggle (only when not previewing) ── */}
      {!isPreviewing && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleUploadMode}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
              mode === 'upload'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            📁 Upload Photo
          </button>
          <button
            type="button"
            onClick={handleCameraMode}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
              mode === 'camera'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            📸 Take Photo
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/*  UPLOAD MODE                                   */}
      {/* ════════════════════════════════════════════════ */}
      {mode === 'upload' && !isPreviewing && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50/50'
          }`}
        >
          <input
            ref={fileInputRef}
            id={`${id}-file-input`}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            className="hidden"
          />

          <div className="flex flex-col items-center gap-2">
            {/* Upload icon */}
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
              isDragging ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
            }`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>

            <div>
              <p className={`text-sm font-medium ${isDragging ? 'text-indigo-600' : 'text-slate-600'}`}>
                {isDragging ? 'Drop photo here' : 'Click or drag & drop a photo'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Supports JPG, PNG, GIF · Max 10MB</p>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/*  CAMERA MODE                                   */}
      {/* ════════════════════════════════════════════════ */}
      {mode === 'camera' && !isPreviewing && (
        <div className="space-y-3">
          {/* Camera error state */}
          {cameraError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
              <div className="flex items-start gap-2">
                <span className="text-lg shrink-0">⚠️</span>
                <div>
                  <p className="font-semibold">Camera Error</p>
                  <p className="text-xs mt-0.5">{cameraError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleUploadMode}
                className="mt-3 text-sm font-semibold text-rose-600 hover:text-rose-700 underline cursor-pointer"
              >
                Switch to Upload mode
              </button>
            </div>
          )}

          {/* Camera viewfinder */}
          <div className="relative bg-black rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center">
            <video
              ref={videoRef}
              id={`${id}-video`}
              autoPlay
              playsInline
              muted
              onCanPlay={startCamera}
              className={`w-full h-full object-cover ${cameraActive ? '' : 'opacity-0'}`}
            />

            {/* Camera placeholder / loading */}
            {!cameraActive && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70">
                <svg className="w-10 h-10 animate-pulse mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm">Requesting camera...</p>
              </div>
            )}

            {/* Flash overlay */}
            {snapshotFlash && (
              <div className="absolute inset-0 bg-white animate-ping opacity-50 pointer-events-none" />
            )}
          </div>

          {/* Snap button + cancel */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSnap}
              disabled={!cameraActive}
              className="flex-1 py-3 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-200 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Snap Photo
            </button>
            <button
              type="button"
              onClick={handleUploadMode}
              className="px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold transition-all hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          {/* Hidden canvas for snapshot */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/*  PREVIEW (shown after capture/upload)          */}
      {/* ════════════════════════════════════════════════ */}
      {isPreviewing && (
        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white">
          <img
            src={preview}
            alt="Captured preview"
            className="w-full h-48 object-cover"
          />
          {/* Overlay with remove button */}
          <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
            <button
              type="button"
              onClick={handleRemove}
              className="opacity-0 hover:opacity-100 px-5 py-2.5 bg-white/90 hover:bg-white text-rose-600 rounded-xl text-sm font-bold shadow-lg transition-all duration-200 cursor-pointer backdrop-blur-sm"
            >
              ✕ Remove Photo
            </button>
          </div>
          {/* Badge */}
          <div className="absolute top-2 right-2 px-2.5 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-lg shadow-md">
            ✓ Photo Captured
          </div>
        </div>
      )}
    </div>
  );
}
