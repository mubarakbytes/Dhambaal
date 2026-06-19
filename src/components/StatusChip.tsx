import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface StatusChipProps {
  label?: string;
  verified?: boolean;
  connectionStatus?: string;
}

type BadgeStyle = {
  label: string;
  iconName: string;
  iconColor: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
};

const getConnectionBadgeStyle = (connectionStatus: string): BadgeStyle => {
  switch (connectionStatus) {
    case 'p2p':
      return {
        label: 'Direct P2P',
        iconName: 'flash-outline',
        iconColor: Colors.tertiary,
        backgroundColor: 'rgba(74, 225, 131, 0.1)',
        borderColor: 'rgba(74, 225, 131, 0.4)',
        textColor: Colors.tertiary,
      };
    case 'relay':
    case 'custom_relay':
    case 'default_relay':
      return {
        label: 'TURN relay',
        iconName: 'server-outline',
        iconColor: Colors.primary,
        backgroundColor: 'rgba(164, 200, 255, 0.12)',
        borderColor: 'rgba(164, 200, 255, 0.45)',
        textColor: Colors.primary,
      };
    case 'connecting':
      return {
        label: 'Connecting',
        iconName: 'sync-outline',
        iconColor: '#eab308',
        backgroundColor: 'rgba(234, 179, 8, 0.12)',
        borderColor: 'rgba(234, 179, 8, 0.45)',
        textColor: '#eab308',
      };
    case 'failed':
      return {
        label: 'Failed',
        iconName: 'warning-outline',
        iconColor: Colors.error,
        backgroundColor: 'rgba(255, 92, 92, 0.12)',
        borderColor: 'rgba(255, 92, 92, 0.45)',
        textColor: Colors.error,
      };
    default:
      return {
        label: 'Unknown',
        iconName: 'help-circle-outline',
        iconColor: Colors.outline,
        backgroundColor: 'rgba(139, 145, 157, 0.1)',
        borderColor: 'rgba(139, 145, 157, 0.35)',
        textColor: Colors.outline,
      };
  }
}

export function StatusChip({ label = 'P2P SECURED', verified = true, connectionStatus }: StatusChipProps) {
  const badgeStyle = connectionStatus ? getConnectionBadgeStyle(connectionStatus) : null;
  const displayLabel = badgeStyle ? badgeStyle.label : label;
  const displayIcon = badgeStyle ? badgeStyle.iconName : (verified ? 'lock-closed' : 'lock-open-outline');
  const displayIconColor = badgeStyle ? badgeStyle.iconColor : (verified ? Colors.tertiary : Colors.outline);
  const displayTextColor = badgeStyle ? badgeStyle.textColor : (verified ? Colors.tertiary : Colors.outline);
  const glowColor = badgeStyle ? badgeStyle.iconColor : (verified ? 'rgba(74, 225, 131, 0.3)' : 'rgba(139, 145, 157, 0.3)');
  const glowStyle = Platform.OS === 'web'
    ? ({ boxShadow: `0 0 8px ${glowColor}` } as any)
    : {};
  const displayContainerStyle = badgeStyle
    ? { backgroundColor: badgeStyle.backgroundColor, borderColor: badgeStyle.borderColor }
    : verified
      ? styles.verified
      : styles.unverified;

  return (
    <View style={[styles.chip, displayContainerStyle, glowStyle]}>
      <Ionicons
        name={displayIcon as any}
        size={10}
        color={displayIconColor}
      />
      <Text style={[styles.label, { color: displayTextColor }]}>
        {displayLabel}
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
});
