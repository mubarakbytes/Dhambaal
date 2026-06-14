import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  SafeAreaView, StatusBar, ScrollView, Share, Alert, Clipboard, TextInput
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

const SETTINGS = [
  { icon: 'notifications-outline' as const, label: 'Ogeysiisyada', sub: 'Maamul codadka iyo fariimaha' },
  { icon: 'shield-checkmark-outline' as const, label: 'Nabadgelyada', sub: 'Furayaasha sirta iyo tirtirida' },
  { icon: 'color-palette-outline' as const, label: 'Habmuuqa', sub: 'Madow / Iftiin' },
  { icon: 'globe-outline' as const, label: 'Xiriirka (Relay)', sub: 'Maamul server-kaaga xiriirka' },
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

  // Custom Relay States
  const [customRelayUrl, setCustomRelayUrl] = useState('');
  const [customRelayUser, setCustomRelayUser] = useState('');
  const [customRelayPass, setCustomRelayPass] = useState('');

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
        const storedRelay = await AsyncStorage.getItem('CUSTOM_TURN_SERVER');

        if (storedSound !== null) setSoundEnabled(storedSound === 'true');
        if (storedVibrate !== null) setVibrateEnabled(storedVibrate === 'true');
        if (storedTheme !== null) setThemeMode(storedTheme as 'dark' | 'light');
        if (storedRelay !== null) {
          try {
            const relay = JSON.parse(storedRelay);
            setCustomRelayUrl(relay.url || '');
            setCustomRelayUser(relay.username || '');
            setCustomRelayPass(relay.password || '');
          } catch(e) {}
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
              <View style={styles.modalOptionGroup}>
                <Text style={styles.modalSubtitle}>Halkan waxaad ku dari kartaa Custom Relay Server (TURN) si xiriirkaagu u noqdo mid si buuxda aad adigu u maamusho.</Text>
                
                <Text style={styles.keyLabel}>Relay URL (tusaale: turn:server.com:3478)</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="turn:my-server.com:3478"
                  placeholderTextColor={Colors.onSurfaceVariant}
                  value={customRelayUrl}
                  onChangeText={setCustomRelayUrl}
                  autoCapitalize="none"
                />

                <Text style={styles.keyLabel}>Magaca Isticmaalaha (Username)</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="Username"
                  placeholderTextColor={Colors.onSurfaceVariant}
                  value={customRelayUser}
                  onChangeText={setCustomRelayUser}
                  autoCapitalize="none"
                />

                <Text style={styles.keyLabel}>Furaha Sirta (Password)</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="Password"
                  placeholderTextColor={Colors.onSurfaceVariant}
                  secureTextEntry
                  value={customRelayPass}
                  onChangeText={setCustomRelayPass}
                />

                <TouchableOpacity 
                  style={styles.saveButton}
                  onPress={async () => {
                    const relay = { url: customRelayUrl, username: customRelayUser, password: customRelayPass };
                    await AsyncStorage.setItem('CUSTOM_TURN_SERVER', JSON.stringify(relay));
                    Alert.alert('Waa la keydiyay', 'Relay server-kaada cusub waa la keydiyay.');
                    setActiveModal(null);
                  }}
                >
                  <Text style={styles.saveButtonText}>Kaydi</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </GlassPanel>
      </View>
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
      </View>
    </WebSidebarLayout>
  );
}
