import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { initiateCall, endCall, setCallCallbacks } from '../../src/services/callService';

export default function OutgoingCall() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const router = useRouter();
  const [status, setStatus] = useState('Wicitaan Baxaya...');

  useEffect(() => {
    if (!id) {
      router.back();
      return;
    }

    setCallCallbacks(
      (stream) => {
        // When remote stream is received, it means they answered!
        setStatus('Waa la qabtay!');
        // Navigate to OngoingCall, passing id and name
        router.replace(`/otherPages/OngoingCall?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name || 'Unknown')}`);
      },
      () => {
        // Call ended or rejected
        setStatus('Wuu go\'ay / Waa la diiday');
        setTimeout(() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)/wicitaano');
          }
        }, 1500);
      }
    );

    // Initiate the WebRTC call!
    initiateCall(id);

    return () => {
      // If component unmounts unexpectedly, don't end call if they answered, 
      // but usually the callback routes to OngoingCall which keeps the service alive.
    };
  }, [id]);

  const handleHangUp = () => {
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
  },
  status: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: Typography.regular,
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