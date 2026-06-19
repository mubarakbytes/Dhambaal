import React, { useState, useEffect } from 'react';
import {
  View, Text, Platform, SafeAreaView, StatusBar, SectionList, StyleSheet, TouchableOpacity,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, subscribeTheme } from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { Spacing } from '../../src/theme/spacing';
import { CallItem } from '../../src/components/CallItem';
import { WebSidebarLayout } from '../../src/components/WebSidebarLayout';
import { listenToCallHistory } from '../../src/services/calls';
import { MadaxaMobilka } from '../../src/components/MadaxaMobilka';

type Filter = 'dhamaan' | 'malaAqbalin';
export default function WicitaaanoScreen() {
  const router = useRouter();
  const [themeTick, setThemeTick] = useState(0);
  const [callsList, setCallsList] = useState<any[]>([]);

  // Subscribe to theme updates dynamically to trigger screen re-render instantly!
  useEffect(() => {
    const unsubscribe = subscribeTheme(() => {
      setThemeTick((tick) => tick + 1);
    });
    return unsubscribe;
  }, []);

  // Listen to call history updates
  useEffect(() => {
    const unsubscribe = listenToCallHistory((updatedCalls) => {
      setCallsList(updatedCalls);
    });
    return unsubscribe;
  }, []);

  const [filter, setFilter] = useState<Filter>('dhamaan');
  const isWeb = Platform.OS === 'web';

  const filtered = filter === 'malaAqbalin'
    ? callsList.filter((c) => c.type === 'missed')
    : callsList;

  const todayCalls = filtered.filter(c => c.time.includes(':') || c.time.toLowerCase().includes('am') || c.time.toLowerCase().includes('pm'));
  const yesterdayCalls = filtered.filter(c => c.time === 'Shalay');
  const olderCalls = filtered.filter(c => !todayCalls.includes(c) && !yesterdayCalls.includes(c));

  const filteredSections = [
    { title: 'MAANTA', data: todayCalls },
    { title: 'SHALAY', data: yesterdayCalls },
    { title: 'KALE', data: olderCalls }
  ].filter((s) => s.data.length > 0);

  // Define styles dynamically inside the component body so theme values refresh instantly!
  const styles = StyleSheet.create({
    screenBg: { flex: 1, backgroundColor: Colors.background },
    content: { flex: 1 },
    pageHeader: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    pageTitle: { ...Typography.headlineLg, color: Colors.onSurface, fontSize: 28 },
    pageSubtitle: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 2 },
    filterRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.md,
    },
    filterBtn: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Spacing.radiusFull,
      borderWidth: 1,
      borderColor: Colors.glassPanelBorder,
      backgroundColor: Colors.glassPanelBg,
    },
    filterBtnActive: {
      backgroundColor: Colors.glassInteractiveBg,
      borderColor: Colors.primary,
    },
    filterLabel: { ...Typography.bodySm, color: Colors.onSurfaceVariant },
    filterLabelActive: { color: Colors.primary, fontWeight: '600' },
    sectionHeader: {
      ...Typography.labelMono,
      color: Colors.onSurfaceVariant,
      fontSize: 11,
      letterSpacing: 1.2,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xs,
    },
    listContent: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
    empty: { alignItems: 'center', paddingTop: Spacing.xl },
    emptyIcon: { fontSize: 48, marginBottom: Spacing.sm },
    emptyText: { ...Typography.bodyLg, color: Colors.onSurfaceVariant },
  });

  const content = (
    <View style={styles.content}>
      {isWeb && (
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Wicitaanada</Text>
          <Text style={styles.pageSubtitle}>Taariikhda wicitaanadaada P2P</Text>
        </View>
      )}

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'dhamaan' && styles.filterBtnActive]}
          onPress={() => setFilter('dhamaan')}
        >
          <Text style={[styles.filterLabel, filter === 'dhamaan' && styles.filterLabelActive]}>
            Dhamaan
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'malaAqbalin' && styles.filterBtnActive]}
          onPress={() => setFilter('malaAqbalin')}
        >
          <Text style={[styles.filterLabel, filter === 'malaAqbalin' && styles.filterLabelActive]}>
            Mala-aqbalin
          </Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={filteredSections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionHeader}>{title}</Text>
        )}
        renderItem={({ item }) => <Pressable onPress={() => isWeb ? router.push({ pathname: '/(tabs)/fariimaha', params: { chatId: item.contactId } }) : router.push(`/fariin/${item.contactId}`)}><CallItem call={item} /></Pressable>}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="call-outline" size={48} color={Colors.onSurfaceVariant} style={styles.emptyIcon} />
            <Text style={styles.emptyText}>Wicitaano ma jiraan</Text>
          </View>
        }
      />
    </View>
  );

  return (
    <WebSidebarLayout activeRoute="/(tabs)/wicitaano">
      <View style={styles.screenBg}>
        {!isWeb && (
          <SafeAreaView style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0 }}>
            <MadaxaMobilka ciwaan="Dhambaal" showSearchIcon={false} />
          </SafeAreaView>
        )}
        {content}
      </View>
    </WebSidebarLayout>
  );
}
