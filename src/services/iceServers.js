import AsyncStorage from '@react-native-async-storage/async-storage';

const CUSTOM_RELAYS_KEY = 'CUSTOM_TURN_SERVERS';
const RELAY_STATS_KEY = 'CUSTOM_TURN_STATS';

// Multiple TURN providers for redundancy - if one fails, others may work
const TURN_PROVIDERS = [
  // Metered.ca (current)
  {
    urls: [
      "turn:global.relay.metered.ca:80",
      "turn:global.relay.metered.ca:80?transport=tcp",
      "turn:global.relay.metered.ca:443",
      "turns:global.relay.metered.ca:443?transport=tcp"
    ],
    username: 'aea9290e5735182d313f605e',
    credential: '7M7ON3oY3QGjcCNK'
  },
  // OpenRelay.metered.ca (backup)
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:3478'
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
];

export const getIceServers = async (forceDefaultTurn = false) => {
  const servers = [
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
  ];

  // 1. Check for user-configured custom relays (highest priority - multiple supported)
  try {
    const customStr = await AsyncStorage.getItem(CUSTOM_RELAYS_KEY);
    if (customStr) {
      const customRelays = JSON.parse(customStr);
      if (Array.isArray(customRelays) && customRelays.length > 0) {
        for (const relay of customRelays) {
          if (relay.enabled !== false && relay.urls && relay.urls.length > 0) {
            servers.push({
              urls: relay.urls,
              username: relay.username || '',
              credential: relay.password || '',
            });
            console.log('[ICE] Using custom TURN server:', relay.name || relay.urls[0]);
          }
        }
      }
    }
  } catch (e) {
    console.error('[ICE] Error reading custom TURN:', e);
  }

  // 2. Always add default TURN providers for redundancy (no early return!)
  for (const provider of TURN_PROVIDERS) {
    servers.push({
      urls: provider.urls,
      username: provider.username,
      credential: provider.credential,
    });
  }

  console.log('[ICE] Configured ICE servers:', servers.length, 'total (STUN + TURN)');
  return { iceServers: servers };
};

export const getCustomRelays = async () => {
  try {
    const customStr = await AsyncStorage.getItem(CUSTOM_RELAYS_KEY);
    return customStr ? JSON.parse(customStr) : [];
  } catch (e) {
    console.error('[ICE] Error reading custom relays:', e);
    return [];
  }
};

export const saveCustomRelays = async (relays) => {
  await AsyncStorage.setItem(CUSTOM_RELAYS_KEY, JSON.stringify(relays));
};

export const getRelayStats = async () => {
  try {
    const statsStr = await AsyncStorage.getItem(RELAY_STATS_KEY);
    return statsStr ? JSON.parse(statsStr) : {};
  } catch (e) {
    return {};
  }
};

export const recordRelayAttempt = async (relayId, success) => {
  try {
    const stats = await getRelayStats();
    if (!stats[relayId]) {
      stats[relayId] = { success: 0, failed: 0, lastUsed: null };
    }
    if (success) {
      stats[relayId].success++;
    } else {
      stats[relayId].failed++;
    }
    stats[relayId].lastUsed = new Date().toISOString();
    await AsyncStorage.setItem(RELAY_STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    console.error('[ICE] Error recording relay stats:', e);
  }
};

export const resetRelayStats = async (relayId) => {
  try {
    const stats = await getRelayStats();
    if (stats[relayId]) {
      stats[relayId] = { success: 0, failed: 0, lastUsed: null };
      await AsyncStorage.setItem(RELAY_STATS_KEY, JSON.stringify(stats));
    }
  } catch (e) {
    console.error('[ICE] Error resetting relay stats:', e);
  }
};
