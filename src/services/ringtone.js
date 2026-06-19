import { Platform } from 'react-native';
import { createAudioPlayer } from 'expo-audio';

let ringtonePlayer = null;

/**
 * Play the system default ringtone for incoming calls.
 * Uses the bundled incoming_ringtone.mp3
 */
export const playIncomingRingtone = () => {
  if (ringtonePlayer) {
    return;
  }

  if (Platform.OS === 'web') {
    try {
      const audio = new Audio(require('../../assets/incoming_call_rigtone.mp3'));
      audio.loop = true;
      audio.play().catch(e => console.warn('[Ringtone] Web play error:', e));
      ringtonePlayer = audio;
    } catch (e) {
      console.warn('[Ringtone] Web error:', e);
    }
    return;
  }

  try {
    const player = createAudioPlayer(require('../../assets/incoming_call_rigtone.mp3'));
    player.loop = true;
    player.play();
    ringtonePlayer = player;
  } catch (e) {
    console.warn('[Ringtone] Incoming ringtone error:', e);
  }
};

export const playOutgoingRingtone = () => {
  if (ringtonePlayer) {
    return;
  }

  if (Platform.OS === 'web') {
    try {
      const audio = new Audio(require('../../assets/ringtone.mp3'));
      audio.loop = true;
      audio.play().catch(e => console.warn('[Ringtone] Web play error:', e));
      ringtonePlayer = audio;
    } catch (e) {
      console.warn('[Ringtone] Web error:', e);
    }
    return;
  }

  try {
    const player = createAudioPlayer(require('../../assets/ringtone.mp3'));
    player.loop = true;
    player.play();
    ringtonePlayer = player;
  } catch (e) {
    console.warn('[Ringtone] Outgoing play error:', e);
  }
};

export const stopRingtone = () => {
  if (!ringtonePlayer) {
    return;
  }
  try {
    if (Platform.OS === 'web') {
      ringtonePlayer.pause();
      ringtonePlayer.currentTime = 0;
    } else {
      ringtonePlayer.pause();
      ringtonePlayer.remove();
    }
  } catch (e) {
    console.warn('[Ringtone] Stop error:', e);
  }
  ringtonePlayer = null;
};
