// Receipt capture + upload. The flow:
//   1. User taps "Attach receipt" → we ask for camera or library
//   2. Image is downscaled to ≤1600px long edge (keeps most under 200KB)
//   3. Bytes are POST'd as multipart to /api/mobile/v1/receipts
//   4. Server returns receipt_id; caller stores it on the expense
//
// Signed download URLs are cached in-memory for 10 minutes. They expire after
// 15 server-side, so we refresh well before that.

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import api, { expensesAPI } from './api';

const MAX_LONG_EDGE = 1600;
const JPEG_QUALITY = 0.85;

// Ask the user where the image should come from, then return a downscaled
// local URI. Returns null if the user cancelled or denied permissions.
export async function pickReceiptImage(source /* 'camera' | 'library' */) {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      throw new Error('Camera permission denied');
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (result.canceled) return null;
    return downscale(result.assets[0]);
  }

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Photo library permission denied');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
  });
  if (result.canceled) return null;
  return downscale(result.assets[0]);
}

// Downscale to ≤MAX_LONG_EDGE on the long edge, recompress as JPEG.
async function downscale(asset) {
  const { uri, width, height } = asset;
  const longEdge = Math.max(width || 0, height || 0);
  const ops = [];
  if (longEdge > MAX_LONG_EDGE) {
    const scale = MAX_LONG_EDGE / longEdge;
    ops.push({
      resize: width >= height
        ? { width: MAX_LONG_EDGE }
        : { height: MAX_LONG_EDGE },
    });
    // eslint-disable-next-line no-void
    void scale; // kept to make the math intent explicit
  }
  const out = await ImageManipulator.manipulateAsync(uri, ops, {
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return { uri: out.uri, width: out.width, height: out.height };
}

// Upload a local image URI to the server. Returns { receipt_id, ... }.
// Throws on network or server errors; caller surfaces the message.
export async function uploadReceipt(localUri) {
  const formData = new FormData();
  // React Native's FormData accepts this { uri, name, type } shape directly.
  formData.append('file', {
    uri: localUri,
    name: 'receipt.jpg',
    type: 'image/jpeg',
  });

  const response = await api.post('/mobile/v1/receipts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // Receipts can be 200KB; default axios timeout is fine for that.
  });
  return response.data;
}

// In-memory cache of signed URLs. Key: receipt_id; value: { url, expires_at }.
// Saves a round-trip when the same receipt is opened twice in quick succession.
const _signedUrlCache = new Map();
const URL_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min (server signs for 15)

export async function getReceiptUrl(receiptId) {
  if (!receiptId) return null;
  const cached = _signedUrlCache.get(receiptId);
  if (cached && cached.expires_at > Date.now()) {
    return cached.url;
  }
  const { url } = await expensesAPI.getReceiptUrl(receiptId);
  _signedUrlCache.set(receiptId, { url, expires_at: Date.now() + URL_CACHE_TTL_MS });
  return url;
}
