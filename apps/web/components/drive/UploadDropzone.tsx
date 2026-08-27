'use client';

import React, { useState, useRef } from 'react';
import { Icon } from '../ui/Icons';

interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  children: React.ReactNode;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function UploadDropzone({ onFilesSelected, children, inputRef: externalInputRef }: UploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef || internalInputRef;

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Only reset if left the outer container
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileList = Array.from(e.dataTransfer.files);
      onFilesSelected(fileList);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files);
      onFilesSelected(fileList);
      e.target.value = ''; // reset so same file can be picked again if needed
    }
  }

  return (
    <div
      className={`upload-dropzone-container${isDragOver ? ' upload-dropzone--active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        id="file-upload-input"
        onChange={handleFileInputChange}
      />

      {isDragOver && (
        <div className="upload-dropzone-overlay" aria-hidden="true">
          <div className="upload-dropzone-banner">
            <Icon name="upload" className="w-12 h-12 text-primary" />
            <p className="upload-dropzone-text">Drop files to upload to Orbit</p>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
