import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  useWindowDimensions, 
  Platform,
  Image,
  Clipboard,
  Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import '../src/services/polyfills';
import { useRouter } from 'expo-router';

// 3. Load GUN sequentially now that globalThis is perfectly prepared
const Gun = require('gun/gun');
require('gun/sea');

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { hydrateDatabase } from '../src/services/storage';
import { decryptString } from '../src/services/backupCrypto';



type AuthScreenState = 'welcomeScreen' | 'registerScreen' | 'importScreen';

export default function Index() {

  /**
   * @returns Screen width
   */
  const { width } = useWindowDimensions();

  
  const router = useRouter();
  const [screenState, setScreenState] = useState<AuthScreenState>('welcomeScreen');
  const [displayName, setDisplayName] = useState('');
  const [importWords, setImportWords] = useState('');
  const [hasCopied, setHasCopied] = useState(false);
  const [generatedKeyPair, setGeneratedKeyPair] = useState<any>(null);

  const [showImportPinModal, setShowImportPinModal] = useState(false);
  const [importedBackup, setImportedBackup] = useState<any>(null);
  const [importPinInput, setImportPinInput] = useState('');

  const [isChecking, setIsChecking] = useState(true);

  // Auto-login check: haddii uu jiro furaha guud ee akoonka, UI-ga ha muujin.
  // Layout-ka ayaa sameyn doona redirect-ga, marka halkan kaliya waxaan ka hortageynaa in UI-gu soo muuqdo.
  React.useEffect(() => {
    const checkExistingAuth = async () => {
      try {
        const storedKey = await AsyncStorage.getItem('PUBLICK_KEY');
        if (!storedKey) {
          setIsChecking(false);
        }
        // Haddii storedKey jiro, isChecking waxay ahaan doontaa true si uusan UI-gu u muuqan inta redirect-gu dhacayo
      } catch (err) {
        console.error('Error checking auth status:', err);
        setIsChecking(false);
      }
    };
    checkExistingAuth();
  }, []);

  const isWeb = width > 768;

  // Navigation handlers (UI transitions)

  if (isChecking) {
    // Show empty background while checking to prevent flash
    return <View style={styles.container} />;
  }

  /**
   * Wuxuu u wareejiyaa user-ka screen-ka magac gelinta halkaas oo uu ku bilaabi karo habka abuurista cinwaanka cusub.
   * @returns registerScreen
   */
  const handleStartRegister = () => setScreenState('registerScreen');

  /**
   * Wuxuu u wareejiyaa user-ka screen-ka soo celinta cinwaanka halkaas oo uu userka galin doono ereyada seeds-ka ee 12-ka eray ahaa
   * @returns importScreen
   */
  const handleStartImport = () => setScreenState('importScreen');

  /**
   * Wuxuu u wareejiyaa user-ka screen-ka muujinta ereyadda seed-ka halkaas oo uu user-ku arki doono 12-ka eray ee seeds-ka ah ee loo adeegsaday abuurista cinwaankiisa.
   * @returns reveal_keysScreen
   */
  const handleGenerateKeys = async () => {
    if (displayName.trim()) {
      try {
        // Generates the cryptographically secure key bundle
        const pair = await Gun.SEA.pair();

        // Safety check: Make sure pair actually generated before reading .pub
        if (!pair) {
          alert("Crypto Engine Error: Keypair generation returned undefined.");
          return;
        }

        setGeneratedKeyPair(pair);

        // Save the key pair and display name directly to AsyncStorage
        await AsyncStorage.setItem('PUBLICK_KEY', JSON.stringify(pair.pub));
        await AsyncStorage.setItem('USER_PAIR', JSON.stringify(pair));
        await AsyncStorage.setItem('DISPLAY_NAME', displayName.trim());
        
        //setScreenState('reveal_keysScreen');
        router.replace('/(tabs)/fariimaha');
      } catch (error) {
        alert(`Error saving key pair: ${error}`);
      }
    }
  };

  /**  
    * Toos u aad page-ka fariimaha kadib marka user-ku dhameystiro habka abuurista ama soo celinta cinwaanka.
  */

  /**
   * ka qaad nuqul keypair-ka cusub ee la soo saaray.
   */
  const handleCopyKeyPair = () => {
    if (generatedKeyPair) {
      const keysText = JSON.stringify(generatedKeyPair);
      if (Platform.OS === 'web') {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(keysText);
        }
      } else {
        Clipboard.setString(keysText);
      }
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    }
  };

  /**
   * Soo celi akoonka marka userka uu ku shubo Keypair JSON sax ah.
   */
  const handleRestoreAccount = async () => {
    const rawInput = importWords.trim();
    if (!rawInput) return;
    try {
      const parsedPair = JSON.parse(rawInput);
      if (!parsedPair.pub || !parsedPair.priv) {
        alert("Cillad: Keypair-ka la galiyay ma ahan mid sax ah (waa inuu leeyahay pub iyo priv).");
        return;
      }
      
      // Save display name and pair in AsyncStorage
      await AsyncStorage.setItem('PUBLICK_KEY', JSON.stringify(parsedPair.pub));
      await AsyncStorage.setItem('USER_PAIR', JSON.stringify(parsedPair));
      await AsyncStorage.setItem('DISPLAY_NAME', 'Isticmaale Sooceliyay');
      
      router.replace('/(tabs)/fariimaha');
    } catch (e) {
      alert("Cillad: Ma awoodin inaan u aqriyo sidii JSON sax ah. Hubi inaad koobiyeysay qoraalka saxda ah.");
    }
  };

  const performRestoreData = async (backup: any) => {
    // Restoring account credentials
    await AsyncStorage.setItem('PUBLICK_KEY', JSON.stringify(backup.USER_PAIR.pub));
    await AsyncStorage.setItem('USER_PAIR', JSON.stringify(backup.USER_PAIR));
    await AsyncStorage.setItem('DISPLAY_NAME', backup.DISPLAY_NAME || 'Isticmaale Sooceliyay');

    // If it is a mobile or web backup with data, we can also restore lists
    if (backup.type === 'mobile' || backup.type === 'web') {
      // Restore binaries if present
      if (backup.binaries) {
        if (Platform.OS === 'web') {
          for (const msgId in backup.binaries) {
            const item = backup.binaries[msgId];
            if (item.base64) {
              localStorage.setItem('dh_voice_' + msgId, item.base64);
            }
            if (item.mimeType) {
              localStorage.setItem('dh_voice_mime_' + msgId, item.mimeType);
            }
          }
        } else {
          // Mobile binary restore
          const voiceDir = `${FileSystem.documentDirectory}.dhambaal_voice/`;
          const filesDir = `${FileSystem.documentDirectory}Dhambaal_Files/`;

          // Ensure directories exist
          await FileSystem.makeDirectoryAsync(voiceDir, { intermediates: true }).catch(() => {});
          await FileSystem.makeDirectoryAsync(filesDir, { intermediates: true }).catch(() => {});

          for (const msgId in backup.binaries) {
            const item = backup.binaries[msgId];
            if (item.base64) {
              if (item.type === 'voice') {
                const voicePath = `${voiceDir}${msgId}.m4a`;
                await FileSystem.writeAsStringAsync(voicePath, item.base64, {
                  encoding: FileSystem.EncodingType.Base64,
                });
              } else if (item.type === 'file' && item.fileName) {
                const safeName = item.fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                const filePath = `${filesDir}${safeName}`;
                await FileSystem.writeAsStringAsync(filePath, item.base64, {
                  encoding: FileSystem.EncodingType.Base64,
                });
              }
            }
          }

          // Update fileUri and voiceNoteAudioUri in messages list to point to new local filesystem path
          if (backup.messages_list) {
            for (const m of backup.messages_list) {
              if (m.type === 'file' && backup.binaries[m.id]) {
                const binary = backup.binaries[m.id];
                const safeName = binary.fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                m.fileUri = `${filesDir}${safeName}`;
              } else if (m.type === 'voice') {
                const voiceId = m.voiceNoteMsgId || m.id;
                m.voiceNoteAudioUri = `${voiceDir}${voiceId}.m4a`;
              }
            }
          }
        }
      }

      if (backup.contacts_list) {
        await AsyncStorage.setItem('rdhambaal_contacts_list', JSON.stringify(backup.contacts_list));
      }
      if (backup.contact_requests_list) {
        await AsyncStorage.setItem('rdhambaal_contact_requests_list', JSON.stringify(backup.contact_requests_list));
      }
      if (backup.messages_list) {
        await AsyncStorage.setItem('rdhambaal_messages_list', JSON.stringify(backup.messages_list));
      }
      if (backup.calls_list) {
        await AsyncStorage.setItem('rdhambaal_calls_list', JSON.stringify(backup.calls_list));
      }
    }

    // Hydrate GunDB graph with the new values
    await hydrateDatabase();

    alert("Guul: Xogtaadii waa lagu shubay aalada!");
    router.replace('/(tabs)/fariimaha');
  };

  const handleImportFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      let jsonContent = '';

      if (Platform.OS === 'web') {
        const file = asset.file;
        if (file) {
          jsonContent = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = (e) => reject(new Error('FileReader error'));
            reader.readAsText(file);
          });
        } else {
          const response = await fetch(asset.uri);
          jsonContent = await response.text();
        }
      } else {
        jsonContent = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      const backup = JSON.parse(jsonContent);

      // Check if it is a secure encrypted backup file
      if (backup.encryptedPair && backup.encryptedData) {
        setImportedBackup(backup);
        setImportPinInput('');
        setShowImportPinModal(true);
        return;
      }

      // Fallback for legacy unencrypted backup files
      if (!backup.USER_PAIR || !backup.PUBLICK_KEY) {
        alert("Cillad: Faylkan ma ahan backup sax ah (ma laha USER_PAIR ama PUBLICK_KEY).");
        return;
      }

      await performRestoreData(backup);
    } catch (err: any) {
      console.error('[Import] Error importing backup:', err);
      alert(`Qalad: Ma awoodin inaan shubo faylka: ${err?.message || err}`);
    }
  };

  const handleVerifyImportPin = async () => {
    const pin = importPinInput.trim();
    if (!pin) {
      alert("Fadlan geli fure sireedka!");
      return;
    }

    try {
      // 1. Decrypt keypair using the PIN
      const decryptedPairStr = await Gun.SEA.decrypt(importedBackup.encryptedPair, pin);
      if (!decryptedPairStr) {
        alert("Cillad: Fure sireedku waa qalad ama faylka waa uu waxyeeloobay!");
        return;
      }

      const decryptedPair = typeof decryptedPairStr === 'string' ? JSON.parse(decryptedPairStr) : decryptedPairStr;
      if (!decryptedPair.pub || !decryptedPair.priv) {
        alert("Cillad: Furayaasha la helay ma ahan kuwo sax ah.");
        return;
      }

      // 2. Decrypt chat data lists using the PIN with high-performance stream cipher
      const decryptedDataStr = decryptString(importedBackup.encryptedData, pin);
      let lists: any = {
        contacts_list: [],
        contact_requests_list: [],
        messages_list: [],
        calls_list: [],
        binaries: {},
      };

      if (decryptedDataStr) {
        const parsed = typeof decryptedDataStr === 'string' ? JSON.parse(decryptedDataStr) : decryptedDataStr;
        lists = parsed;
      }

      // 3. Assemble backup object
      const backup = {
        type: importedBackup.type,
        PUBLICK_KEY: decryptedPair.pub,
        USER_PAIR: decryptedPair,
        DISPLAY_NAME: importedBackup.DISPLAY_NAME,
        contacts_list: lists.contacts_list || [],
        contact_requests_list: lists.contact_requests_list || [],
        messages_list: lists.messages_list || [],
        calls_list: lists.calls_list || [],
        binaries: lists.binaries || {},
      };

      // 4. Save PIN hash locally on the new device
      const pinHash = await Gun.SEA.work(pin, null, null, { name: 'SHA-256' });
      await AsyncStorage.setItem('rdhambaal_export_pin_hash', pinHash);

      setShowImportPinModal(false);
      setImportedBackup(null);
      setImportPinInput('');

      await performRestoreData(backup);
    } catch (e: any) {
      console.error('[Import] Error decrypting backup:', e);
      alert("Cillad: Fure sireedka aad gelisay waa qalad!");
    }
  };

  const renderImportPinModal = () => {
    if (!showImportPinModal) return null;
    return (
      <Modal visible={true} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalDismissArea} 
            onPress={() => {
              setShowImportPinModal(false);
              setImportedBackup(null);
            }} 
            activeOpacity={1} 
          />
          <View style={[styles.modalContent, isWeb && styles.modalContentWeb]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="lock-closed-outline" size={20} color="#FFFFFF" />
                <Text style={styles.modalTitle}>Ku Fur Fure Sireedka</Text>
              </View>
              <TouchableOpacity 
                onPress={() => {
                  setShowImportPinModal(false);
                  setImportedBackup(null);
                }} 
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSubtitle}>
                Faylkan waa uu ku xiran yahay (waa encrypted). Fadlan geli fure sireedkii/password-kii aad ku ilaalisaay markaad xogta la baxaysay:
              </Text>

              <View style={styles.modalOptionGroup}>
                <Text style={styles.keyLabel}>Fure Sireedka (Security PIN)</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="Gali fure sireedka"
                  placeholderTextColor="#A0AEC0"
                  secureTextEntry
                  value={importPinInput}
                  onChangeText={setImportPinInput}
                />
              </View>

              <TouchableOpacity 
                style={[styles.primaryButton, { marginTop: 16 }]}
                onPress={handleVerifyImportPin}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#6366F1', '#8B5CF6']}
                  style={styles.gradientButton}
                >
                  <Text style={styles.primaryButtonText}>Gali & Fur Xogta</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <LinearGradient
      colors={['#07070F', '#0D0C1D', '#090815']}
      style={styles.container}
    >
      {/* Decorative Glowing Orbs in Background */}
      <View style={[styles.glowOrb, styles.orb1]} />
      <View style={[styles.glowOrb, styles.orb2]} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Main Glassmorphism Card Wrapper */}
        <View style={[
          styles.authCard, 
          isWeb ? styles.webCardWidth : styles.mobileCardWidth
        ]}>
          
          {/* ============================================================== */}
          {/* 1. WELCOME SCREEN (KU SOO DHAWAADA)                             */}
          {/* ============================================================== */}
          {screenState === 'welcomeScreen' && (
            <View style={styles.stateWrapper}>
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../assets/logo.png')} 
                  style={styles.logoImage} 
                  resizeMode="contain"
                />
                <Text style={styles.appTitle}>Dhambaal</Text>
                <Text style={styles.appTagline}>Wadahadal P2P oo Sugan & Madax-bannaan</Text>
              </View>

              <View style={styles.buttonGroup}>
                <TouchableOpacity 
                  style={styles.primaryButton}
                  onPress={handleStartRegister}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#6366F1', '#8B5CF6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientButton}
                  >
                    <Ionicons name="key-outline" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                    <Text style={styles.primaryButtonText}>Abuur Cinwaan Cusub</Text>
                  </LinearGradient>
                </TouchableOpacity>

                

                <TouchableOpacity 
                  style={styles.secondaryButton}
                  onPress={handleImportFile}
                  activeOpacity={0.8}
                >
                  <Ionicons name="cloud-download-outline" size={20} color="#E2E8F0" style={styles.buttonIcon} />
                  <Text style={styles.secondaryButtonText}>Soo Celi Cinwaan Hore</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.securityBadge}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#10B981" />
                <Text style={styles.securityText}>100% Localized, Serverless, Zero-Trust</Text>
              </View>
            </View>
          )}

          {/* ============================================================== */}
          {/* 2. REGISTER SCREEN (MAGAC GELIN)                                */}
          {/* ============================================================== */}
          {screenState === 'registerScreen' && (
            <View style={styles.stateWrapper}>
              <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => setScreenState('welcomeScreen')} style={styles.backBtn}>
                  <Ionicons name="arrow-back-outline" size={24} color="#A0AEC0" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Abuur Profile</Text>
              </View>

              <Text style={styles.instructionText}>
                Ku qor magac ama naaneys hoos si aad u bilowdo abuurista furayaashaada amniga.
              </Text>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Magacaaga</Text>
                <View style={styles.inputTextContainer}>
                  <Ionicons name="person-outline" size={20} color="#718096" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Tusaale: Safiyo"
                    placeholderTextColor="#4A5568"
                    value={displayName}
                    onChangeText={setDisplayName}
                  />
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.primaryButton, !displayName.trim() && styles.disabledButton]}
                onPress={handleGenerateKeys}
                disabled={!displayName.trim()}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={displayName.trim() ? ['#6366F1', '#8B5CF6'] : ['#2D3748', '#2D3748']}
                  style={styles.gradientButton}
                >
                  {/* Nesting the text here */}
                  <Text style={styles.primaryButtonText}>
                    Sii Soco <Text style={styles.ooText}>OO</Text> Abuur Furayaal
                  </Text>
                  
                  <Ionicons name="chevron-forward-outline" size={18} color="#FFFFFF" style={styles.iconRight} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          

          {/* ============================================================== */}
          {/* 4. IMPORT PROFILE SCREEN (SOO CELIN)                            */}
          {/* ============================================================== */}
          {screenState === 'importScreen' && (
            <View style={styles.stateWrapper}>
              <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => setScreenState('welcomeScreen')} style={styles.backBtn}>
                  <Ionicons name="arrow-back-outline" size={24} color="#A0AEC0" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Soo Celi Bar Hore</Text>
              </View>

              <Text style={styles.instructionText}>
                Fadlan ku paste-garee Keypair JSON-kii aad horey u kaydisay sanduuqa hoose:
              </Text>

              <View style={styles.textareaWrapper}>
                <TextInput
                  style={styles.textareaInput}
                  placeholder='{"pub":"...","priv":"...","epub":"...","epriv":"..."}'
                  placeholderTextColor="#4A5568"
                  multiline={true}
                  numberOfLines={4}
                  value={importWords}
                  onChangeText={setImportWords}
                />
              </View>

              <TouchableOpacity 
                style={[styles.primaryButton, !importWords.trim() && styles.disabledButton]}
                onPress={handleRestoreAccount}
                disabled={!importWords.trim()}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={importWords.trim() ? ['#6366F1', '#8B5CF6'] : ['#2D3748', '#2D3748']}
                  style={styles.gradientButton}
                >
                  <Ionicons name="cloud-download-outline" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                  <Text style={styles.primaryButtonText}>Soo Celi Cinwaan-ka</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </ScrollView>
      {renderImportPinModal()}
    </LinearGradient>
  );
}

/* ==================== WEB-KA / MAREEGTA ==================== */
/* ==================== MOBILKA / APP-KA ==================== */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07070F',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.15,
  },
  orb1: {
    top: '10%',
    left: '10%',
    width: 300,
    height: 300,
    backgroundColor: '#6366F1',
    transform: [{ scale: 1.2 }],
  },
  orb2: {
    bottom: '15%',
    right: '5%',
    width: 350,
    height: 350,
    backgroundColor: '#EC4899',
    transform: [{ scale: 1.1 }],
  },
  authCard: {
    backgroundColor: 'rgba(17, 16, 36, 0.65)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
      },
    }),
  },
  webCardWidth: {
    width: 500,
  },
  mobileCardWidth: {
    width: '100%',
    maxWidth: 400,
  },
  stateWrapper: {
    width: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoImage: {
    width: 130,
    height: 130,
    marginBottom: 10,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  appTagline: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  buttonGroup: {
    width: '100%',
    gap: 16,
    marginBottom: 30,
  },
  primaryButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.5,
  },
  gradientButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  buttonIcon: {
    marginRight: 10,
  },
  iconRight: {
    marginLeft: 8,
  },
  secondaryButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E2E8F0',
  },
  securityBadge: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  securityText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backBtn: {
    marginRight: 16,
    padding: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerTitleCenter: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 22,
    marginBottom: 28,
  },
  instructionTextCenter: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  inputWrapper: {
    width: '100%',
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 14,
    color: '#E2E8F0',
    fontWeight: '600',
    marginBottom: 10,
  },
  inputTextContainer: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
  },
  warningContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  warningIcon: {
    alignSelf: 'center',
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#FBAF24',
    lineHeight: 18,
    fontWeight: '500',
  },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 28,
  },
  wordCard: {
    width: '31%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordIndex: {
    fontSize: 11,
    color: '#718096',
    fontWeight: 'bold',
    width: 18,
  },
  wordText: {
    fontSize: 13,
    color: '#E2E8F0',
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  copyButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  copyButtonText: {
    fontSize: 14,
    color: '#A0AEC0',
    fontWeight: '600',
  },
  copySuccessText: {
    color: '#10B981',
  },
  doneButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  doneGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  textareaWrapper: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 32,
  },
  textareaInput: {
    color: '#FFFFFF',
    fontSize: 16,
    height: 100,
    textAlignVertical: 'top',
  },
  ooText: {
    color: '#fcaba5', // A light purple/indigo that looks great on top of the gradient background
    // color: '#F59E0B', // Alternatively, use this gold/yellow if you want it to pop aggressively!
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
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
    width: '90%',
    maxWidth: 480,
    backgroundColor: '#0F0E26',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'center',
  },
  modalContentWeb: {
    width: 480,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    maxHeight: 400,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#A0AEC0',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalOptionGroup: {
    marginBottom: 16,
  },
  keyLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A0AEC0',
    marginBottom: 8,
  },
  inputField: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 15,
  },
});
