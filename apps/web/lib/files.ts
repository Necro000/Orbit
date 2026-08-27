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

export async function downloadFile(fileId: string) {
  const res = await apiFetch<{ file: FileItem; downloadUrl: string }>(`/api/files/${fileId}`);
  const a = document.createElement('a');
  a.href = res.downloadUrl;
  a.download = res.file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function uploadFileDirect(
  file: File,
  folderId?: string | null,
  onProgress?: (pct: number) => void,
): Promise<FileItem> {
  // 1. Init upload
  const initRes = await apiFetch<InitUploadResponse>('/api/files/init', {
    method: 'POST',
    body: JSON.stringify({
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
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
