import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Platform, SafeAreaView, StatusBar, Modal, TextInput, Alert, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';

import { Colors, subscribeTheme } from '../../src/theme/colors';
import { Typography } from '../../src/theme/typography';
import { Spacing } from '../../src/theme/spacing';
import { ContactCard, Contact } from '../../src/components/ContactCard';
import { SearchBar } from '../../src/components/SearchBar';
import { WebSidebarLayout } from '../../src/components/WebSidebarLayout';
import { listenToContacts, removeContact } from '../../src/services/contacts';
import { ContactRequestCard } from '../../src/components/ContactRequestCard';
import {
  acceptContactRequest,
  cancelContactRequest,
  listenToContactRequests,
  rejectContactRequest,
  sendContactRequest,
  type ContactRequest,
} from '../../src/services/contactRequests';
import { MadaxaMobilka } from '../../src/components/MadaxaMobilka';

type Filter = 'dhamaan' | 'jooge' | 'maqane';

const SCAN_SETTINGS: any = {
  barcodeTypes: ['qr'],
};

export default function DadkaScreen() {
  const [themeTick, setThemeTick] = useState(0);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);

  // Subscribe to theme updates dynamically to trigger screen re-render instantly!
  useEffect(() => {
    const unsubscribe = subscribeTheme(() => {
      setThemeTick((tick) => tick + 1);
    });
    return unsubscribe;
  }, []);

  // Dhegeyso isbeddelka asxaabta ee GunDB
  useEffect(() => {
    const unsubscribeContacts = listenToContacts((list) => {
      setContacts(list as Contact[]);
    });
    return unsubscribeContacts;
  }, []);

  useEffect(() => {
    const unsubscribeRequests = listenToContactRequests((list) => {
      setContactRequests(list);
    });
    return unsubscribeRequests;
  }, []);

  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [filter, setFilter] = useState<Filter>('dhamaan');
  const isWeb = Platform.OS === 'web';

  // Modal & Camera States
  const [modalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'manual'>('qr');
  const [name, setName] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const filtered = contacts.filter((c) => {
    const matchSearch = (c.name || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'dhamaan' || c.status === filter;
    return matchSearch && matchFilter;
  });

  const handleBarcodeScanned = ({ type, data }: any) => {
    console.log('[Scanner] QR Code detected! type:', type, 'data:', data);
    if (!data) return;
    try {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        if (parsed.pub) {
          setPublicKey(parsed.pub);
        } else if (parsed.publicKey) {
          setPublicKey(parsed.publicKey);
        } else {
          setPublicKey(data);
        }

        if (parsed.name) {
          setName(parsed.name);
        }
      } else {
        setPublicKey(data);
      }
    } catch (e) {
      setPublicKey(data);
    }
    setActiveTab('manual'); // Switch to manual tab to show the scanned key
  };

  const resetRequestForm = () => {
    setName('');
    setPublicKey('');
    setRequestMessage('');
    setActiveTab('qr');
  };

  const closeRequestModal = () => {
    setModalVisible(false);
    resetRequestForm();
  };

  const handleSendContactRequest = async () => {
    if (!name || !publicKey) {
      {
        isWeb ? alert('Fadlan buuxi magaca iyo public key-ga') 
        : 
        Alert.alert('Xog ayaa harsan', 'Fadlan buuxi magaca iyo public key-ga');
      }
      return;
    }

    if (!requestMessage.trim()) {
      {
        isWeb ? alert('Fadlan qor fariin gaaban oo codsi ah') 
        : 
        Alert.alert('Qor fariin', 'Fadlan qor fariin gaaban oo codsi ah');
      }
      return;
    }

    try {
      setIsSendingRequest(true);

      const { delivered } = await sendContactRequest(publicKey, requestMessage, name);

      closeRequestModal();

      Alert.alert(
        'Codsiga waa la diray',
        delivered
          ? `Codsiga waa la diray ${name}.`
          : `Codsiga waa la helay ${name}. Waa la diri donaa lkn hadda ma jiro xiriir direct ah.`
      );
    } catch (err: any) {
      Alert.alert('Lama diri karo codsiga', err?.message || 'Cilad aan la garanayn ayaa dhacday');
      console.error('Error sending contact request:', err?.message || err);
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const { delivered } = await acceptContactRequest(requestId);
      {
        isWeb ? alert('Xiriirka waa la aqbalay') : 
        Alert.alert(
          'Xiriirka waa la aqbalay',
          delivered
            ? 'Qofkan ayaa lagu daray xiriiradaada, waxaana si toos ah loogu diray aqbalaadaadda.'
            : 'Qofkan ayaa lagu daray xiriiradaada, laakiin wali waxaa la sugayaa xiriir toos ah si loogu gudbiyo aqbalaadaada.'
        );
      }
    } catch (error: any) {
      Alert.alert('Lama aqbalin', error?.message || 'Cilad aan la garanayn ayaa dhacday');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { delivered } = await rejectContactRequest(requestId);
      {
        isWeb ? alert('Codsiga waa la diiday') : 
        Alert.alert(
          'Codsiga waa la diiday',
          delivered
            ? 'Diidmadaada waxaa si toos ah loogu gudbinayaa qofka codsiga soo diray.'
            : 'Diidmadaada waxaa lala sugayaa xiriir toos ah si loogu gudbiyo qofka codsiga soo diray.'
        );
      }
    } catch (error: any) {
      Alert.alert('Lama diidin', error?.message || 'Cilad aan la garanayn ayaa dhacday');
    }
  };

  const handleCancelRequest = (request: ContactRequest) => {
    const confirmCancel = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.confirm(`Jooji codsiga aad u dirtay ${request.receiverName || request.receiverId}?`)
      : true;

    if (!confirmCancel) {
      return;
    }

    void (async () => {
      try {
        const { delivered } = await cancelContactRequest(request.id);
        Alert.alert(
          'Codsiga waa la joojiyay',
          delivered
            ? 'Codsiga waa la joojiyay oo si toos ah ayaa loo diray.'
            : 'Codsiga waa la joojiyay, laakiin wali waxaa la sugayaa xiriir toos ah si loo diro joojinta.'
        );
      } catch (error: any) {
        Alert.alert('Lama joojin', error?.message || 'Cilad aan la garanayn ayaa dhacday');
      }
    })();
  };

  const handleDeleteContact = (contact: Contact) => {
    const confirmDelete = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.confirm(`Ka tir ${contact.name}  contacts-kaada sidoo kale jooji xiriirka jira?`)
      : true;

    if (!confirmDelete) {
      return;
    }

    void (async () => {
      try {
        await removeContact(contact.id);
        Alert.alert('Shaqsigani ', `${contact.name} waa la masaxay.`);
      } catch (error: any) {
        Alert.alert('Lama tirin', error?.message || 'Unknown error');
      }
    })();
  };

  // Evaluate styles inside the component dynamically on each render!
  const styles = StyleSheet.create({
    screenBg: { flex: 1, backgroundColor: Colors.background },
    content: { flex: 1 },
    pageHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    },
    pageTitle: { ...Typography.headlineLg, color: Colors.onSurface, fontSize: 28 },
    pageSubtitle: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 2 },
    filterIconBtn: {
      width: 44, height: 44, borderRadius: Spacing.radiusMd,
      backgroundColor: Colors.glassPanelBg,
      borderWidth: 1, borderColor: Colors.glassPanelBorder,
      alignItems: 'center', justifyContent: 'center',
    },
    mobileControls: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.sm },
    filterRow: { flexDirection: 'row', gap: Spacing.sm },
    filterBtn: {
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
      borderRadius: Spacing.radiusFull, borderWidth: 1,
      borderColor: Colors.glassPanelBorder, backgroundColor: Colors.glassPanelBg,
    },
    filterBtnActive: { backgroundColor: Colors.glassInteractiveBg, borderColor: Colors.primary },
    filterLabel: { ...Typography.bodySm, color: Colors.onSurfaceVariant },
    filterLabelActive: { color: Colors.primary, fontWeight: '600' },
    webGrid: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.md },
    mobileList: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
    requestSection: {
      gap: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.md,
    },
    requestSummaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: Spacing.radius2xl,
      borderWidth: 1,
      borderColor: Colors.glassPanelBorder,
      backgroundColor: Colors.glassInteractiveBg,
    },
    requestSummaryIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.glassPanelBg,
      borderWidth: 1,
      borderColor: Colors.glassPanelBorder,
    },
    requestSummaryTextWrap: { flex: 1, gap: 2 },
    requestSummaryTitle: { ...Typography.titleMd, color: Colors.onSurface },
    requestSummarySub: { ...Typography.bodySm, color: Colors.onSurfaceVariant },
    requestSummaryCount: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.primary,
    },
    requestSummaryCountText: {
      ...Typography.labelMono,
      color: Colors.onPrimary,
      fontWeight: '700',
    },
    requestColumn: { gap: Spacing.sm },
    requestSectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 2,
    },
    requestSectionTitle: { ...Typography.titleMd, color: Colors.onSurface },
    requestSectionHint: { ...Typography.bodySm, color: Colors.onSurfaceVariant },
    addCard: {
      flex: 1, minWidth: 160,
      backgroundColor: Colors.glassPanelBg,
      borderWidth: 1.5, borderColor: Colors.glassPanelBorder,
      borderStyle: 'dashed' as any,
      borderRadius: Spacing.radius2xl,
      padding: Spacing.md, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    },
    addIcon: {
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: Colors.glassInteractiveBg,
      alignItems: 'center', justifyContent: 'center',
    },
    addTitle: { ...Typography.titleMd, color: Colors.primary, textAlign: 'center' },
    addSubtitle: { ...Typography.bodySm, color: Colors.onSurfaceVariant, textAlign: 'center' },
    fab: {
      position: 'absolute', bottom: 90, right: Spacing.md,
      width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary,
      alignItems: 'center', justifyContent: 'center', elevation: 8,
    },
    // Modal Styles
    // Modal Styles - Updated for a true Bottom Sheet look
    modalOverlay: {
      flex: 1, 
      justifyContent: 'flex-end', 
      backgroundColor: 'rgba(0,0,0,0.6)', // Slightly darker overlay for better focus
    },
    modalCard: {
      backgroundColor: Colors.background, 
      borderTopLeftRadius: 24, 
      borderTopRightRadius: 24,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      // Add generous bottom padding to ensure it covers the tab bar area completely
      paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xl, 
      height: '85%', // Make it taller so it doesn't look cut off
      width: '100%', // Stretch edge-to-edge
      elevation: 20, // Add shadow for Android
      shadowColor: '#000', // Add shadow for iOS
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
    },
    handleBar: {
      width: 48, 
      height: 5, 
      backgroundColor: Colors.onSurfaceVariant,
      borderRadius: 2.5, 
      alignSelf: 'center', 
      marginBottom: Spacing.lg,
      opacity: 0.5,
    },
    modalHeaderRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    modalTitle: { ...Typography.titleLg, color: Colors.onSurface },
    closeText: { ...Typography.bodyMd, color: Colors.primary },
    tabContainer: {
      flexDirection: 'row', backgroundColor: Colors.glassPanelBg,
      borderRadius: Spacing.radiusMd, padding: 4, marginBottom: Spacing.lg,
    },
    tabButton: {
      flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Spacing.radiusSm,
    },
    activeTabButton: { backgroundColor: Colors.glassInteractiveBg },
    tabText: { ...Typography.bodySm, color: Colors.onSurfaceVariant },
    activeTabText: { color: Colors.primary, fontWeight: 'bold' },
    contentContainer: { flex: 1 },
    scannerWrapper: {
      flex: 1, borderRadius: Spacing.radiusMd, overflow: 'hidden',
      backgroundColor: '#000', minHeight: 300, position: 'relative',
    },
    camera: {
      flex: 1,
      width: '100%',
      height: '100%',
    },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.md },
    infoText: { color: '#FFF', textAlign: 'center', marginBottom: Spacing.md },
    permissionBtn: { backgroundColor: Colors.primary, padding: Spacing.sm, borderRadius: Spacing.radiusMd },
    permissionBtnText: { color: Colors.onPrimary },
    formWrapper: { flex: 1 },
    label: { ...Typography.bodySm, color: Colors.onSurface, marginBottom: Spacing.xs },
    input: {
      backgroundColor: Colors.glassPanelBg, color: Colors.onSurface,
      padding: Spacing.md, borderRadius: Spacing.radiusMd, marginBottom: Spacing.md,
      borderWidth: 1, borderColor: Colors.glassPanelBorder,
    },
    textArea: { height: 100, textAlignVertical: 'top' },
    helperText: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginBottom: Spacing.sm },
    submitButton: {
      backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: Spacing.radiusMd,
      alignItems: 'center', marginTop: Spacing.sm,
    },
    submitButtonText: { color: Colors.onPrimary, fontWeight: 'bold' },
  });

  const pendingIncomingRequests = contactRequests.filter(
    (request) => request.direction === 'incoming' && request.status === 'pending'
  );
  const pendingOutgoingRequests = contactRequests.filter(
    (request) => request.direction === 'outgoing' && request.status === 'pending'
  );

  const requestSection = pendingIncomingRequests.length > 0 || pendingOutgoingRequests.length > 0 ? (
    <View style={styles.requestSection}>
      <View style={styles.requestSummaryCard}>
        <View style={styles.requestSummaryIcon}>
          <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
        </View>
        <View style={styles.requestSummaryTextWrap}>
          <Text style={styles.requestSummaryTitle}>Codsi La Gudbiyay</Text>
          <Text style={styles.requestSummarySub}>
           
            Codsiyada aad gudbisatay iyo kuwa laguu soo gudbiyay waxay ka muuqan donaan halkan ilaa inta ay ka helayaan jawaab celin dhanka loo diray.
          </Text>
        </View>
        <View style={styles.requestSummaryCount}>
          <Text style={styles.requestSummaryCountText}>
            {pendingIncomingRequests.length + pendingOutgoingRequests.length}
          </Text>
        </View>
      </View>

      {pendingIncomingRequests.length > 0 ? (
        <View style={styles.requestColumn}>
          <View style={styles.requestSectionTitleRow}>
            <Text style={styles.requestSectionTitle}>Codsi Yimid</Text>
            <Text style={styles.requestSectionHint}>{pendingIncomingRequests.length} Sugid</Text>
          </View>

          {pendingIncomingRequests.map((request) => (
            <ContactRequestCard
              key={request.id}
              request={request}
              onAccept={() => handleAcceptRequest(request.id)}
              onReject={() => handleRejectRequest(request.id)}
            />
          ))}
        </View>
      ) : null}

      {pendingOutgoingRequests.length > 0 ? (
        <View style={styles.requestColumn}>
          <View style={styles.requestSectionTitleRow}>
            <Text style={styles.requestSectionTitle}>Codsi La Diray</Text>
            <Text style={styles.requestSectionHint}>{pendingOutgoingRequests.length} pending</Text>
          </View>

          {pendingOutgoingRequests.map((request) => (
            <ContactRequestCard
              key={request.id}
              request={request}
              onCancel={() => handleCancelRequest(request)}
            />
          ))}
        </View>
      ) : null}
    </View>
  ) : null;

  function AddContactCard() {
    return (
      <TouchableOpacity style={styles.addCard} onPress={() => setModalVisible(true)}>
        <View style={styles.addIcon}>
          <Ionicons name="person-add-outline" size={28} color={Colors.onSurfaceVariant} />
        </View>
        <Text style={styles.addTitle}>Dirso Codsi</Text>
        <Text style={styles.addSubtitle}>Sawir Qr Code ama gacanta ku qor si laguugu diro codsi saxiibtinimo</Text>
      </TouchableOpacity>
    );
  }

  return (
    <WebSidebarLayout activeRoute="/(tabs)/dadka">
      <View style={styles.screenBg}>
        {!isWeb && (
          <SafeAreaView style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0 }}>
            <MadaxaMobilka 
              ciwaan="Dhambaal"
              isSearching={isSearching} 
              setIsSearching={setIsSearching} 
              searchText={search} 
              setSearchText={setSearch} 
              placeholder="Raadi dadka..."
            />
          </SafeAreaView>
        )}

        <View style={styles.content}>
          <View style={styles.pageHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pageTitle}>Dadka</Text>
              <Text style={styles.pageSubtitle}>
                {pendingIncomingRequests.length > 0
                  ? `${pendingIncomingRequests.length} request(s) waiting for your review`
                  : isWeb ? 'Your decentralized P2P network contacts.' : 'Maamul xiriiradaada P2P'}
              </Text>
            </View>
            {isWeb && (
              <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
                <View style={{ width: 240 }}>
                  <SearchBar placeholder="Raadi dadka..." value={search} onChangeText={setSearch} />
                </View>
                <TouchableOpacity style={styles.filterIconBtn}>
                  <Ionicons name="settings-outline" size={18} color={Colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {!isWeb && (
            <View style={styles.mobileControls}>
              <View style={styles.filterRow}>
                {(['dhamaan', 'jooge', 'maqane'] as Filter[]).map((f) => (
                  <TouchableOpacity
                     key={f}
                     style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
                     onPress={() => setFilter(f)}
                  >
                    <Text style={[styles.filterLabel, filter === f && styles.filterLabelActive]}>
                      {f === 'dhamaan' ? 'Dhamaan' : f === 'jooge' ? 'Jooge' : f === 'maqane' ? 'Maqane' : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {isWeb ? (
            <FlatList
              data={[...filtered, { id: '_add', name: '',  shortId: '' } as Contact]}
              keyExtractor={(c) => c.id}
              numColumns={4}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.webGrid}
              columnWrapperStyle={{ gap: Spacing.md }}
              ListHeaderComponent={requestSection}
              renderItem={({ item }) =>
                item.id === '_add' ? (
                  <AddContactCard />
                ) : (
                  <View style={{ flex: 1 }}>
                    <ContactCard contact={item} variant="grid" onMessage={() => {
                      router.push({ pathname: '/(tabs)/fariimaha', params: { chatId: item.id } });
                    }} onCall={() => {}} onDelete={() => handleDeleteContact(item)} />
                  </View>
                )
              }
            />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(c) => c.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.mobileList}
              ListHeaderComponent={requestSection}
              renderItem={({ item }) => (
                <ContactCard contact={item} variant="list" onMessage={() => {
                  router.push(`/fariin/${item.id}`);
                }} onCall={() => {}} onDelete={() => handleDeleteContact(item)} />
              )}
            />
          )}
        </View>

        {/* Fixed Mobile FAB (Triggers Modal state) */}
        {!isWeb && (
          <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
            <Ionicons name="create-outline" size={24} color={Colors.onPrimary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Slide-up Contact Modal (Now inside the render tree properly) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeRequestModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            
            <View style={styles.handleBar} />

            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Ku Dar Qof</Text>
              <TouchableOpacity onPress={closeRequestModal}>
                <Text style={styles.closeText}>Jooji</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tabContainer}>
              <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'qr' && styles.activeTabButton]}
                onPress={() => setActiveTab('qr')}
              >
                <Text style={[styles.tabText, activeTab === 'qr' && styles.activeTabText]}>Khoodka DJ</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'manual' && styles.activeTabButton]}
                onPress={() => setActiveTab('manual')}
              >
                <Text style={[styles.tabText, activeTab === 'manual' && styles.activeTabText]}>KuQoris</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.contentContainer}>
              {activeTab === 'qr' ? (
                <View style={styles.scannerWrapper}>
                  {!permission?.granted ? (
                    <View style={styles.centerContainer}>
                      <Text style={styles.infoText}>Waxaa loo baahan yahay camerada si aan u sawiro qrcode-ka fadlan ii ogolaaw inaan isticmaalo</Text>
                      <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                        <Text style={styles.permissionBtnText}>Ma isticmaali karaa camerada</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <CameraView
                      style={styles.camera}
                      facing="back"
                      barcodeScannerSettings={SCAN_SETTINGS}
                      onBarcodeScanned={handleBarcodeScanned}
                    />
                  )}
                </View>
              ) : (
                <ScrollView style={styles.formWrapper} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                  <Text style={styles.label}>Person Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Gali magaca saaxiibkaa."
                    placeholderTextColor={Colors.onSurfaceVariant}
                    value={name}
                    onChangeText={setName}
                  />

                  <Text style={styles.label}>Public Key</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Gali halkan PUBLIC KEY-ga saaxiibkaa."
                    placeholderTextColor={Colors.onSurfaceVariant}
                    value={publicKey}
                    onChangeText={setPublicKey}
                    multiline
                    numberOfLines={3}
                  />

                  <Text style={styles.label}>Fariin Codsi ah</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Waxaad qortaa fariin gaaban si saxiibkaa u ogaado in uu codsigan uu ka yimid adiga iyo in kale"
                    placeholderTextColor={Colors.onSurfaceVariant}
                    value={requestMessage}
                    onChangeText={setRequestMessage}
                    multiline
                    numberOfLines={4}
                  />

                  <Text style={styles.helperText}>
                    Codsiga waxaa si toos ah loogu gudbin doona aalada saaxiibkaa marka xiriir toos ah oo P2P ah la heli karo.
                  </Text>

                  <TouchableOpacity
                    style={[styles.submitButton, isSendingRequest && { opacity: 0.7 }]}
                    onPress={handleSendContactRequest}
                    disabled={isSendingRequest}
                  >
                    <Text style={styles.submitButtonText}>
                      {isSendingRequest ? 'Diraya...' : 'Dir Codsiga'}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </WebSidebarLayout>
  );
}
