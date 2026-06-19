import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { playVoiceNote, stopSound } from '../services/voiceNotes';

interface VoiceNotePreviewProps {
  visible: boolean;
  recordingUri: string | null;
  duration: string;
  onSend: () => void;
  onCancel: () => void;
}

export function VoiceNotePreview({ visible, recordingUri, duration, onSend, onCancel }: VoiceNotePreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      if (soundRef.current) {
        stopSound(soundRef.current);
        soundRef.current = null;
      }
      setIsPlaying(false);
    }
  }, [visible]);

  const togglePlay = async () => {
    if (!recordingUri) return;

    if (isPlaying && soundRef.current) {
      await stopSound(soundRef.current);
      soundRef.current = null;
      setIsPlaying(false);
      return;
    }

    try {
      const sound = await playVoiceNote(recordingUri);
      soundRef.current = sound;
      setIsPlaying(true);

      if (Platform.OS === 'web') {
        sound.onended = () => {
          setIsPlaying(false);
          soundRef.current = null;
        };
      } else if (sound.setOnPlaybackStatusUpdate) {
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
            soundRef.current = null;
          }
        });
      }
    } catch (e) {
      console.error('[VoiceNotePreview] Playback error:', e);
    }
  };

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        stopSound(soundRef.current);
      }
    };
  }, []);

  const webBlur = Platform.OS === 'web' ? ({ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } as any) : {};

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.container, webBlur]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Dib u dhageyso Codkaaga</Text>

          <TouchableOpacity onPress={togglePlay} style={styles.playBtn} activeOpacity={0.7}>
            <Ionicons
              name={isPlaying ? 'pause-circle' : 'play-circle'}
              size={72}
              color={Colors.primary}
            />
          </TouchableOpacity>

          <Text style={styles.duration}>{duration}</Text>

          <View style={styles.actions}>
            <TouchableOpacity onPress={onCancel} style={styles.cancelBtn} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={20} color={Colors.error} />
              <Text style={styles.cancelText}>Tirtir</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onSend} style={styles.sendBtn} activeOpacity={0.8}>
              <Ionicons name="send" size={18} color={Colors.onPrimary} />
              <Text style={styles.sendText}>Dir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.glassPanelBg,
    borderTopLeftRadius: Spacing.radius2xl,
    borderTopRightRadius: Spacing.radius2xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.glassPanelBorder,
    borderBottomWidth: 0,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.onSurfaceVariant,
    opacity: 0.3,
  },
  title: {
    ...Typography.titleMd,
    color: Colors.onSurface,
  },
  playBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.glassInteractiveBg,
  },
  duration: {
    ...Typography.titleMd,
    color: Colors.onSurface,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.lg,
    width: '100%',
    paddingHorizontal: Spacing.md,
  },
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.radiusXl,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  cancelText: {
    ...Typography.bodyLg,
    color: Colors.error,
  },
  sendBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.radiusXl,
    backgroundColor: Colors.primary,
  },
  sendText: {
    ...Typography.bodyLg,
    color: Colors.onPrimary,
    fontWeight: 'bold',
  },
});
