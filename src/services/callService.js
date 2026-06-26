import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { publishSignal } from './signaling';
import { getCleanPublicKey, getStoredContacts } from './storage';
import { addCallRecord } from './calls';
import { stopRingtone } from './ringtone';
import { getIceServers } from './iceServers';
import {
  startCallAudioSession,
  stopCallAudioSession,
  toggleCallSpeakerphone,
  toggleCallMicrophoneMute,
  isCallSpeakerphoneEnabled,
  isCallMicrophoneMuted,
} from './callAudio';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility } from '@notifee/react-native';

// WebRTC Polyfills
let RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, mediaDevices;

if (Platform.OS === 'web') {
  RTCPeerConnection = window.RTCPeerConnection;
  RTCSessionDescription = window.RTCSessionDescription;
  RTCIceCandidate = window.RTCIceCandidate;
  mediaDevices = navigator.mediaDevices;
} else {
  try {
    const WebRTC = require('react-native-webrtc');
    RTCPeerConnection = WebRTC.RTCPeerConnection;
    RTCSessionDescription = WebRTC.RTCSessionDescription;
    RTCIceCandidate = WebRTC.RTCIceCandidate;
    mediaDevices = WebRTC.mediaDevices;
  } catch (e) {
    console.warn('[CallService] react-native-webrtc lama heli karo:', e.message);
  }
}


// State
let currentCallPC = null;
let localStream = null;
let remoteStream = null;
let activeCallContact = null;
let isCallInitiator = false;
let pendingIceCandidates = [];

// Callbacks
let onRemoteStreamReceived = null;
let onCallEndedCallback = null;
let onCallAnsweredCallback = null;

// Call transport status for the active call screen
const callConnectionStatusListeners = new Set();
const callConnectionStatusByPeer = new Map();

// Helper to resolve contact display name
const resolveCallerName = async (friendPubKey) => {
  try {
    const contacts = await getStoredContacts();
    const contact = contacts.find((item) => item.id === friendPubKey);
    return contact?.name?.trim() || 'Unknown';
  } catch (error) {
    console.warn('[CallService] Could not resolve caller name:', error);
    return 'Unknown';
  }
};

export const registerCallConnectionStatusListener = (listener) => {
  callConnectionStatusListeners.add(listener);
  return () => callConnectionStatusListeners.delete(listener);
};

export const getCallConnectionStatusForPeer = (friendPubKey) => {
  return callConnectionStatusByPeer.get(friendPubKey) || 'connecting';
};

const emitCallConnectionStatus = (friendPubKey, status) => {
  callConnectionStatusByPeer.set(friendPubKey, status);
  callConnectionStatusListeners.forEach((listener) => {
    try {
      listener(friendPubKey, status);
    } catch (error) {
      console.warn('[CallService] Connection status listener failed:', error);
    }
  });
};

export const setCallCallbacks = (onStream, onEnd, onAnswer = null) => {
  onRemoteStreamReceived = onStream;
  onCallEndedCallback = onEnd;
  onCallAnsweredCallback = onAnswer;
};

// Global storage for the massive SDP string to prevent Router URL crashes
let cachedPendingOfferSdp = null;
const PENDING_SDP_KEY = 'dhambaal_pending_sdp';
const PENDING_SDP_PUBKEY_KEY = 'dhambaal_pending_sdp_pubkey';

export const setPendingOfferSdp = (sdp) => {
  cachedPendingOfferSdp = sdp;
};

export const getPendingOfferSdp = () => {
  return cachedPendingOfferSdp;
};

// Persist SDP to AsyncStorage so notification actions can retrieve it
// (Android intents may drop large SDP strings from notification.data)
export const persistOfferSdp = async (friendPubKey, sdp) => {
  try {
    cachedPendingOfferSdp = sdp;
    await AsyncStorage.setItem(PENDING_SDP_KEY, sdp);
    await AsyncStorage.setItem(PENDING_SDP_PUBKEY_KEY, friendPubKey);
  } catch (e) {
    console.error('[CallService] Error persisting SDP:', e);
  }
};

export const getPersistedOfferSdp = async () => {
  try {
    const sdp = await AsyncStorage.getItem(PENDING_SDP_KEY);
    const pubKey = await AsyncStorage.getItem(PENDING_SDP_PUBKEY_KEY);
    return { sdp, pubKey };
  } catch (e) {
    console.error('[CallService] Error reading persisted SDP:', e);
    return { sdp: null, pubKey: null };
  }
};

export const clearPersistedOfferSdp = async () => {
  try {
    await AsyncStorage.multiRemove([PENDING_SDP_KEY, PENDING_SDP_PUBKEY_KEY]);
  } catch (e) {
    console.error('[CallService] Error clearing persisted SDP:', e);
  }
};

const getMicrophoneStream = async () => {
  try {
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    localStream = stream;
    const shouldMuteMicrophone = isCallMicrophoneMuted();
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !shouldMuteMicrophone;
    });
    return stream;
  } catch (error) {
    console.error('[CallService] Ma helin codka:', error);
    throw error;
  }
};

const stopLocalStream = () => {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  remoteStream = null;
  pendingIceCandidates = [];
};

let callIceRetryCount = 0;
const MAX_CALL_ICE_RETRIES = 3;

const analyzeCallConnectionStats = async (friendPubKey, peerConnection) => {
  try {
    const stats = await peerConnection.getStats();
    let isRelay = false;

    const getReport = (id) => {
      if (typeof stats.get === 'function') return stats.get(id);
      if (Array.isArray(stats)) return stats.find((report) => report.id === id);
      return null;
    };

    stats.forEach((report) => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        const localCandidate = getReport(report.localCandidateId);
        if (localCandidate && localCandidate.candidateType === 'relay') {
          isRelay = true;
        }
      }
    });

    if (currentCallPC !== peerConnection || activeCallContact !== friendPubKey) {
      return;
    }

    emitCallConnectionStatus(friendPubKey, isRelay ? 'relay' : 'p2p');
  } catch (error) {
    console.warn('[CallService] Could not inspect call stats:', error.message);
    if (currentCallPC !== peerConnection || activeCallContact !== friendPubKey) {
      return;
    }
    emitCallConnectionStatus(friendPubKey, 'p2p');
  }
};

const setupCallIceMonitoring = (friendPubKey, peerConnection) => {
  peerConnection.oniceconnectionstatechange = () => {
    if (!peerConnection) return;
    const state = peerConnection.iceConnectionState;
    console.log('[P2P Call] ICE State:', state);

    if (state === 'connected' || state === 'completed') {
      console.log('[P2P Call] ✅ ICE Connected - Audio should work now');
      callIceRetryCount = 0; // Reset on success
      analyzeCallConnectionStats(friendPubKey, peerConnection);
    }

    if (state === 'failed') {
      console.warn('[P2P Call] ⚠️ ICE Failed - Attempting fallback...');
      emitCallConnectionStatus(friendPubKey, 'failed');
      
      if (callIceRetryCount < MAX_CALL_ICE_RETRIES) {
        callIceRetryCount++;
        console.log(`[P2P Call] 🔄 Retry ${callIceRetryCount}/${MAX_CALL_ICE_RETRIES} with fresh ICE servers...`);
        
        // Store current state before cleanup
        const wasInitiator = isCallInitiator;
        const contact = activeCallContact;
        const localStreamTracks = localStream ? localStream.getTracks() : [];
        
        // Clean up failed connection
        cleanupCallState();
        
        // Retry with new connection
        setTimeout(() => {
          if (wasInitiator) {
            initiateCall(contact).catch(() => {});
          } else {
            // For answerer, we need to re-send answer - but we don't have offerSdp here
            // The caller will retry their offer
            console.log('[P2P Call] Answerer waiting for caller retry...');
          }
        }, 1000);
      } else {
        console.error('[P2P Call] ❌ Max ICE retries reached - Call failed');
        if (onCallEndedCallback) onCallEndedCallback();
        cleanupCallState();
      }
    }

    if (state === 'disconnected') {
      console.warn('[P2P Call] ICE Disconnected');
      // Give it a moment to potentially reconnect
      setTimeout(() => {
        if (currentCallPC && currentCallPC.iceConnectionState === 'disconnected') {
          console.warn('[P2P Call] Still disconnected after timeout');
        }
      }, 5000);
    }
  };
};

export const initiateCall = async (friendPubKey) => {
  const myPubKey = await getCleanPublicKey();
  if (!myPubKey) return;

  activeCallContact = friendPubKey;
  isCallInitiator = true;
  callIceRetryCount = 0;
  emitCallConnectionStatus(friendPubKey, 'connecting');

  try {
    startCallAudioSession();
    const config = await getIceServers(true);
    currentCallPC = new RTCPeerConnection(config);
    const stream = await getMicrophoneStream();
    
    if (!currentCallPC) return;
    // Add local tracks to connection
    stream.getTracks().forEach(track => {
      currentCallPC.addTrack(track, stream);
    });

    currentCallPC.ontrack = (event) => {
      remoteStream = event.streams[0];
      if (onRemoteStreamReceived) onRemoteStreamReceived(remoteStream);
    };

    currentCallPC.onicecandidate = (event) => {
      if (event.candidate) {
        publishSignal(friendPubKey, {
          signalType: 'call-ice',
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
          from: myPubKey,
        });
      }
    };

    setupCallIceMonitoring(friendPubKey, currentCallPC);

    const offer = await currentCallPC.createOffer();
    await currentCallPC.setLocalDescription(offer);

    // Send offer to friend
    publishSignal(friendPubKey, {
      signalType: 'call-offer',
      sdp: offer.sdp,
      from: myPubKey,
    });

  } catch (error) {
    console.error('[CallService] Qalad initiateCall:', error);
    endCall();
  }
};

let activeIncomingCallNotificationId = 'incoming_call';

export const handleIncomingOffer = async (friendPubKey, offerSdp, timestamp = null) => {
  // Check if this is a late/missed call signal
  const signalTimestamp = timestamp || Date.now();
  const signalAgeSeconds = (Date.now() - signalTimestamp) / 1000;

  if (signalAgeSeconds >= 15) {
    console.log(`[CallService] Call offer is too old (${signalAgeSeconds.toFixed(1)}s). Handling as missed call.`);
    // 1. Record the missed call in database
    await addCallRecord(friendPubKey, 'missed');

    // 2. Display missed call notification
    if (Platform.OS !== 'web') {
      try {
        const callerName = await resolveCallerName(friendPubKey);
        const channelId = await notifee.createChannel({
          id: 'dhambaal_missed_calls',
          name: 'Missed Calls',
          importance: AndroidImportance.HIGH,
        });

        await notifee.displayNotification({
          title: 'Wicitaan ku dhaafay',
          body: `Waxaad wicitaan ka heshay ${callerName}`,
          android: {
            channelId,
            importance: AndroidImportance.HIGH,
            smallIcon: 'ic_launcher',
            pressAction: {
              id: 'default',
              launchActivity: 'default',
            },
          },
        });
      } catch (error) {
        console.error('[CallService] Error posting missed call notification:', error);
      }
    }
    return;
  }

  activeCallContact = friendPubKey;
  isCallInitiator = false;
  emitCallConnectionStatus(friendPubKey, 'connecting');
  
  if (Platform.OS === 'web') {
    if (Notification.permission === 'granted') {
      const n = new Notification('Wicitaan Soo Socda', { body: 'Waxaad haysataa wicitaan cusub.' });
      n.onclick = () => { window.focus(); };
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          const n = new Notification('Wicitaan Soo Socda', { body: 'Waxaad haysataa wicitaan cusub.' });
          n.onclick = () => { window.focus(); };
        }
      });
    }
    // Route to the incoming call screen directly on Web
    setPendingOfferSdp(offerSdp);
    router.push(`/otherPages/IncomingCall?id=${encodeURIComponent(friendPubKey)}`);
    return;
  }

  // If the app is active in the foreground on Mobile, route directly to the Incoming Call screen!
  if (AppState.currentState === 'active') {
    setPendingOfferSdp(offerSdp);
    router.push(`/otherPages/IncomingCall?id=${encodeURIComponent(friendPubKey)}`);
    return;
  }

  // Store SDP in AsyncStorage so notification actions can retrieve it
  await persistOfferSdp(friendPubKey, offerSdp);

  try {
    const channelId = await notifee.createChannel({
      id: 'dhambaal_calls_v2', // Changed ID so Android registers the sound!
      name: 'Incoming Calls',
      importance: AndroidImportance.HIGH,
      sound: 'incoming_call_rigtone',
      vibration: true,
    });

    // Abuur ID u gaar ah wicitaan kasta si uusan Android u block-gareyn (Rate limit) wicitaanada is xiga
    const uniqueNotificationId = `incoming_call_${friendPubKey}_${Date.now()}`;
    
    // Tirtir wicitaankii hore haddii uu jiro
    if (activeIncomingCallNotificationId) {
      await notifee.cancelNotification(activeIncomingCallNotificationId).catch(() => {});
    }
    
    activeIncomingCallNotificationId = uniqueNotificationId;

    await notifee.displayNotification({
      id: uniqueNotificationId,
      title: 'Wicitaan Soo Socda',
      body: 'Waxaad haysataa wicitaan...',
      android: {
        channelId,
        importance: AndroidImportance.HIGH,
        ongoing: true,
        autoCancel: false,
        loopSound: true,
        category: AndroidCategory.CALL,
        visibility: AndroidVisibility.PUBLIC,
        smallIcon: 'ic_launcher', // Explicit launcher icon to prevent display crashes
        // We removed asForegroundService: true because starting a foreground service
        // from the background on Android 12+ crashes the application due to OS restrictions.
        fullScreenAction: {
          id: 'default',
        },
        timeoutAfter: 30000,
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
        actions: [
          { title: 'Diid', pressAction: { id: 'reject' } },
          { title: 'Qabo', pressAction: { id: 'answer', launchActivity: 'default' } },
        ],
      },
      data: { friendPubKey },
    });
  } catch (error) {
    console.error('[CallService] Qalad Notifee:', error);
  }
};

export const answerCall = async (friendPubKey, offerSdp) => {
  const myPubKey = await getCleanPublicKey();
  callIceRetryCount = 0;
  emitCallConnectionStatus(friendPubKey, 'connecting');
  
  try {
    startCallAudioSession();
    const config = await getIceServers(true);
    currentCallPC = new RTCPeerConnection(config);
    const stream = await getMicrophoneStream();
    
    if (!currentCallPC) return;
    
    stream.getTracks().forEach(track => {
      currentCallPC.addTrack(track, stream);
    });

    currentCallPC.ontrack = (event) => {
      remoteStream = event.streams[0];
      if (onRemoteStreamReceived) onRemoteStreamReceived(remoteStream);
    };

    currentCallPC.onicecandidate = (event) => {
      if (event.candidate) {
        publishSignal(friendPubKey, {
          signalType: 'call-ice',
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
          from: myPubKey,
        });
      }
    };

    setupCallIceMonitoring(friendPubKey, currentCallPC);

    await currentCallPC.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offerSdp }));
    
    // Flush pending ICE candidates
    pendingIceCandidates.forEach(async (c) => {
      try { await currentCallPC.addIceCandidate(new RTCIceCandidate(c)); } catch(e){}
    });
    pendingIceCandidates = [];

    const answer = await currentCallPC.createAnswer();
    await currentCallPC.setLocalDescription(answer);

    publishSignal(friendPubKey, {
      signalType: 'call-answer',
      sdp: answer.sdp,
      from: myPubKey,
    });

    // Save answered call history
    addCallRecord(friendPubKey, 'incoming');
    await clearPersistedOfferSdp();

  } catch (error) {
    console.error('[CallService] Qalad answerCall:', error);
    endCall();
  }
};

export const handleAnswer = async (answerSdp) => {
  if (!currentCallPC) return;
  try {
    await currentCallPC.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));
    
    // Flush pending ICE candidates
    pendingIceCandidates.forEach(async (c) => {
      try { await currentCallPC.addIceCandidate(new RTCIceCandidate(c)); } catch(e){}
    });
    pendingIceCandidates = [];

    // Save outgoing call history since they answered
    addCallRecord(activeCallContact, 'outgoing');
    
    if (onCallAnsweredCallback) onCallAnsweredCallback();
  } catch (error) {
    console.error('[CallService] Qalad handleAnswer:', error);
  }
};

export const handleIceCandidate = async (candidate) => {
  try {
    if (currentCallPC && currentCallPC.remoteDescription) {
      await currentCallPC.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      // Buffer them even if PC doesn't exist yet (phone is ringing)
      pendingIceCandidates.push(candidate);
    }
  } catch (error) {
    console.error('[CallService] Qalad handleIceCandidate:', error);
  }
};

// Store reject action for background event handler (MQTT unavailable in background)
const PENDING_REJECT_KEY = 'dhambaal_pending_reject';

export const storePendingRejectCall = async (friendPubKey) => {
  try {
    await AsyncStorage.setItem(PENDING_REJECT_KEY, friendPubKey);
  } catch (e) {
    console.error('[CallService] Error storing pending reject:', e);
  }
};

export const getAndClearPendingRejectCall = async () => {
  try {
    const pubKey = await AsyncStorage.getItem(PENDING_REJECT_KEY);
    if (pubKey) {
      await AsyncStorage.removeItem(PENDING_REJECT_KEY);
    }
    return pubKey;
  } catch (e) {
    console.error('[CallService] Error reading pending reject:', e);
    return null;
  }
};

export const rejectCall = async (friendPubKey) => {
  const myPubKey = await getCleanPublicKey();
  if (!myPubKey) {
    console.warn('[CallService] No public key for rejectCall');
    return;
  }
  await publishSignal(friendPubKey, {
    signalType: 'call-reject',
    from: myPubKey,
  });
  
  addCallRecord(friendPubKey, 'missed');
  cleanupCallState();
};

export const handleReject = async () => {
  stopRingtone();
  if (Platform.OS !== 'web') {
    if (activeIncomingCallNotificationId) await notifee.cancelNotification(activeIncomingCallNotificationId).catch(() => {});
  }
  // They rejected our call
  if (activeCallContact) {
    addCallRecord(activeCallContact, 'outgoing');
  }
  cleanupCallState();
  if (onCallEndedCallback) onCallEndedCallback();
};

export const endCall = async () => {
  stopRingtone();
  if (!activeCallContact) return;
  const myPubKey = await getCleanPublicKey();
  publishSignal(activeCallContact, {
    signalType: 'call-end',
    from: myPubKey,
  });
  
  if (Platform.OS !== 'web') {
    if (activeIncomingCallNotificationId) await notifee.cancelNotification(activeIncomingCallNotificationId).catch(() => {});
  }
  
  cleanupCallState();
  if (onCallEndedCallback) onCallEndedCallback();
};

export const handleEndCall = async () => {
  stopRingtone();
  if (Platform.OS !== 'web') {
    if (activeIncomingCallNotificationId) await notifee.cancelNotification(activeIncomingCallNotificationId).catch(() => {});
  }
  cleanupCallState();
  if (onCallEndedCallback) onCallEndedCallback();
};

// Persist pending call action to AsyncStorage so _layout.tsx can read it after notification tap
const PENDING_CALL_ACTION_KEY = 'dhambaal_pending_call_action';

export const storePendingCallAction = async (action) => {
  try {
    await AsyncStorage.setItem(PENDING_CALL_ACTION_KEY, JSON.stringify(action));
  } catch (e) {
    console.error('[CallService] Error storing pending call action:', e);
  }
};

export const getAndClearPendingCallAction = async () => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_CALL_ACTION_KEY);
    await AsyncStorage.removeItem(PENDING_CALL_ACTION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('[CallService] Error reading pending call action:', e);
    return null;
  }
};

const cleanupCallState = () => {
  stopCallAudioSession();
  stopLocalStream();
  if (currentCallPC) {
    currentCallPC.close();
    currentCallPC = null;
  }
  activeCallContact = null;
  isCallInitiator = false;
  pendingIceCandidates = [];
  callConnectionStatusByPeer.clear();
  clearPersistedOfferSdp().catch(() => {});
};

export const getLocalStream = () => localStream;
export const getRemoteStream = () => remoteStream;

export const toggleMute = () => {
  const nextMuted = toggleCallMicrophoneMute();
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !nextMuted;
    }
  }
  return nextMuted;
};

export const toggleSpeaker = () => {
  return toggleCallSpeakerphone();
};

export const isSpeakerOn = () => isCallSpeakerphoneEnabled();

export const isMicrophoneMuted = () => isCallMicrophoneMuted();
