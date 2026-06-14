import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'dh_voice_';
const META_PREFIX = 'dh_voice_meta_';
const MIME_PREFIX = 'dh_voice_mime_';

export const storeVoiceAudioAsync = async (msgId, base64) => {
  try {
    await AsyncStorage.setItem(PREFIX + msgId, base64);
  } catch (e) {
    console.error('[VoiceStorage] Failed to store audio async:', e);
  }
};

export const getVoiceAudioAsync = async (msgId) => {
  try {
    return await AsyncStorage.getItem(PREFIX + msgId);
  } catch (e) {
    console.error('[VoiceStorage] Failed to read audio async:', e);
    return null;
  }
};

export const deleteVoiceAudioAsync = async (msgId) => {
  try {
    await AsyncStorage.removeItem(PREFIX + msgId);
    await AsyncStorage.removeItem(META_PREFIX + msgId);
    await AsyncStorage.removeItem(MIME_PREFIX + msgId);
  } catch (e) {
    console.error('[VoiceStorage] Failed to delete audio async:', e);
  }
};

export const hasVoiceAudioAsync = async (msgId) => {
  try {
    const val = await AsyncStorage.getItem(PREFIX + msgId);
    return val !== null;
  } catch (e) {
    return false;
  }
};

// Fallback synchronous methods for backward compatibility (may fail on large files in localStorage)

export const storeVoiceAudio = (msgId, base64) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PREFIX + msgId, base64);
    }
  } catch (e) {
    console.error('[VoiceStorage] Failed to store audio:', e);
  }
};

export const getVoiceAudio = (msgId) => {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(PREFIX + msgId);
    }
    return null;
  } catch (e) {
    console.error('[VoiceStorage] Failed to read audio:', e);
    return null;
  }
};

export const deleteVoiceAudio = (msgId) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(PREFIX + msgId);
      localStorage.removeItem(META_PREFIX + msgId);
      localStorage.removeItem(MIME_PREFIX + msgId);
    }
  } catch (e) {
    console.error('[VoiceStorage] Failed to delete audio:', e);
  }
};

export const setAutoDeleteAt = (msgId, timestamp) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(META_PREFIX + msgId, String(timestamp));
    }
  } catch (e) {
    console.error('[VoiceStorage] Failed to set auto-delete time:', e);
  }
};

export const getAutoDeleteAt = (msgId) => {
  try {
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(META_PREFIX + msgId);
      return val ? Number(val) : null;
    }
    return null;
  } catch (e) {
    return null;
  }
};

export const storeVoiceMimeType = (msgId, mimeType) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MIME_PREFIX + msgId, mimeType);
    }
  } catch (e) {
    console.error('[VoiceStorage] Failed to store mime type:', e);
  }
};

export const getVoiceMimeType = (msgId) => {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(MIME_PREFIX + msgId);
    }
    return null;
  } catch (e) {
    return null;
  }
};

export const hasVoiceAudio = (msgId) => {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(PREFIX + msgId) !== null;
    }
    return false;
  } catch (e) {
    return false;
  }
};

export const cleanupExpired = () => {
  try {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    
    const now = Date.now();
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(META_PREFIX)) {
        const msgId = key.replace(META_PREFIX, '');
        const expiry = Number(localStorage.getItem(key));
        if (expiry < now) {
          keysToRemove.push(msgId);
        }
      }
    }

    keysToRemove.forEach((msgId) => deleteVoiceAudio(msgId));
    return keysToRemove;
  } catch (e) {
    console.error('[VoiceStorage] Cleanup error:', e);
    return [];
  }
};
