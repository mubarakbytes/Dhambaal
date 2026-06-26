import '../src/services/polyfills';
import '../src/services/messages';
import '../src/services/contactRequests';
import { Stack, SplashScreen, useRouter, useRootNavigationState } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router/react-navigation';
import { Colors, subscribeTheme, setTheme } from '../src/theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startSignalingListener, startPresenceEngine, syncPendingDirectMessages } from '../src/services/connection';
import { EventType } from '@notifee/react-native';
import { getStoredContacts } from '../src/services/storage';
import {
  rejectCall,
  setPendingOfferSdp,
  getPendingOfferSdp,
  getAndClearPendingCallAction,
  storePendingCallAction,
  getPersistedOfferSdp,
  storePendingRejectCall,
  getAndClearPendingRejectCall,
} from '../src/services/callService';

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

const buildIncomingCallRoute = (friendPubKey: string) => {
  return `/otherPages/IncomingCall?id=${encodeURIComponent(friendPubKey)}`;
};

const buildOngoingCallRoute = (friendPubKey: string, callerName: string) => {
  return `/otherPages/OngoingCall?id=${encodeURIComponent(friendPubKey)}&name=${encodeURIComponent(callerName)}&autoAnswer=true`;
};

const resolveCallerName = async (friendPubKey: string) => {
  try {
    const contacts = await getStoredContacts();
    const contact = contacts.find((item) => item.id === friendPubKey);
    return contact?.name?.trim() || 'Unknown';
  } catch (error) {
    console.warn('[Layout] Could not resolve caller name:', error);
    return 'Unknown';
  }
};

const resolveIncomingCallSdp = async (notification: any) => {
  const cached = getPendingOfferSdp();
  if (cached) {
    return cached;
  }

  const persisted = await getPersistedOfferSdp();
  if (persisted && persisted.sdp) {
    return persisted.sdp;
  }

  return notification && notification.data ? notification.data.offerSdp : null;
};

const prepareIncomingCallAction = async (notification: any, actionId: string) => {
  if (!notification || !notification.data || !notification.data.friendPubKey) {
    return null;
  }

  const friendPubKey = notification.data.friendPubKey;

  if (actionId === 'reject') {
    await notifee.cancelNotification(notification.id).catch(() => {});
    await storePendingRejectCall(friendPubKey);
    return null;
  }

  const offerSdp = await resolveIncomingCallSdp(notification);
  if (!offerSdp) {
    console.warn('[Layout] No SDP found for incoming call action:', actionId);
    return null;
  }

  setPendingOfferSdp(offerSdp);

  const route =
    actionId === 'answer'
      ? buildOngoingCallRoute(friendPubKey, await resolveCallerName(friendPubKey))
      : buildIncomingCallRoute(friendPubKey);

  await storePendingCallAction({
    route,
    autoAnswer: actionId === 'answer',
  });
  await notifee.cancelNotification(notification.id).catch(() => {});

  return route;
};

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
    if (type === EventType.ACTION_PRESS || type === EventType.PRESS) {
      const actionId = type === EventType.ACTION_PRESS ? (pressAction ? pressAction.id : 'default') : 'default';
      await prepareIncomingCallAction(notification, actionId);
    } else if (type === EventType.DISMISSED || type === EventType.TIMEOUT) {
      // Waa la iska aamusiyay (ama waa dhamaaday waqtigii) wicitaanka
      console.log('[Background] Call dismissed or timed out');
      if (notification && notification.data && notification.data.friendPubKey) {
        await storePendingRejectCall(notification.data.friendPubKey);
        try {
          // Clear internal states
          rejectCall(notification.data.friendPubKey).catch(() => {});
        } catch (e) {}
      }
    } else if (type === EventType.BOOT_COMPLETED) {
      console.log('[Background] Phone rebooted! Starting background services...');
      try {
        const publicKey = await AsyncStorage.getItem('PUBLICK_KEY');
        if (publicKey) {
          startSignalingListener();
          await startPresenceEngine();
          
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
        }
      } catch (err) {
        console.error('[Background] Failed to boot services:', err);
      }
    }
  });
}


SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const isNewArch = typeof (global as any).RN$Bridgeless !== 'undefined' || typeof (global as any).nativeFabricUIManager !== 'undefined';
  console.log('[Native Check] New Architecture enabled in running APK:', isNewArch);

  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const fontsLoaded = true;
  const fontError = null;
  const [themeTick, setThemeTick] = useState(0);
  const [isReady, setIsReady] = useState(false); // Changed name to general setup readiness
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const isNavigationReadyRef = React.useRef(false);
  isNavigationReadyRef.current = !!rootNavigationState?.key;

  // Bilow adeegyada P2P-ka iyo joogitaanka (Presence System) marka uu jiro furaha guud
  useEffect(() => {
    let cleanupPresence = null;
    let servicesStarted = false;

    const checkForPendingCallAction = async () => {
      try {
        const pendingCall = await getAndClearPendingCallAction();
        if (pendingCall && pendingCall.route) {
          console.log('[Layout] App resumed with pending call action, navigating to:', pendingCall.route);
          if (isNavigationReadyRef.current) {
            router.push(pendingCall.route);
          } else {
            setInitialRoute(pendingCall.route);
          }
        }
      } catch (err) {
        console.error('[Layout] Error checking pending call action on resume:', err);
      }
    };

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
        // Check for pending call actions (e.g. from background notification clicks)
        checkForPendingCallAction();
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
      const route = await prepareIncomingCallAction(notification, actionId);
      if (!route) {
        if (actionId === 'reject' && notification && notification.data && notification.data.friendPubKey) {
          try {
            rejectCall(notification.data.friendPubKey);
          } catch (_) {}
        }
        return;
      }

      if (!isNavigationReadyRef.current) {
        setInitialRoute(route);
      } else {
        router.push(route);
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

        // 3. Process any pending reject from background notification action
        const pendingReject = await getAndClearPendingRejectCall();
        if (pendingReject) {
          console.log('[Layout] Processing pending reject call:', pendingReject.substring(0, 12));
          rejectCall(pendingReject).catch(() => {});
        }

        // 4. Handle Routing Redirection based on user existence
        if (!userExists) {
          setInitialRoute(prev => prev || '/'); 
        } else {
          // Check if there's a pending call from a notification tap
          const pendingCall = await getAndClearPendingCallAction();
          if (pendingCall && pendingCall.route) {
            setInitialRoute(pendingCall.route);
          } else {
            setInitialRoute(prev => prev || '/(tabs)/fariimaha');
          }
        }
      } catch (err) {
        console.error('Error bootstrapping app:', err);
      } finally {
        setIsReady(true);
      }
    };
    bootstrapApp();
  }, []);

  // Execute redirection ONLY AFTER the layout has fully mounted
  useEffect(() => {
    if (isReady && initialRoute && rootNavigationState?.key) {
      router.replace(initialRoute);
      setInitialRoute(null);
    }
  }, [isReady, initialRoute, rootNavigationState?.key]);

  // Listen to live theme changes during app session
  useEffect(() => {
    const unsubscribe = subscribeTheme(() => {
      setThemeTick(tick => tick + 1);
    });
    return unsubscribe;
  }, []);

  // Preload Ionicons on web to prevent fontfaceobserver timeouts
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const loadWebFonts = async () => {
      try {
        const { Ionicons } = require('@expo/vector-icons');
        const Font = require('expo-font');
        await Font.loadAsync(Ionicons.font);
      } catch (e) {
        console.warn('Failed to load Web fonts', e);
      }
    };
    loadWebFonts();
  }, []);

  // Hide splash screen only when both fonts and bootstrap logic are finished
  useEffect(() => {
    if ((fontsLoaded || fontError) && isReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isReady]);

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
