// src/lib/storage.ts
// Firebase Storage upload helpers for all file types used in PGF.
// All files are stored in organized path structures within Firebase Storage.

import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * Upload a file to Firebase Storage.
 * Returns the download URL of the uploaded file.
 */
async function uploadFile(
  path: string,
  file: File | Blob,
  contentType?: string
): Promise<string> {
  const storageRef = ref(storage, path);
  const metadata = contentType ? { contentType } : undefined;

  await uploadBytes(storageRef, file, metadata);
  return getDownloadURL(storageRef);
}

/**
 * Upload a base64 data URL as a file.
 * Commonly used for webcam captures and canvas signatures.
 */
async function uploadBase64(path: string, dataUrl: string): Promise<string> {
  // Extract MIME type and base64 data
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches) throw new Error('Invalid data URL format');

  const mimeType = matches[1];
  const base64Data = matches[2];
  const byteString = atob(base64Data);
  const byteArray = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    byteArray[i] = byteString.charCodeAt(i);
  }

  const blob = new Blob([byteArray], { type: mimeType });
  return uploadFile(path, blob, mimeType);
}

/**
 * Generate a unique filename with timestamp prefix.
 */
function uniqueName(baseName: string, ext: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${baseName}_${timestamp}_${random}.${ext}`;
}

// ============================================================================
// Customer Profile Documents
// ============================================================================

/**
 * Upload customer profile photo (webcam capture).
 */
export async function uploadProfilePhoto(
  customerId: string,
  dataUrl: string
): Promise<string> {
  const path = `customers/photos/${customerId}/${uniqueName('profile', 'jpg')}`;
  return uploadBase64(path, dataUrl);
}

/**
 * Upload customer digital signature (canvas capture).
 */
export async function uploadSignature(
  customerId: string,
  dataUrl: string
): Promise<string> {
  const path = `customers/signatures/${customerId}/${uniqueName('signature', 'png')}`;
  return uploadBase64(path, dataUrl);
}

/**
 * Upload KYC document (Aadhaar front/back, PAN card).
 */
export async function uploadKYCDocument(
  customerId: string,
  docType: 'aadhaar_front' | 'aadhaar_back' | 'pan',
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `customers/kyc/${customerId}/${uniqueName(docType, ext)}`;
  return uploadFile(path, file, file.type);
}

// ============================================================================
// Gold Collateral Photos
// ============================================================================

/**
 * Upload a gold ornament photo.
 */
export async function uploadGoldPhoto(
  collateralId: string,
  position: 'front' | 'back' | 'side',
  file: File | Blob,
  contentType?: string
): Promise<string> {
  const ext = contentType?.includes('png') ? 'png' : 'jpg';
  const path = `collaterals/photos/${collateralId}/${uniqueName(position, ext)}`;
  return uploadFile(path, file, contentType || 'image/jpeg');
}

/**
 * Upload a gold photo from a base64 data URL (webcam capture).
 */
export async function uploadGoldPhotoBase64(
  collateralId: string,
  position: 'front' | 'back' | 'side',
  dataUrl: string
): Promise<string> {
  const path = `collaterals/photos/${collateralId}/${uniqueName(position, 'jpg')}`;
  return uploadBase64(path, dataUrl);
}

// ============================================================================
// Generated Documents (PDFs)
// ============================================================================

/**
 * Upload a generated PDF document.
 */
export async function uploadGeneratedPDF(
  docType: string,
  entityId: string,
  pdfBlob: Blob
): Promise<string> {
  const path = `documents/${docType}/${entityId}/${uniqueName(docType, 'pdf')}`;
  return uploadFile(path, pdfBlob, 'application/pdf');
}

// ============================================================================
// Company Branding Assets
// ============================================================================

/**
 * Upload company profile asset (logo, seal, etc.)
 */
export async function uploadCompanyAsset(
  assetType: 'logo' | 'seal',
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `company/${uniqueName(assetType, ext)}`;
  return uploadFile(path, file, file.type);
}

// ============================================================================
// Delete Helpers
// ============================================================================

/**
 * Delete a file from Firebase Storage by its download URL.
 */
export async function deleteFileByUrl(downloadUrl: string): Promise<void> {
  try {
    // Create a reference from the download URL
    const storageRef = ref(storage, downloadUrl);
    await deleteObject(storageRef);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to delete file: ${message}`);
  }
}
