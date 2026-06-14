import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface StatusChipProps {
  label?: string;
  verified?: boolean;
}

export function StatusChip({ label = 'P2P SECURED', verified = true }: StatusChipProps) {
  const glowStyle = Platform.OS === 'web'
    ? ({ boxShadow: '0 0 8px rgba(74,225,131,0.3)' } as any)
    : {};

  return (
    <View style={[styles.chip, verified ? styles.verified : styles.unverified, glowStyle]}>
      <Ionicons
        name={verified ? 'lock-closed' : 'lock-open-outline'}
        size={10}
        color={verified ? Colors.tertiary : Colors.outline}
      />
      <Text style={[styles.label, verified ? styles.labelVerified : styles.labelUnverified]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
    alignSelf: 'center',
  },
  verified: {
    backgroundColor: 'rgba(74, 225, 131, 0.1)',
    borderColor: 'rgba(74, 225, 131, 0.4)',
  },
  unverified: {
    backgroundColor: 'rgba(139, 145, 157, 0.1)',
    borderColor: 'rgba(139, 145, 157, 0.4)',
  },
  label: { ...Typography.labelMono, fontSize: 10 },
  labelVerified: { color: Colors.tertiary },
  labelUnverified: { color: Colors.outline },
});
