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
  Image 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import '../src/services/polyfills';
import { useRouter } from 'expo-router';

// 3. Load GUN sequentially now that globalThis is perfectly prepared
const Gun = require('gun/gun');
require('gun/sea');

import AsyncStorage from '@react-native-async-storage/async-storage';



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

  // Auto-login check: haddii uu jiro furaha guud ee akoonka, toos ugu gudub bogga fariimaha
  React.useEffect(() => {
    const checkExistingAuth = async () => {
      try {
        const storedKey = await AsyncStorage.getItem('PUBLICK_KEY');
        if (storedKey) {
          router.replace('/(tabs)/fariimaha');
        }
      } catch (err) {
        console.error('Error checking auth status:', err);
      }
    };
    checkExistingAuth();
  }, []);

  const isWeb = width > 768;

  // Navigation handlers (UI transitions)

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
                  onPress={handleStartImport}
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
                    placeholder="Tusaale: Mubaarak"
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
});
