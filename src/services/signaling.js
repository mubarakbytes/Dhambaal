import './polyfills';
// =====================================================================================
// SIGNALING SERVICE — Adeegga Calaamadaha (MQTT Multi-Broker Signaling)
// =====================================================================================
// Wuxuu isticmaalayaa MQTT brokers BADAN oo isku mar ah si labada qalab ay isku
// arkaan xitaa haddii mid ka mid ah broker-yada uu dhinto.
// Publish = u dir dhammaan broker-yada. Subscribe = dhegeyso dhammaan broker-yada.
// =====================================================================================

import mqtt from 'mqtt';
import { Platform } from 'react-native';

// ===================== MQTT BROKER LIST =====================
const MQTT_BROKER_LIST = [
  { url: 'wss://broker.emqx.io:8084/mqtt', name: 'EMQX' },
  { url: 'wss://broker.hivemq.com:8884/mqtt', name: 'HiveMQ' },
];

// ===================== MODULE STATE =====================
const connectedClients = [];                     // All connected MQTT client objects
const signalHandlers = new Map();                // topic -> callback
const APP_TOPIC_PREFIX = 'rdhambaal';
let isSetupDone = false;
let setupPromise = null;

// Track which messages we already processed (to avoid duplicates from multiple brokers)
const processedMessageIds = new Set();
const MAX_PROCESSED_IDS = 500; // Keep memory bounded

// ===================== HELPERS =====================

const generateClientId = (myPublicKey = null, brokerName = '') => {
  const platformName = Platform.OS;
  if (myPublicKey) {
    // Generate a stable client ID using the public key (cleaned of non-alphanumeric chars)
    const cleanPubKey = myPublicKey.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    const cleanBroker = brokerName.replace(/[^a-zA-Z0-9]/g, '');
    return `${APP_TOPIC_PREFIX}_${platformName}_${cleanBroker}_${cleanPubKey}`;
  }
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${APP_TOPIC_PREFIX}_${platformName}_${randomPart}`;
};

const buildSignalTopic = (publicKey) => `${APP_TOPIC_PREFIX}/signal/${publicKey}`;
const buildPresenceTopic = (publicKey) => `${APP_TOPIC_PREFIX}/presence/${publicKey}`;

// Deduplicate messages arriving from multiple brokers
const generateMessageId = (data) => {
  return `${data.from || data.publicKey || ''}_${data.signalType || 'presence'}_${data.timestamp || data.lastActive || ''}`;
};

const trackMessage = (messageId) => {
  if (processedMessageIds.has(messageId)) return false; // Already seen
  processedMessageIds.add(messageId);
  // Keep the set from growing forever
  if (processedMessageIds.size > MAX_PROCESSED_IDS) {
    const firstItem = processedMessageIds.values().next().value;
    processedMessageIds.delete(firstItem);
  }
  return true; // New message
};

// ===================== MULTI-BROKER CONNECTION =====================

/**
 * Waxay ku xirtaa DHAMMAAN broker-yada isku mar ah.
 * @param {string} [myPublicKey] - Furahaaga (in loo isticmaalo Last Will)
 */
export const connectToSignalingBroker = (myPublicKey = null) => {
  if (isSetupDone && connectedClients.length > 0) {
    return Promise.resolve();
  }

  if (setupPromise) {
    return setupPromise;
  }

  setupPromise = new Promise((resolve) => {
    let resolvedOnce = false;
    let attempts = 0;

    MQTT_BROKER_LIST.forEach((broker) => {
      const clientId = generateClientId(myPublicKey, broker.name);
      console.log(`[Signaling] Isku xiraya ${broker.name} (${broker.url}) clientId: ${clientId}...`);

      const willTopic = myPublicKey ? buildPresenceTopic(myPublicKey) : undefined;
      const willPayload = myPublicKey ? JSON.stringify({ status: 'offline', publicKey: myPublicKey }) : undefined;

      const isPersistent = !!myPublicKey;
      const isWeb = Platform.OS === 'web';

      const client = mqtt.connect(broker.url, {
        clientId,
        clean: isWeb ? true : !isPersistent, // clean: false enables persistent sessions on mobile; true on web
        connectTimeout: 15000,
        reconnectPeriod: 10000,
        keepalive: 30,
        will: willTopic ? {
          topic: willTopic,
          payload: willPayload,
          qos: 1,
          retain: true,
        } : undefined,
      });

      // Tag the client with its broker name for logging
      client._brokerName = broker.name;

      client.on('connect', () => {
        console.log(`[Signaling] ✅ Ku xiran ${broker.name}!`);
        connectedClients.push(client);

        // Subscribe this client to all topics we want to listen to
        signalHandlers.forEach((_callback, topic) => {
          client.subscribe(topic, { qos: 1 });
        });

        if (!resolvedOnce) {
          resolvedOnce = true;
          isSetupDone = true;
          setupPromise = null;
          resolve();
        }
      });

      client.on('message', (topic, messageBuffer) => {
        try {
          const messageText = messageBuffer.toString();
          const messageData = JSON.parse(messageText);

          // Deduplicate — same message may arrive from multiple brokers
          const messageId = generateMessageId(messageData);
          if (!trackMessage(messageId)) return; // Already processed
          
          console.log(`[Signaling] 📥 MQTT Fariin (${client._brokerName}):`, topic, 'Type:', messageData.signalType || messageData.messageType || 'Presence');

          const handler = signalHandlers.get(topic);
          if (handler) {
            handler(messageData);
          } else {
            console.log(`[Signaling] ⚠️ Handler lama helin topic-gan:`, topic);
          }
        } catch (e) {
          console.warn('[Signaling] Parse error:', e.message);
        }
      });

      client.on('error', (error) => {
        console.warn(`[Signaling] ⚠️ ${broker.name}: ${error.message}`);
      });

      client.on('close', () => {
        // Remove from connected list
        const index = connectedClients.indexOf(client);
        if (index >= 0) connectedClients.splice(index, 1);
      });

      client.on('reconnect', () => {
        console.log(`[Signaling] 🔄 ${broker.name} dib u isku xiraya...`);
      });
    });

    // Safety timeout — resolve even if no broker connects (so app doesn't hang)
    setTimeout(() => {
      if (!resolvedOnce) {
        resolvedOnce = true;
        isSetupDone = true;
        setupPromise = null;
        console.warn('[Signaling] ⚠️ Wax broker ah lama helin 15s gudahood. Sii wadaya...');
        resolve();
      }
    }, 15000);
  });

  return setupPromise;
};

// ===================== PUBLISH (Dir — u dir dhammaan broker-yada) =====================

/**
 * Waxay u dirtaa calaamad saaxiib — DHAMMAAN broker-yada connected ayaa la u diraa.
 */
export const publishSignal = async (targetPublicKey, signalData) => {
  if (connectedClients.length === 0) {
    await connectToSignalingBroker();
  }

  const topic = buildSignalTopic(targetPublicKey);
  const payload = JSON.stringify({
    ...signalData,
    timestamp: Date.now(),
  });

  let publishedCount = 0;
  
  // Create an array of promises for all publish operations
  const publishPromises = connectedClients.map((client) => {
    return new Promise((resolve) => {
      try {
        client.publish(topic, payload, { qos: 1 }, (error) => {
          if (error) {
            console.warn(`[Signaling] Error publishing on ${client._brokerName}:`, error.message);
          } else {
            publishedCount++;
          }
          resolve(); // Always resolve so Promise.all doesn't reject entirely
        });
      } catch (e) {
        console.warn(`[Signaling] Dir wayday ${client._brokerName}:`, e.message);
        resolve();
      }
    });
  });

  // Wait for all broker publish operations to complete or fail
  await Promise.all(publishPromises);

  if (publishedCount > 0) {
    console.log(`[Signaling] 📤 Calaamad loo diray ${publishedCount} broker(s)`);
  } else {
    console.warn('[Signaling] ⚠️ 0 broker connected — calaamada lama dirin!');
  }
};

// ===================== SUBSCRIBE (Dhegeysi — dhammaan broker-yada) =====================

/**
 * Waxay dhegeysataa calaamadaha ku soo socda — dhammaan broker-yada connected.
 */
export const subscribeToSignals = async (myPublicKey, onSignalReceived) => {
  if (connectedClients.length === 0) {
    await connectToSignalingBroker(myPublicKey);
  }

  const topic = buildSignalTopic(myPublicKey);
  signalHandlers.set(topic, onSignalReceived);

  connectedClients.forEach((client) => {
    client.subscribe(topic, { qos: 1 }, (err) => {
      if (!err) {
        console.log(`[Signaling] 📡 ${client._brokerName}: Dhegeysanayaa calaamadaha`);
      }
    });
  });
};

// ===================== PRESENCE =====================

export const publishPresenceHeartbeat = (myPublicKey) => {
  const topic = buildPresenceTopic(myPublicKey);
  const payload = JSON.stringify({
    status: 'online',
    publicKey: myPublicKey,
  });

  connectedClients.forEach((client) => {
    try {
      client.publish(topic, payload, { qos: 1, retain: true });
    } catch (e) { /* ignore */ }
  });
};

export const subscribeToPresence = async (contactPublicKey, onPresenceUpdate) => {
  if (connectedClients.length === 0) {
    await connectToSignalingBroker();
  }

  const topic = buildPresenceTopic(contactPublicKey);

  signalHandlers.set(topic, (presenceData) => {
    if (presenceData && presenceData.status) {
      if (presenceData.status === 'online') {
        onPresenceUpdate(true);
      } else {
        onPresenceUpdate(false);
      }
    } else if (presenceData && presenceData.lastActive) {
      // Backward compatibility for old heartbeat format
      const isStale = (Date.now() - Math.abs(presenceData.lastActive)) > 45000;
      onPresenceUpdate(!isStale);
    }
  });

  connectedClients.forEach((client) => {
    client.subscribe(topic, { qos: 0 });
  });
};

export const unsubscribeFromPresence = (contactPublicKey) => {
  const topic = buildPresenceTopic(contactPublicKey);
  signalHandlers.delete(topic);
  connectedClients.forEach((client) => {
    try { client.unsubscribe(topic); } catch (e) { /* ignore */ }
  });
};

// ===================== CLEANUP =====================

export const disconnectSignaling = () => {
  console.log('[Signaling] Xiritaanka dhammaan broker-yada...');
  signalHandlers.clear();
  connectedClients.forEach((client) => {
    try { client.end(true); } catch (e) { /* ignore */ }
  });
  connectedClients.length = 0;
  isSetupDone = false;
  setupPromise = null;
};
