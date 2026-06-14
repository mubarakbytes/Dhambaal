import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { Avatar } from './Avatar';

export interface Contact {
  id: string;
  name: string;
  status: 'jooge' | 'maqane';
  shortId: string;
  avatarSource?: any;
  initials?: string;
  verified?: boolean;
}

interface ContactCardProps {
  contact: Contact;
  onMessage?: () => void;
  onCall?: () => void;
  onDelete?: () => void;
  variant?: 'grid' | 'list';
}

/**
 * Contact card – grid on web, list row on mobile.
 */
export function ContactCard({ contact, onMessage, onCall, onDelete, variant = 'list' }: ContactCardProps) {
  const webBlur =
    Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } as any)
      : {};

  // Evaluate styles inside the component dynamically on each render!
  const styles = StyleSheet.create({
    // Grid variant
    gridCard: {
      backgroundColor: Colors.glassPanelBg,
      borderWidth: 1,
      borderColor: Colors.glassPanelBorder,
      borderRadius: Spacing.radius2xl,
      padding: Spacing.md,
      alignItems: 'center',
      minWidth: 160,
      position: 'relative',
    },
    verifiedBadge: {
      position: 'absolute',
      top: Spacing.sm,
      right: Spacing.sm,
    },
    gridAvatar: {
      marginBottom: Spacing.sm,
    },
    gridName: {
      ...Typography.titleMd,
      color: Colors.onSurface,
      textAlign: 'center',
      marginBottom: 2,
    },
    gridStatusText: {
      ...Typography.bodySm,
      marginBottom: Spacing.sm,
    },
    gridFooter: {
      width: '100%',
      gap: Spacing.xs,
      marginTop: Spacing.sm,
      alignItems: 'center',
    },
    gridActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      flexWrap: 'wrap',
    },
    idText: {
      ...Typography.labelMono,
      color: Colors.primary,
      fontSize: 10,
    },

    // List variant
    listCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.glassPanelBg,
      borderWidth: 1,
      borderColor: Colors.glassPanelBorder,
      borderRadius: Spacing.radiusXl,
      padding: Spacing.sm,
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    listInfo: {
      flex: 1,
      gap: 2,
    },
    listName: {
      ...Typography.titleMd,
      color: Colors.onSurface,
    },
    listStatus: {
      ...Typography.bodySm,
    },
    listActions: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },

    // Shared
    actionBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: Colors.glassInteractiveBg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: Colors.glassPanelBorder,
    },
    destructiveActionBtn: {
      backgroundColor: 'rgba(255, 92, 92, 0.12)',
      borderColor: 'rgba(255, 92, 92, 0.35)',
    },
    destructiveTextActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.sm,
      width: 'auto',
    },
    destructiveTextActionLabel: {
      ...Typography.bodySm,
      color: Colors.error,
      fontWeight: '700',
    },
  });

  if (variant === 'grid') {
    return (
      <View style={[styles.gridCard, webBlur]}>
        {contact.verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="shield-checkmark" size={16} color={Colors.tertiary} />
          </View>
        )}
        <Avatar
          source={contact.avatarSource}
          initials={contact.initials}
          size={72}
          status={contact.status}
          style={styles.gridAvatar}
        />
        <Text style={styles.gridName}>{contact.name}</Text>
        <Text
          style={[
            styles.gridStatusText,
            { color: contact.status === 'jooge' ? Colors.tertiary : Colors.onSurfaceVariant },
          ]}
        >
          {contact.status === 'jooge' ? 'Jooge' : 'Maqane'}
        </Text>
        <View style={styles.gridFooter}>
          <Text style={styles.idText}>ID: {contact.shortId}</Text>
          <View style={styles.gridActions}>
            {onMessage && (
              <TouchableOpacity style={styles.actionBtn} onPress={onMessage}>
                <Ionicons name="chatbubble-outline" size={16} color={Colors.onSurface} />
              </TouchableOpacity>
            )}
            {contact.status === 'jooge' && onCall && (
              <TouchableOpacity style={styles.actionBtn} onPress={onCall}>
                <Ionicons name="call-outline" size={16} color={Colors.onSurface} />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.destructiveActionBtn, styles.destructiveTextActionBtn]}
                onPress={onDelete}
                accessibilityLabel={`Delete ${contact.name}`}
              >
                <Ionicons name="trash-outline" size={16} color={Colors.error} />
                <Text style={styles.destructiveTextActionLabel}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  // List variant (mobile)
  return (
    <View style={[styles.listCard, webBlur]}>
      <Avatar
        source={contact.avatarSource}
        initials={contact.initials}
        size={56}
        status={contact.status}
      />
      <View style={styles.listInfo}>
        <Text style={styles.listName}>{contact.name}</Text>
        <Text
          style={[
            styles.listStatus,
            { color: contact.status === 'jooge' ? Colors.tertiary : Colors.onSurfaceVariant },
          ]}
        >
          {contact.status === 'jooge' ? 'Jooge' : 'Maqane'}
        </Text>
      </View>
      <View style={styles.listActions}>
        {onMessage && (
          <TouchableOpacity style={styles.actionBtn} onPress={onMessage}>
            <Ionicons name="chatbubble-outline" size={16} color={Colors.onSurface} />
          </TouchableOpacity>
        )}
        {contact.status === 'jooge' && onCall && (
          <TouchableOpacity style={styles.actionBtn} onPress={onCall}>
            <Ionicons name="call-outline" size={16} color={Colors.onSurface} />
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.destructiveActionBtn]}
            onPress={onDelete}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.error} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
