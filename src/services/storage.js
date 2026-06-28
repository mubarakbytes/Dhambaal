import './polyfills';
// Faylkan wuxuu maamulayaa kaydinta maxalliga ah (local storage).
// Waxaan u adeegsaneynaa GunDB oo local-only ah si uu UI-gu u noqdo mid reactive ah.
// Sidoo kale waxaan u isticmaaleynaa AsyncStorage si aan u backup-gareyno xogta (Persistence).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import Gun from 'gun/gun';
import 'gun/sea';

// 1. Initialize local GunDB without peers (Fully offline, local-only database for chats/contacts)
export const gun = Gun();

// AsyncStorage Keys
const CONTACTS_STORAGE_KEY = 'rdhambaal_contacts_list';
const CONTACT_REQUESTS_STORAGE_KEY = 'rdhambaal_contact_requests_list';
const MESSAGES_STORAGE_KEY = 'rdhambaal_messages_list';
const CALLS_STORAGE_KEY = 'rdhambaal_calls_list';

// ==================== CONTACTS STORAGE HANDLERS ==================== //

/**
 * Waxay ka soo aqrisaa furaha guud (Public Key) local storage,
 * iyadoo iska hubinaysa in aysan ku jirin qigalyo (JSON quotes).
 */
export const getCleanPublicKey = async () => {
  const rawKey = await AsyncStorage.getItem('PUBLICK_KEY');
  if (!rawKey) return null;
  try {
    const parsed = JSON.parse(rawKey);
    return typeof parsed === 'string' ? parsed.trim() : String(parsed).trim();
  } catch {
    return String(rawKey).trim();
  }
};

let isStartupResetDone = false;

/**
 * Waxay soo celisaa magaca adeegaha ee ku kaydsan local storage.
 */
export const getStoredContacts = async () => {
  try {
    const rawData = await AsyncStorage.getItem(CONTACTS_STORAGE_KEY);
    const parsed = rawData ? JSON.parse(rawData) : [];
    
    let hasChanges = false;
    const cleaned = parsed.map(c => {
      const cleanId = c.id ? String(c.id).replace(/^"|"$/g, '').trim() : c.id;
      
      let status = c.status || 'maqane';
      // Reset status to 'maqane' only on the very first read (app startup)
      if (!isStartupResetDone && status !== 'maqane') {
        status = 'maqane';
        hasChanges = true;
      }
      
      return {
        ...c,
        id: cleanId,
        status
      };
    });

    if (!isStartupResetDone) {
      isStartupResetDone = true;
      if (hasChanges) {
        // Write the reset statuses back to storage asynchronously
        AsyncStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(cleaned)).catch(err => {
          console.error('Error persisting reset contact statuses to storage:', err);
        });
      }
    }

    return cleaned;
  } catch (error) {
    console.error('Error fetching contacts from storage:', error);
    return [];
  }
};

/**
 * Waxay ku kaydisaa dhammaan xiriirada (contacts) AsyncStorage-ka.
 */
export const saveContactList = async (contactsList) => {
  try {
    await AsyncStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contactsList));
  } catch (error) {
    console.error('Error saving contacts to storage:', error);
  }
};

/**
 * Waxay ku dartaa saaxiib cusub AsyncStorage iyo GunDB.
 */
export const addContactToDatabase = async (contact) => {
  try {
    const contacts = await getStoredContacts();
    const index = contacts.findIndex(c => c.id === contact.id);
    
    if (index >= 0) {
      contacts[index] = { ...contacts[index], ...contact, deleted: false, deletedAt: null };
    } else {
      contacts.push({ ...contact, deleted: false, deletedAt: null });
    }
    
    await saveContactList(contacts);
    gun.get('contacts').get(contact.id).put({ ...contact, deleted: false, deletedAt: null });
  } catch (error) {
    console.error('Error adding contact to database:', error);
  }
};

/**
 * Waxay cusbooneysiisaa qeybo ka mid ah xogta saaxiib (tusaale: status ama magaca).
 */
export const updateContactInDatabase = async (publicKey, updates) => {
  try {
    const contacts = await getStoredContacts();
    const index = contacts.findIndex(c => c.id === publicKey);
    
    if (index >= 0) {
      contacts[index] = { ...contacts[index], ...updates };
      await saveContactList(contacts);
      
      // Cusbooneysii GunDB KALIYA haddii contact-gu jiro (si looga hortago ghost contacts)
      gun.get('contacts').get(publicKey).put(updates);
    }
  } catch (error) {
    console.error('Error updating contact in database:', error);
  }
};

/**
 * Waxay tirtirtaa contact-ka local storage iyo GunDB tombstone.
 */
export const removeContactFromDatabase = async (publicKey) => {
  try {
    const contacts = await getStoredContacts();
    const nextContacts = contacts.filter(contact => contact.id !== publicKey);
    await saveContactList(nextContacts);

    const now = new Date().toISOString();
    gun.get('contacts').get(publicKey).put({
      id: publicKey,
      deleted: true,
      deletedAt: now,
    });
  } catch (error) {
    console.error('Error removing contact from database:', error);
  }
};

// ==================== CONTACT REQUESTS STORAGE HANDLERS ==================== //

/**
 * Waxay ka soo aqrisaa dhammaan codsiyada xiriirka (contact requests) AsyncStorage-ka.
 */
export const getStoredContactRequests = async () => {
  try {
    const rawData = await AsyncStorage.getItem(CONTACT_REQUESTS_STORAGE_KEY);
    return rawData ? JSON.parse(rawData) : [];
  } catch (error) {
    console.error('Error fetching contact requests from storage:', error);
    return [];
  }
};

/**
 * Waxay ku kaydisaa dhammaan codsiyada xiriirka (contact requests) AsyncStorage-ka.
 */
export const saveContactRequestList = async (requestsList) => {
  try {
    await AsyncStorage.setItem(CONTACT_REQUESTS_STORAGE_KEY, JSON.stringify(requestsList));
  } catch (error) {
    console.error('Error saving contact requests to storage:', error);
  }
};

/**
 * Waxay ku dartaa ama cusbooneysiisaa request cusub AsyncStorage iyo GunDB.
 */
export const addContactRequestToDatabase = async (contactRequest) => {
  try {
    const requests = await getStoredContactRequests();
    const index = requests.findIndex(request => request.id === contactRequest.id);

    if (index >= 0) {
      requests[index] = { ...requests[index], ...contactRequest };
    } else {
      requests.push(contactRequest);
    }

    await saveContactRequestList(requests);
    gun.get('contactRequests').get(contactRequest.id).put(contactRequest);
  } catch (error) {
    console.error('Error adding contact request to database:', error);
  }
};

/**
 * Waxay cusbooneysiisaa request gaar ah (tusaale: pending -> accepted).
 */
export const updateContactRequestInDatabase = async (requestId, updates) => {
  try {
    const requests = await getStoredContactRequests();
    const index = requests.findIndex(request => request.id === requestId);

    if (index >= 0) {
      requests[index] = { ...requests[index], ...updates };
      await saveContactRequestList(requests);
    }

    gun.get('contactRequests').get(requestId).put(updates);
  } catch (error) {
    console.error('Error updating contact request in database:', error);
  }
};

/**
 * Waxay tirtirtaa request gaar ah AsyncStorage iyo GunDB.
 */
export const removeContactRequestFromDatabase = async (requestId) => {
  try {
    const requests = await getStoredContactRequests();
    const nextRequests = requests.filter(request => request.id !== requestId);
    await saveContactRequestList(nextRequests);

    gun.get('contactRequests').get(requestId).put(null);
  } catch (error) {
    console.error('Error removing contact request from database:', error);
  }
};

/**
 * Waxay tirtirtaa request-yada la xiriira public key gaar ah.
 */
export const removeContactRequestsForPeer = async (publicKey) => {
  try {
    const requests = await getStoredContactRequests();
    const relatedRequests = requests.filter(
      request => request.senderId === publicKey || request.receiverId === publicKey
    );

    if (relatedRequests.length === 0) {
      return;
    }

    const nextRequests = requests.filter(
      request => request.senderId !== publicKey && request.receiverId !== publicKey
    );

    await saveContactRequestList(nextRequests);

    relatedRequests.forEach(request => {
      gun.get('contactRequests').get(request.id).put(null);
    });
  } catch (error) {
    console.error('Error removing contact requests for peer:', error);
  }
};

// ==================== MESSAGES STORAGE HANDLERS ==================== //

/**
 * Waxay ka soo aqrisaa dhammaan fariimaha (messages) AsyncStorage-ka.
 */
export const getStoredMessages = async () => {
  try {
    const rawData = await AsyncStorage.getItem(MESSAGES_STORAGE_KEY);
    return rawData ? JSON.parse(rawData) : [];
  } catch (error) {
    console.error('Error fetching messages from storage:', error);
    return [];
  }
};

/**
 * Waxay ku kaydisaa dhammaan fariimaha (messages) AsyncStorage-ka.
 */
export const saveMessageList = async (messagesList) => {
  try {
    await AsyncStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messagesList));
  } catch (error) {
    console.error('Error saving messages to storage:', error);
  }
};

/**
 * Waxay ku raadisaa fariin gaar ah id-keeda.
 */
export const getMessageById = async (msgId) => {
  try {
    const messages = await getStoredMessages();
    return messages.find(m => m.id === msgId) || null;
  } catch (e) {
    console.error('Error getting message by ID:', e);
    return null;
  }
};

/**
 * Waxay ku dartaa fariin cusub AsyncStorage iyo GunDB (iyadoo laga fogaanayo in fariimaha is dul saarmaan).
 */
let messageMutationChain = Promise.resolve();

export const addMessageToDatabase = async (newMessage) => {
  messageMutationChain = messageMutationChain.then(async () => {
    try {
      const messages = await getStoredMessages();
      const index = messages.findIndex(msg => msg.id === newMessage.id);
      
      if (index === -1) {
        messages.push(newMessage);
        await saveMessageList(messages);
        DeviceEventEmitter.emit('new_local_message', newMessage);
      } else {
        const oldMsg = messages[index];
        let hasChanges = false;
        
        for (const key in newMessage) {
          if (newMessage[key] !== undefined && newMessage[key] !== oldMsg[key]) {
            oldMsg[key] = newMessage[key];
            hasChanges = true;
          }
        }
        
        if (hasChanges) {
          await saveMessageList(messages);
          DeviceEventEmitter.emit('new_local_message', oldMsg);
        }
      }
      
      // Ku dar local GunDB
      gun.get('messages').get(newMessage.id).put(newMessage);
    } catch (error) {
      console.error('Error adding message to database:', error);
    }
  }).catch(e => console.error(e));
  return messageMutationChain;
};

// ==================== CALLS STORAGE HANDLERS ==================== //

/**
 * Waxay ka soo aqrisaa dhammaan wicitaanada AsyncStorage-ka.
 */
export const getStoredCalls = async () => {
  try {
    const rawData = await AsyncStorage.getItem(CALLS_STORAGE_KEY);
    return rawData ? JSON.parse(rawData) : [];
  } catch (error) {
    console.error('Error fetching calls from storage:', error);
    return [];
  }
};

/**
 * Waxay ku kaydisaa dhammaan wicitaanada AsyncStorage-ka.
 */
export const saveCallList = async (callsList) => {
  try {
    await AsyncStorage.setItem(CALLS_STORAGE_KEY, JSON.stringify(callsList));
  } catch (error) {
    console.error('Error saving calls to storage:', error);
  }
};

/**
 * Waxay ku dartaa wicitaan cusub AsyncStorage iyo GunDB.
 */
export const addCallToDatabase = async (newCall) => {
  try {
    const calls = await getStoredCalls();
    const exists = calls.some(c => c.id === newCall.id);
    
    if (!exists) {
      calls.push(newCall);
      await saveCallList(calls);
    }
    
    // Ku dar local GunDB
    gun.get('calls').get(newCall.id).put(newCall);
  } catch (error) {
    console.error('Error adding call to database:', error);
  }
};

// ==================== DATABASE HYDRATION ==================== //

/**
 * Waxaan ku shubeynaa xogta ku kaydsan AsyncStorage-ka gudaha GunDB marka abka la furo.
 */
export const hydrateDatabase = async () => {
  const contacts = await getStoredContacts();
  const contactRequests = await getStoredContactRequests();
  const messages = await getStoredMessages();
  const calls = await getStoredCalls();

  // Load contacts into Gun graph
  contacts.forEach(contact => {
    gun.get('contacts').get(contact.id).put(contact);
  });

  // Load contact requests into Gun graph
  contactRequests.forEach(request => {
    gun.get('contactRequests').get(request.id).put(request);
  });

  // Load messages into Gun graph
  messages.forEach(msg => {
    gun.get('messages').get(msg.id).put(msg);
    // Link to the specific chat room
    const roomId = [msg.senderId, msg.receiverId].sort().join('_');
    gun.get('rooms').get(roomId).get('messages').get(msg.id).put(msg);
  });

  // Load calls into Gun graph
  calls.forEach(call => {
    gun.get('calls').get(call.id).put(call);
  });

  console.log(`Database hydrated: Loaded ${contacts.length} contacts, ${contactRequests.length} contact requests, ${messages.length} messages, and ${calls.length} calls.`);
};

// Hydrate database immediately
hydrateDatabase();

/**
 * Gebi ahaanba wuxuu tirtiraa dhammaan xogta AsyncStorage iyo GunDB.
 */
export const wipeAllData = async () => {
  try {
    // 1. Get all stored items to nullify them in GunDB before we clear storage
    const contacts = await getStoredContacts();
    const contactRequests = await getStoredContactRequests();
    const messages = await getStoredMessages();
    const calls = await getStoredCalls();
    const myPubKey = await getCleanPublicKey();

    // 2. Clear AsyncStorage completely
    await AsyncStorage.clear();

    // 3. Nullify GunDB records so any active map/on UI listeners clear their state
    if (myPubKey) {
      contacts.forEach(c => {
        if (c && c.id) {
          const arr = [myPubKey, c.id].sort();
          const roomId = `${arr[0]}_${arr[1]}`;
          gun.get('rooms').get(roomId).put(null);
        }
      });
    }

    contacts.forEach(c => {
      if (c && c.id) {
        gun.get('contacts').get(c.id).put(null);
      }
    });

    contactRequests.forEach(r => {
      if (r && r.id) {
        gun.get('contactRequests').get(r.id).put(null);
      }
    });

    messages.forEach(m => {
      if (m && m.id) {
        gun.get('messages').get(m.id).put(null);
      }
    });

    calls.forEach(c => {
      if (c && c.id) {
        gun.get('calls').get(c.id).put(null);
      }
    });

    // Reset startup flag so next account hydration works correctly
    isStartupResetDone = false;

    console.log('[STORAGE] wipeAllData: AsyncStorage and GunDB cleared successfully.');
  } catch (error) {
    console.error('[STORAGE] Error in wipeAllData:', error);
  }
};
