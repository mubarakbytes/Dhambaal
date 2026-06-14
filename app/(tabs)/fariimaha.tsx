/**
 * RDHAMBAAL - FARIIMAHA SCREEN
 * 
 * Faylkani wuxuu xambaarsan yahay bogga ugu muhiimsan ee fariimaha (Chats Hub).
 * Wuxuu si otomaatig ah u kala saaraa qaabka loo soo bandhigayo:
 * - Mobilka: Wuxuu tusayaa liiska wada-sheekaysiga oo kaliya, markii la gujiyo ayuu u gudbayaa bogga fariinta.
 * - Mareegta (Web): Wuxuu tusayaa laba qaybood (Split view) - dhanka bidix oo ah liiska fariimaha iyo dhanka midig oo ah qaybta wada-sheekaysiga ee furan.
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Platform, SafeAreaView, StatusBar, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, subscribeTheme } from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { Spacing } from '../../src/theme/spacing';
import { Avatar } from '../../src/components/Avatar';
import { SearchBar } from '../../src/components/SearchBar';
import { MessageBubble } from '../../src/components/MessageBubble';
import { GlassPanel } from '../../src/components/GlassPanel';
import { WebSidebarLayout } from '../../src/components/WebSidebarLayout';
import { listenToActiveChats, listenToMessages, sendMessage as sendMessageService, sendVoiceNote, sendFileMessage } from '../../src/services/messages';
import { connectToPeer } from '../../src/services/connection';
import { MadaxaMobilka } from '../../src/components/MadaxaMobilka';
import { VoiceNotePreview } from '../../src/components/VoiceNotePreview';
import { startRecording, stopRecording, readAudioAsBase64, playVoiceNote, stopSound } from '../../src/services/voiceNotes';
import { cleanupExpired, getVoiceAudio, getVoiceMimeType, getAutoDeleteAt, setAutoDeleteAt } from '../../src/services/voiceStorage';

/**
 * XOGTA WADA-SHEEKAYSIGA (CHAT ITEM INTERFACE)
 */
interface ChatItem {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  status: 'jooge' | 'maqane'; // Halka qofku khadka ku jiro (🟢 Jooge) iyo in kale (⚫ Maqane)
  unread?: number;            // Tirada fariimaha aan la akhrin
  isGroup?: boolean;          // Inay tahay koox iyo in kale
  initials?: string;          // Xarfaha hore ee magaca kooxda
}

/**
 * SHAY KASTA OO WADA-SHEEKAYSI AH (CHAT LIST ITEM COMPONENT)
 */
function ChatListItem({ item, isActive, onPress, styles }: { item: ChatItem; isActive?: boolean; onPress: () => void; styles: any }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}
      style={[styles.chatItem, isActive && styles.chatItemActive]}>
      {item.isGroup ? (
        <View style={styles.groupAvatar}><Text style={{ ...Typography.titleMd, color: Colors.onSecondaryContainer }}>{item.initials}</Text></View>
      ) : (
        <Avatar size={52} initials={item.name?.[0] || '?'} status={item.status} />
      )}
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.chatName, isActive && { color: Colors.primary }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.chatTime, item.unread ? { color: Colors.primary } : null]}>{item.time}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.chatPreview} numberOfLines={1}>{item.lastMessage}</Text>
          {item.unread ? (
            <View style={styles.unreadBadge}><Text style={styles.unreadText}>{item.unread}</Text></View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * SANNDUUQA WADA-SHEEKAYSIGA MAREEGTA (WEB CHAT PANEL COMPONENT)
 */
function WebChatPanel({ chat, styles }: { chat: ChatItem, styles: any }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [webMsgText, setWebMsgText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

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

  useEffect(() => {
    if (!chat || !chat.id) return;

    connectToPeer(chat.id);

    let cancelled = false;

    const cleanupPromise = listenToMessages(chat.id, (list) => {
      if (cancelled) return;
      const formatted = list.map(m => {
        const isVoice = m.type === 'voice';
        const voiceNote = isVoice
          ? {
              duration: m.voiceNoteDuration || '0:00',
              audioUri: m.voiceNoteAudioUri,
              msgId: m.voiceNoteMsgId,
              isExpired: m.isExpired || false,
            }
          : undefined;
        const file = m.type === 'file'
          ? {
              msgId: m.id,
              name: m.fileName,
              uri: m.fileUri,
              size: m.fileSize,
              mimeType: m.fileMimeType,
              isExpired: false,
            }
          : undefined;

        return {
          id: m.id,
          text: m.content,
          time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: m.senderId === chat.id ? ('received' as const) : ('sent' as const),
          status: m.status || 'pending',
          voiceNote,
          file,
        };
      });
      setMessages(formatted);
    });

    return () => {
      cancelled = true;
      cleanupPromise.then((cleanupFn) => {
        if (cleanupFn) cleanupFn();
      });
    };
  }, [chat.id]);

  // Cleanup expired voice notes
  useEffect(() => {
    const expired = cleanupExpired();
    if (expired.length > 0) {
      setMessages(prev => prev.map(m => {
        if (m.voiceNote?.msgId && expired.includes(m.voiceNote.msgId)) {
          return { ...m, voiceNote: { ...m.voiceNote, isExpired: true } };
        }
        return m;
      }));
    }
  }, []);

  const handleWebSend = async () => {
    if (!webMsgText.trim() || !chat.id) return;
    await sendMessageService(chat.id, webMsgText.trim());
    setWebMsgText('');
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
        alert('Faylka waa inuusan ka weynaan 5MB.');
        return;
      }

      let base64 = '';
      if (file.file) {
        const reader = new FileReader();
        reader.readAsDataURL(file.file);
        reader.onload = async () => {
          base64 = reader.result as string;
          await sendFileMessage(chat.id, base64, file.name, file.mimeType || 'application/octet-stream', file.size || 0);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        };
      } else if (file.uri) {
        // Fallback if needed, though on Web file.file usually exists
        const response = await fetch(file.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = async () => {
          base64 = reader.result as string;
          await sendFileMessage(chat.id, base64, file.name, file.mimeType || 'application/octet-stream', file.size || 0);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        };
      }
    } catch (e) {
      console.error('[Web] Failed to pick file:', e);
    }
  };

  // Voice note playback with pause/resume
  const handlePlayVoiceNote = async (voiceNote: any) => {
    if (!voiceNote.msgId) {
      if (voiceNote.audioUri) {
        const sound = await playVoiceNote(voiceNote.audioUri);
        currentSoundRef.current = sound;
        setActiveVoiceMsgId(voiceNote.msgId);
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.didJustFinish) {
            stopSound(sound);
            currentSoundRef.current = null;
            setActiveVoiceMsgId(null);
          }
        });
      }
      return;
    }

    // If tapping the same voice note, toggle pause/resume
    if (voiceNote.msgId === activeVoiceMsgId && currentSoundRef.current) {
      const status = await currentSoundRef.current.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await currentSoundRef.current.pauseAsync();
          setActiveVoiceMsgId(null);
        } else {
          await currentSoundRef.current.playAsync();
          setActiveVoiceMsgId(voiceNote.msgId);
        }
      }
      return;
    }

    // Stop current sound if playing a different one
    if (currentSoundRef.current) {
      await stopSound(currentSoundRef.current);
      currentSoundRef.current = null;
    }

    const base64 = getVoiceAudio(voiceNote.msgId);
    if (!base64) return;
    const mimeType = getVoiceMimeType(voiceNote.msgId) || 'audio/m4a';
    const uri = `data:${mimeType};base64,${base64}`;
    const sound = await playVoiceNote(uri);
    currentSoundRef.current = sound;
    setActiveVoiceMsgId(voiceNote.msgId);

    if (!getAutoDeleteAt(voiceNote.msgId)) {
      setAutoDeleteAt(voiceNote.msgId, Date.now() + 3600000);
    }

    let subscription: any = null;
    if (Platform.OS === 'web') {
      sound.onended = () => {
        currentSoundRef.current = null;
        setActiveVoiceMsgId(null);
      };
    } else if (sound.addListener) {
      subscription = sound.addListener('playbackStatusUpdate', (status: any) => {
        if (status.didJustFinish) {
          stopSound(sound);
          if (subscription) subscription.remove();
          currentSoundRef.current = null;
          setActiveVoiceMsgId(null);
        }
      });
    }
  };

  // Download voice note (web only)
  const handleDownloadVoiceNote = async (voiceNote: any) => {
    if (!voiceNote.msgId) return;
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

      timerIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - recordingStartRef.current;
        const sec = Math.floor(elapsed / 1000);
        const min = Math.floor(sec / 60);
        const remainSec = sec % 60;
        setRecordingTimer(`${min}:${remainSec.toString().padStart(2, '0')}`);

        // Auto-stop at 15s
        if (sec >= 15) {
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
    if (!previewUri || !chat.id) return;
    try {
      const { base64, mimeType } = await readAudioAsBase64(previewUri);
      await sendVoiceNote(chat.id, base64, previewDuration, mimeType);
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

  return (
    <View style={[styles.webChatPanel, { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.glassPanelBorder }]}>
      <View style={styles.webChatHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <Avatar size={40} initials={chat.name ? chat.name[0] : '?'} status={chat.status} />
          <View>
            <Text style={styles.webChatName}>{chat.name || 'Lama Yaqaan'}</Text>
            <Text style={{ ...Typography.labelMono, color: Colors.tertiary, fontSize: 11 }}>
              {chat.status === 'jooge' ? '🟢 Jooge Hada' : '⚫ Maqane'}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
          {[{name: 'call-outline' as const, key: 'call'}, {name: 'information-circle-outline' as const, key: 'info'}].map((icon) => (
            <TouchableOpacity key={icon.key} style={styles.webActionBtn}><Ionicons name={icon.name} size={18} color={Colors.onSurface} /></TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m, i) => m.id || String(i)}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
        ListHeaderComponent={
          <View style={{ alignItems: 'center', marginBottom: Spacing.md }}>
            <Text style={styles.dateDivider}>Maanta</Text>
          </View>
        }
        renderItem={({ item }) => (
          <MessageBubble
            text={item.text}
            type={item.type}
            time={item.time}
            status={item.status as any}
            voiceNote={item.voiceNote}
            file={item.file}
            isPlaying={item.voiceNote?.msgId === activeVoiceMsgId}
            onPlayVoiceNote={handlePlayVoiceNote}
            onDownloadVoiceNote={handleDownloadVoiceNote}
          />
        )}
      />

      <View style={styles.webInputBar}>
        {isRecording ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.sm }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF3B30' }} />
            <Text style={{ ...Typography.titleMd, color: '#FF3B30', fontVariant: ['tabular-nums'] }}>{recordingTimer}</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF3B30' }}
              onPress={stopCurrentRecording}
            >
              <Ionicons name="stop" size={18} color="white" />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity style={styles.webActionIcon} onPress={handlePickFile}><Ionicons name="attach-outline" size={22} color={Colors.onSurfaceVariant} /></TouchableOpacity>
            <View style={styles.webInputField}>
              <TextInput
                style={{ ...Typography.bodySm, color: Colors.onSurface, flex: 1, padding: 0 }}
                placeholder="Qor fariin..."
                placeholderTextColor={Colors.outline}
                value={webMsgText}
                onChangeText={setWebMsgText}
                onSubmitEditing={handleWebSend}
              />
              <TouchableOpacity style={styles.webInlineHappy}><Ionicons name="happy-outline" size={22} color={Colors.onSurfaceVariant} /></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.webActionIcon} onPress={startNewRecording}>
              <Ionicons name="mic-outline" size={22} color={Colors.onSurfaceVariant} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.sendBtn} onPress={handleWebSend}>
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
    </View>
  );
}

export default function FariimhaScreen() {
  const [themeTick, setThemeTick] = useState(0);

  // Subscribe to theme updates dynamically to trigger screen re-render instantly!
  useEffect(() => {
    const unsubscribe = subscribeTheme(() => {
      setThemeTick((tick) => tick + 1);
    });
    return unsubscribe;
  }, []);

  const router = useRouter();
  const params = useLocalSearchParams();
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activeChat, setActiveChat] = useState<ChatItem>({} as any);
  const initialChatSelected = useRef(false);
  const isWeb = Platform.OS === 'web';

  // Marka laga soo wareego Dadka tab, dooro contact-ga
  useEffect(() => {
    if (isWeb && params.chatId && chats.length > 0) {
      const chatToOpen = chats.find(c => c.id === params.chatId);
      if (chatToOpen && chatToOpen.id !== activeChat?.id) {
        setActiveChat(chatToOpen);
      }
    }
  }, [params.chatId, chats, isWeb]);

  useEffect(() => {
    if (isWeb && activeChat?.id) {
      global.currentChatId = activeChat.id;
    } else if (isWeb) {
      global.currentChatId = null;
    }
  }, [activeChat?.id, isWeb]);

  // Dhegeyso Wada-sheekaysiyada Firfircoon
  useEffect(() => {
    const unsubscribe = listenToActiveChats((activeChatsList) => {
      setChats(activeChatsList as ChatItem[]);
      // Dooro wada-sheekaysiga ugu horeeya haddii laga jiro Mareegta (Web Split Screen)
      if (Platform.OS === 'web' && !initialChatSelected.current && activeChatsList.length > 0) {
        setActiveChat(activeChatsList[0]);
        initialChatSelected.current = true;
      }
    });
    return unsubscribe;
  }, []);

  // Evaluate styles inside the component dynamically on each render!
  const styles = StyleSheet.create({
    screenBg: { flex: 1, backgroundColor: Colors.background },
    chatListPanelWeb: {
      width: 360, borderRadius: Spacing.radiusXl,
      marginLeft: Spacing.sm, marginTop: Spacing.sm, marginBottom: Spacing.sm,
      borderWidth: 1, borderColor: Colors.glassPanelBorder,
      overflow: 'hidden',
    },
    chatItem: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
      backgroundColor: Colors.glassPanelBg,
      borderWidth: 1,
      borderColor: Colors.glassPanelBorder,
      borderRadius: Spacing.radiusXl,
      marginBottom: Spacing.sm,
    },
    chatItemActive: { 
      backgroundColor: Colors.glassInteractiveBg, 
      borderColor: Colors.primary,
    },
    chatName: { ...Typography.titleMd, color: Colors.onSurface, flex: 1, marginRight: 8 },
    chatTime: { ...Typography.labelMono, color: Colors.onSurfaceVariant },
    chatPreview: { ...Typography.bodySm, color: Colors.onSurfaceVariant, flex: 1, marginRight: 8 },
    unreadBadge: {
      backgroundColor: Colors.primary, borderRadius: Spacing.radiusFull,
      width: 22, height: 22, alignItems: 'center', justifyContent: 'center',
    },
    unreadText: { ...Typography.labelMono, color: Colors.onPrimary, fontSize: 11 },
    groupAvatar: {
      width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.secondaryContainer,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: Colors.glassPanelBorder,
    },
    fab: {
      position: 'absolute', bottom: 90, right: Spacing.md,
      width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary,
      alignItems: 'center', justifyContent: 'center',
      elevation: 8,
    },
    webLayout: { flex: 1, flexDirection: 'row', gap: Spacing.sm, padding: Spacing.sm },
    webChatPanel: {
      flex: 1, marginRight: Spacing.sm, marginTop: Spacing.sm,
      marginBottom: Spacing.sm, borderRadius: Spacing.radiusXl, overflow: 'hidden',
    },
    webChatHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.glassPanelBorder,
      backgroundColor: Colors.glassPanelBg,
    },
    webChatName: { ...Typography.titleMd, color: Colors.onSurface },
    webActionBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: Colors.glassPanelBg, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: Colors.glassPanelBorder,
    },
    dateDivider: {
      ...Typography.labelMono, color: Colors.onSurfaceVariant, fontSize: 11,
      backgroundColor: Colors.glassPanelBg, paddingHorizontal: Spacing.sm,
      paddingVertical: 4, borderRadius: Spacing.radiusFull,
      borderWidth: 1, borderColor: Colors.glassPanelBorder,
    },
    webInputBar: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.glassPanelBorder,
      backgroundColor: Colors.glassPanelBg,
    },
    webInputField: {
      flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.glassPanelBg,
      borderWidth: 1, borderColor: Colors.glassPanelBorder,
      borderRadius: Spacing.radiusFull, paddingHorizontal: Spacing.md, paddingVertical: 10,
    },
    webInlineHappy: {
      paddingLeft: Spacing.xs,
      opacity: 0.7,
    },
    webActionIcon: {
      width: 40, height: 40, alignItems: 'center', justifyContent: 'center', opacity: 0.7,
    },
    sendBtn: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary,
      alignItems: 'center', justifyContent: 'center',
    },
  });

  // Intelligent Context-Aware Fuzzy Search
  const filtered = useMemo(() => {
    if (!search.trim()) return chats;

    const query = search.toLowerCase().trim();

    return chats.filter(c => 
      c.name.toLowerCase().includes(query) || 
      (c.lastMessage && c.lastMessage.toLowerCase().includes(query))
    );
  }, [chats, search]);

  // Qaybta Liiska Wada-sheekaysiga (Chat List component)
  const listComponent = (
    <FlatList
      data={filtered}
      keyExtractor={(c, i) => c.id || String(i)}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingTop: isWeb ? Spacing.sm : Spacing.md, paddingBottom: Spacing.md }}
      renderItem={({ item }) => (
        <ChatListItem
          item={item}
          isActive={isWeb && activeChat.id === item.id}
          onPress={() => isWeb ? (setActiveChat(item), console.log("[Selected chat]", item)) : router.push(`/fariin/${item.id}`)}
          styles={styles}
        />
      )}
    />
  );

  const chatList = isWeb ? (
    <View style={styles.chatListPanelWeb}>
      <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm }}>
        <Text style={{ ...Typography.titleMd, color: Colors.onSurface }}>Fariimaha</Text>
      </View>
      <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm }}>
        <SearchBar placeholder="Raadi fariimaha..." value={search} onChangeText={setSearch} />
      </View>
      {listComponent}
    </View>
  ) : (
    <View style={{ flex: 1 }}>
      {listComponent}
    </View>
  );

  return (
    <WebSidebarLayout activeRoute="/(tabs)/fariimaha">
      <View style={styles.screenBg}>
        {isWeb ? (
          <View style={styles.webLayout}>
            {chatList}
            {activeChat && activeChat.id ? (
              <WebChatPanel key={activeChat.id} chat={activeChat} styles={styles} />
            ) : (
              <View style={[styles.webChatPanel, { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.glassPanelBorder, justifyContent: 'center', alignItems: 'center', gap: Spacing.md }]}>
                <Ionicons name="chatbubbles-outline" size={64} color={Colors.primary} style={{ opacity: 0.8 }} />
                <Text style={{ ...Typography.titleMd, color: Colors.onSurface, textAlign: 'center' }}>Dooro Qof aad la wadaagto fariimo</Text>
                <Text style={{ ...Typography.bodySm, color: Colors.onSurfaceVariant, textAlign: 'center', maxWidth: 320 }}>
                  Dooro mid ka mid ah asxaabtaada ee dhanka bidix ku yaala si aad u bilowdo wada-sheekaysiga.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <SafeAreaView style={{ flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0 }}>
            <MadaxaMobilka 
              ciwaan="Dhambaal"
              isSearching={isSearching} 
              setIsSearching={setIsSearching} 
              searchText={search} 
              setSearchText={setSearch} 
              placeholder="Raadi fariimaha..." 
            />
            {chatList}
          </SafeAreaView>
        )}
      </View>
    </WebSidebarLayout>
  );
}
