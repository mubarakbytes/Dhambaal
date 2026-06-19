import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { StatusChip } from '../../src/components/StatusChip';
import {
  endCall,
  toggleMute,
  toggleSpeaker,
  setCallCallbacks,
  getRemoteStream,
  answerCall,
  getPendingOfferSdp,
  getPersistedOfferSdp,
  getCallConnectionStatusForPeer,
  registerCallConnectionStatusListener,
  isMicrophoneMuted,
  isSpeakerOn as getSpeakerState,
} from '../../src/services/callService';
import { stopRingtone } from '../../src/services/ringtone';

export default function OngoingCall() {
  const { id, name, autoAnswer } = useLocalSearchParams<{ id: string; name: string; autoAnswer?: string }>();
  const router = useRouter();
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(() => isMicrophoneMuted());
  const [isSpeakerOn, setIsSpeakerOn] = useState(() => getSpeakerState());
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  // NOTE: For pure audio calls, react-native-webrtc automatically routes the audio 
  // track to the hardware speaker/earpiece. We DO NOT need an RTCView, which is a heavy 
  // SurfaceView that can throttle or freeze the UI thread on some Android devices.
  const [remoteStreamState, setRemoteStreamState] = useState<any>(null);

  const audioRef = useRef<any>(null);
  const startTime = useRef(Date.now());

  useEffect(() => {
    stopRingtone();
    if (!id) {
      return;
    }

    setIsMuted(isMicrophoneMuted());
    setIsSpeakerOn(getSpeakerState());

    setConnectionStatus(getCallConnectionStatusForPeer(id));

    const unsubscribeConnectionStatus = registerCallConnectionStatusListener((peerKey, status) => {
      if (peerKey === id) {
        setConnectionStatus(status);
      }
    });

    // Start duration timer based on actual elapsed time
    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);

    // If navigated from a background notification "Qabo" tap, answer here in the foreground
    if (autoAnswer === 'true') {
      (async () => {
        // Try in-memory first, then AsyncStorage (notification intent may have dropped SDP)
        let pendingSdp = getPendingOfferSdp();
        if (!pendingSdp) {
          const persisted = await getPersistedOfferSdp();
          if (persisted && persisted.sdp) {
            pendingSdp = persisted.sdp;
          }
        }
        if (pendingSdp) {
          // Only request microphone when the app is truly active to prevent fatal native crashes
          if (AppState.currentState === 'active') {
            setTimeout(() => answerCall(id, pendingSdp), 500);
          } else {
            const subscription = AppState.addEventListener('change', (nextState) => {
              if (nextState === 'active') {
                setTimeout(() => answerCall(id, pendingSdp), 500);
                subscription.remove();
              }
            });
          }
        }
      })();
    }

    const attachStream = (stream: any) => {
      if (Platform.OS === 'web' && audioRef.current && stream) {
        audioRef.current.srcObject = stream;
        audioRef.current.play().catch((e: any) => console.warn('Audio play failed:', e));
      } else if (Platform.OS !== 'web' && stream) {
        setRemoteStreamState(stream);
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

    return () => {
      clearInterval(interval);
      unsubscribeConnectionStatus();
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    // Format strictly as 00:00 to prevent user confusion
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
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

  const handleSpeaker = () => {
    const on = toggleSpeaker();
    setIsSpeakerOn(on);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarInitial}>{(name || '?').substring(0, 1).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{name || 'Unknown'}</Text>
        <Text style={styles.status}>{formatDuration(duration)}</Text>
        <View style={styles.connectionBadgeRow}>
          <StatusChip connectionStatus={connectionStatus} />
        </View>
      </View>

      {/* For Web, we use standard HTML Audio. For Native, audio is automatically routed by the WebRTC engine. */}
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
        
        <TouchableOpacity style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]} onPress={handleSpeaker}>
          <Ionicons name={isSpeakerOn ? "volume-high" : "volume-low-outline"} size={28} color="#fff" />
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
    fontSize: 20,
    color: 'rgba(255,255,255,0.9)',
    fontFamily: Typography.medium,
    textAlign: 'center',
    width: '100%',
    fontVariant: ['tabular-nums'],
  },
  connectionBadgeRow: {
    marginTop: 12,
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
