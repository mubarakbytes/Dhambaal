import { Platform } from 'react-native';
import { router } from 'expo-router';
import { publishSignal } from './signaling';
import { getCleanPublicKey } from './storage';
import { addCallRecord } from './calls';
import { getIceServers } from './connection';
import notifee, { AndroidImportance } from '@notifee/react-native';

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

// Callbacks
let onRemoteStreamReceived = null;
let onCallEndedCallback = null;

export const setCallCallbacks = (onStream, onEnd) => {
  onRemoteStreamReceived = onStream;
  onCallEndedCallback = onEnd;
};

const getMicrophoneStream = async () => {
  try {
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    localStream = stream;
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
};

export const initiateCall = async (friendPubKey) => {
  const myPubKey = await getCleanPublicKey();
  if (!myPubKey) return;

  activeCallContact = friendPubKey;
  isCallInitiator = true;

  try {
    const config = await getIceServers();
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

export const handleIncomingOffer = async (friendPubKey, offerSdp) => {
  activeCallContact = friendPubKey;
  isCallInitiator = false;
  
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
    router.push(`/otherPages/IncomingCall?id=${encodeURIComponent(friendPubKey)}&sdp=${encodeURIComponent(offerSdp)}`);
    return;
  }

  try {
    const channelId = await notifee.createChannel({
      id: 'calls',
      name: 'Incoming Calls',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
    });

    await notifee.displayNotification({
      id: 'incoming_call',
      title: 'Wicitaan Soo Socda',
      body: 'Waxaad haysataa wicitaan...',
      android: {
        channelId,
        importance: AndroidImportance.HIGH,
        ongoing: true, // Prevents swiping away easily
        category: 'call',
        fullScreenAction: {
          id: 'default',
        },
        actions: [
          { title: 'Diid', pressAction: { id: 'reject' } },
          { title: 'Qabo', pressAction: { id: 'answer' } },
        ],
      },
      data: { friendPubKey, offerSdp },
    });
  } catch (error) {
    console.error('[CallService] Qalad Notifee:', error);
  }
};

export const answerCall = async (friendPubKey, offerSdp) => {
  const myPubKey = await getCleanPublicKey();
  
  try {
    const config = await getIceServers();
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

    await currentCallPC.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offerSdp }));
    const answer = await currentCallPC.createAnswer();
    await currentCallPC.setLocalDescription(answer);

    publishSignal(friendPubKey, {
      signalType: 'call-answer',
      sdp: answer.sdp,
      from: myPubKey,
    });

    // Save answered call history
    addCallRecord(friendPubKey, 'incoming');

  } catch (error) {
    console.error('[CallService] Qalad answerCall:', error);
    endCall();
  }
};

export const handleAnswer = async (answerSdp) => {
  if (!currentCallPC) return;
  try {
    await currentCallPC.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));
    // Save outgoing call history since they answered
    addCallRecord(activeCallContact, 'outgoing');
  } catch (error) {
    console.error('[CallService] Qalad handleAnswer:', error);
  }
};

export const handleIceCandidate = async (candidate) => {
  if (!currentCallPC) return;
  try {
    await currentCallPC.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    console.error('[CallService] Qalad handleIceCandidate:', error);
  }
};

export const rejectCall = async (friendPubKey) => {
  const myPubKey = await getCleanPublicKey();
  publishSignal(friendPubKey, {
    signalType: 'call-reject',
    from: myPubKey,
  });
  
  // They missed our call? No, we missed their call.
  addCallRecord(friendPubKey, 'missed');
  cleanupCallState();
};

export const handleReject = async () => {
  if (Platform.OS !== 'web') {
    await notifee.cancelNotification('incoming_call');
  }
  // They rejected our call
  if (activeCallContact) {
    addCallRecord(activeCallContact, 'outgoing');
  }
  cleanupCallState();
  if (onCallEndedCallback) onCallEndedCallback();
};

export const endCall = async () => {
  if (!activeCallContact) return;
  const myPubKey = await getCleanPublicKey();
  publishSignal(activeCallContact, {
    signalType: 'call-end',
    from: myPubKey,
  });
  
  if (Platform.OS !== 'web') {
    await notifee.cancelNotification('incoming_call');
  }
  
  cleanupCallState();
  if (onCallEndedCallback) onCallEndedCallback();
};

export const handleEndCall = async () => {
  if (Platform.OS !== 'web') {
    await notifee.cancelNotification('incoming_call');
  }
  cleanupCallState();
  if (onCallEndedCallback) onCallEndedCallback();
};

const cleanupCallState = () => {
  stopLocalStream();
  if (currentCallPC) {
    currentCallPC.close();
    currentCallPC = null;
  }
  activeCallContact = null;
  isCallInitiator = false;
};

export const getLocalStream = () => localStream;
export const getRemoteStream = () => remoteStream;
export const toggleMute = () => {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled; // returns true if muted
    }
  }
  return false;
};
