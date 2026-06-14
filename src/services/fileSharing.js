import { Platform } from 'react-native';
import { sendMessageDirect } from './connection';
import { getCleanPublicKey } from './storage';
import * as FileSystem from 'expo-file-system/legacy';

// 32KB chunks for WebRTC Data Channel safety
const CHUNK_SIZE = 32 * 1024;
const incomingFileChunks = new Map();

/**
 * Splits a base64 string into chunks and sends them over P2P.
 * @param {string} friendPubKey The receiver's public key
 * @param {string} msgId The unique ID of the message
 * @param {string} base64Data The full base64 string of the file
 */
export const sendFileP2P = async (friendPubKey, msgId, base64Data) => {
  const myPubKey = await getCleanPublicKey();
  if (!myPubKey) return;

  const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);
  console.log(`[FILE] Sending file ${msgId} to ${friendPubKey} in ${totalChunks} chunks.`);

  for (let i = 0; i < totalChunks; i++) {
    const chunkStr = base64Data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    
    const payload = {
      type: 'file-chunk',
      msgId: msgId,
      chunkIndex: i,
      totalChunks: totalChunks,
      data: chunkStr,
      senderId: myPubKey,
    };

    const sent = await sendMessageDirect(friendPubKey, JSON.stringify(payload));
    
    if (!sent) {
       console.warn(`[FILE] Chunk ${i} failed to send directly. It was queued.`);
    }

    // Give WebRTC buffer breathing room
    if (i % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }
  
  console.log(`[FILE] Finished sending all chunks for ${msgId}.`);
};

/**
 * Handles incoming file chunks and returns the complete base64 when finished.
 * @param {Object} chunkData The chunk payload
 * @returns {string|null} Complete base64 string if all chunks arrived, else null.
 */
export const receiveFileChunk = (chunkData) => {
  const { msgId, chunkIndex, totalChunks, data } = chunkData;

  if (!incomingFileChunks.has(msgId)) {
    incomingFileChunks.set(msgId, {
      chunks: new Array(totalChunks),
      receivedCount: 0,
    });
  }

  const fileBuffer = incomingFileChunks.get(msgId);
  
  // Prevent duplicate chunks counting twice
  if (!fileBuffer.chunks[chunkIndex]) {
    fileBuffer.chunks[chunkIndex] = data;
    fileBuffer.receivedCount++;
  }

  if (fileBuffer.receivedCount === totalChunks) {
    console.log(`[FILE] File ${msgId} fully received! Reconstructing...`);
    const completeBase64 = fileBuffer.chunks.join('');
    incomingFileChunks.delete(msgId);
    return completeBase64;
  }

  return null;
};

/**
 * Saves base64 data to the device file system.
 */
export const saveFileToDisk = async (base64Data, fileName) => {
  if (Platform.OS === 'web') return null;
  try {
    const dir = FileSystem.documentDirectory + 'Dhambaal_Files/';
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const uri = dir + safeName;
    await FileSystem.writeAsStringAsync(uri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
    return uri;
  } catch (e) {
    console.error('[FILE] Qalad keydinta faylka:', e);
    return null;
  }
};
