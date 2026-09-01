import sharp from 'sharp';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import {
  processPreviewJob,
  enqueuePreviewGeneration,
  type PreviewJob,
} from './previewWorker';
import { storage } from './storage';

describe('Preview Worker Unit Tests', () => {
  const testStorageKey = 'tenants/unit-test/folders/root/files/test-sample-image.png';
  const previewStorageKey = `previews/${testStorageKey}.jpg`;

  beforeAll(async () => {
    // Generate a valid source 400x300 PNG image in storage
    const imgBuffer = await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 4,
        background: { r: 59, g: 130, b: 246, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    await storage.saveObjectDirect(testStorageKey, imgBuffer, 'image/png');
  });

  afterAll(async () => {
    await storage.deleteObject(testStorageKey);
    await storage.deleteObject(previewStorageKey);
  });

  it('successfully generates a 200x200 JPEG thumbnail from a source image', async () => {
    const job: PreviewJob = {
      fileId: 'file-1234',
      storageKey: testStorageKey,
      mimeType: 'image/png',
      name: 'test-sample-image.png',
    };

    await processPreviewJob(job);

    const previewVerification = await storage.verifyObject(previewStorageKey);
    expect(previewVerification.exists).toBe(true);
    expect(previewVerification.sizeBytes).toBeGreaterThan(0);

    const previewBuffer = await storage.getObject(previewStorageKey);
    const meta = await sharp(previewBuffer).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(200);
  });

  it('resiliently handles corrupted image files without throwing or crashing', async () => {
    const corruptedKey = 'tenants/unit-test/folders/root/files/corrupted.png';
    await storage.saveObjectDirect(corruptedKey, Buffer.from('corrupted-non-image-data'), 'image/png');

    const job: PreviewJob = {
      fileId: 'file-corrupt-123',
      storageKey: corruptedKey,
      mimeType: 'image/png',
      name: 'corrupted.png',
    };

    // processPreviewJob or enqueuePreviewGeneration must not crash or throw unhandled rejection
    expect(() => enqueuePreviewGeneration(job)).not.toThrow();

    await storage.deleteObject(corruptedKey);
  });
});
