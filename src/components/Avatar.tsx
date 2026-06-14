import React from 'react';
import { View, Image, Text, StyleSheet, ViewStyle, ImageSourcePropType } from 'react-native';
import { Colors } from '../theme/colors';

interface AvatarProps {
  source?: ImageSourcePropType;
  initials?: string;
  size?: number;
  status?: 'jooge' | 'maqane' | 'none';
  style?: ViewStyle;
  initialsColor?: string;
  initialsBg?: string;
}

/**
 * Circular avatar with optional online status dot.
 * - jooge (online): green dot
 * - maqane (offline): gray dot
 */
export function Avatar({
  source,
  initials,
  size = 48,
  status = 'none',
  style,
  initialsColor,
  initialsBg,
}: AvatarProps) {
  // Solve default parameters being evaluated at compile/instantiation time:
  const resolvedColor = initialsColor || Colors.onSurface;
  const resolvedBg = initialsBg || Colors.secondaryContainer;

  return (
    <View style={[styles.wrapper, { width: size, height: size }, style]}>
      {source ? (
        <Image
          source={source}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
        />
      ) : (
        <View
          style={[
            styles.initialsContainer,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: resolvedBg, // dynamically evaluated on render
            },
          ]}
        >
          <Text
            style={{
              color: resolvedColor, // dynamically evaluated on render
              fontFamily: 'PlusJakartaSans_600SemiBold',
              fontSize: size * 0.35,
              fontWeight: '600',
            }}
          >
            {initials}
          </Text>
        </View>
      )}

      {status !== 'none' && (
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor:
                status === 'jooge' ? Colors.statusJooge : Colors.statusMaqane,
              borderColor: Colors.surface, // dynamically evaluated on render
              width: size * 0.22,
              height: size * 0.22,
              borderRadius: (size * 0.22) / 2,
              bottom: 0,
              right: 0,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  image: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  initialsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statusDot: {
    position: 'absolute',
    borderWidth: 2,
  },
});
