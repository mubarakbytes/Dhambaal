import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from './Avatar';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import type { ContactRequest } from '../services/contactRequests';

interface ContactRequestCardProps {
  request: ContactRequest;
  onAccept?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
}

const getRequestBadgeStyle = (status: ContactRequest['status']) => {
  if (status === 'accepted') {
    return { backgroundColor: 'rgba(74, 225, 131, 0.12)', borderColor: 'rgba(74, 225, 131, 0.35)' };
  }

  if (status === 'rejected') {
    return { backgroundColor: 'rgba(255, 107, 107, 0.12)', borderColor: 'rgba(255, 107, 107, 0.35)' };
  }

  return { backgroundColor: 'rgba(164, 200, 255, 0.12)', borderColor: 'rgba(164, 200, 255, 0.35)' };
};

const getRequestStatusLabel = (status: ContactRequest['status']) => {
  if (status === 'accepted') return 'Accepted';
  if (status === 'rejected') return 'Rejected';
  return 'Pending';
};

export function ContactRequestCard({ request, onAccept, onReject, onCancel }: ContactRequestCardProps) {
  const displayName =
    request.direction === 'incoming'
      ? request.senderName || request.senderId
      : request.receiverName || request.receiverId;

  const initials = displayName.substring(0, 2).toUpperCase();
  const isIncomingPending = request.direction === 'incoming' && request.status === 'pending';
  const isOutgoingPending = request.direction === 'outgoing' && request.status === 'pending';
  const badgeStyle = getRequestBadgeStyle(request.status);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.personRow}>
          <Avatar size={48} initials={initials} status="none" />
          <View style={styles.textBlock}>
            <View style={styles.nameRow}>
              <Text style={styles.nameText}>{displayName}</Text>
              <View style={[styles.badge, badgeStyle]}>
                <Ionicons
                  name={request.status === 'accepted' ? 'checkmark-circle-outline' : request.status === 'rejected' ? 'close-circle-outline' : 'time-outline'}
                  size={12}
                  color={request.status === 'rejected' ? Colors.error : request.status === 'accepted' ? Colors.tertiary : Colors.primary}
                />
                <Text
                  style={[
                    styles.badgeText,
                    { color: request.status === 'rejected' ? Colors.error : request.status === 'accepted' ? Colors.tertiary : Colors.primary },
                  ]}
                >
                  {getRequestStatusLabel(request.status)}
                </Text>
              </View>
            </View>

            <Text style={styles.metaText}>
              {request.direction === 'incoming' ? 'Wuxuu rabaa inaad noqotaan friends' : 'Sugitaan In La Aqbalo'}
            </Text>
            <Text style={styles.noteText} numberOfLines={2}>
              {request.note || 'No note included.'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>
          {new Date(request.updatedAt || request.createdAt).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>

        {isIncomingPending ? (
          <View style={styles.actionRow}>
            {onReject ? (
              <TouchableOpacity style={[styles.secondaryButton, styles.rejectButton]} onPress={onReject}>
                <Ionicons name="close" size={16} color={Colors.error} />
                <Text style={[styles.secondaryButtonText, { color: Colors.error }]}>Diid</Text>
              </TouchableOpacity>
            ) : null}

            {onAccept ? (
              <TouchableOpacity style={styles.primaryButton} onPress={onAccept}>
                <Ionicons name="checkmark" size={16} color={Colors.onPrimary} />
                <Text style={styles.primaryButtonText}>Aqbal</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : isOutgoingPending && onCancel ? (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.secondaryButton, styles.cancelButton]} onPress={onCancel}>
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
              <Text style={[styles.secondaryButtonText, { color: Colors.error }]}>Jooji</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.glassPanelBg,
    borderWidth: 1,
    borderColor: Colors.glassPanelBorder,
    borderRadius: Spacing.radius2xl,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    flex: 1,
  },
  textBlock: {
    flex: 1,
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  nameText: {
    ...Typography.titleMd,
    color: Colors.onSurface,
    flexShrink: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Spacing.radiusFull,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    ...Typography.labelMonoSm,
    fontSize: 10,
  },
  metaText: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    fontWeight: '900',
  },
  noteText: {
    ...Typography.bodySm,
    color: Colors.onSurface,
    opacity: 0.9,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  footerText: {
    ...Typography.labelMonoSm,
    color: Colors.onSurfaceVariant,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginLeft: 'auto',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: Spacing.radiusFull,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  primaryButtonText: {
    ...Typography.labelMonoSm,
    color: Colors.onPrimary,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Spacing.radiusFull,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  rejectButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    borderColor: 'rgba(255, 107, 107, 0.25)',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    borderColor: 'rgba(255, 107, 107, 0.25)',
  },
  secondaryButtonText: {
    ...Typography.labelMonoSm,
    fontWeight: '700',
  },
});
