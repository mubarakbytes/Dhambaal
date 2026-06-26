import './polyfills';
// =====================================================================================
// CONNECTION SERVICE — Adeegga Xiriirka Tooska ah (WebRTC P2P + MQTT Signaling)
// =====================================================================================
// Faylkani wuxuu mas'uul ka yahay:
// 1. Dhisidda xiriirka tooska ah (WebRTC P2P) labada qalab dhexdooda
// 2. Isticmaalka MQTT si loo kala beddelo calaamadaha (SDP/ICE)
// 3. Maaraynta joogitaanka (Presence) — yaa online, yaa offline
// =====================================================================================

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStoredContacts, updateContactInDatabase, getCleanPublicKey, gun } from './storage';
import { getIceServers, recordRelayAttempt } from './iceServers';
import {
  connectToSignalingBroker,
  publishSignal,
  subscribeToSignals,
  publishPresenceHeartbeat,
  subscribeToPresence,
  unsubscribeFromPresence,
  disconnectSignaling,
} from './signaling';
import { Alert } from 'react-native';
import {
  handleIncomingOffer as handleCallOffer,
  handleAnswer as handleCallAnswer,
  handleIceCandidate as handleCallIce,
  handleReject as handleCallReject,
  handleEndCall
} from './callService';

// ===================== WEBRTC SETUP (Diyaarinta WebRTC) =====================

let P2PConnection;       // RTCPeerConnection — Xiriirka labada aaladood
let HandshakeData;       // RTCSessionDescription — Xogta gacan-qaadka
let NetworkPath;         // RTCIceCandidate — Waddada shabakadda

if (Platform.OS === 'web') {
  P2PConnection = window.RTCPeerConnection;
  HandshakeData = window.RTCSessionDescription;
  NetworkPath = window.RTCIceCandidate;
} else {
  try {
    const WebRTC = require('react-native-webrtc');
    P2PConnection = WebRTC.RTCPeerConnection;
    HandshakeData = WebRTC.RTCSessionDescription;
    NetworkPath = WebRTC.RTCIceCandidate;
  } catch (e) {
    console.warn('[P2P] react-native-webrtc lama heli karo:', e.message);
  }
}

// ===================== MODULE STATE =====================

const STALE_SIGNAL_THRESHOLD_MS = 30000;          // 30 seconds — signals older than this are ignored
const PENDING_MESSAGES_STORAGE_KEY = 'rdhambaal_pending_direct_messages_queue';

const activeConnections = new Map();               // friendPubKey -> { peerConnection, dataChannel }
const pendingIceCandidates = new Map();             // friendPubKey -> [ICE candidates waiting for remote desc]
const pendingDirectMessages = new Map();            // friendPubKey -> [queued messages]
let pendingDirectMessageMutationChain = Promise.resolve();

const messageListeners = new Set();                // Listeners for incoming WebRTC messages
const statusListeners = new Set();                 // Listeners for connection status updates
const connectionStatusByPeer = new Map();          // friendPubKey -> last known transport status

export const registerConnectionStatusListener = (listener) => {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
};

const emitConnectionStatus = (pubKey, status) => {
  connectionStatusByPeer.set(pubKey, status);
  statusListeners.forEach(l => l(pubKey, status));
};

export const getConnectionStatusForPeer = (pubKey) => {
  const status = connectionStatusByPeer.get(pubKey);
  if (status === 'custom_relay' || status === 'default_relay') {
    return 'relay';
  }
  return status || 'connecting';
};

// ===================== HELPER FUNCTIONS =====================

const generateQueuedMessageId = () => {
  return `queued_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * Waxay akhrisaa furaha guud ee kaydka. MUHIIM: AsyncStorage wuxuu ku kaydiyaa
 * furayaasha iyada oo ku duuban JSON quotes (tusaale: '"abc123"').
 * Waxaan ka saarneynaa quote-yaas si topic-yadu isku mid u noqdaan.
 */
const readMyPublicKey = async () => {
  return await getCleanPublicKey();
};

// ===================== MESSAGE QUEUE PERSISTENCE =====================

const readPersistedQueuedMessages = async () => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_MESSAGES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('[P2P] Qalad akhrinta fariimaha sugaya:', e);
    return {};
  }
};

const savePersistedQueuedMessages = async (queueMap) => {
  await AsyncStorage.setItem(PENDING_MESSAGES_STORAGE_KEY, JSON.stringify(queueMap));
};

const mutatePersistedQueuedMessages = (mutateFn) => {
  pendingDirectMessageMutationChain = pendingDirectMessageMutationChain
    .then(async () => {
      const currentMap = await readPersistedQueuedMessages();
      const mutated = (await mutateFn(currentMap)) || currentMap;
      await savePersistedQueuedMessages(mutated);
      return mutated;
    })
    .catch((error) => {
      console.error('[P2P] Qalad cusboonaysiinta fariimaha sugaya:', error);
      return {};
    });
  return pendingDirectMessageMutationChain;
};

// ===================== DATA CHANNEL MANAGEMENT =====================

/**
 * Waxay diwaangelisaa dhageyste fariimaha tooska ah ee WebRTC.
 */
export const registerOnMessageReceived = (listener) => {
  messageListeners.add(listener);
};

const notifyMessageListeners = (senderPubKey, messageText) => {
  messageListeners.forEach((listener) => {
    try {
      listener(senderPubKey, messageText);
    } catch (e) {
      console.error('[P2P] Qalad dhageyste fariinta:', e);
    }
  });
};

/**
 * Waxay diyaarisaa kanaalka xogta (data channel) — dhegeysi marka uu furmo, xirmo, ama fariin timaado.
 */
const setupDataChannel = (friendPubKey, channel) => {
  channel.onopen = () => {
    console.log(`[P2P] ✅ Kanaalka xogta waa furmay: ${friendPubKey.substring(0, 12)}...`);
    updateContactInDatabase(friendPubKey, { status: 'jooge' });
    void flushPendingDirectMessages(friendPubKey);
  };

  channel.onclose = () => {
    console.log(`[P2P] ❌ Kanaalka xogta waa xirmay: ${friendPubKey.substring(0, 12)}...`);
    updateContactInDatabase(friendPubKey, { status: 'maqane' });
    activeConnections.delete(friendPubKey);
  };

  channel.onerror = (error) => {
    console.error(`[P2P] Qalad kanaalka xogta: ${friendPubKey.substring(0, 12)}...`, error);
  };

  channel.onmessage = (event) => {
    console.log(`[P2P] 📨 Fariin ka timid: ${friendPubKey.substring(0, 12)}...`);
    notifyMessageListeners(friendPubKey, event.data);
  };
};

// ===================== CONNECTION STATE MONITORING =====================

const analyzeConnectionStats = async (friendPubKey, peerConnection, forceDefaultTurn) => {
  try {
    const stats = await peerConnection.getStats();
    let isRelay = false;
    let relayUrl = null;
    
    const getReport = (id) => {
      if (typeof stats.get === 'function') return stats.get(id);
      if (Array.isArray(stats)) return stats.find(s => s.id === id);
      return null;
    };

    stats.forEach(report => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        const localCandidate = getReport(report.localCandidateId);
        if (localCandidate && localCandidate.candidateType === 'relay') {
          isRelay = true;
          // Extract relay URL from candidate
          relayUrl = localCandidate.url || localCandidate.address;
        }
      }
    });

    if (isRelay) {
      if (forceDefaultTurn) {
        emitConnectionStatus(friendPubKey, 'default_relay');
      } else {
        emitConnectionStatus(friendPubKey, 'custom_relay');
      }
      
      // Record relay stats - try to identify which relay was used
      if (relayUrl) {
        try {
          const { getCustomRelays } = await import('./iceServers');
          const customRelays = await getCustomRelays();
          const matchedRelay = customRelays.find(r => 
            r.enabled !== false && r.urls.some(u => relayUrl.includes(u.replace('turn:', '').replace('turns:', '').split(':')[0]))
          );
          if (matchedRelay) {
            await recordRelayAttempt(matchedRelay.id, true);
          }
        } catch (e) {
          console.warn('[P2P] Could not record relay stats:', e.message);
        }
      }
    } else {
      emitConnectionStatus(friendPubKey, 'p2p');
    }
  } catch (e) {
    console.warn(`[P2P] Qalad analyzeConnectionStats:`, e.message);
    emitConnectionStatus(friendPubKey, 'p2p');
  }
};

/**
 * Waxay la socdaa xaaladda xiriirka ICE. Haddii uu guuldareysato, dib ayay u isku daydaa.
 */
const monitorConnectionState = (friendPubKey, peerConnection, forceDefaultTurn) => {
  peerConnection.oniceconnectionstatechange = async () => {
    const state = peerConnection.iceConnectionState;
    console.log(`[P2P] ICE xaalad (${friendPubKey.substring(0, 12)}...): ${state}`);

    if (state === 'connected' || state === 'completed') {
      console.log(`[P2P] ✅ Xiriirka P2P waa ku guuleystay! (${friendPubKey.substring(0, 12)}...)`);
      updateContactInDatabase(friendPubKey, { status: 'jooge' });
      analyzeConnectionStats(friendPubKey, peerConnection, forceDefaultTurn);
    }

    if (state === 'failed') {
      console.warn(`[P2P] ⚠️ ICE wuu guuldareystay. Bilaabayaa automatic fallback...`);
      disconnectPeer(friendPubKey);
      emitConnectionStatus(friendPubKey, 'failed');

      // Record relay failure stats
      try {
        const { getCustomRelays, recordRelayAttempt } = await import('./iceServers');
        const customRelays = await getCustomRelays();
        for (const relay of customRelays) {
          if (relay.enabled !== false) {
            await recordRelayAttempt(relay.id, false);
          }
        }
      } catch (e) {
        console.warn('[P2P] Could not record relay failure stats:', e.message);
      }

      // Automatic fallback - no user prompt needed since we now have multiple TURN providers
      // The new getIceServers() includes multiple TURN providers for redundancy
      setTimeout(() => {
        console.log(`[P2P] 🔄 Automatic retry with full ICE server list (multiple TURN providers)...`);
        connectToPeer(friendPubKey, true, true).catch((err) => {
          console.error(`[P2P] Automatic retry failed:`, err);
          // Final fallback - try again after longer delay
          setTimeout(() => {
            connectToPeer(friendPubKey, true, true).catch(() => {});
          }, 5000);
        });
      }, 2000);
    }

    if (state === 'disconnected') {
      console.warn(`[P2P] Xiriirku wuu kala go'ay: ${friendPubKey.substring(0, 12)}...`);
      // Give it 10 seconds before marking offline and forcing a reconnect
      setTimeout(() => {
        const conn = activeConnections.get(friendPubKey);
        if (conn && conn.peerConnection.iceConnectionState === 'disconnected') {
          console.warn(`[P2P] 🔄 Xiriirka ayaa go'ay in ka badan 10s. Dib u dhisaya...`);
          updateContactInDatabase(friendPubKey, { status: 'maqane' });
          disconnectPeer(friendPubKey);
          // Restart handshake aggressively
          setTimeout(() => {
            connectToPeer(friendPubKey, true).catch(() => {});
          }, 2000);
        }
      }, 10000);
    }
  };
};

// ===================== ICE CANDIDATE BUFFERING =====================

/**
 * Waxay ku dartaa ICE candidate buffer-ka haddii remote description aan wali la sameynin.
 * Haddii remote description horey loo sameeyay, si toos ah ayay u dartaa.
 */
const addIceCandidateSafely = async (friendPubKey, peerConnection, candidateData) => {
  try {
    if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
      // Remote description already set — add ICE candidate directly
      await peerConnection.addIceCandidate(new NetworkPath(candidateData));
    } else {
      // Buffer it — we'll add it after setRemoteDescription
      if (!pendingIceCandidates.has(friendPubKey)) {
        pendingIceCandidates.set(friendPubKey, []);
      }
      pendingIceCandidates.get(friendPubKey).push(candidateData);
      console.log(`[P2P] ICE candidate buffered (sugaya remote desc): ${friendPubKey.substring(0, 12)}...`);
    }
  } catch (e) {
    console.warn(`[P2P] ICE candidate ku darid wayday:`, e.message);
  }
};

/**
 * Waxay ku dartaa dhammaan ICE candidates-kii buffered-ka ahaa marka remote description la sameeyay.
 */
const flushBufferedIceCandidates = async (friendPubKey, peerConnection) => {
  const buffered = pendingIceCandidates.get(friendPubKey) || [];
  pendingIceCandidates.delete(friendPubKey);

  for (const candidateData of buffered) {
    try {
      await peerConnection.addIceCandidate(new NetworkPath(candidateData));
    } catch (e) {
      console.warn(`[P2P] Buffered ICE ku darid wayday:`, e.message);
    }
  }

  if (buffered.length > 0) {
    console.log(`[P2P] ${buffered.length} buffered ICE candidates oo la daray.`);
  }
};

// ===================== PEER CONNECTION MANAGEMENT =====================

/**
 * Waxay xirtaa xiriirka peer gaar ah oo nadiifisaa.
 */
export const disconnectPeer = (friendPubKey) => {
  const connection = activeConnections.get(friendPubKey);
  if (!connection) return false;

  try {
    if (connection.dataChannel && connection.dataChannel.readyState !== 'closed') {
      connection.dataChannel.close();
    }
  } catch (e) { /* ignore */ }

  try {
    if (connection.peerConnection && connection.peerConnection.signalingState !== 'closed') {
      connection.peerConnection.close();
    }
  } catch (e) { /* ignore */ }

  activeConnections.delete(friendPubKey);
  pendingIceCandidates.delete(friendPubKey);
  return true;
};

/**
 * Waxay abuurtaa xiriir cusub oo P2P ah oo u dirtaa offer saaxiibka.
 */
export const connectToPeer = async (friendPubKey, isInitiator = true, forceDefaultTurn = true) => {
  if (!friendPubKey) return;

  const myPubKey = await readMyPublicKey();
  if (!myPubKey || friendPubKey === myPubKey) return;

  // Si aan loogu celcelin isku xirka isku midka ah
  if (activeConnections.has(friendPubKey)) {
    const conn = activeConnections.get(friendPubKey);
    if (conn.peerConnection.signalingState !== 'closed') {
      return;
    }
  }

  emitConnectionStatus(friendPubKey, 'connecting');
  console.log(`[P2P] 🔄 Bilaabayaa isku xirka: ${friendPubKey.substring(0, 12)}... (Initiator: ${isInitiator})`);

  try {
    const config = await getIceServers(forceDefaultTurn);
    const peerConnection = new P2PConnection(config);
    monitorConnectionState(friendPubKey, peerConnection, forceDefaultTurn);

    let dataChannel = null;
    if (isInitiator) {
      dataChannel = peerConnection.createDataChannel('rdhambaalChat');
      setupDataChannel(friendPubKey, dataChannel);
    }

    peerConnection.ondatachannel = (event) => {
      dataChannel = event.channel;
      setupDataChannel(friendPubKey, dataChannel);
      const conn = activeConnections.get(friendPubKey) || {};
      activeConnections.set(friendPubKey, { ...conn, dataChannel });
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        publishSignal(friendPubKey, {
          signalType: 'ice-candidate',
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
          from: myPubKey,
        });
      }
    };

    const connectionObj = { peerConnection, dataChannel };
    activeConnections.set(friendPubKey, connectionObj);

    if (isInitiator) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      await publishSignal(friendPubKey, {
        signalType: 'offer',
        sdp: offer.sdp,
        from: myPubKey,
      });
    } else {
      await publishSignal(friendPubKey, {
        signalType: 'wakeup',
        from: myPubKey,
      });
    }

    return connectionObj;
  } catch (e) {
    console.error('[P2P] Qalad abuurista xiriirka:', e);
    emitConnectionStatus(friendPubKey, 'failed');
  }
};

/**
 * Marka offer la helo, waxay aqbashaa oo soo celisaa answer.
 */
const handleReceivedOffer = async (friendPubKey, offerSdp, myPubKey) => {
  console.log(`[P2P] 📞 Tallaabo 4/6: Offer la helay! Samaynaya answer...`);

  let connection = activeConnections.get(friendPubKey);
  if (!connection) {
    // Create a connection as the answerer — no local offer, just accept theirs
    const config = await getIceServers(true);
    const peerConnection = new P2PConnection(config);
    monitorConnectionState(friendPubKey, peerConnection);

    peerConnection.ondatachannel = (event) => {
      setupDataChannel(friendPubKey, event.channel);
      const conn = activeConnections.get(friendPubKey) || {};
      activeConnections.set(friendPubKey, { ...conn, dataChannel: event.channel });
    };
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        publishSignal(friendPubKey, {
          signalType: 'ice-candidate',
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
          from: myPubKey,
        });
      }
    };

    activeConnections.set(friendPubKey, { peerConnection, dataChannel: null });
    connection = activeConnections.get(friendPubKey);
  }
  if (!connection) return;

  const pc = connection.peerConnection;

  // Prevent setting offer on a connection that already has a local offer (glare)
  if (pc.signalingState === 'have-local-offer') {
    const iAmTheOfferer = myPubKey < friendPubKey;
    if (iAmTheOfferer) {
      // My offer might have been lost — re-send it to guarantee the loser can accept it
      console.log(`[P2P] Glare detected — I am the offerer, re-sending my offer.`);
      await publishSignal(friendPubKey, {
        signalType: 'offer',
        sdp: pc.localDescription.sdp,
        from: myPubKey,
      });
      return;
    }
    // I should be the answerer — rollback my offer
    console.log(`[P2P] Glare detected — Rolling back my offer, accepting theirs.`);
    await pc.setLocalDescription({ type: 'rollback' });
  }

  await pc.setRemoteDescription(new HandshakeData({ type: 'offer', sdp: offerSdp }));
  await flushBufferedIceCandidates(friendPubKey, pc);

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  console.log(`[P2P] 📞 Tallaabo 5/6: U diraya answer...`);
  await publishSignal(friendPubKey, {
    signalType: 'answer',
    sdp: answer.sdp,
    from: myPubKey,
  });
};

/**
 * Marka answer la helo, waxay dejisaa remote description.
 */
const handleReceivedAnswer = async (friendPubKey, answerSdp) => {
  console.log(`[P2P] 📞 Tallaabo 5/6: Answer la helay! Dejinaya remote description...`);

  const connection = activeConnections.get(friendPubKey);
  if (!connection || !connection.peerConnection) return;

  const pc = connection.peerConnection;
  if (pc.signalingState !== 'have-local-offer') {
    console.warn(`[P2P] Answer la helay laakiin signaling state waa: ${pc.signalingState}`);
    return;
  }

  await pc.setRemoteDescription(new HandshakeData({ type: 'answer', sdp: answerSdp }));
  await flushBufferedIceCandidates(friendPubKey, pc);
  console.log(`[P2P] 📞 Tallaabo 6/6: Sugaya ICE in uu ku guuleysto... ⏳`);
};

/**
 * Marka ICE candidate la helo MQTT-ka, ku dar peer connection-ka.
 */
const handleReceivedIceCandidate = async (friendPubKey, candidateData) => {
  const connection = activeConnections.get(friendPubKey);
  if (!connection || !connection.peerConnection) {
    // Buffer it — we might not have the connection yet
    if (!pendingIceCandidates.has(friendPubKey)) {
      pendingIceCandidates.set(friendPubKey, []);
    }
    pendingIceCandidates.get(friendPubKey).push(candidateData);
    return;
  }

  await addIceCandidateSafely(friendPubKey, connection.peerConnection, candidateData);
};

// ===================== SIGNALING LISTENER (Dhageysi Calaamadaha) =====================

/**
 * Waxay bilawdaa dhegeysiga calaamadaha MQTT ee ku soo socda.
 * Tani waa shaqada ugu muhiimsan — waxay helaysaa offers, answers, iyo ICE candidates.
 */
export const startSignalingListener = async () => {
  const myPubKey = await readMyPublicKey();
  if (!myPubKey) return;

  // First connect to MQTT broker
  await connectToSignalingBroker(myPubKey);

  console.log(`[P2P] 📡 Dhegeysanayaa calaamadaha: ${myPubKey.substring(0, 12)}...`);

  // Subscribe to our signaling topic
  await subscribeToSignals(myPubKey, async (signalData) => {
    if (!signalData || !signalData.from || signalData.from === myPubKey) return;

    const isCallSignal = [
      'call-offer', 'call-answer', 'call-ice', 'call-reject', 'call-end'
    ].includes(signalData.signalType);

    // Filter stale signals (older than 30 seconds) for standard P2P signals.
    // Call signals are processed even if they are old to show missed calls.
    if (!isCallSignal && signalData.timestamp && (Date.now() - signalData.timestamp) > STALE_SIGNAL_THRESHOLD_MS) {
      console.log(`[P2P] Calaamad duugan la iska dhaafay (${signalData.signalType})`);
      return;
    }

    const friendPubKey = signalData.from;

    try {
      if (signalData.signalType === 'offer') {
        await handleReceivedOffer(friendPubKey, signalData.sdp, myPubKey);
      } else if (signalData.signalType === 'answer') {
        await handleReceivedAnswer(friendPubKey, signalData.sdp);
      } else if (signalData.signalType === 'ice-candidate') {
        await handleReceivedIceCandidate(friendPubKey, signalData.candidate);
      } else if (signalData.signalType === 'wakeup') {
        console.log(`[P2P] ⏰ Wakeup la helay ka ${friendPubKey.substring(0, 12)}...`);
        const connection = activeConnections.get(friendPubKey);
        if (connection && connection.peerConnection) {
          console.log(`[P2P] 📞 Tallaabo 2/6: Wakeup la helay, dib u diraya Offer SDP...`);
          const offer = await connection.peerConnection.createOffer();
          await connection.peerConnection.setLocalDescription(offer);
          await publishSignal(friendPubKey, {
            signalType: 'offer',
            sdp: offer.sdp,
            from: myPubKey,
          });
        } else {
          await connectToPeer(friendPubKey, true);
        }
      } else if (signalData.signalType === 'call-offer') {
        await handleCallOffer(friendPubKey, signalData.sdp, signalData.timestamp);
      } else if (signalData.signalType === 'call-answer') {
        await handleCallAnswer(signalData.sdp);
      } else if (signalData.signalType === 'call-ice') {
        await handleCallIce(signalData.candidate);
      } else if (signalData.signalType === 'call-reject') {
        handleCallReject();
      } else if (signalData.signalType === 'call-end') {
        handleEndCall();
      }
    } catch (error) {
      console.error(`[P2P] Qalad calaamada habaynteeda:`, error);
    }
  });
};

// ===================== MESSAGE SENDING =====================

/**
 * Waxay kaydisaa fariin sugeysa marka xiriirku furmo.
 */
const queueDirectMessage = async (friendPubKey, text) => {
  await mutatePersistedQueuedMessages((queueMap) => {
    const existing = Array.isArray(queueMap[friendPubKey]) ? queueMap[friendPubKey] : [];
    existing.push({
      id: generateQueuedMessageId(),
      payload: text,
      queuedAt: new Date().toISOString(),
    });
    queueMap[friendPubKey] = existing;
    return queueMap;
  });
};

/**
 * Waxay u dirtaa dhammaan fariimaha sugayey marka kanaalku furmo.
 */
const flushPendingDirectMessages = async (friendPubKey) => {
  const connection = activeConnections.get(friendPubKey);
  if (!connection?.dataChannel || connection.dataChannel.readyState !== 'open') return false;

  const queueMap = await readPersistedQueuedMessages();
  const queue = queueMap[friendPubKey] || [];
  if (queue.length === 0) return false;

  const sentIds = [];
  for (const msg of queue) {
    try {
      connection.dataChannel.send(msg.payload);
      sentIds.push(msg.id);
      
      // Update status to 'sent' (double ticks) in background!
      const parsed = JSON.parse(msg.payload);
      if (parsed && parsed.id && parsed.receiverId && parsed.senderId) {
          const roomId = [parsed.senderId, parsed.receiverId].sort().join('_');
          gun.get('messages').get(parsed.id).put({ status: 'sent' });
          gun.get('rooms').get(roomId).get('messages').get(parsed.id).put({ status: 'sent' });
      }
      console.log(`[P2P - BACKGROUND] ✅ Fariin sugaysay waa la diray! ID: ${parsed.id}`);
    } catch (e) {
      console.warn(`[P2P] Fariin dir wayday:`, e.message);
      break;
    }
  }

  if (sentIds.length > 0) {
    await mutatePersistedQueuedMessages((map) => {
      const sentSet = new Set(sentIds);
      const remaining = (map[friendPubKey] || []).filter((m) => !sentSet.has(m.id));
      if (remaining.length > 0) {
        map[friendPubKey] = remaining;
      } else {
        delete map[friendPubKey];
      }
      return map;
    });
    console.log(`[P2P] ✅ ${sentIds.length} fariimood oo sugayey ayaa la diray.`);
  }

  return sentIds.length > 0;
};

/**
 * Waxay u dirtaa fariin si toos ah saaxiibka. Haddii xiriir la'aan jirto, waxay queue-gareysaa.
 */
export const sendMessageDirect = async (friendPubKey, text) => {
  let connection = activeConnections.get(friendPubKey);

  if (!connection?.dataChannel || connection.dataChannel.readyState !== 'open') {
    connection = await connectToPeer(friendPubKey);
  }

  if (!connection?.dataChannel) {
    console.warn(`[P2P] Ma diri karo fariinta — kanaal la'aantiisa: ${friendPubKey.substring(0, 12)}...`);
    await queueDirectMessage(friendPubKey, text);
    return false;
  }

  if (connection.dataChannel.readyState === 'open') {
    await flushPendingDirectMessages(friendPubKey);
    connection = activeConnections.get(friendPubKey);
    if (connection?.dataChannel?.readyState === 'open') {
      connection.dataChannel.send(text);
      return true;
    }
  }

  console.warn(`[P2P] Xiriirku wali ma diyaarna: ${friendPubKey.substring(0, 12)}...`);
  await queueDirectMessage(friendPubKey, text);
  return false;
};

/**
 * Waxay dib u isku xirtaa peers-ka leh fariimo sugaya.
 */
export const syncPendingDirectMessages = async () => {
  const queueMap = await readPersistedQueuedMessages();
  const peerKeys = Object.keys(queueMap);
  if (peerKeys.length === 0) return;

  await Promise.all(
    peerKeys.map(async (friendPubKey) => {
      const conn = activeConnections.get(friendPubKey);
      if (conn?.dataChannel?.readyState === 'open') {
        await flushPendingDirectMessages(friendPubKey);
      } else if (!conn || conn.peerConnection?.signalingState === 'closed') {
        await connectToPeer(friendPubKey);
      }
    })
  );
};

// Kept for backward compatibility with contactRequests.ts
export const removePendingDirectMessageForRequest = async (friendPubKey, requestId) => {
  if (!friendPubKey || !requestId) return false;
  await mutatePersistedQueuedMessages((queueMap) => {
    const queue = Array.isArray(queueMap[friendPubKey]) ? queueMap[friendPubKey] : [];
    const filtered = queue.filter((m) => {
      try {
        const parsed = JSON.parse(m.payload);
        return !(parsed?.messageType === 'contact-request' && parsed?.request?.id === requestId);
      } catch { return true; }
    });
    if (filtered.length > 0) { queueMap[friendPubKey] = filtered; }
    else { delete queueMap[friendPubKey]; }
    return queueMap;
  });
  return true;
};

export const clearPendingDirectMessagesForPeer = async (friendPubKey) => {
  if (!friendPubKey) return false;
  await mutatePersistedQueuedMessages((queueMap) => {
    delete queueMap[friendPubKey];
    return queueMap;
  });
  return true;
};

// ===================== PRESENCE ENGINE (Mashiinka Joogitaanka) =====================

/**
 * Waxay bilawdaa adeegga joogitaanka (online/offline detection).
 * MQTT-ga ayay u adeegsataa heartbeat iyo dhegeysiga asxaabta.
 */
export const startPresenceEngine = async () => {
  const myPubKey = await readMyPublicKey();
  if (!myPubKey) return () => {};

  console.log(`[Presence] Bilawga mashiinka joogitaanka: ${myPubKey.substring(0, 12)}...`);

  // Ensure MQTT is connected with LWT configured
  await connectToSignalingBroker(myPubKey);

  // 1. Publish initial online status
  publishPresenceHeartbeat(myPubKey);

  // 2. Listen to contacts' presence
  const trackedContacts = new Set();

  const setupPresenceListeners = async () => {
    const contacts = await getStoredContacts();

    contacts.forEach((contact) => {
      if (contact.id === myPubKey || contact.deleted) return;
      if (trackedContacts.has(contact.id)) return;

      trackedContacts.add(contact.id);
      console.log(`[Presence] Dhegeysanayaa: ${contact.name} (${contact.id.substring(0, 8)}...)`);

      subscribeToPresence(contact.id, (isOnline) => {
        const newStatus = isOnline ? 'jooge' : 'maqane';
        updateContactInDatabase(contact.id, { status: newStatus });

        // Isku xir toos ah (Auto-connect) WebRTC marka uu saaxiibku online noqdo
        // Tani waxay oggolaanaysaa in fariimaha lagu helo background-ka iyadoo aan chat-ka la furin.
        if (isOnline) {
          connectToPeer(contact.id).catch(err => console.log(`[P2P] Qalad auto-connect:`, err));
        }
      });
    });
  };

  setupPresenceListeners();
  void syncPendingDirectMessages();

  const contactCheckInterval = setInterval(setupPresenceListeners, 30000);
  const queueRetryInterval = setInterval(() => {
    void syncPendingDirectMessages();
  }, 30000);

  // Cleanup function
  return () => {
    console.log(`[Presence] Joojinaya mashiinka joogitaanka.`);
    clearInterval(contactCheckInterval);
    clearInterval(queueRetryInterval);
    trackedContacts.forEach((contactId) => unsubscribeFromPresence(contactId));
    trackedContacts.clear();
  };
};

// ===================== INITIALIZE HOLE PUNCH REFERENCE =====================
export const getActiveConnection = (pubKey) => activeConnections.get(pubKey);
