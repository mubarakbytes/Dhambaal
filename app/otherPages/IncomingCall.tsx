import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { StatusChip } from '../../src/components/StatusChip';
import {
  answerCall,
  rejectCall,
  setCallCallbacks,
  getPendingOfferSdp,
  getCallConnectionStatusForPeer,
  registerCallConnectionStatusListener,
} from '../../src/services/callService';
import { getStoredContacts } from '../../src/services/storage';
import { playIncomingRingtone, stopRingtone } from '../../src/services/ringtone';

export default function IncomingCall() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [callerName, setCallerName] = useState('Unknown');
  const [sdp, setSdp] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  useEffect(() => {
    const pendingSdp = getPendingOfferSdp();
    if (!id || !pendingSdp) {
      router.back();
      return;
    }
    setSdp(pendingSdp);
    setConnectionStatus(getCallConnectionStatusForPeer(id));

    const unsubscribeConnectionStatus = registerCallConnectionStatusListener((peerKey, status) => {
      if (peerKey === id) {
        setConnectionStatus(status);
      }
    });

    getStoredContacts().then(contacts => {
      const contact = contacts.find(c => c.id === id);
      if (contact) {
        setCallerName(contact.name);
      }
    });

    Vibration.vibrate([1000, 2000], true);
    playIncomingRingtone();

    setCallCallbacks(
      (stream) => {
        stopRingtone();
        Vibration.cancel();
        router.replace(`/otherPages/OngoingCall?id=${id}&name=${encodeURIComponent(callerName)}`);
      },
      () => {
        stopRingtone();
        Vibration.cancel();
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/wicitaano');
        }
      }
    );

    return () => {
      stopRingtone();
      Vibration.cancel();
      unsubscribeConnectionStatus();
    };
  }, [id]);

  const handleAnswer = () => {
    if (!sdp) return;
    stopRingtone();
    Vibration.cancel();
    answerCall(id, sdp);
    router.replace(`/otherPages/OngoingCall?id=${id}&name=${encodeURIComponent(callerName)}`);
  };

  const handleDecline = () => {
    stopRingtone();
    Vibration.cancel();
    rejectCall(id);
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
          <Text style={styles.avatarInitial}>{(callerName || '?').substring(0, 1).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{callerName}</Text>
        <Text style={styles.status}>Wicitaan Soo Socda...</Text>
        <View style={styles.connectionBadgeRow}>
          <StatusChip connectionStatus={connectionStatus} />
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={[styles.callButton, styles.declineButton]} onPress={handleDecline}>
          <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
        
        <View style={{ width: 60 }} />

        <TouchableOpacity style={[styles.callButton, styles.answerButton]} onPress={handleAnswer}>
          <Ionicons name="call" size={32} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1E1E', 
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
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: Platform.OS === 'ios' ? 60 : 40,
  },
  callButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  declineButton: {
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  answerButton: {
    backgroundColor: '#34C759',
    shadowColor: '#34C759',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
