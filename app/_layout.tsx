import '../src/services/polyfills';
import '../src/services/messages';
import '../src/services/contactRequests';
import { Stack, SplashScreen, useRouter } from 'expo-router'; // 1. Added useRouter
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router/react-navigation';
import { Colors, subscribeTheme, setTheme } from '../src/theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startSignalingListener, startPresenceEngine, syncPendingDirectMessages } from '../src/services/connection';
import { EventType } from '@notifee/react-native';
import { handleReject } from '../src/services/callService';

// Safe Notifee Import
let notifee: any = null;
try {
  if (Platform.OS !== 'web') {
    notifee = require('@notifee/react-native').default;
  }
} catch (e) {
  console.warn('[Layout] Notifee native module not found.');
}

import * as IntentLauncher from 'expo-intent-launcher';

// Diwaangeli Foreground Service-ka (Wuxuu ilaaliyaa in JS Thread-ku uusan seexan)
if (notifee) {
  notifee.registerForegroundService((notification) => {
    return new Promise(() => {
      // Promise-kan marnaba ma xirmo (resolve), kaas oo ku qasbaya Android inuu ka dhigo app-ka mid nool!
      console.log('[Background] Foreground Service waa shaqaynayaa...');
    });
  });

  notifee.onBackgroundEvent(async ({ type, detail }) => {
    console.log('[Background] Notifee Background Event:', type);
    const { notification, pressAction } = detail;
    if (notification && notification.data && notification.data.friendPubKey) {
      if (type === EventType.ACTION_PRESS && pressAction.id === 'reject') {
        await handleReject();
        await notifee.cancelNotification(notification.id);
      }
      // Answer action will launch the app, and we'll handle getInitialNotification in useEffect
    }
  });
}


SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const isNewArch = typeof (global as any).RN$Bridgeless !== 'undefined' || typeof (global as any).nativeFabricUIManager !== 'undefined';
  console.log('[Native Check] New Architecture enabled in running APK:', isNewArch);

  const router = useRouter(); // 2. Initialize router
  const fontsLoaded = true;
  const fontError = null;
  const [themeTick, setThemeTick] = useState(0);
  const [isReady, setIsReady] = useState(false); // Changed name to general setup readiness

  // Bilow adeegyada P2P-ka iyo joogitaanka (Presence System) marka uu jiro furaha guud
  useEffect(() => {
    let cleanupPresence = null;
    let servicesStarted = false;

    const startServicesIfAuthenticated = async () => {
      try {
        const publicKey = await AsyncStorage.getItem('PUBLICK_KEY');
        if (publicKey && !servicesStarted) {
          servicesStarted = true;
          console.log('[Layout] Dhisaya adeegyada P2P & Presence...');
          startSignalingListener();
          cleanupPresence = await startPresenceEngine();

          if (Platform.OS === 'android' && notifee) {
            try {
              // Codso ogolaanshaha Push Notifications (Qasab ku ah Android 13+)
              await notifee.requestPermission();

              const channelId = await notifee.createChannel({
                id: 'dhambaal_bg',
                name: 'Dhambaal Background Service',
              });

              await notifee.displayNotification({
                title: 'Dhambaal waa Furan yahay',
                body: 'Dhegeysanayaa fariimaha cusub (P2P)...',
                android: {
                  channelId,
                  asForegroundService: true,
                },
              });

              const batteryChecked = await AsyncStorage.getItem('battery_opt_checked');
              if (!batteryChecked) {
                IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                await AsyncStorage.setItem('battery_opt_checked', 'true');
              }
            } catch (err) {
              console.log('[Layout] Qalad Notifee ama Battery:', err);
            }
          }
        }
      } catch (err) {
        console.error('Error starting P2P services in layout:', err);
      }
    };

    startServicesIfAuthenticated();
    const checkInterval = setInterval(startServicesIfAuthenticated, 3000);

    // Dhegeyso marka App-ku uu soo laabto (Foreground)
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('[Layout] App-ku wuxuu soo noqday Active. Dib u xiraya P2P...');
        // Dib u bilow adeegyada P2P iyo joogitaanka si ula xiriiro asxaabta offline-ka ahaa
        startServicesIfAuthenticated();
        // Hubi fariimaha qabyada ah
        void syncPendingDirectMessages();
      }
    });

    return () => {
      clearInterval(checkInterval);
      appStateSubscription.remove();
      if (cleanupPresence) {
        cleanupPresence();
      }
    };
  }, []);

  // Notifee Foreground and Initial Notification Handling
  useEffect(() => {
    if (!notifee) return;

    const handleCallAction = async (notification, actionId) => {
      if (!notification || !notification.data || !notification.data.friendPubKey) return;
      const pubKey = notification.data.friendPubKey;
      const sdp = notification.data.offerSdp;
      
      if (actionId === 'reject') {
        await handleReject();
        await notifee.cancelNotification(notification.id);
      } else if (actionId === 'answer' || actionId === 'default') {
        await notifee.cancelNotification(notification.id);
        router.push(`/otherPages/IncomingCall?id=${encodeURIComponent(pubKey)}&sdp=${encodeURIComponent(sdp)}`);
      }
    };

    notifee.getInitialNotification().then(initial => {
      if (initial && initial.notification) {
        handleCallAction(initial.notification, initial.pressAction ? initial.pressAction.id : 'default');
      }
    });

    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.ACTION_PRESS || type === EventType.PRESS) {
        handleCallAction(detail.notification, detail.pressAction ? detail.pressAction.id : 'default');
      }
    });

    return unsubscribe;
  }, []);

  // Hydrate theme AND check user existence BEFORE hiding splash screen
  useEffect(() => {
    const bootstrapApp = async () => {
      try {
        // 1. Handle Theme Hydration
        const storedTheme = await AsyncStorage.getItem('SETTINGS_THEME');
        if (storedTheme === 'light') {
          setTheme('light');
        } else {
          setTheme('dark'); 
        }

        // 2. Check User Existence
        const publicKey = await AsyncStorage.getItem('PUBLICK_KEY');
        const displayName = await AsyncStorage.getItem('DISPLAY_NAME');

        const userExists = publicKey !== null && displayName !== null;
        alert(`User existence check: ${userExists ? 'User found' : 'No user found'}`);


        // 3. Handle Routing Redirection based on user existence
        if (!userExists) {
          // Redirect to the root index.jsx immediately before revealing the UI
          router.replace('/'); 
        } else {
          router.replace('/(tabs)/fariimaha'); // Redirect to main tabs if user exists
        }
      } catch (err) {
        console.error('Error bootstrapping app:', err);
      } finally {
        setIsReady(true);
      }
    };
    bootstrapApp();
  }, []);

  // Listen to live theme changes during app session
  useEffect(() => {
    const unsubscribe = subscribeTheme(() => {
      setThemeTick(tick => tick + 1);
    });
    return unsubscribe;
  }, []);

  // Inject font on web environment safely
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let link: HTMLLinkElement | null = null;
    try {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://googleapis.com';
      document.head.appendChild(link);
    } catch (_) {}
    return () => {
      if (link && document.head.contains(link)) {
        document.head.removeChild(link);
      }
    };
  }, []);

  // Hide splash screen only when both fonts and bootstrap logic are finished
  useEffect(() => {
    if ((fontsLoaded || fontError) && isReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isReady]);

  // Keep screen blank behind splash screen until setup is fully ready
  if (!isReady) {
    return null;
  }

  const isLight = Colors.background === '#f4f6f8'; 

  const customTheme = {
    ...(isLight ? DefaultTheme : DarkTheme),
    colors: {
      ...(isLight ? DefaultTheme.colors : DarkTheme.colors),
      background: Colors.background,
      card: Colors.surface,
      text: Colors.onSurface,
    },
  };

  return (
    <ThemeProvider value={customTheme}>
      <StatusBar style={isLight ? 'dark' : 'light'} backgroundColor={Colors.background} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'slide_from_right',
        }}
      >
        {/* 4. Ensure index is registered in your Stack layout */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="fariin/[id]"
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
            animation: 'slide_from_right',
            detachPreviousScreen: false,
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
