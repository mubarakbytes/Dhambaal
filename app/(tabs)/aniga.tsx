import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  SafeAreaView, StatusBar, ScrollView, Share, Alert, Clipboard, TextInput,
  Modal, Switch, FlatList, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCodeSVG from 'react-native-qrcode-svg';

import { Colors, setTheme, subscribeTheme } from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { Spacing } from '../../src/theme/spacing';
import { Avatar } from '../../src/components/Avatar';
import { StatusChip } from '../../src/components/StatusChip';
import { GlassPanel } from '../../src/components/GlassPanel';
import { WebSidebarLayout } from '../../src/components/WebSidebarLayout';
import { MadaxaMobilka } from '../../src/components/MadaxaMobilka';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { getCustomRelays, saveCustomRelays, getRelayStats, recordRelayAttempt, resetRelayStats } from '../../src/services/iceServers';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

const SETTINGS = [
  { icon: 'notifications-outline' as const, label: 'Ogeysiisyada', sub: 'Maamul codadka iyo fariimaha' },
  { icon: 'shield-checkmark-outline' as const, label: 'Nabadgelyada', sub: 'Furayaasha sirta iyo tirtirida' },
  { icon: 'color-palette-outline' as const, label: 'Habmuuqa', sub: 'Madow / Iftiin' },
  { icon: 'globe-outline' as const, label: 'Xiriirka (Relay)', sub: 'Maamul server-kaaga xiriirka' },
  { icon: 'download-outline' as const, label: 'Labax xogta', sub: 'La bax dhamaan xogtaada' },
];

const fetchPublicKey = async (): Promise<string> => {
  try {
    const key = await AsyncStorage.getItem('PUBLICK_KEY');
    if (key !== null) {
      try {
        // Unwraps the JSON string safely to get the raw cryptographic string
        return JSON.parse(key);
      } catch {
        return key; // Fallback if it was stored as raw text
      }
    }
    return 'Furaha Guud Lama Heli Karo';
  } catch (error) {
    console.error('Error reading public key:', error);
    return 'Furaha Guud ahaan Lama Heli Karo';
  }
};

const fetchDisplayName = async () : Promise<string> =>  {
  try {
    const name = await AsyncStorage.getItem('DISPLAY_NAME');
    if (name !== null) {
      return name;
    } else {
      return 'Isticmaale';
    }
  } catch (error) {
    console.error('Error reading display name:', error);
    return 'Isticmaale';
  }
};

// QR code placeholder
interface QRCodeProps {
  publicKey?: string;
  name?: string;
}
function QRCode({publicKey, name}: QRCodeProps) {
  // Styles can be evaluated locally
  const qrStyles = StyleSheet.create({
    qrContainer: { alignItems: 'center', justifyContent: 'center' },
    qrBox: {
      width: 150, height: 150,
      backgroundColor: '#FFFFFF',
      borderRadius: Spacing.radiusLg,
      alignItems: 'center', justifyContent: 'center',
      padding: 10,
    },
  });

  const qrValue = publicKey && name 
    ? JSON.stringify({ name: name, pub: publicKey })
    : publicKey || '';

  return (
    <View style={qrStyles.qrContainer}>
      <View style={qrStyles.qrBox}>
        {qrValue ? (
          <View style={{
            borderRadius: 16,
            overflow: 'hidden',
            width: 130,
            height: 130,
          }}>
            <QRCodeSVG
              value={qrValue}
              size={130}
              backgroundColor="#FFFFFF"
              color="#000000"
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function AnigaScreen() {
  const [themeTick, setThemeTick] = useState(0);

  // Subscribe to theme updates dynamically to trigger screen re-render instantly!
  useEffect(() => {
    const unsubscribe = subscribeTheme(() => {
      setThemeTick((tick) => tick + 1);
    });
    return unsubscribe;
  }, []);

  const [PUBLIC_KEY, setPUBLIC_KEY] = useState<string>('Loading...');
  const [displayName, setDisplayName] = useState<string>('Isticmaale');
  const [isCopy, setIsCopy] = useState<boolean>(false);

  // Dynamic Settings States
  const [activeModal, setActiveModal] = useState<'notifications' | 'security' | 'appearance' | 'connection' | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrateEnabled, setVibrateEnabled] = useState(true);
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');

  // Custom Relay States - Dashboard
  const [customRelays, setCustomRelays] = useState<Array<{
    id: string;
    name: string;
    urls: string[];
    username: string;
    password: string;
    enabled: boolean;
  }>>([]);
  const [relayStats, setRelayStats] = useState<Record<string, { success: number; failed: number; lastUsed: string | null }>>({});
  const [showAddRelayModal, setShowAddRelayModal] = useState(false);
  const [editingRelayId, setEditingRelayId] = useState<string | null>(null);
  const [newRelayForm, setNewRelayForm] = useState({
    name: '',
    urls: [''],
    username: '',
    password: '',
    enabled: true,
  });

  const performExport = async (target: 'web' | 'mobile') => {
    try {
      const pubKey = await AsyncStorage.getItem('PUBLICK_KEY');
      const userPair = await AsyncStorage.getItem('USER_PAIR');
      const displayName = await AsyncStorage.getItem('DISPLAY_NAME');

      let exportData: any = {
        type: target,
        PUBLICK_KEY: pubKey ? JSON.parse(pubKey) : null,
        USER_PAIR: userPair ? JSON.parse(userPair) : null,
        DISPLAY_NAME: displayName,
      };

      if (target === 'mobile') {
        const contacts = await AsyncStorage.getItem('rdhambaal_contacts_list');
        const contactRequests = await AsyncStorage.getItem('rdhambaal_contact_requests_list');
        const messages = await AsyncStorage.getItem('rdhambaal_messages_list');
        const calls = await AsyncStorage.getItem('rdhambaal_calls_list');

        exportData.contacts_list = contacts ? JSON.parse(contacts) : [];
        exportData.contact_requests_list = contactRequests ? JSON.parse(contactRequests) : [];
        exportData.messages_list = messages ? JSON.parse(messages) : [];
        exportData.calls_list = calls ? JSON.parse(calls) : [];

        // Package all voice notes and media files
        const binaries: Record<string, any> = {};
        if (Platform.OS === 'web') {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('dh_voice_') && !key.startsWith('dh_voice_meta_') && !key.startsWith('dh_voice_mime_')) {
              const msgId = key.replace('dh_voice_', '');
              const base64 = localStorage.getItem(key);
              const mimeType = localStorage.getItem('dh_voice_mime_' + msgId) || 'application/octet-stream';
              
              const msg = exportData.messages_list.find((m: any) => m.id === msgId || m.voiceNoteMsgId === msgId);
              const type = msg ? msg.type : 'voice';
              const fileName = msg ? msg.fileName : null;

              if (base64) {
                binaries[msgId] = {
                  base64,
                  mimeType,
                  type,
                  fileName,
                };
              }
            }
          }
        } else {
          for (const m of exportData.messages_list) {
            const voiceId = m.type === 'voice' ? (m.voiceNoteMsgId || m.id) : null;
            if (m.type === 'voice' && voiceId) {
              const voicePath = `${FileSystem.documentDirectory}.dhambaal_voice/${voiceId}.m4a`;
              try {
                const info = await FileSystem.getInfoAsync(voicePath);
                if (info.exists) {
                  const base64 = await FileSystem.readAsStringAsync(voicePath, {
                    encoding: FileSystem.EncodingType.Base64,
                  });
                  binaries[voiceId] = {
                    base64,
                    mimeType: m.voiceNote?.mimeType || 'audio/m4a',
                    type: 'voice',
                  };
                }
              } catch (err) {
                console.warn(`[Export] Error reading voice note file for message ${m.id}:`, err);
              }
            } else if (m.type === 'file' && m.fileUri) {
              try {
                const info = await FileSystem.getInfoAsync(m.fileUri);
                if (info.exists) {
                  const base64 = await FileSystem.readAsStringAsync(m.fileUri, {
                    encoding: FileSystem.EncodingType.Base64,
                  });
                  binaries[m.id] = {
                    base64,
                    mimeType: m.fileMimeType || 'application/octet-stream',
                    type: 'file',
                    fileName: m.fileName,
                  };
                }
              } catch (err) {
                console.warn(`[Export] Error reading shared file for message ${m.id}:`, err);
              }
            }
          }
        }
        exportData.binaries = binaries;
      }

      const jsonString = JSON.stringify(exportData, null, 2);
      const filename = `dhambaal_backup_${target}.json`;

      if (Platform.OS === 'web') {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const fileUri = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, jsonString, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'La bax xogta Dhambaal',
            UTI: 'public.json',
          });
        } else {
          Alert.alert('Qalad', 'Sharing ma ahan mid diyaar ah aaladaada.');
        }
      }
    } catch (err: any) {
      console.error('[Export] Error exporting data:', err);
      Alert.alert('Qalad', `Lama soo bixi karo xogta: ${err?.message || err}`);
    }
  };

  const handleExportData = () => {
    Alert.alert(
      'Labax Xogta (Export)',
      'Halkee rabtaa in aad la aado xogtaada?',
      [
        {
          text: 'Web (Kaliya Aqoonsiga)',
          onPress: () => performExport('web'),
        },
        {
          text: 'Mobile (Dhamaan Xogta)',
          onPress: () => performExport('mobile'),
        },
        {
          text: 'Jooji',
          style: 'cancel'
        }
      ],
      { cancelable: true }
    );
  };

  useEffect(() => {
    const loadProfileAndSettings = async () => {
      const storedKey = await fetchPublicKey();
      const storedName = await fetchDisplayName();
      setPUBLIC_KEY(storedKey);
      setDisplayName(storedName);

      try {
        const storedSound = await AsyncStorage.getItem('SETTINGS_SOUND');
        const storedVibrate = await AsyncStorage.getItem('SETTINGS_VIBRATE');
        const storedTheme = await AsyncStorage.getItem('SETTINGS_THEME');
        const [savedRelays, savedStats] = await Promise.all([
          getCustomRelays(),
          getRelayStats(),
        ]);

        if (storedSound !== null) setSoundEnabled(storedSound === 'true');
        if (storedVibrate !== null) setVibrateEnabled(storedVibrate === 'true');
        if (storedTheme !== null) setThemeMode(storedTheme as 'dark' | 'light');
        
        // Migrate old single relay format to new array format
        if (savedRelays.length === 0) {
          const oldRelay = await AsyncStorage.getItem('CUSTOM_TURN_SERVER');
          if (oldRelay) {
            try {
              const relay = JSON.parse(oldRelay);
              if (relay.url) {
                const migratedRelay = {
                  id: `relay_${Date.now()}`,
                  name: 'My Relay',
                  urls: [relay.url],
                  username: relay.username || '',
                  password: relay.password || '',
                  enabled: true,
                };
                await saveCustomRelays([migratedRelay]);
                setCustomRelays([migratedRelay]);
              }
            } catch(e) {}
          }
        } else {
          setCustomRelays(savedRelays);
        }
        setRelayStats(savedStats);
      } catch (err) {
        console.error('Error loading settings:', err);
      }
    };
    loadProfileAndSettings();
  }, []);

  const saveSound = async (val: boolean) => {
    setSoundEnabled(val);
    await AsyncStorage.setItem('SETTINGS_SOUND', String(val));
  };

  const saveVibrate = async (val: boolean) => {
    setVibrateEnabled(val);
    await AsyncStorage.setItem('SETTINGS_VIBRATE', String(val));
  };

  const saveTheme = async (val: 'dark' | 'light') => {
    setTheme(val);
    setThemeMode(val);
    await AsyncStorage.setItem('SETTINGS_THEME', val);
  };

  // Relay form handlers
  const handleAddUrl = () => {
    setNewRelayForm(prev => ({ ...prev, urls: [...prev.urls, ''] }));
  };

  const handleRemoveUrl = (index: number) => {
    if (newRelayForm.urls.length <= 1) return;
    setNewRelayForm(prev => ({ ...prev, urls: prev.urls.filter((_, i) => i !== index) }));
  };

  const handleUrlChange = (index: number, text: string) => {
    setNewRelayForm(prev => {
      const urls = [...prev.urls];
      urls[index] = text;
      return { ...prev, urls };
    });
  };

  const saveRelay = async () => {
    if (!newRelayForm.name.trim()) {
      Alert.alert('Error', 'Please enter a relay name');
      return;
    }
    const validUrls = newRelayForm.urls.filter(u => u.trim());
    if (validUrls.length === 0) {
      Alert.alert('Error', 'Please enter at least one relay URL');
      return;
    }

    const relayData = {
      ...newRelayForm,
      name: newRelayForm.name.trim(),
      urls: validUrls,
    };

    if (editingRelayId) {
      // Update existing
      const updated = customRelays.map(r => r.id === editingRelayId ? { ...r, ...relayData } : r);
      setCustomRelays(updated);
      await saveCustomRelays(updated);
    } else {
      // Add new
      const newRelay = {
        ...relayData,
        id: `relay_${Date.now()}`,
      };
      const updated = [...customRelays, newRelay];
      setCustomRelays(updated);
      await saveCustomRelays(updated);
    }

    setShowAddRelayModal(false);
    setEditingRelayId(null);
    setNewRelayForm({ name: '', urls: [''], username: '', password: '', enabled: true });
  };

  const isWeb = Platform.OS === 'web';

  // Evaluate styles inside the component dynamically on each render!
  const styles = StyleSheet.create({
    screenBg: { flex: 1, backgroundColor: Colors.background },
    scrollContent: { padding: Spacing.md, gap: Spacing.md },
    pageTitle: { ...Typography.headlineLg, color: Colors.onSurface, marginBottom: 2 },
    pageSubtitle: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginBottom: Spacing.md },
    webTwoCol: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
    profileCard: { padding: Spacing.md },
    profileCardWeb: { flex: 2 },
    profileInnerWeb: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
    profileInnerMobile: { alignItems: 'center', gap: Spacing.sm },
    profileInfo: { flex: 1, gap: Spacing.sm },
    userName: { ...Typography.headlineLg, color: Colors.onSurface, fontSize: 26 },
    userHandle: { ...Typography.bodySm, color: Colors.onSurfaceVariant},
    keyLabel: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: Spacing.xs },
    keyBox: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: Colors.glassPanelBg === '#ffffff' ? '#e2e8f0' : 'rgba(0,0,0,0.3)',
      borderWidth: 1, borderColor: Colors.glassPanelBorder,
      borderRadius: Spacing.radiusMd,
      paddingHorizontal: Spacing.sm, paddingVertical: 8,
      gap: Spacing.sm,
    },
    keyText: { ...Typography.labelMono, color: Colors.primary, flex: 1, fontSize: 13 },
    mobileKeyBox: { gap: Spacing.xs },
    qrCard: {
      padding: Spacing.md, 
      alignItems: 'center', 
      gap: Spacing.lg, 
      flex: 1 as any,
    },
    qrTitle: { ...Typography.titleMd, color: Colors.onSurface, textAlign: 'center', marginBottom: Spacing.sm },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      width: '100%',
      backgroundColor: Colors.glassPanelBg,
      borderRadius: Spacing.radiusMd,
      padding: Spacing.sm,
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: Colors.glassPanelBorder,
    },
    shareBtnLabel: { ...Typography.titleMd, color: Colors.onSurface },
    settingsCard: { padding: 0, overflow: 'hidden' },
    settingsHeader: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.glassPanelBorder,
    },
    settingsIcon: { fontSize: 20 },
    settingsTitle: { ...Typography.titleMd, color: Colors.onSurface },
    settingRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    },
    settingDivider: { borderBottomWidth: 1, borderBottomColor: Colors.glassPanelBorder },
    settingIconBox: {
      width: 40, height: 40, borderRadius: Spacing.radiusMd,
      backgroundColor: Colors.glassPanelBg,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: Colors.glassPanelBorder,
    },
    settingLabel: { ...Typography.titleMd, color: Colors.onSurface, fontSize: 15 },
    settingSub: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 2 },
    settingArrow: { fontSize: 22, color: Colors.onSurfaceVariant },

    // Slide-up Modal Styles (Perfect for both Mobile & Web)
    modalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: Colors.glassOverlayBg,
      justifyContent: 'flex-end',
      alignItems: 'center',
      zIndex: 9999,
    },
    modalDismissArea: {
      ...StyleSheet.absoluteFillObject,
    },
    modalContent: {
      width: '100%',
      borderTopLeftRadius: Spacing.radius2xl,
      borderTopRightRadius: Spacing.radius2xl,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: Colors.glassPanelBorder,
      backgroundColor: Colors.surface,
    },
    modalContentWeb: {
      width: 480,
      borderRadius: Spacing.radius2xl,
      alignSelf: 'center',
      marginBottom: 'auto',
      marginTop: 'auto',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: Colors.glassPanelBorder,
    },
    modalTitle: {
      ...Typography.titleMd,
      color: Colors.onSurface,
      fontSize: 18,
    },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: Colors.glassPanelBg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: Colors.glassPanelBorder,
    },
    modalBody: {
      paddingTop: Spacing.md,
    },
    modalSubtitle: {
      ...Typography.bodySm,
      color: Colors.onSurfaceVariant,
      marginBottom: Spacing.md,
    },
    modalOptionGroup: {
      gap: Spacing.md,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.xs,
    },
    optionLabel: {
      ...Typography.titleMd,
      color: Colors.onSurface,
      fontSize: 16,
    },
    optionSub: {
      ...Typography.bodySm,
      color: Colors.onSurfaceVariant,
      fontSize: 12,
      marginTop: 2,
    },
    switchTrack: {
      width: 48,
      height: 26,
      borderRadius: 13,
      backgroundColor: Colors.glassPanelBg,
      padding: 2,
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: Colors.glassPanelBorder,
    },
    switchTrackActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    switchThumb: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: Colors.onSurface,
      transform: [{ translateX: 0 }],
    },
    switchThumbActive: {
      transform: [{ translateX: 22 }],
      backgroundColor: Colors.onPrimary,
    },
    securityKeyDisplay: {
      backgroundColor: 'rgba(0,0,0,0.3)',
      borderWidth: 1,
      borderColor: Colors.glassPanelBorder,
      borderRadius: Spacing.radiusMd,
      padding: Spacing.sm,
      gap: 4,
      marginBottom: Spacing.sm,
    },
    securityKeyTitle: {
      ...Typography.bodySm,
      color: Colors.onSurfaceVariant,
      fontWeight: 'bold',
    },
    securityKeyContent: {
      ...Typography.labelMono,
      color: Colors.primary,
      fontSize: 12,
    },
    wipeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      backgroundColor: 'rgba(255, 107, 107, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255, 107, 107, 0.3)',
      borderRadius: Spacing.radiusMd,
      padding: Spacing.sm,
      marginTop: Spacing.sm,
    },
    wipeButtonText: {
      ...Typography.titleMd,
      color: '#FF6B6B',
      fontSize: 14,
      fontWeight: 'bold',
    },
    themeOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.sm,
      borderRadius: Spacing.radiusMd,
      borderWidth: 1,
      borderColor: Colors.glassPanelBorder,
      backgroundColor: Colors.glassPanelBg,
    },
    themeOptionRowActive: {
      borderColor: Colors.primary,
      backgroundColor: Colors.glassInteractiveBg,
    },
    themeOptionLabel: {
      ...Typography.bodySm,
      color: Colors.onSurfaceVariant,
      flex: 1,
    },
    themeOptionLabelActive: {
      color: Colors.onSurface,
      fontWeight: '600',
    },
    inputField: {
      backgroundColor: Colors.glassPanelBg,
      borderWidth: 1,
      borderColor: Colors.glassPanelBorder,
      borderRadius: Spacing.radiusMd,
      padding: Spacing.sm,
      color: Colors.onSurface,
      ...Typography.bodySm,
      marginBottom: Spacing.sm,
    },
    saveButton: {
      backgroundColor: Colors.primary,
      padding: Spacing.md,
      borderRadius: Spacing.radiusMd,
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    saveButtonText: {
      ...Typography.titleMd,
      color: Colors.onPrimary,
    },
    // Relay Dashboard Styles
    statsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    statCard: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: Colors.glassPanelBg,
      borderWidth: 1,
      borderColor: Colors.glassPanelBorder,
      borderRadius: Spacing.radiusMd,
      padding: Spacing.md,
      alignItems: 'center',
    },
    statNumber: {
      ...Typography.headlineLg,
      color: Colors.primary,
      fontSize: 24,
      fontWeight: 'bold',
    },
    statLabel: {
      ...Typography.bodySm,
      color: Colors.onSurfaceVariant,
      marginTop: 2,
      textAlign: 'center',
    },
    addRelayButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      padding: Spacing.md,
      backgroundColor: Colors.glassInteractiveBg,
      borderWidth: 1,
      borderColor: Colors.primary,
      borderRadius: Spacing.radiusMd,
      marginBottom: Spacing.md,
    },
    addRelayButtonText: {
      ...Typography.titleMd,
      color: Colors.primary,
    },
    emptyState: {
      alignItems: 'center',
      padding: Spacing.xl,
      gap: Spacing.sm,
    },
    emptyStateText: {
      ...Typography.titleMd,
      color: Colors.onSurface,
    },
    emptyStateSub: {
      ...Typography.bodySm,
      color: Colors.onSurfaceVariant,
      textAlign: 'center',
    },
    relayCard: {
      backgroundColor: Colors.glassPanelBg,
      borderWidth: 1,
      borderColor: Colors.glassPanelBorder,
      borderRadius: Spacing.radiusMd,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    relayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: Spacing.md,
    },
    relayInfo: {
      flex: 1,
    },
    relayNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    relayName: {
      ...Typography.titleMd,
      color: Colors.onSurface,
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: Spacing.radiusSm,
    },
    statusBadgeActive: {
      backgroundColor: 'rgba(76, 175, 80, 0.2)',
    },
    statusBadgeInactive: {
      backgroundColor: 'rgba(255, 107, 107, 0.2)',
    },
    statusBadgeText: {
      ...Typography.bodySm,
      fontSize: 10,
      fontWeight: '600',
    },
    relayUrls: {
      marginBottom: Spacing.sm,
    },
    relayUrlText: {
      ...Typography.labelMono,
      color: Colors.onSurfaceVariant,
      fontSize: 11,
      marginBottom: 2,
    },
    relayStats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    relayStatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    relayActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    actionButton: {
      padding: Spacing.xs,
    },
  });

  const profileCard = (
    <GlassPanel style={[styles.profileCard, isWeb && styles.profileCardWeb]}>
      <View style={isWeb ? styles.profileInnerWeb : styles.profileInnerMobile}>
        <Avatar size={isWeb ? 100 : 90} initials={displayName[0]} status="jooge"
          initialsBg={Colors.secondaryContainer} initialsColor={Colors.onSecondaryContainer} />
        <View style={styles.profileInfo}>
          <StatusChip />
          <Text style={styles.userName}>{displayName || 'Isticmaale'}</Text>
          {isWeb && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.3)', height: 35, paddingHorizontal: 6, borderRadius: 4, alignSelf: 'flex-start' }}>
              <Text style={styles.userHandle}>@{PUBLIC_KEY} <Ionicons 
                                                                  name = {isCopy ? 'checkmark-outline' : 'copy-outline'}
                                                                  size={20} color={Colors.onSurfaceVariant} 
                                                                  onPress={()=> {
                                                                    Clipboard.setString(PUBLIC_KEY);
                                                                    setIsCopy(true);
                                                                  }}
                                                                  /></Text>
            </View>
          )}
          {isWeb && <Text style={styles.keyLabel}>Furaha Guud (Public Key)</Text>}
        </View>
      </View>
    </GlassPanel>
  );

  const qrSection = (
    <GlassPanel style={styles.qrCard}>
      <Text style={styles.qrTitle}>{isWeb ? 'Scan-garee' : 'Isawir si aan u saxiibno'}</Text>

      <QRCode publicKey={PUBLIC_KEY} name={displayName} />
      {/* Share Button */}
      <TouchableOpacity style={styles.shareBtn}
        onPress={async () => {
          try {
            const result = await Share.share({
              message: `ASC, waxaan isticmalayaa **DHAMBAAL**, Kani waa public key-gay-ga fadlan igala soo xiriir: \n${PUBLIC_KEY}`,
              url: 'https://dhambaal.com/app/profile', // Optional: Link to your app or website
              title: 'La Wadaagis Public Key' ,
            });
            
            if (result.action === Share.sharedAction) {
              if (result.activityType) {
                // shared with app activity type on iOS
              } else {
                // shared
              }
            } else if (result.action === Share.dismissedAction) {
              // dismissed (iOS only)
            }
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        }}
      >
        <Ionicons name="share-outline" size={18} color={Colors.onSurface} />
        <Text style={styles.shareBtnLabel}>Wadaag</Text>
      </TouchableOpacity>
    </GlassPanel>
  );

  const settingsSection = (
    <GlassPanel style={styles.settingsCard}>
      <View style={styles.settingsHeader}>
        <Ionicons name="settings-outline" size={20} color={Colors.onSurface} />
        <Text style={styles.settingsTitle}>Habeyn {isWeb ? '(Settings)' : ''}</Text>
      </View>
      {SETTINGS.map((s, i) => (
        <TouchableOpacity 
          key={s.label} 
          style={[styles.settingRow, i < SETTINGS.length - 1 && styles.settingDivider]}
          onPress={() => {
            if (s.icon.includes('notifications')) setActiveModal('notifications');
            if (s.icon.includes('shield')) setActiveModal('security');
            if (s.icon.includes('color-palette')) setActiveModal('appearance');
            if (s.icon.includes('globe')) setActiveModal('connection');
            if (s.icon.includes('download')) handleExportData();
          }}
        >
          <View style={styles.settingIconBox}><Ionicons name={s.icon} size={18} color={Colors.onSurface} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>{s.label}</Text>
            {isWeb && <Text style={styles.settingSub}>{s.sub}</Text>}
          </View>
          <Text style={styles.settingArrow}>›</Text>
        </TouchableOpacity>
      ))}
    </GlassPanel>
  );

  const content = (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, !isWeb && { paddingBottom: 100 }]}
    >
      {isWeb ? (
        /* ==========================================================================
           [ MAREEGTA / WEB PROFILE VIEW ]
           ========================================================================== */
        <>
          <Text style={styles.pageTitle}>Aniga</Text>
          <Text style={styles.pageSubtitle}>Maamul xogtaada iyo nabadgelyadaada</Text>
          <View style={styles.webTwoCol}>
            {profileCard}
            {qrSection}
          </View>
          {settingsSection}
        </>
      ) : (
        /* ==========================================================================
           [ MOBILKA / APP PROFILE VIEW (ANDROID & iOS) ]
           ========================================================================== */
        <>
          {profileCard}
          <View style={styles.mobileKeyBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="key-outline" size={14} color={Colors.onSurfaceVariant} />
              <Text style={styles.keyLabel}>Furaha Dadweynaha</Text>
            </View>
            <View style={styles.keyBox}>
              <Text style={styles.keyText}>{PUBLIC_KEY}</Text>
              <TouchableOpacity style={{ opacity: 0.7 }}><Ionicons name="copy-outline" size={24} color={Colors.onSurfaceVariant}
              onPress={async () => {
                try {
                    const result = await Share.share({
                      message: `${PUBLIC_KEY}`,
                      url: 'https://dhambaal.com/app/profile', // Optional: Link to your app or website
                      title: 'La Wadaagis Public Key' ,
                    });
                    
                    if (result.action === Share.sharedAction) {
                      if (result.activityType) {
                        // shared with app activity type on iOS
                      } else {
                        // shared
                      }
                    } else if (result.action === Share.dismissedAction) {
                      // dismissed (iOS only)
                    }
                  } catch (error: any) {
                    Alert.alert('Error', error.message);
                  }
              }}
               /></TouchableOpacity>
            </View>
          </View>
          {qrSection}
          {settingsSection}
        </>
      )}
    </ScrollView>
  );

  // ==================== RELAY DASHBOARD COMPONENT ====================
const RelayDashboard = ({
  relays,
  stats,
  onAddRelay,
  onEditRelay,
  onDeleteRelay,
  onToggleEnabled,
  onResetStats,
}: {
  relays: Array<{ id: string; name: string; urls: string[]; username: string; password: string; enabled: boolean }>;
  stats: Record<string, { success: number; failed: number; lastUsed: string | null }>;
  onAddRelay: () => void;
  onEditRelay: (relay: { id: string; name: string; urls: string[]; username: string; password: string; enabled: boolean }) => void;
  onDeleteRelay: (relayId: string) => void;
  onToggleEnabled: (relayId: string, enabled: boolean) => void;
  onResetStats: (relayId: string) => void;
}) => {
  const totalSuccess = Object.values(stats).reduce((sum, s) => sum + s.success, 0);
  const totalFailed = Object.values(stats).reduce((sum, s) => sum + s.failed, 0);
  const totalAttempts = totalSuccess + totalFailed;
  const successRate = totalAttempts > 0 ? Math.round((totalSuccess / totalAttempts) * 100) : 0;

  return (
    <View style={styles.modalOptionGroup}>
      {/* Summary Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{relays.length}</Text>
          <Text style={styles.statLabel}>Relays Configured</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{totalAttempts}</Text>
          <Text style={styles.statLabel}>Total Attempts</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{successRate}%</Text>
          <Text style={styles.statLabel}>Success Rate</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{relays.filter(r => r.enabled).length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
      </View>

      {/* Add Relay Button */}
      <TouchableOpacity style={styles.addRelayButton} onPress={onAddRelay} activeOpacity={0.8}>
        <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
        <Text style={styles.addRelayButtonText}>Add New Relay</Text>
      </TouchableOpacity>

      {/* Relays List */}
      {relays.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="wifi-outline" size={48} color={Colors.onSurfaceVariant} />
          <Text style={styles.emptyStateText}>No custom relays configured</Text>
          <Text style={styles.emptyStateSub}>Add your own TURN server for maximum privacy</Text>
        </View>
      ) : (
        <FlatList
          data={relays}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={() => null}
          renderItem={({ item }) => {
            const relayStats = stats[item.id] || { success: 0, failed: 0, lastUsed: null };
            const relayAttempts = relayStats.success + relayStats.failed;
            const relaySuccessRate = relayAttempts > 0 ? Math.round((relayStats.success / relayAttempts) * 100) : 0;
            
            return (
              <View style={styles.relayCard}>
                <View style={styles.relayHeader}>
                  <View style={styles.relayInfo}>
                    <View style={styles.relayNameRow}>
                      <Text style={styles.relayName}>{item.name}</Text>
                      <View style={[
                        styles.statusBadge,
                        item.enabled ? styles.statusBadgeActive : styles.statusBadgeInactive
                      ]}>
                        <Text style={styles.statusBadgeText}>
                          {item.enabled ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.relayUrls}>
                      {item.urls.map((url, idx) => (
                        <Text key={idx} style={styles.relayUrlText}>{url}</Text>
                      ))}
                    </View>
                    <View style={styles.relayStats}>
                      <Text style={styles.relayStatItem}>
                        <Ionicons name="checkmark-circle-outline" size={14} color="#4CAF50" />
                        <Text> Success: {relayStats.success}</Text>
                      </Text>
                      <Text style={styles.relayStatItem}>
                        <Ionicons name="close-circle-outline" size={14} color="#FF6B6B" />
                        <Text> Failed: {relayStats.failed}</Text>
                      </Text>
                      <Text style={styles.relayStatItem}>
                        <Ionicons name="trending-up-outline" size={14} color={Colors.primary} />
                        <Text> Rate: {relaySuccessRate}%</Text>
                      </Text>
                      {relayStats.lastUsed && (
                        <Text style={styles.relayStatItem}>
                          <Ionicons name="time-outline" size={14} color={Colors.onSurfaceVariant} />
                          <Text> Last: {new Date(relayStats.lastUsed).toLocaleDateString()}</Text>
                        </Text>
                      )}
                    </View>
                  </View>
                  
                  <View style={styles.relayActions}>
                    <TouchableOpacity 
                      onPress={() => onToggleEnabled(item.id, !item.enabled)}
                      style={styles.actionButton}
                      activeOpacity={0.7}
                    >
                      <Switch
                        value={item.enabled}
                        onValueChange={(val) => onToggleEnabled(item.id, val)}
                        thumbColor={item.enabled ? Colors.primary : Colors.onSurfaceVariant}
                        trackColor={{ false: Colors.glassPanelBg, true: Colors.primary }}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => onEditRelay(item)}
                      style={styles.actionButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="create-outline" size={20} color={Colors.onSurfaceVariant} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => onResetStats(item.id)}
                      style={styles.actionButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="refresh-outline" size={20} color={Colors.onSurfaceVariant} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => onDeleteRelay(item.id)}
                      style={styles.actionButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

// Reusable custom slide-up settings modal sheet
  const renderSettingsModal = () => {
    if (!activeModal) return null;

    return (
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.modalDismissArea} 
          activeOpacity={1} 
          onPress={() => setActiveModal(null)} 
        />
        
        <GlassPanel style={[styles.modalContent, isWeb && styles.modalContentWeb]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {activeModal === 'notifications' && '🔔 Ogeysiisyada'}
              {activeModal === 'security' && '🔐 Nabadgelyada'}
              {activeModal === 'appearance' && '🎨 Habmuuqa'}
              {activeModal === 'connection' && '🌐 Xiriirka'}
            </Text>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          <View style={styles.modalBody}>
            {activeModal === 'notifications' && (
              <View style={styles.modalOptionGroup}>
                <Text style={styles.modalSubtitle}>Maamul dhawaqa iyo ogeysiisyada fariimaha cusub</Text>
                
                {/* Sound Toggle */}
                <TouchableOpacity 
                  style={styles.optionRow} 
                  activeOpacity={0.8}
                  onPress={() => saveSound(!soundEnabled)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionLabel}>Codka Fariimaha</Text>
                    <Text style={styles.optionSub}>Dhawaaq marka ay timaato fariin cusub</Text>
                  </View>
                  <View style={[styles.switchTrack, soundEnabled && styles.switchTrackActive]}>
                    <View style={[styles.switchThumb, soundEnabled && styles.switchThumbActive]} />
                  </View>
                </TouchableOpacity>

                {/* Vibrate Toggle */}
                <TouchableOpacity 
                  style={styles.optionRow} 
                  activeOpacity={0.8}
                  onPress={() => saveVibrate(!vibrateEnabled)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionLabel}>Gariirka</Text>
                    <Text style={styles.optionSub}>Gariir marka xiriir cusub uu yimaaado</Text>
                  </View>
                  <View style={[styles.switchTrack, vibrateEnabled && styles.switchTrackActive]}>
                    <View style={[styles.switchThumb, vibrateEnabled && styles.switchThumbActive]} />
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {activeModal === 'security' && (
              <View style={styles.modalOptionGroup}>
                <Text style={styles.modalSubtitle}>Maamul furahaaga gaarka ah ama tirtir dhammaan xogta akoonka</Text>
                
                {/* Public Key Display */}
                <View style={styles.securityKeyDisplay}>
                  <Text style={styles.securityKeyTitle}>Furaha Dadweynaha (Public Key):</Text>
                  <Text style={styles.securityKeyContent} numberOfLines={2}>{PUBLIC_KEY}</Text>
                </View>

                {/* Account Wipe Option */}
                <TouchableOpacity 
                  style={styles.wipeButton} 
                  activeOpacity={0.8}
                  onPress={() => {
                    Alert.alert(
                      'Miyad hubtaa?',
                      'Kani wuxuu gebi ahaanba tirtirayaa furayaashaada iyo xogtaada. Ma awoodi doontid inaad dib u soo ceshato haddii aadan haysan 12-ka erey ee seeds-ka ah!',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { 
                          text: 'Haa, Tirtir', 
                          style: 'destructive',
                          onPress: async () => {
                            await AsyncStorage.clear();
                            setActiveModal(null);
                            router.replace('/');
                          }
                        }
                      ]
                    );
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                  <Text style={styles.wipeButtonText}>TIRTIR AKOONKA GABI AHAANBA</Text>
                </TouchableOpacity>
              </View>
            )}

            {activeModal === 'appearance' && (
              <View style={styles.modalOptionGroup}>
                <Text style={styles.modalSubtitle}>Dooro midabka visual-ka ee aad doorbideyso ee Dhambaal</Text>
                
                {/* Dark Mode Theme Option */}
                <TouchableOpacity 
                  style={[styles.themeOptionRow, themeMode === 'dark' && styles.themeOptionRowActive]}
                  onPress={() => saveTheme('dark')}
                >
                  <Ionicons name="moon" size={20} color={themeMode === 'dark' ? Colors.primary : Colors.onSurfaceVariant} />
                  <Text style={[styles.themeOptionLabel, themeMode === 'dark' && styles.themeOptionLabelActive]}>Madow Premium (Dark Mode)</Text>
                  {themeMode === 'dark' && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                </TouchableOpacity>

                {/* Light Mode Theme Option */}
                <TouchableOpacity 
                  style={[styles.themeOptionRow, themeMode === 'light' && styles.themeOptionRowActive]}
                  onPress={() => saveTheme('light')}
                >
                  <Ionicons name="sunny" size={20} color={themeMode === 'light' ? Colors.primary : Colors.onSurfaceVariant} />
                  <Text style={[styles.themeOptionLabel, themeMode === 'light' && styles.themeOptionLabelActive]}>Caddaan Classic (Light Mode)</Text>
                  {themeMode === 'light' && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                </TouchableOpacity>
              </View>
            )}

            {activeModal === 'connection' && (
              <RelayDashboard
                relays={customRelays}
                stats={relayStats}
                onAddRelay={() => {
                  setNewRelayForm({ name: '', urls: [''], username: '', password: '', enabled: true });
                  setEditingRelayId(null);
                  setShowAddRelayModal(true);
                }}
                onEditRelay={(relay) => {
                  setNewRelayForm({ 
                    name: relay.name, 
                    urls: relay.urls.length > 0 ? relay.urls : [''], 
                    username: relay.username, 
                    password: relay.password, 
                    enabled: relay.enabled 
                  });
                  setEditingRelayId(relay.id);
                  setShowAddRelayModal(true);
                }}
                onDeleteRelay={async (relayId) => {
                  Alert.alert(
                    'Tirtir Relay',
                    'Miyad hubtaa in aad relay-kan tirtirto?',
                    [
                      { text: 'Maya', style: 'cancel' },
                      { text: 'Haa, Tirtir', style: 'destructive', onPress: async () => {
                        const updated = customRelays.filter(r => r.id !== relayId);
                        setCustomRelays(updated);
                        await saveCustomRelays(updated);
                        const stats = { ...relayStats };
                        delete stats[relayId];
                        setRelayStats(stats);
                        await AsyncStorage.setItem('CUSTOM_TURN_STATS', JSON.stringify(stats));
                      }}
                    ]
                  );
                }}
                onToggleEnabled={async (relayId, enabled) => {
                  const updated = customRelays.map(r => r.id === relayId ? { ...r, enabled } : r);
                  setCustomRelays(updated);
                  await saveCustomRelays(updated);
                }}
                onResetStats={async (relayId) => {
                  await resetRelayStats(relayId);
                  const stats = await getRelayStats();
                  setRelayStats(stats);
                }}
              />
            )}
          </View>
        </GlassPanel>
      </View>
    );
  };

  // Add/Edit Relay Modal
  const renderAddEditRelayModal = () => {
    if (!showAddRelayModal) return null;

    return (
      <Modal visible={true} animationType="slide" transparent={true}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => { setShowAddRelayModal(false); setEditingRelayId(null); }} activeOpacity={1} />
        <GlassPanel style={[styles.modalContent, isWeb && styles.modalContentWeb]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingRelayId ? 'Edit Relay' : 'Add Custom Relay'}
            </Text>
            <TouchableOpacity onPress={() => { setShowAddRelayModal(false); setEditingRelayId(null); }} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalSubtitle}>
              {editingRelayId ? 'Update your TURN server settings' : 'Configure your own TURN server for maximum privacy'}
            </Text>

            <View style={styles.modalOptionGroup}>
              <Text style={styles.keyLabel}>Relay Name</Text>
              <TextInput
                style={styles.inputField}
                placeholder="My Relay Server"
                value={newRelayForm.name}
                onChangeText={(text) => setNewRelayForm(prev => ({ ...prev, name: text }))}
                autoCapitalize="words"
              />

              <Text style={styles.keyLabel}>Relay URLs (one per line)</Text>
              {newRelayForm.urls.map((url, idx) => (
                <View key={idx} style={{ flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.xs }}>
                  <TextInput
                    style={[styles.inputField, { flex: 1 }]}
                    placeholder={`turn:server.com:3478 (URL ${idx + 1})`}
                    placeholderTextColor={Colors.onSurfaceVariant}
                    value={url}
                    onChangeText={(text) => handleUrlChange(idx, text)}
                    autoCapitalize="none"
                  />
                  {newRelayForm.urls.length > 1 && (
                    <TouchableOpacity 
                      onPress={() => handleRemoveUrl(idx)} 
                      style={styles.actionButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close-circle-outline" size={24} color="#FF6B6B" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity 
                onPress={handleAddUrl} 
                style={[styles.addRelayButton, { marginTop: Spacing.xs, backgroundColor: Colors.glassPanelBg }]}
                activeOpacity={0.8}
              >
                <Ionicons name="add-outline" size={18} color={Colors.primary} />
                <Text style={styles.addRelayButtonText}>Add Another URL</Text>
              </TouchableOpacity>

              <Text style={styles.keyLabel}>Username (optional)</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Username"
                placeholderTextColor={Colors.onSurfaceVariant}
                value={newRelayForm.username}
                onChangeText={(text) => setNewRelayForm(prev => ({ ...prev, username: text }))}
                autoCapitalize="none"
              />

              <Text style={styles.keyLabel}>Password (optional)</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Password"
                placeholderTextColor={Colors.onSurfaceVariant}
                secureTextEntry
                value={newRelayForm.password}
                onChangeText={(text) => setNewRelayForm(prev => ({ ...prev, password: text }))}
                autoCapitalize="none"
              />

              <TouchableOpacity 
                style={styles.saveButton}
                onPress={saveRelay}
              >
                <Text style={styles.saveButtonText}>
                  {editingRelayId ? 'Save Changes' : 'Add Relay'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </GlassPanel>
      </Modal>
    );
  };

  return (
    <WebSidebarLayout activeRoute="/(tabs)/aniga">
      <View style={styles.screenBg}>
        {!isWeb && (
          <SafeAreaView style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0 }}>
            <MadaxaMobilka ciwaan="Dhambaal" showSearchIcon={false} />
          </SafeAreaView>
        )}
        {content}
        
        {/* Render overlay slide modal */}
        {renderSettingsModal()}
        {/* Render Add/Edit Relay Modal */}
        {renderAddEditRelayModal()}
      </View>
    </WebSidebarLayout>
  );
}
