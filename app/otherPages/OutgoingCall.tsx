import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { StatusChip } from '../../src/components/StatusChip';
import {
  initiateCall,
  endCall,
  setCallCallbacks,
  getCallConnectionStatusForPeer,
  registerCallConnectionStatusListener,
} from '../../src/services/callService';
import { playOutgoingRingtone, stopRingtone } from '../../src/services/ringtone';

export default function OutgoingCall() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const router = useRouter();
  const [status, setStatus] = useState('Wicitaan Baxaya...');
  const [answered, setAnswered] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  useEffect(() => {
    if (!id) {
      return;
    }

    setConnectionStatus(getCallConnectionStatusForPeer(id));

    const unsubscribeConnectionStatus = registerCallConnectionStatusListener((peerKey, nextStatus) => {
      if (peerKey === id) {
        setConnectionStatus(nextStatus);
      }
    });

    if (answered) {
      // Yield JS thread before navigating to avoid Expo Router silent drops
      setTimeout(() => {
        router.push(`/otherPages/OngoingCall?id=${id}&name=${encodeURIComponent(name || 'Unknown')}`);
      }, 50);
    }
    return () => {
      unsubscribeConnectionStatus();
    };
  }, [answered, id, name]);

  useEffect(() => {
    stopRingtone();
    playOutgoingRingtone();
    if (!id) {
      router.back();
      return;
    }

    setCallCallbacks(
      (stream) => {
        // Stream updated
      },
      () => {
        // Call ended or rejected
        stopRingtone();
        setStatus('Wuu go\'ay / Waa la diiday');
        setTimeout(() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)/wicitaano');
          }
        }, 1500);
      },
      () => {
        // Call answered! Set state to trigger navigation effect
        stopRingtone();
        setStatus('Waa la qabtay!');
        setAnswered(true);
      }
    );

    // Initiate the WebRTC call!
    initiateCall(id);

    return () => {
      // If component unmounts unexpectedly, stop the ringtone
      stopRingtone();
    };
  }, [id]);

  const handleHangUp = () => {
    stopRingtone();
    endCall();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/wicitaano');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarInitial}>{(name || '?').substring(0, 1).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{name || 'Unknown'}</Text>
        <Text style={styles.status}>{status}</Text>
        <View style={styles.connectionBadgeRow}>
          <StatusChip connectionStatus={connectionStatus} />
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.endCallButton} onPress={handleHangUp}>
          <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1E1E', // Darker elegant theme for calls
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 48,
    fontFamily: Typography.semiBold,
  },
  name: {
    fontSize: 28,
    color: '#fff',
    fontFamily: Typography.bold,
    marginBottom: 8,
    textAlign: 'center',
    width: '100%',
  },
  status: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: Typography.regular,
    textAlign: 'center',
    width: '100%',
  },
  connectionBadgeRow: {
    marginTop: 12,
  },
  controls: {
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    alignItems: 'center',
  },
  endCallButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FF3B30', // Red for hang up
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#FF3B30',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
