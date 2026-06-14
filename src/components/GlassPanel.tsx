import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { Colors } from '../theme/colors';

interface GlassPanelProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: 'low' | 'medium' | 'high';
  interactive?: boolean;
}

/**
 * Glassmorphic frosted-glass container.
 * On web: uses CSS backdrop-filter blur.
 * On native: uses semi-transparent background (expo-blur optional enhancement).
 */
export function GlassPanel({
  children,
  style,
  intensity = 'medium',
  interactive = false,
}: GlassPanelProps) {
  // Let's use the dynamic Colors.glassPanelBg and glassInteractiveBg which adapt perfectly to Light/Dark modes!
  const bg = interactive
    ? Colors.glassInteractiveBg
    : Colors.glassPanelBg;

  const webStyle =
    Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        } as any)
      : {};

  // Evaluate styles inside render function so they update dynamically on theme change!
  const dynamicStyles = StyleSheet.create({
    panel: {
      backgroundColor: bg,
      borderColor: Colors.glassPanelBorder,
      borderWidth: 1,
      borderRadius: 16,
      overflow: 'hidden',
    }
  });

  return (
    <View
      style={[
        dynamicStyles.panel,
        webStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
}
