import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from './api';
import type { FileItem, FolderContentsResponse } from './folders';

export interface InitUploadResponse {
  file: {
    id: string;
    name: string;
    mime_type: string;
    size_bytes: string;
    status: string;
  };
  upload: {
    uploadUrl: string;
    method: string;
    headers?: Record<string, string>;
  };
}

export function useRenameFile(currentFolderId: string | 'root' = 'root') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      return apiFetch<{ file: FileItem }>(`/api/files/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName }),
      });
    },
    onMutate: async ({ id, newName }) => {
      await queryClient.cancelQueries({ queryKey: ['folder', currentFolderId] });
      const prevData = queryClient.getQueryData<FolderContentsResponse>(['folder', currentFolderId]);
      if (prevData) {
        queryClient.setQueryData(['folder', currentFolderId], {
          ...prevData,
          files: prevData.files.map((f) => (f.id === id ? { ...f, name: newName } : f)),
        });
      }
      return { prevData };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevData) {
        queryClient.setQueryData(['folder', currentFolderId], context.prevData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['folder', currentFolderId] });
    },
  });
}

export function useDeleteFile(currentFolderId: string | 'root' = 'root') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiFetch<{ ok: boolean }>(`/api/files/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder', currentFolderId] });
    },
  });
}

export interface FileDetailsResponse {
  file: FileItem & { role?: string };
  downloadUrl: string;
  streamUrl?: string;
}

export async function getFileDetails(fileId: string): Promise<FileDetailsResponse> {
  return apiFetch<FileDetailsResponse>(`/api/files/${fileId}`);
}

export async function downloadFile(fileId: string) {
  const res = await apiFetch<FileDetailsResponse>(`/api/files/${fileId}`);
  const a = document.createElement('a');
  a.href = res.downloadUrl;
  a.download = res.file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function validateFileSizeLimit(file: File): { valid: boolean; error?: string } {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const mime = (file.type || '').toLowerCase();

  // Video max 2 GB
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv', 'avi', 'wmv'].includes(ext)) {
    if (file.size > 2 * 1024 * 1024 * 1024) {
      return { valid: false, error: 'Video files cannot exceed 2 GB.' };
    }
  }
  // Audio max 250 MB
  else if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext)) {
    if (file.size > 250 * 1024 * 1024) {
      return { valid: false, error: 'Audio files cannot exceed 250 MB.' };
    }
  }
  // Image max 100 MB
  else if (
    mime.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'jfif', 'webp', 'avif', 'heic', 'heif', 'svg', 'gif', 'bmp', 'ico', 'tiff'].includes(ext)
  ) {
    if (file.size > 100 * 1024 * 1024) {
      return { valid: false, error: 'Image files cannot exceed 100 MB.' };
    }
  }
  // All other files max 1 GB
  else if (file.size > 1024 * 1024 * 1024) {
    return { valid: false, error: 'Files cannot exceed 1 GB.' };
  }

  return { valid: true };
}

export async function uploadFileDirect(
  file: File,
  folderId?: string | null,
  onProgress?: (pct: number) => void,
): Promise<FileItem> {
  const check = validateFileSizeLimit(file);
  if (!check.valid) {
    throw new Error(check.error);
  }

  let mimeType = file.type || 'application/octet-stream';
  if ((mimeType === 'application/octet-stream' || !mimeType) && file.name.toLowerCase().endsWith('.jfif')) {
    mimeType = 'image/jpeg';
  }

  // 1. Init upload
  const initRes = await apiFetch<InitUploadResponse>('/api/files/init', {
    method: 'POST',
    body: JSON.stringify({
      name: file.name,
      mimeType,
      sizeBytes: file.size,
      folderId: folderId ?? null,
    }),
  });

  // 2. Direct upload to storage with progress tracking
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(initRes.upload.method, initRes.upload.uploadUrl, true);

    if (initRes.upload.headers) {
      Object.entries(initRes.upload.headers).forEach(([key, val]) => {
        xhr.setRequestHeader(key, val);
      });
    }

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Direct storage upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during file transfer'));
    xhr.send(file);
  });

  // 3. Complete upload
  const completeRes = await apiFetch<{ file: FileItem }>('/api/files/complete', {
    method: 'POST',
    body: JSON.stringify({ fileId: initRes.file.id }),
  });

  return completeRes.file;
}

export async function moveFile(fileId: string, targetFolderId: string | null): Promise<FileItem> {
  const res = await apiFetch<{ file: FileItem }>(`/api/files/${fileId}`, {
    method: 'PATCH',
    body: JSON.stringify({ folderId: targetFolderId }),
  });
  return res.file;
}

export async function moveFolder(folderId: string, targetParentId: string | null): Promise<{ id: string; name: string }> {
  const res = await apiFetch<{ folder: { id: string; name: string } }>(`/api/folders/${folderId}`, {
    method: 'PATCH',
    body: JSON.stringify({ parentId: targetParentId }),
  });
  return res.folder;
}
