import React, { useEffect, useState, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image, Linking, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';

export interface VoiceNoteProps {
  duration: string;
  audioUri?: string;
  msgId?: string;
  autoDeleteAt?: number;
  isExpired?: boolean;
  waveform?: number[];
}

interface MessageBubbleProps {
  text?: string;
  time: string;
  type: 'sent' | 'received';
  showAvatar?: boolean;
  avatarSource?: any;
  status?: 'sent' | 'delivered' | 'read' | 'deleted' | string;
  isDeleted?: boolean;
  voiceNote?: VoiceNoteProps;
  file?: { msgId?: string; name: string; uri?: string; size: number; mimeType: string; isExpired?: boolean };
  senderName?: string;
  isPlaying?: boolean;
  onPlayVoiceNote?: (voiceNote: VoiceNoteProps) => void;
  onDownloadVoiceNote?: (voiceNote: VoiceNoteProps) => void;
  onLongPress?: () => void;
  highlight?: string;
  isSearchMatch?: boolean;
}

export const MessageBubble = memo(function MessageBubble({
  text,
  time,
  type,
  showAvatar = false,
  avatarSource,
  status = 'read',
  isDeleted = false,
  voiceNote,
  file,
  senderName,
  isPlaying = false,
  onPlayVoiceNote,
  onDownloadVoiceNote,
  onLongPress,
  highlight = '',
  isSearchMatch = false,
}: MessageBubbleProps) {
  const isSent = type === 'sent';
  const isWeb = Platform.OS === 'web';

  const [webImageUri, setWebImageUri] = useState<string | undefined>();

  useEffect(() => {
    if (isWeb && file?.msgId && file.mimeType.startsWith('image/') && !file.isExpired) {
      import('../services/voiceStorage').then(async ({ getVoiceAudioAsync }) => {
        const base64 = await getVoiceAudioAsync(file.msgId);
        if (base64) setWebImageUri(`data:${file.mimeType};base64,${base64}`);
      });
    }
  }, [isWeb, file]);

  const autoDeleteAt = voiceNote?.autoDeleteAt ?? null;
  const isExpired = voiceNote?.isExpired ?? false;
  const hasWarning = isWeb && !isSent && !autoDeleteAt && !isExpired && voiceNote != null;

  const handlePlay = () => {
    if (isExpired || !voiceNote || !onPlayVoiceNote) return;
    onPlayVoiceNote(voiceNote);
  };

  const handleDownload = () => {
    if (onDownloadVoiceNote && voiceNote) {
      onDownloadVoiceNote(voiceNote);
    }
  };

  const handleOpenFile = async () => {
    if (file?.isExpired) return;
    if (isWeb && file?.msgId) {
      // Dynamic import to avoid web errors if not found
      import('../services/voiceStorage').then(async ({ getVoiceAudioAsync }) => {
        const base64 = await getVoiceAudioAsync(file.msgId);
        if (base64) {
          const byteCharacters = atob(base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: file.mimeType });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
        }
      });
    } else if (file?.uri) {
      Linking.openURL(file.uri).catch(() => alert('Ma furi karo faylkan.'));
    }
  };

  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: Spacing.sm,
    },
    rowSent: {
      justifyContent: 'flex-end',
    },
    rowReceived: {
      justifyContent: 'flex-start',
    },
    avatarPlaceholder: {
      width: 24,
      marginRight: 6,
    },
    sentBubble: {
      backgroundColor: Colors.sentBubble,
      borderRadius: Spacing.radius2xl,
      borderBottomRightRadius: Spacing.radiusSm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 10,
      maxWidth: '85%',
    },
    receivedBubble: {
      backgroundColor: Colors.glassPanelBg,
      borderWidth: 1,
      borderColor: Colors.glassPanelBorder,
      borderRadius: Spacing.radius2xl,
      borderBottomLeftRadius: Spacing.radiusSm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 10,
      maxWidth: '85%',
    },
    sentText: {
      ...Typography.bodyLg,
      color: Colors.sentBubbleText,
    },
    receivedText: {
      ...Typography.bodyLg,
      color: Colors.onSurface,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
      marginTop: 4,
    },
    sentTime: {
      ...Typography.labelMonoSm,
      color: 'rgba(255,255,255,0.6)',
    },
    receivedTime: {
      ...Typography.labelMonoSm,
      color: Colors.onSurfaceVariant,
    },
    senderName: {
      ...Typography.bodySm,
      color: Colors.primary,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    voiceContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: 2,
      minWidth: 200,
    },
    playBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    waveformContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      height: 32,
    },
    waveformBar: {
      width: 3,
      borderRadius: 1.5,
    },
    durationText: {
      ...Typography.labelMono,
      fontSize: 10,
    },
    sentDuration: {
      color: 'rgba(255,255,255,0.8)',
    },
    receivedDuration: {
      color: Colors.onSurfaceVariant,
    },
    voiceFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: 4,
    },
    downloadBtn: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    warningText: {
      ...Typography.labelMono,
      fontSize: 9,
      color: Colors.onSurfaceVariant,
      flex: 1,
    },
    expiredText: {
      ...Typography.labelMono,
      fontSize: 9,
      color: Colors.onSurfaceVariant,
      fontStyle: 'italic',
    },
  });

  const webBlur =
    Platform.OS === 'web' && !isSent
      ? ({
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        } as any)
      : {};

  const defaultWaveform = [12, 18, 8, 24, 14, 28, 10, 20, 16, 6, 22, 12, 18, 8, 24, 14];
  const activeWaveform = voiceNote?.waveform ?? defaultWaveform;

  if (isDeleted) {
    return (
      <View style={[styles.row, isSent ? styles.rowSent : styles.rowReceived]}>
        <View style={[isSent ? styles.sentBubble : styles.receivedBubble, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, opacity: 0.7 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="trash-outline" size={14} color={Colors.onSurfaceVariant} />
            <Text style={{ ...Typography.bodySm, color: Colors.onSurfaceVariant, fontStyle: 'italic' }}>Fariintan waa la tirtiray</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, isSent ? styles.rowSent : styles.rowReceived]}>
      {showAvatar && !isSent && (
        <View style={styles.avatarPlaceholder} />
      )}

      <TouchableOpacity 
        style={[
          isSent ? styles.sentBubble : [styles.receivedBubble, webBlur],
          isSearchMatch && { borderLeftWidth: 3, borderLeftColor: '#fde047' }
        ]}
        activeOpacity={0.8}
        onLongPress={onLongPress}
        delayLongPress={500}
      >
        {!!senderName && !isSent && (
          <Text style={styles.senderName}>{senderName}</Text>
        )}

        {!!text && (
          <Text style={isSent ? styles.sentText : styles.receivedText}>
            {highlight && isSearchMatch && text.toLowerCase().includes(highlight.toLowerCase())
              ? text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, i) =>
                  part.toLowerCase() === highlight.toLowerCase()
                    ? <Text key={i} style={{ backgroundColor: '#fde047', color: '#1c1917' }}>{part}</Text>
                    : part
                )
              : text
            }
          </Text>
        )}

        {file && (
          <TouchableOpacity onPress={handleOpenFile} activeOpacity={0.7} style={{ marginTop: text ? 8 : 0 }}>
            {file.isExpired ? (
              <View style={[styles.voiceNoteContainer, { opacity: 0.5 }]}>
                <Ionicons name="warning" size={24} color={Colors.onSurfaceVariant} />
                <Text style={{ ...Typography.bodySm, color: Colors.onSurfaceVariant, marginLeft: 8 }}>Faylkan waa uu dhacay</Text>
              </View>
            ) : file.mimeType.startsWith('image/') ? (
              <View style={{ borderRadius: 8, overflow: 'hidden' }}>
                {(isWeb ? webImageUri : file.uri) ? (
                  <Image 
                    source={{ uri: isWeb ? webImageUri : file.uri }} 
                    style={{ width: 200, height: 200, resizeMode: 'cover' }} 
                  />
                ) : (
                  <View style={{ width: 200, height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: isSent ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}>
                    <ActivityIndicator size="small" color={isSent ? '#ffffff' : Colors.primary} />
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                  <Ionicons name="image-outline" size={12} color={isSent ? Colors.sentBubbleText : Colors.onSurfaceVariant} />
                  <Text style={{ fontSize: 10, color: isSent ? Colors.sentBubbleText : Colors.onSurfaceVariant }}>{file.name}</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.voiceNoteContainer, { backgroundColor: isSent ? 'rgba(255,255,255,0.2)' : Colors.surface, padding: 12, borderRadius: 8 }]}>
                {(!isWeb && !file.uri) ? (
                  <ActivityIndicator size="small" color={isSent ? '#ffffff' : Colors.primary} style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="document-text" size={32} color={isSent ? Colors.sentBubbleText : Colors.primary} />
                )}
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ ...Typography.bodyMd, color: isSent ? Colors.sentBubbleText : Colors.onSurface, fontWeight: 'bold' }} numberOfLines={1}>{file.name}</Text>
                  <Text style={{ fontSize: 11, color: isSent ? 'rgba(255,255,255,0.7)' : Colors.onSurfaceVariant }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB {(!isWeb && !file.uri) && '• Soo dejinta xogta...'}
                  </Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        )}

        {voiceNote && !file && (
          isExpired ? (
            <Text style={[isSent ? styles.sentText : styles.receivedText, { fontStyle: 'italic', opacity: 0.8 }]}>
              <Ionicons name="lock-closed" size={14} /> Fariin codeedkan hadda lama heli karo waa ay dhacday
            </Text>
          ) : (
            <View>
              <View style={styles.voiceContainer}>
                <TouchableOpacity
                  style={[
                    styles.playBtn,
                    {
                      backgroundColor: isSent
                        ? 'rgba(255,255,255,0.2)'
                        : Colors.primary,
                    },
                  ]}
                  onPress={handlePlay}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={18}
                    color={isSent ? Colors.sentBubbleText : Colors.onPrimary}
                    style={{ marginLeft: isPlaying ? 0 : 2 }}
                  />
                </TouchableOpacity>

                <View style={styles.waveformContainer}>
                  {activeWaveform.map((height, index) => {
                    const isPlayedPart = index < activeWaveform.length * 0.4;
                    let barColor = isSent ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)';
                    if (isPlaying && isPlayedPart) {
                      barColor = isSent ? Colors.sentBubbleText : Colors.primary;
                    } else if (isPlayedPart) {
                      barColor = isSent ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)';
                    }
                    return (
                      <View
                        key={index}
                        style={[styles.waveformBar, { height, backgroundColor: barColor }]}
                      />
                    );
                  })}
                </View>

                <Text style={[styles.durationText, isSent ? styles.sentDuration : styles.receivedDuration]}>
                  {voiceNote.duration}
                </Text>
              </View>

              {isWeb && (
                <View style={styles.voiceFooter}>
                  {onDownloadVoiceNote && (
                    <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload} activeOpacity={0.7}>
                      <Ionicons name="download-outline" size={14} color={Colors.primary} />
                    </TouchableOpacity>
                  )}
                  {hasWarning && (
                    <Text style={styles.warningText}>
                      Auto-deleted 1 hr after play
                    </Text>
                  )}
                </View>
              )}
            </View>
          )
        )}

        <View style={styles.meta}>
          <Text style={isSent ? styles.sentTime : styles.receivedTime}>{time}</Text>
          {isSent && (
            <Ionicons
              name={status === 'sent' || status === 'read' || status === 'delivered' ? 'checkmark-done' : 'checkmark-outline'}
              size={14}
              color={status === 'sent' ? Colors.tertiary : Colors.onSurfaceVariant}
            />
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
});
