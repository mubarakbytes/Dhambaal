import { Platform } from 'react-native';
import InCallManager from 'react-native-incall-manager';

let callAudioStarted = false;
let speakerphoneEnabled = false;
let microphoneMuted = false;

export const startCallAudioSession = ({ speakerOn } = {}) => {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    if (!callAudioStarted) {
      InCallManager.start({ media: 'audio', auto: true });
      callAudioStarted = true;
    }

    if (typeof speakerOn === 'boolean') {
      speakerphoneEnabled = speakerOn;
    }
    InCallManager.setForceSpeakerphoneOn(speakerphoneEnabled);
    InCallManager.setMicrophoneMute(microphoneMuted);
  } catch (error) {
    console.warn('[CallAudio] Failed to start call audio session:', error);
  }
};

export const stopCallAudioSession = () => {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    InCallManager.setMicrophoneMute(false);
    InCallManager.setForceSpeakerphoneOn(false);
    InCallManager.stop();
  } catch (error) {
    console.warn('[CallAudio] Failed to stop call audio session:', error);
  } finally {
    callAudioStarted = false;
    speakerphoneEnabled = false;
    microphoneMuted = false;
  }
};

export const setCallSpeakerphoneEnabled = (enabled) => {
  speakerphoneEnabled = !!enabled;

  if (Platform.OS !== 'web' && callAudioStarted) {
    try {
      InCallManager.setForceSpeakerphoneOn(speakerphoneEnabled);
    } catch (error) {
      console.warn('[CallAudio] Failed to set speakerphone:', error);
    }
  }

  return speakerphoneEnabled;
};

export const toggleCallSpeakerphone = () => {
  return setCallSpeakerphoneEnabled(!speakerphoneEnabled);
};

export const setCallMicrophoneMuted = (muted) => {
  microphoneMuted = !!muted;

  if (Platform.OS !== 'web' && callAudioStarted) {
    try {
      InCallManager.setMicrophoneMute(microphoneMuted);
    } catch (error) {
      console.warn('[CallAudio] Failed to set microphone mute:', error);
    }
  }

  return microphoneMuted;
};

export const toggleCallMicrophoneMute = () => {
  return setCallMicrophoneMuted(!microphoneMuted);
};

export const isCallSpeakerphoneEnabled = () => speakerphoneEnabled;

export const isCallMicrophoneMuted = () => microphoneMuted;
