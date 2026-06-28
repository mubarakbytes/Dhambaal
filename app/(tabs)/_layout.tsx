import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, subscribeTheme } from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { Spacing } from '../../src/theme/spacing';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TABS = [
  { name: 'fariimaha', label: 'Fariimaha', icon: 'chatbubbles' as const, iconOutline: 'chatbubbles-outline' as const },
  { name: 'wicitaano', label: 'Wicitaano', icon: 'call' as const, iconOutline: 'call-outline' as const },
  { name: 'dadka', label: 'Dadka', icon: 'people' as const, iconOutline: 'people-outline' as const },
  { name: 'aniga', label: 'Aniga', icon: 'person' as const, iconOutline: 'person-outline' as const },
];

function CustomTabBar({ state, navigation }: any) {
  // On web, sidebar handles navigation — hide bottom bar
  if (Platform.OS === 'web') return null;

  const insets = useSafeAreaInsets();

  // Evaluate styles inside the render function so they update dynamically with the theme
  const styles = StyleSheet.create({
    tabBar: {
      flexDirection: 'row',
      backgroundColor: Colors.surface, // dynamically updates dark vs light!
      borderTopWidth: 1,
      borderTopColor: Colors.glassPanelBorder,
      height: Spacing.bottomNavHeight + insets.bottom,
      paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: Spacing.radiusLg,
      marginHorizontal: 4,
    },
    tabItemActive: {
      backgroundColor: Colors.glassInteractiveBg,
    },
    tabLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 },
  });

  return (
    <View style={styles.tabBar}>
      {state.routes.map((route: any, index: number) => {
        const tab = TABS.find((t) => t.name === route.name) ?? TABS[0];
        const isFocused = state.index === index;
        return (
          <TouchableOpacity
            key={route.key}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={[styles.tabItem, isFocused && styles.tabItemActive]}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isFocused ? tab.icon : tab.iconOutline}
              size={22}
              color={isFocused ? Colors.primary : Colors.onSurfaceVariant}
            />
            <Text style={[styles.tabLabel, { color: isFocused ? Colors.primary : Colors.onSurfaceVariant }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const [themeTick, setThemeTick] = useState(0);

  useEffect(() => {
    // Dynamic theme listener to trigger layout re-renders instantly
    const unsubscribe = subscribeTheme(() => {
      setThemeTick(tick => tick + 1);
    });
    return unsubscribe;
  }, []);

  return (
    <Tabs
      screenOptions={{ 
        headerShown: false,
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
      ))}
    </Tabs>
  );
}
