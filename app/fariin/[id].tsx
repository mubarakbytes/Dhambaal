import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Platform, SafeAreaView, StatusBar, KeyboardAvoidingView, Alert,
  ActivityIndicator, Modal
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, subscribeTheme } from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { Spacing } from '../../src/theme/spacing';
import { Avatar } from '../../src/components/Avatar';
import { MessageBubble } from '../../src/components/MessageBubble';
import { StatusChip } from '../../src/components/StatusChip';
import { VoiceNotePreview } from '../../src/components/VoiceNotePreview';

import { gun, getStoredContacts, getCleanPublicKey, getStoredMessages, saveMessageList } from '../../src/services/storage';
import { connectToPeer, getConnectionStatusForPeer, registerConnectionStatusListener } from '../../src/services/connection';
import { sendMessage as sendMessageService, sendVoiceNote, listenToMessages, sendFileMessage, deleteMessage } from '../../src/services/messages';
import { startRecording, stopRecording, readAudioAsBase64, playVoiceNote, stopSound, getVoicePlaybackUri } from '../../src/services/voiceNotes';
import { cleanupExpired, getVoiceAudio, getVoiceMimeType, getAutoDeleteAt, setAutoDeleteAt, hasVoiceAudio } from '../../src/services/voiceStorage';

interface Message {
  id: string;
  text?: string;
  time: string;
  type: 'sent' | 'received';
  status?: string;
  isDeleted?: boolean;
  voiceNote?: { duration: string; audioUri?: string; msgId?: string; isExpired?: boolean };
  file?: { msgId?: string; name: string; uri?: string; size: number; mimeType: string; isExpired?: boolean };
}

export default function FariinScreen() {
  const [themeTick, setThemeTick] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeTheme(() => {
      setThemeTick((tick) => tick + 1);
    });
    return unsubscribe;
  }, []);

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [msgText, setMsgText] = useState('');
  const flatListRef = useRef<FlatList>(null);



  const [chatData, setChatData] = useState({ name: 'Unknown', status: 'maqane' as const });
  const [messages, setMessages] = useState<Message[]>([]);
  const PAGE_SIZE = 10;
  const allMessagesRef = useRef<Message[]>([]);
  const allRawRef = useRef<any[]>([]);
  const totalDisplayedRef = useRef(PAGE_SIZE);
  const lastListLengthRef = useRef(0);
  const isAtBottomRef = useRef(true);
  const isPaginatingRef = useRef(false);
  const [displayedMessages, setDisplayedMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('connecting');
  const [showMenu, setShowMenu] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (displayedMessages.length > 0 && isAtBottomRef.current && !isPaginatingRef.current) {
      setTimeout(() => flatListRef.current?.scrollToIndex({ index: 0, animated: true }), 100);
    }
  }, [displayedMessages]);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTimer, setRecordingTimer] = useState('0:00');
  const [showPreview, setShowPreview] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewDuration, setPreviewDuration] = useState('');
  const recordingRef = useRef<any>(null);
  const recordingStartRef = useRef(0);
  const timerIntervalRef = useRef<any>(null);
  const currentSoundRef = useRef<any>(null);
  const [activeVoiceMsgId, setActiveVoiceMsgId] = useState<string | null>(null);

  const isWeb = Platform.OS === 'web';

  // Cleanup expired voice notes on mount
  useEffect(() => {
    if (isWeb) {
      const expired = cleanupExpired();
      if (expired.length > 0) {
        allMessagesRef.current = allMessagesRef.current.map(m => {
          if (m.voiceNote?.msgId && expired.includes(m.voiceNote.msgId)) {
            return { ...m, voiceNote: { ...m.voiceNote, isExpired: true } };
          }
          return m;
        });
        setDisplayedMessages(prev => prev.map(m => {
          if (m.voiceNote?.msgId && expired.includes(m.voiceNote.msgId)) {
            return { ...m, voiceNote: { ...m.voiceNote, isExpired: true } };
          }
          return m;
        }));
      }
    }
  }, [isWeb]);

  // 1. Fetch Contact Details & Listen to Live Status Updates
  useEffect(() => {
    if (!id) return;

    global.currentChatId = id;

    getStoredContacts().then(list => {
      const contact = list.find(c => c.id === id);
      if (contact) {
        setChatData({ name: contact.name, status: contact.status as any });
      }
    });

    const contactStream = gun.get('contacts').get(id).on((data) => {
      if (data) {
        setChatData({ name: data.name, status: (data.status || 'maqane') as any });
      }
    });

    return () => {
      global.currentChatId = null;
      gun.get('contacts').get(id).off();
    };
  }, [id]);

  // 2. Start WebRTC connection handshake & Listen to Room Messages
  useEffect(() => {
    if (!id) return;

    getCleanPublicKey().then(myPubKey => {
      if (myPubKey) {
        const isInitiator = myPubKey < id;
        connectToPeer(id, isInitiator);
      }
    });

    setConnectionStatus(getConnectionStatusForPeer(id));

    const unsubscribeConnectionStatus = registerConnectionStatusListener((pubKey, status) => {
      if (pubKey === id) {
        setConnectionStatus(status);
      }
    });

    let cancelled = false;
    const cleanupPromise = listenToMessages(id, (list) => {
      if (cancelled || list.length === lastListLengthRef.current) return;
      lastListLengthRef.current = list.length;
      allRawRef.current = list;
      showSlice(list, totalDisplayedRef.current);
    });

    return () => {
      cancelled = true;
      unsubscribeConnectionStatus();
      cleanupPromise.then((fn) => { if (fn) fn(); });
    };
  }, [id]);

  const isSameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const getDateLabel = (timestamp: string): string => {
    const msgDate = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (isSameDay(msgDate, today)) return 'Maanta';
    if (isSameDay(msgDate, yesterday)) return 'Shalay';

    const sixDaysAgo = new Date(today);
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

    if (msgDate >= sixDaysAgo) {
      const days = ['Axad', 'Isniin', 'Tallaado', 'Arbaco', 'Khamiis', 'Jimce', 'Sabti'];
      return days[msgDate.getDay()];
    }

    const day = msgDate.getDate().toString().padStart(2, '0');
    const month = (msgDate.getMonth() + 1).toString().padStart(2, '0');
    const year = msgDate.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatMessage = (m: any): Message => {
    const isVoice = m.type === 'voice';
    let isExpired = m.isExpired || false;
    if (isVoice && isWeb && m.voiceNoteMsgId) {
      if (!hasVoiceAudio(m.voiceNoteMsgId)) {
        isExpired = true;
      }
    }
    const voiceNote = isVoice
      ? { duration: m.voiceNoteDuration || '0:00', audioUri: m.voiceNoteAudioUri, msgId: m.voiceNoteMsgId, isExpired }
      : undefined;
    const file = m.type === 'file'
      ? { msgId: m.id, name: m.fileName, uri: m.fileUri, size: m.fileSize, mimeType: m.fileMimeType, isExpired: isWeb && !m.fileUri && !hasVoiceAudio(m.id) }
      : undefined;
    return {
      id: m.id,
      text: m.content,
      time: `${getDateLabel(m.timestamp)} ${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      type: m.senderId === id ? ('received' as const) : ('sent' as const),
      status: m.status || 'pending',
      isDeleted: m.isDeleted || false,
      voiceNote,
      file,
    };
  };

  const showSlice = (raw: any[], totalToShow: number) => {
    totalDisplayedRef.current = totalToShow;
    const total = raw.length;
    const start = Math.max(0, total - totalToShow);
    const toDisplay = raw.slice(start).reverse();
    const formatted = toDisplay.map(formatMessage);
    allMessagesRef.current = formatted;
    setDisplayedMessages(formatted);
    setHasMore(start > 0);
    setMessages(formatted.slice(0, PAGE_SIZE));
  };

  const loadMoreMessages = () => {
    if (isPaginatingRef.current || !hasMore) return;
    isPaginatingRef.current = true;
    setIsLoadingMore(true);
    const raw = allRawRef.current;
    const currentCount = totalDisplayedRef.current;
    if (raw.length <= currentCount) {
      setHasMore(false);
      setIsLoadingMore(false);
      isPaginatingRef.current = false;
      return;
    }
    const newCount = Math.min(currentCount + PAGE_SIZE, raw.length);
    showSlice(raw, newCount);
    setIsLoadingMore(false);
    setTimeout(() => { isPaginatingRef.current = false; }, 300);
  };

  const hasTriggeredLoadRef = useRef(false);

  const handleScroll = (event: any) => {
    const e = event.nativeEvent || event;
    if (!e.contentOffset || !e.contentSize || !e.layoutMeasurement) return;
    const { contentOffset, contentSize, layoutMeasurement } = e;
    const maxOffset = Math.max(0, contentSize.height - layoutMeasurement.height);
    if (Platform.OS === 'web') {
      isAtBottomRef.current = contentOffset.y > maxOffset - 50;
      const isNearTop = contentOffset.y < 100;
      if (isNearTop && !hasTriggeredLoadRef.current && hasMore) {
        hasTriggeredLoadRef.current = true;
        loadMoreMessages();
      } else if (!isNearTop) {
        hasTriggeredLoadRef.current = false;
      }
    } else {
      const distanceFromEnd = maxOffset - contentOffset.y;
      const isNearTop = distanceFromEnd < 100;
      isAtBottomRef.current = contentOffset.y < 50;
      if (isNearTop && !hasTriggeredLoadRef.current && hasMore) {
        hasTriggeredLoadRef.current = true;
        loadMoreMessages();
      } else if (!isNearTop) {
        hasTriggeredLoadRef.current = false;
      }
    }
  };

  const handlePlayVoiceNote = async (voiceNote: any) => {
    if (!voiceNote.msgId) {
      if (voiceNote.audioUri) {
        const sound = await playVoiceNote(voiceNote.audioUri);
        currentSoundRef.current = sound;
        setActiveVoiceMsgId(voiceNote.msgId);
        
        let subscription: any = null;
        if (sound.addListener) {
          subscription = sound.addListener('playbackStatusUpdate', (status: any) => {
            if (status.didJustFinish) {
              stopSound(sound);
              if (subscription) subscription.remove();
              currentSoundRef.current = null;
              setActiveVoiceMsgId(null);
            }
          });
        }
      }
      return;
    }

    // If tapping the same voice note, toggle pause/resume
    if (voiceNote.msgId === activeVoiceMsgId && currentSoundRef.current) {
      if (currentSoundRef.current.playing) {
        currentSoundRef.current.pause();
        setActiveVoiceMsgId(null);
      } else {
        currentSoundRef.current.play();
        setActiveVoiceMsgId(voiceNote.msgId);
      }
      return;
    }

    // Stop current sound if playing a different one
    if (currentSoundRef.current) {
      await stopSound(currentSoundRef.current);
      currentSoundRef.current = null;
    }

    const uri = await getVoicePlaybackUri(voiceNote);
    if (!uri) return;
    const sound = await playVoiceNote(uri);
    currentSoundRef.current = sound;
    setActiveVoiceMsgId(voiceNote.msgId);

    if (!getAutoDeleteAt(voiceNote.msgId)) {
      setAutoDeleteAt(voiceNote.msgId, Date.now() + 3600000);
    }

    let subscription2: any = null;
    if (Platform.OS === 'web') {
      sound.onended = () => {
        currentSoundRef.current = null;
        setActiveVoiceMsgId(null);
      };
    } else if (sound.addListener) {
      subscription2 = sound.addListener('playbackStatusUpdate', (status: any) => {
        if (status.didJustFinish) {
          stopSound(sound);
          if (subscription2) subscription2.remove();
          currentSoundRef.current = null;
          setActiveVoiceMsgId(null);
        }
      });
    }
  };

  const handleDownloadVoiceNote = async (voiceNote: any) => {
    if (!isWeb || !voiceNote.msgId) return;
    const base64 = getVoiceAudio(voiceNote.msgId);
    if (!base64) return;

    try {
      const mimeType = getVoiceMimeType(voiceNote.msgId) || 'audio/m4a';
      const blob = await (await fetch(`data:${mimeType};base64,${base64}`)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voice_note_${voiceNote.msgId}.mp3`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('[Download] Failed:', e);
    }
  };

  // Recording handlers
  const startNewRecording = async () => {
    try {
      const result = await startRecording();
      recordingRef.current = result.recording;
      recordingStartRef.current = result.startTime;
      setIsRecording(true);
      setRecordingTimer('0:00');

      // Update timer
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - recordingStartRef.current;
        const sec = Math.floor(elapsed / 1000);
        const min = Math.floor(sec / 60);
        const remainSec = sec % 60;
        setRecordingTimer(`${min}:${remainSec.toString().padStart(2, '0')}`);

        // Auto-stop at 15s on web
        if (isWeb && sec >= 15) {
          stopCurrentRecording();
        }
      }, 100);
    } catch (e) {
      console.error('[Recording] Failed to start:', e);
    }
  };

  const stopCurrentRecording = async () => {
    if (!recordingRef.current) return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setIsRecording(false);

    try {
      const { uri, duration } = await stopRecording({
        recording: recordingRef.current,
        startTime: recordingStartRef.current,
      });
      recordingRef.current = null;
      setPreviewUri(uri);
      setPreviewDuration(duration);
      setShowPreview(true);
    } catch (e) {
      console.error('[Recording] Failed to stop:', e);
    }
  };

  const handleSendVoiceNote = async () => {
    if (!previewUri || !id) return;
    try {
      const { base64, mimeType } = await readAudioAsBase64(previewUri);
      await sendVoiceNote(id, base64, previewDuration, mimeType);
      setShowPreview(false);
      setPreviewUri(null);
    } catch (e) {
      console.error('[VoiceNote] Send failed:', e);
    }
  };

  const handleCancelVoiceNote = () => {
    setShowPreview(false);
    setPreviewUri(null);
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (currentSoundRef.current) stopSound(currentSoundRef.current);
    };
  }, []);

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.background },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: Colors.glassPanelBg,
      borderBottomWidth: 1,
      borderBottomColor: Colors.glassPanelBorder,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    backArrow: { fontSize: 22, color: Colors.onSurface },
    headerInfo: { flex: 1 },
    headerName: { ...Typography.titleMd, color: Colors.onSurface },
    headerStatus: { ...Typography.labelMono, fontSize: 11 },
    headerActions: { flexDirection: 'row', gap: Spacing.xs },
    headerActionBtn: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: Colors.glassPanelBg,
      borderWidth: 1,
      borderColor: Colors.glassPanelBorder,
    },
    divider: { height: 1, backgroundColor: Colors.glassPanelBorder },
    messagesList: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.md },
    p2pChipRow: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: Colors.glassPanelBorder,
      backgroundColor: Colors.glassPanelBg,
    },
    inputAction: {
      width: 40, height: 40, alignItems: 'center', justifyContent: 'center', opacity: 0.7,
    },
    inputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.glassPanelBg,
      borderWidth: 1, borderColor: Colors.glassPanelBorder,
      borderRadius: Spacing.radius2xl,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Platform.OS === 'ios' ? 10 : 4,
      minHeight: 44,
    },
    textInput: {
      flex: 1,
      ...Typography.bodySm,
      color: Colors.onSurface,
      padding: 0,
      maxHeight: 100,
    },
    inlineHappyBtn: {
      paddingLeft: Spacing.xs,
      justifyContent: 'center',
      alignItems: 'center',
      opacity: 0.75,
    },
    sendBtn: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: Colors.primary,
      alignItems: 'center', justifyContent: 'center',
      elevation: 4,
    },
    recordingOverlay: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.sm,
    },
    recordingDot: {
      width: 10, height: 10, borderRadius: 5,
      backgroundColor: '#FF3B30',
    },
    recordingTimer: {
      ...Typography.titleMd,
      color: '#FF3B30',
      fontVariant: ['tabular-nums'],
    },
    recordingCancel: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(255,59,48,0.15)',
    },
    recordingStop: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#FF3B30',
    },
  });

  const sendMessage = async () => {
    const trimmed = msgText.trim();
    if (!trimmed || !id) return;

    await sendMessageService(id, trimmed);
    setMsgText('');
    setTimeout(() => flatListRef.current?.scrollToIndex({ index: 0, animated: true }), 100);
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const file = result.assets[0];
      
      if (file.size && file.size > 5 * 1024 * 1024) {
        if (Platform.OS === 'web') alert('Faylka waa inuusan ka weynaan 5MB.');
        else Alert.alert('Cilad', 'Faylka waa inuusan ka weynaan 5MB.');
        return;
      }

      let base64 = '';
      if (Platform.OS === 'web') {
        if (file.file) {
          const reader = new FileReader();
          reader.readAsDataURL(file.file);
          reader.onload = async () => {
            base64 = reader.result as string;
            if (id) await sendFileMessage(id, base64, file.name, file.mimeType || 'application/octet-stream', file.size || 0);
          };
        }
      } else {
        base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
        if (id) await sendFileMessage(id, base64, file.name, file.mimeType || 'application/octet-stream', file.size || 0);
      }
      setTimeout(() => flatListRef.current?.scrollToIndex({ index: 0, animated: true }), 100);
    } catch (e) {
      console.warn('File pick error:', e);
    }
  };

  const handleLongPressMessage = (msgId: string) => {
    if (Platform.OS === 'web') {
      const wantDelete = window.confirm('Ma rabtaa inaad tirtirto fariintan? (Waa laga tirtirayaa adiga iyo saaxiibkaaga)');
      if (wantDelete && id) {
        deleteMessage(id, msgId);
      }
    } else {
      Alert.alert(
        'Tirtir Fariinta',
        'Ma rabtaa inaad tirtirto fariintan? Tani waa mid joogto ah.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Tirtir', 
            style: 'destructive', 
            onPress: () => {
              if (id) deleteMessage(id, msgId);
            }
          }
        ]
      );
    }
  };

  const clearConversation = async () => {
    try {
      const myKey = await getCleanPublicKey();
      if (!myKey || !id) return;
      const allStored = await getStoredMessages();
      const filtered = allStored.filter((m: any) => {
        const isOurs = (m.senderId === myKey && m.receiverId === id);
        const isTheirs = (m.senderId === id && m.receiverId === myKey);
        return !(isOurs || isTheirs);
      });
      await saveMessageList(filtered);
      for (const msg of allRawRef.current) {
        if (msg.id) deleteMessage(id, msg.id);
      }
      lastListLengthRef.current = 0;
      allRawRef.current = [];
      allMessagesRef.current = [];
      setDisplayedMessages([]);
      setHasMore(false);
      setIsSearching(false);
      setSearchQuery('');
    } catch (e) {
      console.warn('Clear conversation error:', e);
    }
  };

  const matchingMsgIds = searchQuery.trim()
    ? new Set(
        allMessagesRef.current
          .filter(m => m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
          .map(m => m.id)
      )
    : new Set<string>();

  const renderConnectionStatus = () => <StatusChip connectionStatus={connectionStatus} />;

  return (
    <SafeAreaView style={[styles.safe, { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0 }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.onSurface} />
          </TouchableOpacity>

          <Avatar size={40} initials={chatData.name[0]} status={chatData.status} />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{chatData.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.headerStatus, { color: chatData.status === 'jooge' ? Colors.tertiary : Colors.onSurfaceVariant }]}>
                {chatData.status === 'jooge' ? '● Jooge' : '● Maqane'}
              </Text>
              <Text style={{ color: Colors.onSurfaceVariant, fontSize: 10 }}>•</Text>
              {renderConnectionStatus()}
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerActionBtn} onPress={async () => {
              if (Platform.OS === 'web') {
                try {
                  await navigator.mediaDevices.getUserMedia({ audio: true });
                } catch (e) {
                  alert('Fadlan ogolow makarafoonka si aad u wacdo.');
                  return;
                }
              }
              router.push(`/otherPages/OutgoingCall?id=${encodeURIComponent(id)}&name=${encodeURIComponent(chatData.name)}`);
            }}>
              <Ionicons name="call-outline" size={20} color={Colors.onSurface} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionBtn} onPress={() => setShowMenu(true)}>
              <Ionicons name="ellipsis-vertical" size={20} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>
        </View>

        {isSearching && (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.glassPanelBorder }}>
            <Ionicons name="search" size={18} color={Colors.onSurfaceVariant} style={{ marginRight: 8 }} />
            <TextInput
              style={{ flex: 1, ...Typography.bodyMd, color: Colors.onSurface }}
              placeholder="Raadi fariin..."
              placeholderTextColor={Colors.onSurfaceVariant}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <Text style={{ color: Colors.onSurfaceVariant, fontSize: 11, marginRight: 6 }}>{matchingMsgIds.size}</Text>
            )}
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => { setIsSearching(false); setSearchQuery(''); }} style={{ marginLeft: 8 }}>
              <Text style={{ color: Colors.primary, fontSize: 13 }}>Joogi</Text>
            </TouchableOpacity>
          </View>
        )}

        {showMenu && (
          <View style={{ position: Platform.OS === 'web' ? 'fixed' : 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowMenu(false)} />
            <View style={{ position: 'absolute', top: Platform.OS === 'web' ? 90 : 100, right: 16, backgroundColor: Colors.surface, borderRadius: 12, padding: 4, minWidth: 200, borderWidth: 1, borderColor: Colors.glassPanelBorder, ...(Platform.OS === 'web' ? { boxShadow: '0 4px 12px rgba(0,0,0,0.2)' } : { elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 }) }}>
              <TouchableOpacity onPress={() => { setShowMenu(false); setIsSearching(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8 }}>
                <Ionicons name="search-outline" size={18} color={Colors.onSurface} />
                <Text style={{ ...Typography.bodyMd, color: Colors.onSurface }}>Raadi</Text>
              </TouchableOpacity>
              <View style={{ height: 1, backgroundColor: Colors.glassPanelBorder, marginHorizontal: 8 }} />
              <TouchableOpacity onPress={() => {
                setShowMenu(false);
                if (Platform.OS === 'web') {
                  if (window.confirm('Ma hubtaa inaad tirtirto wada-sheekaysigan oo dhan?')) clearConversation();
                } else {
                  Alert.alert('Tirtir wada-sheekaysiga', 'Ma hubtaa?', [
                    { text: 'Joogi', style: 'cancel' },
                    { text: 'Tirtir', style: 'destructive', onPress: clearConversation }
                  ]);
                }
              }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8 }}>
                <Ionicons name="trash-outline" size={18} color={Colors.error} />
                <Text style={{ ...Typography.bodyMd, color: Colors.error }}>Tirtir wada-sheekaysiga</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {allMessagesRef.current.length <= 0 ?
        (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm }}>
            <Ionicons name="chatbubble-ellipses-outline" size={64} color={Colors.onSurfaceVariant} />
            <Text style={{ ...Typography.bodyLg, color: Colors.onSurfaceVariant }}>Bilow Wada-sheekaysi cusub</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={displayedMessages}
            keyExtractor={(m) => m.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.messagesList}
            inverted={true}
            onContentSizeChange={() => { if (!isPaginatingRef.current && isAtBottomRef.current && displayedMessages.length > 0) flatListRef.current?.scrollToIndex({ index: 0, animated: false }); }}
            onLayout={() => { if (!isPaginatingRef.current && isAtBottomRef.current && displayedMessages.length > 0) flatListRef.current?.scrollToIndex({ index: 0, animated: false }); }}
            onScroll={handleScroll}
            scrollEventThrottle={100}
            ListHeaderComponent={
              <View style={styles.p2pChipRow}>
                <StatusChip />
              </View>
            }
            ListFooterComponent={
              <View style={{ paddingTop: 4 }}>
                {hasMore ? (
                  <TouchableOpacity onPress={loadMoreMessages} style={{ paddingVertical: 8, alignItems: 'center' }}>
                    {isLoadingMore ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <Text style={{ color: Colors.onSurfaceVariant, fontSize: 12 }}>Sii soco...</Text>
                    )}
                  </TouchableOpacity>
                ) : displayedMessages.length > 0 ? (
                  <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                    <Ionicons name="checkmark-done" size={16} color={Colors.onSurfaceVariant} />
                    <Text style={{ color: Colors.onSurfaceVariant, fontSize: 11, marginTop: 2 }}>Bilowgii wada-sheekaysiga</Text>
                  </View>
                ) : null}
              </View>
            }
          renderItem={({ item }) => (
            <MessageBubble
              text={item.text}
              time={item.time}
              type={item.type}
              voiceNote={item.voiceNote}
              file={item.file}
              isDeleted={item.isDeleted}
              status={item.status as any}
              isPlaying={item.voiceNote?.msgId === activeVoiceMsgId}
              onPlayVoiceNote={handlePlayVoiceNote}
              onDownloadVoiceNote={isWeb ? handleDownloadVoiceNote : undefined}
              onLongPress={() => handleLongPressMessage(item.id)}
              highlight={searchQuery}
              isSearchMatch={matchingMsgIds.has(item.id)}
            />
          )}
        />)}

        <View style={styles.inputBar}>
          {isRecording ? (
            <View style={styles.recordingOverlay}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingTimer}>{recordingTimer}</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity style={styles.recordingStop} onPress={stopCurrentRecording}>
                <Ionicons name="stop" size={18} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity style={styles.inputAction} onPress={handlePickFile}>
                <Ionicons name="attach-outline" size={22} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Qor fariin..."
                  placeholderTextColor={Colors.onSurfaceVariant}
                  value={msgText}
                  onChangeText={setMsgText}
                  onSubmitEditing={sendMessage}
                  returnKeyType="send"
                  multiline
                  cursorColor={Colors.primary}
                />
                <TouchableOpacity style={styles.inlineHappyBtn}><Ionicons name="happy-outline" size={22} color={Colors.onSurfaceVariant} /></TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.inputAction} onPress={startNewRecording}>
                <Ionicons name="mic-outline" size={22} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
                <Ionicons name="send" size={18} color={Colors.onPrimary} />
              </TouchableOpacity>
            </>
          )}
        </View>

        <VoiceNotePreview
          visible={showPreview}
          recordingUri={previewUri}
          duration={previewDuration}
          onSend={handleSendVoiceNote}
          onCancel={handleCancelVoiceNote}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
