import { apiFetch } from './api';

export interface FileVersion {
  id: string;
  fileId: string;
  versionNumber: number;
  sizeBytes: string;
  checksum: string | null;
  createdAt: string;
  isCurrent: boolean;
}

export interface VersionsResponse {
  versions: FileVersion[];
  currentVersionId: string | null;
}

export interface RevertResponse {
  file: {
    id: string;
    name: string;
    version_id: string;
    size_bytes: string;
  };
  revertedVersion: {
    id: string;
    versionNumber: number;
    sizeBytes: string;
    createdAt: string;
  };
}

export async function fetchFileVersions(fileId: string): Promise<VersionsResponse> {
  return apiFetch<VersionsResponse>(`/api/files/${fileId}/versions`);
}

export async function revertFileVersion(
  fileId: string,
  versionId: string,
  expectedCurrentVersionId?: string,
): Promise<RevertResponse> {
  return apiFetch<RevertResponse>(`/api/files/${fileId}/versions/${versionId}/revert`, {
    method: 'POST',
    body: JSON.stringify({ expectedCurrentVersionId }),
  });
}
