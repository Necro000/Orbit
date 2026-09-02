'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { FileItem } from '@/lib/folders';
import { formatBytes } from '@/lib/format';
import { getFileDetails, downloadFile } from '@/lib/files';
import { useToast } from '@/components/ui/Toast';

interface FilePreviewModalProps {
  file: FileItem | null;
  allFiles?: FileItem[];
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (file: FileItem) => void;
}

type PreviewType = 'video' | 'audio' | 'image' | 'pdf' | 'text' | 'generic';

function detectPreviewType(mimeType: string, filename: string): PreviewType {
  const mime = mimeType.toLowerCase();
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', 'ogv'].includes(ext)) {
    return 'video';
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma'].includes(ext)) {
    return 'audio';
  }
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    return 'image';
  }
  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (
    mime.startsWith('text/') ||
    [
      'txt', 'md', 'markdown', 'json', 'ts', 'tsx', 'js', 'jsx', 'html', 'css',
      'scss', 'py', 'sql', 'sh', 'yaml', 'yml', 'xml', 'env', 'log', 'csv', 'rs', 'go', 'c', 'cpp', 'java'
    ].includes(ext)
  ) {
    return 'text';
  }
  return 'generic';
}

export function FilePreviewModal({
  file,
  allFiles = [],
  isOpen,
  onClose,
  onNavigate,
}: FilePreviewModalProps) {
  const { toast } = useToast();
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Video playback & control state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);

  // Text file content state
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isTextLoading, setIsTextLoading] = useState(false);

  // Image viewer transform state
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const previewType = useMemo(() => {
    if (!file) return 'generic';
    return detectPreviewType(file.mime_type, file.name);
  }, [file]);

  // Current index for previous / next navigation
  const currentIndex = useMemo(() => {
    if (!file || allFiles.length === 0) return -1;
    return allFiles.findIndex((f) => f.id === file.id);
  }, [file, allFiles]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < allFiles.length - 1;

  const handlePrev = useCallback(() => {
    const prevItem = allFiles[currentIndex - 1];
    if (hasPrev && onNavigate && prevItem) {
      onNavigate(prevItem);
    }
  }, [hasPrev, onNavigate, allFiles, currentIndex]);

  const handleNext = useCallback(() => {
    const nextItem = allFiles[currentIndex + 1];
    if (hasNext && onNavigate && nextItem) {
      onNavigate(nextItem);
    }
  }, [hasNext, onNavigate, allFiles, currentIndex]);

  // Fetch file URLs on open / file switch
  useEffect(() => {
    if (!isOpen || !file) {
      return;
    }

    let isMounted = true;
    void Promise.resolve().then(() => {
      if (!isMounted) return;
      setIsLoading(true);
      setError(null);
      setTextContent(null);
      setZoom(1);
      setRotation(0);
      setPlaybackRate(1);
    });

    getFileDetails(file.id)
      .then((data) => {
        if (!isMounted) return;
        const sUrl = data.streamUrl || data.downloadUrl;
        setStreamUrl(sUrl);
        setIsLoading(false);

        // If it's a text file, fetch content
        if (detectPreviewType(file.mime_type, file.name) === 'text' && sUrl) {
          setIsTextLoading(true);
          fetch(sUrl)
            .then((res) => {
              if (!res.ok) throw new Error('Failed to load text content');
              return res.text();
            })
            .then((text) => {
              if (isMounted) setTextContent(text);
            })
            .catch((err) => {
              if (isMounted) console.warn('Could not fetch text content:', err);
            })
            .finally(() => {
              if (isMounted) setIsTextLoading(false);
            });
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load file preview.');
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, file]);

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(console.warn);
    } else {
      videoRef.current.pause();
    }
  };

  const handlePipToggle = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP not available:', err);
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ' && previewType === 'video') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === 'ArrowLeft') {
        if (previewType === 'video' && videoRef.current) {
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
        } else if (hasPrev) {
          handlePrev();
        }
      } else if (e.key === 'ArrowRight') {
        if (previewType === 'video' && videoRef.current) {
          videoRef.current.currentTime = Math.min(
            videoRef.current.duration || 9999,
            videoRef.current.currentTime + 5,
          );
        } else if (hasNext) {
          handleNext();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, previewType, hasPrev, hasNext, handlePrev, handleNext, onClose]);

  if (!isOpen || !file) return null;

  const handleDownload = async () => {
    try {
      await downloadFile(file.id);
      toast({ type: 'success', message: `Downloading ${file.name}` });
    } catch {
      toast({ type: 'error', message: 'Failed to download file.' });
    }
  };

  const handleCopyText = async () => {
    if (!textContent) return;
    try {
      await navigator.clipboard.writeText(textContent);
      toast({ type: 'success', message: 'Copied file contents to clipboard!' });
    } catch {
      toast({ type: 'info', message: 'Please copy manually.' });
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-xl animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-filename"
    >
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-6 py-3.5 border-b border-white/10 bg-[#0F0F14]/90 z-20 select-none">
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
            {previewType === 'video' && (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {previewType === 'audio' && (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            )}
            {previewType === 'image' && (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
            {previewType === 'pdf' && (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            {previewType === 'text' && (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            )}
            {previewType === 'generic' && (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <h2 id="preview-filename" className="text-sm font-semibold text-white truncate max-w-md" title={file.name}>
              {file.name}
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>{formatBytes(file.size_bytes)}</span>
              <span>•</span>
              <span className="uppercase font-mono tracking-wider">{file.mime_type.split('/')[1] || file.mime_type}</span>
              {previewType === 'video' && videoDuration !== null && (
                <>
                  <span>•</span>
                  <span className="text-indigo-300 font-mono">{formatTime(videoCurrentTime)} / {formatTime(videoDuration)}</span>
                </>
              )}
              {allFiles.length > 1 && (
                <>
                  <span>•</span>
                  <span>{currentIndex + 1} of {allFiles.length}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Video Playback Speed Selector */}
          {previewType === 'video' && streamUrl && (
            <div className="hidden sm:flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1 mr-1">
              {[0.5, 1, 1.25, 1.5, 2].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => handlePlaybackRateChange(rate)}
                  className={`px-2 py-0.5 text-[11px] font-mono rounded transition ${
                    playbackRate === rate
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                  title={`Play at ${rate}x speed`}
                >
                  {rate}x
                </button>
              ))}
              <div className="w-[1px] h-3 bg-white/10 mx-1" />
              <button
                type="button"
                onClick={handlePipToggle}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition"
                title="Picture-in-Picture"
                aria-label="Picture in Picture"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2v-6m-5 3h5v-5h-5v5z" />
                </svg>
              </button>
            </div>
          )}

          {/* Image zoom & rotate toolbar */}
          {previewType === 'image' && (
            <div className="hidden sm:flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1 mr-2">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => { setZoom(1); setRotation(0); }}
                className="px-2 py-1 text-xs font-mono rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                title="Reset Zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                title="Zoom In"
                aria-label="Zoom In"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <div className="w-[1px] h-4 bg-white/10 mx-1" />
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                title="Rotate 90°"
                aria-label="Rotate 90 degrees"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          )}

          {/* Copy content button for text/code */}
          {previewType === 'text' && textContent !== null && (
            <button
              type="button"
              onClick={handleCopyText}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium border border-white/10 transition"
              title="Copy content to clipboard"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              <span>Copy</span>
            </button>
          )}

          {/* Download button */}
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/20 transition"
            title="Download file"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="hidden sm:inline">Download</span>
          </button>

          {/* Open in new tab */}
          {streamUrl && (
            <a
              href={streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
              title="Open stream in new tab"
              aria-label="Open in new tab"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition ml-1"
            title="Close (Esc)"
            aria-label="Close preview"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative flex items-center justify-center p-4 sm:p-8 overflow-hidden">
        {/* Previous Navigation Arrow */}
        {hasPrev && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 border border-white/20 text-white flex items-center justify-center shadow-2xl hover:scale-105 transition backdrop-blur-md"
            title="Previous file (Left Arrow)"
            aria-label="Previous file"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Next Navigation Arrow */}
        {hasNext && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 border border-white/20 text-white flex items-center justify-center shadow-2xl hover:scale-105 transition backdrop-blur-md"
            title="Next file (Right Arrow)"
            aria-label="Next file"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Content Viewer Body */}
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">Opening {file.name}...</p>
          </div>
        ) : error ? (
          <div className="max-w-md w-full p-6 rounded-2xl bg-red-950/40 border border-red-800/60 text-center space-y-3">
            <div className="text-3xl">⚠️</div>
            <h3 className="text-base font-semibold text-red-200">Unable to load preview</h3>
            <p className="text-xs text-red-300/80">{error}</p>
            <button
              type="button"
              onClick={handleDownload}
              className="mt-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition"
            >
              Download File Instead
            </button>
          </div>
        ) : previewType === 'video' && streamUrl ? (
          <div className="relative w-full h-full max-w-5xl max-h-[85vh] flex items-center justify-center rounded-2xl overflow-hidden bg-black/80 border border-white/10 shadow-2xl group">
            <video
              ref={videoRef}
              key={streamUrl}
              src={streamUrl}
              controls
              autoPlay
              playsInline
              preload="auto"
              onTimeUpdate={() => {
                if (videoRef.current) {
                  setVideoCurrentTime(videoRef.current.currentTime);
                }
              }}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  setVideoDuration(videoRef.current.duration);
                  videoRef.current.playbackRate = playbackRate;
                }
              }}
              onError={(e) => {
                console.warn('Video playback error:', e);
                setError('Your browser was unable to decode this video format. You can download the file to play it locally.');
              }}
              className="w-full h-full max-h-[85vh] object-contain rounded-xl"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        ) : previewType === 'audio' && streamUrl ? (
          <div className="w-full max-w-xl p-8 rounded-2xl bg-[#14141E] border border-slate-700/80 shadow-2xl flex flex-col items-center text-center space-y-6">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/25 animate-pulse">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-white">{file.name}</h3>
              <p className="text-xs text-slate-400">{formatBytes(file.size_bytes)} • Audio Track</p>
            </div>
            <audio
              key={streamUrl}
              src={streamUrl}
              controls
              autoPlay
              preload="auto"
              className="w-full filter invert hue-rotate-180 brightness-95 rounded-lg"
            >
              Your browser does not support the audio element.
            </audio>
          </div>
        ) : previewType === 'image' && streamUrl ? (
          <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={streamUrl}
              alt={file.name}
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              className="max-w-full max-h-[82vh] object-contain rounded-lg shadow-2xl select-none"
            />
          </div>
        ) : previewType === 'pdf' && streamUrl ? (
          <div className="w-full h-full max-w-6xl max-h-[88vh] rounded-xl overflow-hidden border border-white/10 bg-slate-900 shadow-2xl flex flex-col">
            <iframe
              src={streamUrl}
              title={file.name}
              className="w-full h-full flex-1 border-none rounded-xl"
            />
          </div>
        ) : previewType === 'text' ? (
          <div className="w-full h-full max-w-5xl max-h-[85vh] rounded-2xl overflow-hidden border border-white/10 bg-[#0E1117] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-400">
              <span>{file.name}</span>
              {textContent && <span>{textContent.split('\n').length} lines</span>}
            </div>
            <div className="flex-1 overflow-auto p-6 font-mono text-xs leading-relaxed text-slate-200 bg-[#0B0D13]">
              {isTextLoading ? (
                <div className="flex items-center justify-center h-48 text-slate-400 gap-2">
                  <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span>Loading text...</span>
                </div>
              ) : textContent !== null ? (
                <pre className="whitespace-pre-wrap break-words">{textContent}</pre>
              ) : (
                <p className="text-slate-400">Unable to preview text directly.</p>
              )}
            </div>
          </div>
        ) : (
          /* Generic File Preview Card */
          <div className="w-full max-w-md p-8 rounded-2xl bg-[#14141E] border border-slate-700/80 shadow-2xl flex flex-col items-center text-center space-y-5">
            <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl shadow-inner">
              📦
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-white break-all">{file.name}</h3>
              <p className="text-xs text-slate-400">{formatBytes(file.size_bytes)} • {file.mime_type}</p>
            </div>
            <p className="text-xs text-slate-400 max-w-xs">
              Direct in-browser preview is not available for this file type. You can download the file to view it on your device.
            </p>
            <button
              type="button"
              onClick={handleDownload}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download File</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
