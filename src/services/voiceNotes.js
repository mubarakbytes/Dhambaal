import { Platform } from 'react-native';
import { AudioModule, RecordingPresets, createAudioPlayer } from 'expo-audio';

import * as FileSystem from 'expo-file-system/legacy';
import * as voiceStorage from './voiceStorage';

const VOICE_DIR = Platform.OS === 'web' ? null : FileSystem.documentDirectory + '.dhambaal_voice/';

const ensureDir = async () => {
  if (!VOICE_DIR) return;
  const dirInfo = await FileSystem.getInfoAsync(VOICE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(VOICE_DIR, { intermediates: true });
  }
};

export const startRecording = async () => {
  if (Platform.OS === 'web') {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new window.MediaRecorder(stream);
    const audioChunks = [];
    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };
    mediaRecorder.start();
    return { recording: { mediaRecorder, audioChunks, stream }, startTime: Date.now() };
  }

  if (AudioModule && AudioModule.requestRecordingPermissionsAsync) {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Microphone permission not granted');
    }
  }

  const recording = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
  await recording.prepareToRecordAsync();
  recording.record();

  return { recording, startTime: Date.now() };
};

export const stopRecording = async ({ recording, startTime }) => {
  if (!recording) return { uri: null, duration: '0:00' };
  
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const { mediaRecorder, audioChunks, stream } = recording;
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const uri = URL.createObjectURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        
        const elapsed = Date.now() - startTime;
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const duration = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        resolve({ uri, duration });
      };
      mediaRecorder.stop();
    });
  }

  await recording.stop();
  const uri = recording.uri;
  if (!uri) throw new Error('Recording URI is null');

  const elapsed = Date.now() - startTime;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const duration = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;

  return { uri, duration };
};

export const readAudioAsBase64 = async (uri) => {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    const mimeType = blob.type || 'audio/webm';
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          const base64 = result.split(',')[1];
          resolve({ base64, mimeType });
        } else {
          reject(new Error('Failed to read blob as base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64',
  });
  return { base64, mimeType: 'audio/m4a' };
};

export const saveBase64ToFile = async (base64, msgId) => {
  if (Platform.OS === 'web') {
    voiceStorage.storeVoiceAudio(msgId, base64);
    return null;
  }

  await ensureDir();
  const filePath = `${VOICE_DIR}${msgId}.m4a`;
  await FileSystem.writeAsStringAsync(filePath, base64, {
    encoding: 'base64',
  });
  return filePath;
};

export const getVoiceFilePath = (msgId) => {
  if (!VOICE_DIR) return null;
  return `${VOICE_DIR}${msgId}.m4a`;
};

export const voiceFileExists = async (msgId) => {
  if (Platform.OS === 'web') {
    return voiceStorage.hasVoiceAudio(msgId);
  }
  if (!VOICE_DIR) return false;
  const info = await FileSystem.getInfoAsync(`${VOICE_DIR}${msgId}.m4a`);
  return info.exists;
};

export const playVoiceNote = async (uri) => {
  if (Platform.OS === 'web') {
    const audio = new window.Audio(uri);
    await audio.play();
    return audio;
  }
  const sound = createAudioPlayer(uri);
  await sound.play();
  return sound;
};

export const stopSound = async (sound) => {
  if (sound) {
    try {
      sound.pause();
    } catch (e) {
      // already stopped/unloaded
    }
  }
};

export const getVoicePlaybackUri = async (voiceNote) => {
  if (!voiceNote) return null;
  if (voiceNote.audioUri) return voiceNote.audioUri;
  
  if (Platform.OS === 'web' && voiceNote.msgId) {
    try {
      const base64 = voiceStorage.getVoiceAudio(voiceNote.msgId);
      let mimeType = voiceStorage.getVoiceMimeType(voiceNote.msgId) || 'audio/m4a';
      if (mimeType === 'audio/m4a') mimeType = 'audio/mp4'; // Fallback to mp4 container
      
      if (base64) {
        // Convert to Blob URL for better browser compatibility
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        // Try audio/mp4, if the browser rejects it, the Audio tag is more lenient with Blobs
        const blob = new Blob([byteArray], { type: mimeType });
        return URL.createObjectURL(blob);
      }
    } catch (e) {
      return null;
    }
  } else if (Platform.OS !== 'web' && voiceNote.msgId) {
    const exists = await voiceFileExists(voiceNote.msgId);
    if (exists) return getVoiceFilePath(voiceNote.msgId);
  }
  return null;
};

export const createExpiryTimeout = (msgId, onExpire) => {
  const existingExpiry = voiceStorage.getAutoDeleteAt(msgId);
  const expiry = existingExpiry || (Date.now() + 3600000);

  if (!existingExpiry) {
    voiceStorage.setAutoDeleteAt(msgId, expiry);
  }

  const remaining = expiry - Date.now();
  if (remaining <= 0) {
    voiceStorage.deleteVoiceAudio(msgId);
    if (onExpire) onExpire();
    return null;
  }

  const timerId = setTimeout(() => {
    voiceStorage.deleteVoiceAudio(msgId);
    if (onExpire) onExpire();
  }, remaining);

  return timerId;
};
