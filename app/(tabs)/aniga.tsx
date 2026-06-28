import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  StatusBar, ScrollView, Share, Alert, Clipboard, TextInput,
  Modal, Switch, FlatList, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { router, useNavigation } from 'expo-router';
import { getCustomRelays, saveCustomRelays, getRelayStats, recordRelayAttempt, resetRelayStats } from '../../src/services/iceServers';
import { wipeAllData } from '../../src/services/storage';
import { shutdownConnectionService } from '../../src/services/connection';
import { handleEndCall } from '../../src/services/callService';
import { encryptString } from '../../src/services/backupCrypto';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

const Gun = require('gun/gun');
require('gun/sea');

const SETTINGS = [
  { icon: 'notifications-outline' as const, label: 'Ogeysiisyada', sub: 'Maamul codadka iyo fariimaha' },
  { icon: 'shield-checkmark-outline' as const, label: 'Nabadgelyada', sub: 'Furayaasha sirta iyo tirtirida' },
  { icon: 'key-outline' as const, label: 'Fure Sireed', sub: 'Hubi amniga xogtaada' },
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

  const navigation = useNavigation();
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Force clear export/security verification state on tab navigation/focus
      setShowExportVerifyModal(false);
      setExportPinInput('');
      setExportTarget(null);
    });
    return unsubscribe;
  }, [navigation]);

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

  // PIN Security States
  const [hasPin, setHasPin] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [oldPinInput, setOldPinInput] = useState<string>('');
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [confirmPinInput, setConfirmPinInput] = useState<string>('');
  const [showExportVerifyModal, setShowExportVerifyModal] = useState<boolean>(false);
  const [exportTarget, setExportTarget] = useState<'web' | 'mobile' | null>(null);
  const [exportPinInput, setExportPinInput] = useState<string>('');

  const performExport = async (target: 'web' | 'mobile', pin: string) => {
    try {
      const userPairStr = await AsyncStorage.getItem('USER_PAIR');
      const displayName = await AsyncStorage.getItem('DISPLAY_NAME');

      if (!userPairStr) {
        Alert.alert('Qalad', 'Ma awoodin inaan helo macluumaadka furayaashaada.');
        return;
      }

      const userPair = JSON.parse(userPairStr);
      // 1. Encrypt private keys with the user PIN
      const encryptedPair = await Gun.SEA.encrypt(userPairStr, pin);

      let binaries: Record<string, any> = {};
      let contacts: any[] = [];
      let contactRequests: any[] = [];
      let messages: any[] = [];
      let calls: any[] = [];

      // Always collect all database lists for the backup
      const storedContacts = await AsyncStorage.getItem('rdhambaal_contacts_list');
      const storedRequests = await AsyncStorage.getItem('rdhambaal_contact_requests_list');
      const storedMessages = await AsyncStorage.getItem('rdhambaal_messages_list');
      const storedCalls = await AsyncStorage.getItem('rdhambaal_calls_list');

      contacts = storedContacts ? JSON.parse(storedContacts) : [];
      contactRequests = storedRequests ? JSON.parse(storedRequests) : [];
      messages = storedMessages ? JSON.parse(storedMessages) : [];
      calls = storedCalls ? JSON.parse(storedCalls) : [];

      // Package all voice notes and media files
      if (Platform.OS === 'web') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('dh_voice_') && !key.startsWith('dh_voice_meta_') && !key.startsWith('dh_voice_mime_')) {
            const msgId = key.replace('dh_voice_', '');
            const base64 = localStorage.getItem(key);
            const mimeType = localStorage.getItem('dh_voice_mime_' + msgId) || 'application/octet-stream';
            
            const msg = messages.find((m: any) => m.id === msgId || m.voiceNoteMsgId === msgId);
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
        for (const m of messages) {
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

      // 2. Encrypt all chat lists and binaries using the user PIN to ensure 100% compatibility
      // even if the user keypair lacks epub/epriv keys.
      const listsPayload = {
        contacts_list: contacts,
        contact_requests_list: contactRequests,
        messages_list: messages,
        calls_list: calls,
        binaries: binaries,
      };
      // Encrypt lists and binaries using high-performance stream cipher
      const encryptedData = encryptString(JSON.stringify(listsPayload), pin);

      // 3. Assemble secure export payload
      const secureExport = {
        type: target,
        PUBLICK_KEY: userPair.pub,
        DISPLAY_NAME: displayName || 'Isticmaale',
        encryptedPair: encryptedPair,
        encryptedData: encryptedData,
      };

      const jsonString = JSON.stringify(secureExport, null, 2);
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
        const fileUri = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, jsonString, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        if (Platform.OS === 'android') {
          Alert.alert(
            'La Bax Xogta',
            'Faylka backup-ka ma rabtaa in aad u kaydiso aaladda mise in aad la wadaagto abbaabo kale?',
            [
              {
                text: 'U kaydi aaladda (Download)',
                onPress: async () => {
                  try {
                    const SAF = FileSystem.StorageAccessFramework;
                    if (SAF) {
                      const permissions = await SAF.requestDirectoryPermissionsAsync();
                      if (permissions.granted) {
                        const directoryUri = permissions.directoryUri;
                        const newFileUri = await SAF.createFileAsync(
                          directoryUri,
                          filename,
                          'application/json'
                        );
                        await FileSystem.writeAsStringAsync(newFileUri, jsonString, {
                          encoding: FileSystem.EncodingType.UTF8,
                        });
                        Alert.alert('Guul', 'Backup-ka waxaa lagu kaydiyay gal-ka aad dooratay! ✅');
                      }
                    } else {
                      const isAvailable = await Sharing.isAvailableAsync();
                      if (isAvailable) {
                        await Sharing.shareAsync(fileUri, {
                          mimeType: 'application/json',
                          dialogTitle: 'La bax xogta Dhambaal',
                          UTI: 'public.json',
                        });
                      }
                    }
                  } catch (err: any) {
                    console.error('[Export] Error saving via SAF:', err);
                    Alert.alert('Qalad', `Ma awoodin inaan kaydiyo faylka: ${err?.message || err}`);
                  }
                }
              },
              {
                text: 'La wadaag (Share)',
                onPress: async () => {
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
              },
              { text: 'Kansal', style: 'cancel' }
            ]
          );
        } else {
          // iOS natively includes "Save to Files" in shareAsync sheet
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
      }
    } catch (err: any) {
      console.error('[Export] Error exporting data:', err);
      Alert.alert('Qalad', `Lama soo bixi karo xogta: ${err?.message || err}`);
    }
  };

  const handleExportData = () => {
    if (!hasPin) {
      if (Platform.OS === 'web') {
        const confirmPin = window.confirm(
          'Amniga Xogta\n\nFadlan Xogtaada si aad ula baxdo waa in aad sameystaaa fure sireed si loo ilaaliyo aming xogta'
        );
        if (confirmPin) {
          setShowPinModal(true);
        }
      } else {
        Alert.alert(
          'Amniga Xogta',
          'Fadlan Xogtaada si aad ula baxdo waa in aad sameystaaa fure sireed si loo ilaaliyo aming xogta',
          [
            { text: 'Samee Fure', onPress: () => { setShowPinModal(true); } },
            { text: 'Kansal', style: 'cancel' }
          ]
        );
      }
      return;
    }

    // Directly open the PIN verification screen for security
    setExportTarget(Platform.OS === 'web' ? 'web' : 'mobile');
    setExportPinInput('');
    setShowExportVerifyModal(true);
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

        const storedPinHash = await AsyncStorage.getItem('rdhambaal_export_pin_hash');
        const hasSecurityPin = storedPinHash !== null;
        setHasPin(hasSecurityPin);
        if (!hasSecurityPin) {
          if (Platform.OS === 'web') {
            const confirmPin = window.confirm(
              'Digniin Amni\n\nFadlan waxaa la rabaa in ad sameysato fure sireed si loo sugo amniga xogta'
            );
            if (confirmPin) {
              setShowPinModal(true);
            }
          } else {
            Alert.alert(
              'Digniin Amni',
              'Fadlan waxaa la rabaa in ad sameysato fure sireed si loo sugo amniga xogta',
              [
                { text: 'Kansal', style: 'cancel' },
                { text: 'Samee Fure', onPress: () => setShowPinModal(true) }
              ]
            );
          }
        }
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
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: Colors.glassOverlayBg,
      justifyContent: 'flex-end',
      alignItems: 'center',
      zIndex: 9999,
    },
    modalDismissArea: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
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
            if (s.icon.includes('key')) {
              setOldPinInput('');
              setNewPinInput('');
              setConfirmPinInput('');
              setShowPinModal(true);
            }
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
                    const performWipe = async () => {
                      try {
                        await handleEndCall();
                      } catch (e) {
                        console.warn('Error ending call on account wipe:', e);
                      }
                      try {
                        shutdownConnectionService();
                      } catch (e) {
                        console.warn('Error shutting down connection service on account wipe:', e);
                      }
                      try {
                        await wipeAllData();
                      } catch (e) {
                        console.warn('Error wiping database on account wipe:', e);
                      }
                      setActiveModal(null);
                      if (Platform.OS === 'web') {
                        window.location.href = '/';
                      } else {
                        router.replace('/');
                      }
                    };

                    if (Platform.OS === 'web') {
                      const confirmWipe = window.confirm(
                        'Miyad hubtaa?\n\nKani wuxuu gebi ahaanba tirtirayaa furayaashaada iyo xogtaada. Ma awoodi doontid inaad dib u soo ceshato haddii aadan haysan 12-ka erey ee seeds-ka ah!'
                      );
                      if (confirmWipe) {
                        performWipe();
                      }
                    } else {
                      Alert.alert(
                        'Miyad hubtaa?',
                        'Kani wuxuu gebi ahaanba tirtirayaa furayaashaada iyo xogtaada. Ma awoodi doontid inaad dib u soo ceshato haddii aadan haysan 12-ka erey ee seeds-ka ah!',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { 
                            text: 'Haa, Tirtir', 
                            style: 'destructive',
                            onPress: performWipe
                          }
                        ]
                      );
                    }
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
                  const performDelete = async () => {
                    const updated = customRelays.filter(r => r.id !== relayId);
                    setCustomRelays(updated);
                    await saveCustomRelays(updated);
                    const stats = { ...relayStats };
                    delete stats[relayId];
                    setRelayStats(stats);
                    await AsyncStorage.setItem('CUSTOM_TURN_STATS', JSON.stringify(stats));
                  };

                  if (Platform.OS === 'web') {
                    const confirmDelete = window.confirm(
                      'Tirtir Relay\n\nMiyad hubtaa in aad relay-kan tirtirto?'
                    );
                    if (confirmDelete) {
                      performDelete();
                    }
                  } else {
                    Alert.alert(
                      'Tirtir Relay',
                      'Miyad hubtaa in aad relay-kan tirtirto?',
                      [
                        { text: 'Maya', style: 'cancel' },
                        { text: 'Haa, Tirtir', style: 'destructive', onPress: performDelete }
                      ]
                    );
                  }
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

  const handleSavePin = async () => {
    const old = oldPinInput.trim();
    const newPin = newPinInput.trim();
    const confirm = confirmPinInput.trim();

    if (hasPin) {
      if (!old) {
        Alert.alert('Cillad', 'Fadlan geli fure sireedkii hore.');
        return;
      }
      const storedHash = await AsyncStorage.getItem('rdhambaal_export_pin_hash');
      const enteredOldHash = await Gun.SEA.work(old, null, null, { name: 'SHA-256' });
      if (storedHash !== enteredOldHash) {
        Alert.alert('Cillad', 'Fure sireedkii hore waa qalad!');
        return;
      }
    }

    if (!newPin) {
      Alert.alert('Cillad', 'Fadlan geli fure sireedka cusub.');
      return;
    }
    if (newPin.length < 4) {
      Alert.alert('Cillad', 'Fure sireedku waa inuu ka koobnaadaa/lahaadaa ugu yaraan 4 xaraf/tiro.');
      return;
    }
    if (newPin !== confirm) {
      Alert.alert('Cillad', 'Fure sireedka cusub iyo kan xaqiijinta ma waafaqsana.');
      return;
    }

    try {
      const pinHash = await Gun.SEA.work(newPin, null, null, { name: 'SHA-256' });
      await AsyncStorage.setItem('rdhambaal_export_pin_hash', pinHash);
      setHasPin(true);
      setShowPinModal(false);
      
      setOldPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');
      
      Alert.alert('Guul', 'Fure sireedkii waa la keydiyay!');
    } catch (e) {
      Alert.alert('Cillad', 'Ma awoodin inaan kaydiyo fure sireedka.');
    }
  };

  const handleVerifyPinAndExport = async () => {
    const pin = exportPinInput.trim();
    if (!pin) {
      Alert.alert('Cillad', 'Fadlan geli fure sireedkaaga.');
      return;
    }

    try {
      const storedHash = await AsyncStorage.getItem('rdhambaal_export_pin_hash');
      const enteredHash = await Gun.SEA.work(pin, null, null, { name: 'SHA-256' });
      if (storedHash !== enteredHash) {
        Alert.alert('Cillad', 'Fure sireedku waa qalad!');
        return;
      }

      setShowExportVerifyModal(false);
      setExportPinInput('');
      
      if (exportTarget) {
        performExport(exportTarget, pin);
      }
    } catch (e) {
      Alert.alert('Cillad', 'Cillad ayaa dhacday inta lagu guda jiray xaqiijinta.');
    }
  };

  const renderPinModal = () => {
    if (!showPinModal) return null;
    return (
      <Modal visible={true} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismissArea} onPress={() => setShowPinModal(false)} activeOpacity={1} />
          <GlassPanel style={[styles.modalContent, isWeb && styles.modalContentWeb]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                <Ionicons name="key-outline" size={20} color={Colors.onSurface} />
                <Text style={styles.modalTitle}>Habaynta Fure Sireedka</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPinModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={Colors.onSurface} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {hasPin ? (
                <View style={styles.modalOptionGroup}>
                  <Text style={styles.keyLabel}>Fure Sireed-kii Hore</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="Gali fure sireed-kii hore"
                    placeholderTextColor={Colors.onSurfaceVariant}
                    secureTextEntry
                    value={oldPinInput}
                    onChangeText={setOldPinInput}
                  />
                </View>
              ) : (
                <View style={{ backgroundColor: 'rgba(255,107,107,0.15)', padding: Spacing.sm, borderRadius: 8, marginBottom: Spacing.md }}>
                  <Text style={{ ...Typography.bodySm, color: '#FF8B8B', fontSize: 13, lineHeight: 18 }}>
                    Digniin: fadlan haddii aad hilmaato fure sireed-kan ma awoodi doontid in xogtaada la baxdo.
                  </Text>
                </View>
              )}

              <View style={styles.modalOptionGroup}>
                <Text style={styles.keyLabel}>{hasPin ? 'Fure Sireed-ka Cusub' : 'Gali Fure Sireed Cusub'}</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="Gali fure sireed cusub"
                  placeholderTextColor={Colors.onSurfaceVariant}
                  secureTextEntry
                  value={newPinInput}
                  onChangeText={setNewPinInput}
                />
              </View>

              <View style={styles.modalOptionGroup}>
                <Text style={styles.keyLabel}>Xaqiiji Fure Sireed-ka Cusub</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="Xaqiiji fure sireed-ka cusub"
                  placeholderTextColor={Colors.onSurfaceVariant}
                  secureTextEntry
                  value={confirmPinInput}
                  onChangeText={setConfirmPinInput}
                />
              </View>

              <TouchableOpacity 
                style={[styles.saveButton, { marginTop: Spacing.md }]}
                onPress={handleSavePin}
              >
                <Text style={styles.saveButtonText}>Kaydi Furaha</Text>
              </TouchableOpacity>
            </ScrollView>
          </GlassPanel>
        </View>
      </Modal>
    );
  };

  const renderExportVerifyModal = () => {
    if (!showExportVerifyModal) return null;
    return (
      <Modal visible={true} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismissArea} onPress={() => setShowExportVerifyModal(false)} activeOpacity={1} />
          <GlassPanel style={[styles.modalContent, isWeb && styles.modalContentWeb]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                <Ionicons name="shield-checkmark-outline" size={20} color={Colors.onSurface} />
                <Text style={styles.modalTitle}>Xaqiijinta Amniga</Text>
              </View>
              <TouchableOpacity onPress={() => setShowExportVerifyModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={Colors.onSurface} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalSubtitle, { marginBottom: Spacing.md }]}>
                Fadlan geli fure sireed-kaaga si loo xaqiijiyo xogta oo loo bilaabo labixida xogta.
              </Text>

              <View style={styles.modalOptionGroup}>
                <Text style={styles.keyLabel}>Fure Sireed-kaaga</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="Gali fure sireedkaaga"
                  placeholderTextColor={Colors.onSurfaceVariant}
                  secureTextEntry
                  value={exportPinInput}
                  onChangeText={setExportPinInput}
                />
              </View>

              <TouchableOpacity 
                style={[styles.saveButton, { marginTop: Spacing.md }]}
                onPress={handleVerifyPinAndExport}
              >
                <Text style={styles.saveButtonText}>Xaqiiji & Labax Xogta</Text>
              </TouchableOpacity>
            </ScrollView>
          </GlassPanel>
        </View>
      </Modal>
    );
  };

  // Add/Edit Relay Modal
  const renderAddEditRelayModal = () => {
    if (!showAddRelayModal) return null;

    return (
      <Modal visible={true} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismissArea} onPress={() => { setShowAddRelayModal(false); setEditingRelayId(null); }} activeOpacity={1} />
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
        </View>
      </Modal>
    );
  };

  return (
    <WebSidebarLayout activeRoute="/(tabs)/aniga">
      <View style={styles.screenBg}>
        {!isWeb && (
          <SafeAreaView edges={['top', 'left', 'right']}>
            <MadaxaMobilka ciwaan="Dhambaal" showSearchIcon={false} />
          </SafeAreaView>
        )}
        {content}
        
        {/* Render overlay slide modal */}
        {renderSettingsModal()}
        {/* Render Add/Edit Relay Modal */}
        {renderAddEditRelayModal()}
        {/* Render PIN setup modal */}
        {renderPinModal()}
        {/* Render Export Verify modal */}
        {renderExportVerifyModal()}
      </View>
    </WebSidebarLayout>
  );
}
