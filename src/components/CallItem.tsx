import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { Avatar } from './Avatar';

export type CallType = 'incoming' | 'outgoing' | 'missed';

export interface CallRecord {
  id: string;
  name: string;
  type: CallType;
  time: string;
  avatarSource?: any;
  initials?: string;
}

interface CallItemProps {
  call: CallRecord;
  onCallBack?: () => void;
}

const callTypeLabel: Record<CallType, string> = {
  incoming: 'Lagu Wacay',
  outgoing: 'Wacday',
  missed: 'La Aqbalin',
};

const callTypeIconName: Record<CallType, keyof typeof Ionicons.glyphMap> = {
  incoming: 'arrow-down-outline',
  outgoing: 'arrow-up-outline',
  missed: 'arrow-down-outline',
};

/**
 * Single call history row.
 */
export function CallItem({ call, onCallBack }: CallItemProps) {
  const isMissed = call.type === 'missed';

  // Evaluate styles inside the component dynamically on each render!
  const styles = StyleSheet.create({
    container: {
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
    info: {
      flex: 1,
      gap: 2,
    },
    name: {
      ...Typography.titleMd,
      color: Colors.onSurface,
    },
    missedName: {
      color: Colors.error,
    },
    detail: {
      ...Typography.bodySm,
      color: Colors.onSurfaceVariant,
    },
    missedDetail: {
      color: Colors.error,
    },
    callBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.glassInteractiveBg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: Colors.glassPanelBorder,
    },
  });

  return (
    <View style={styles.container}>
      <Avatar
        source={call.avatarSource}
        initials={call.initials}
        size={48}
        status="none"
      />
      <View style={styles.info}>
        <Text style={[styles.name, isMissed && styles.missedName]}>
          {call.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons
            name={callTypeIconName[call.type]}
            size={14}
            color={isMissed ? Colors.error : Colors.onSurfaceVariant}
          />
          <Text style={[styles.detail, isMissed && styles.missedDetail]}>
            {callTypeLabel[call.type]} • {call.time}
          </Text>
        </View>
      </View>
      {onCallBack && (
        <TouchableOpacity style={styles.callBtn} onPress={onCallBack}>
          <Ionicons
            name="call-outline"
            size={20}
            color={Colors.onSurface}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}
