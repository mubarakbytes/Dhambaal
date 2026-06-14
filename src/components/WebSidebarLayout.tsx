import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Image } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, subscribeTheme } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';

const NAV_ITEMS = [
  { route: '/(tabs)/fariimaha', icon: 'chatbubbles' as const, iconOutline: 'chatbubbles-outline' as const, label: 'Fariimaha' },
  { route: '/(tabs)/wicitaano', icon: 'call' as const, iconOutline: 'call-outline' as const, label: 'Wicitaano' },
  { route: '/(tabs)/dadka', icon: 'people' as const, iconOutline: 'people-outline' as const, label: 'Dadka' },
];

const BOTTOM_ITEMS = [
  { route: '/(tabs)/aniga', icon: 'settings' as const, iconOutline: 'settings-outline' as const, label: 'Aniga' },
];

interface WebSidebarLayoutProps {
  children: React.ReactNode;
  activeRoute: string;
}

/**
 * Web-only sidebar layout wrapper.
 * Renders a slim 96px sidebar + main content area.
 * Only renders on Platform.OS === 'web'.
 */
export function WebSidebarLayout({ children, activeRoute }: WebSidebarLayoutProps) {
  const router = useRouter();
  const [themeTick, setThemeTick] = React.useState(0);

  React.useEffect(() => {
    const unsubscribe = subscribeTheme(() => {
      setThemeTick((tick) => tick + 1);
    });
    return unsubscribe;
  }, []);

  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  const isLight = Colors.background === '#f4f6f8';

  const sidebarBg = isLight ? 'rgba(255, 255, 255, 0.7)' : 'rgba(25, 28, 29, 0.6)';
  const sidebarBorder = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)';
  const logoBorder = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)';
  const navItemActiveBg = isLight ? 'rgba(0, 110, 255, 0.08)' : 'rgba(164, 200, 255, 0.12)';
  const avatarBorder = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.2)';

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: Colors.background,
    },
    sidebar: {
      width: Spacing.sidebarWidth,
      backgroundColor: sidebarBg,
      borderRightWidth: 1,
      borderRightColor: sidebarBorder,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: Spacing.base,
      ...(Platform.OS === 'web'
        ? ({ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } as any)
        : {}),
    },
    logoContainer: {
      paddingBottom: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: logoBorder,
      width: '100%',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    logoImage: {
      width: 44,
      height: 44,
    },
    navItems: {
      flex: 1,
      width: '100%',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.xs,
    },
    navItem: {
      width: 48,
      height: 48,
      borderRadius: Spacing.radiusLg,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    navItemActive: {
      backgroundColor: navItemActiveBg,
    },
    activeBar: {
      position: 'absolute',
      left: -8,
      top: '50%',
      marginTop: -10,
      width: 4,
      height: 20,
      borderRadius: 2,
      backgroundColor: Colors.primary,
    },
    bottomItems: {
      width: '100%',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: logoBorder,
    },
    profileAvatar: {
      position: 'relative',
      marginTop: Spacing.xs,
    },
    avatarCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.secondaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: avatarBorder,
    },
    avatarInitial: {
      ...Typography.titleMd,
      color: Colors.onSecondaryContainer,
      fontSize: 16,
    },
    onlineDot: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: Colors.statusJooge,
      borderWidth: 2,
      borderColor: Colors.surface,
    },
    mainContent: {
      flex: 1,
      overflow: 'hidden' as any,
    },
  });

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sidebar}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/logo.png')} 
            style={styles.logoImage} 
            resizeMode="contain"
          />
        </View>

        {/* Main nav items */}
        <View style={styles.navItems}>
          {NAV_ITEMS.map((item) => {
            const isActive = activeRoute === item.route;
            return (
              <TouchableOpacity
                key={item.route}
                style={[styles.navItem, isActive && styles.navItemActive]}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.7}
              >
                {isActive && <View style={styles.activeBar} />}
                <Ionicons
                  name={isActive ? item.icon : item.iconOutline}
                  size={22}
                  color={isActive ? Colors.primary : Colors.onSurfaceVariant}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bottom: settings + profile */}
        <View style={styles.bottomItems}>
          {BOTTOM_ITEMS.map((item) => {
            const isActive = activeRoute === item.route;
            return (
              <TouchableOpacity
                key={item.route}
                style={[styles.navItem, isActive && styles.navItemActive]}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.7}
              >
                {isActive && <View style={styles.activeBar} />}
                <Ionicons
                  name={isActive ? item.icon : item.iconOutline}
                  size={22}
                  color={isActive ? Colors.primary : Colors.onSurfaceVariant}
                />
              </TouchableOpacity>
            );
          })}
          {/* User avatar */}
          <View style={styles.profileAvatar}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>C</Text>
            </View>
            <View style={styles.onlineDot} />
          </View>
        </View>
      </View>

      {/* Main content */}
      <View style={styles.mainContent}>{children}</View>
    </View>
  );
}
