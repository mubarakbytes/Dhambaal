import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { endCall, toggleMute, setCallCallbacks, getRemoteStream } from '../../src/services/callService';

export default function OngoingCall() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const router = useRouter();
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  // NOTE: On native, if we need to route audio to the speaker, we'd use `react-native-webrtc` RTCView 
  // or Audio routing methods. For pure audio, the stream usually plays automatically on the earpiece.

  const audioRef = useRef<any>(null);
  const startTime = useRef(Date.now());

  useEffect(() => {
    // Start duration timer based on actual elapsed time
    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);

    const attachStream = (stream: any) => {
      if (Platform.OS === 'web' && audioRef.current && stream) {
        audioRef.current.srcObject = stream;
        audioRef.current.play().catch((e: any) => console.warn('Audio play failed:', e));
      }
    };

    setCallCallbacks(
      (stream) => { attachStream(stream); }, // stream updated
      () => {
        // Call ended
        clearInterval(interval);
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/wicitaano');
        }
      }
    );

    // Initial check in case stream arrived before component mounted
    setTimeout(() => {
      attachStream(getRemoteStream());
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleHangUp = () => {
    endCall();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/wicitaano');
    }
  };

  const handleMute = () => {
    const muted = toggleMute();
    setIsMuted(muted);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarInitial}>{(name || '?').substring(0, 1).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{name || 'Unknown'}</Text>
        <Text style={styles.status}>{formatDuration(duration)}</Text>
      </View>

      {/* Since we don't need video, we don't render RTCView. WebRTC native will route audio automatically. */}
      {Platform.OS === 'web' && (
        <audio ref={audioRef} autoPlay playsInline style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
      )}

      <View style={styles.controls}>
        <TouchableOpacity style={[styles.controlButton, isMuted && styles.controlButtonActive]} onPress={handleMute}>
          <Ionicons name={isMuted ? "mic-off" : "mic"} size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.endCallButton} onPress={handleHangUp}>
          <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="volume-high" size={28} color="#fff" />
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
  },
  status: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.9)',
    fontFamily: Typography.medium,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  endCallButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#FF3B30',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});