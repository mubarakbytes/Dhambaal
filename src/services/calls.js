// Faylkani wuxuu mas'uul ka yahay maaraynta wicitaanada ku kaydsan aaladda (Call History).
// Waxay ku kaydinaysaa GunDB iyo AsyncStorage si ay u helaan taariikh dhab ah oo ammaan ah.

import { gun, getStoredCalls, addCallToDatabase } from './storage';
import { listenToContacts } from './contacts';

/**
 * Waxay ku dartaa wicitaan cusub taariikhda wicitaanada.
 * @param {string} contactPubKey - Furaha guud ee saaxiibka lala hadlay.
 * @param {'incoming' | 'outgoing' | 'missed'} type - Nooca wicitaanka.
 */
export const addCallRecord = async (contactPubKey, type) => {
  if (!contactPubKey || !type) return;

  const callId = Date.now().toString() + '_' + Math.random().toString(36).substring(7);
  const callRecord = {
    id: callId,
    contactId: contactPubKey,
    type: type,
    timestamp: new Date().toISOString()
  };

  await addCallToDatabase(callRecord);
  console.log(`[CALL SERVICE] Added call record: ${type} with ${contactPubKey}`);
};

/**
 * Waxay dhegeysataa taariikhda wicitaanada iyadoo la adeegsanayo callback si loogu cusbooneysiiyo UI-ga si toos ah.
 * @param {function} onCallsUpdate - Callback function oo la wacayo marka liisku isbeddelo.
 */
export const listenToCallHistory = (onCallsUpdate) => {
  const callsMap = {};
  const contactsMap = {};

  // Dhegeyso asxaabta si aan u helno magacyadooda dhabta ah
  const unsubscribeContacts = listenToContacts((contactsList) => {
    contactsList.forEach(contact => {
      contactsMap[contact.id] = contact;
    });
    rebuildCallList();
  });

  function rebuildCallList() {
    const rawCalls = Object.values(callsMap).filter(Boolean);
    
    // Haddii taariikhdu eber tahay, eber u celi
    if (rawCalls.length === 0) {
      onCallsUpdate([]);
      return;
    }

    const formattedCalls = rawCalls.map(call => {
      const contact = contactsMap[call.contactId];
      const name = contact ? contact.name : 'Unknown';
      const initials = name ? name.substring(0, 2).toUpperCase() : '?';

      // U qaabee waqtiga
      const date = new Date(call.timestamp);
      const now = new Date();
      
      const isToday = date.toDateString() === now.toDateString();
      
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const isYesterday = date.toDateString() === yesterday.toDateString();
      
      let timeStr = '';
      if (isToday) {
        timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (isYesterday) {
        timeStr = 'Shalay';
      } else {
        timeStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }

      return {
        id: call.id,
        contactId: call.contactId,
        name: name,
        type: call.type,
        time: timeStr,
        initials: initials
      };
    });

    // U kala sooc wicitaanada laga bilaabo kan ugu dambeeyay (timestamp)
    const sorted = formattedCalls.sort((a, b) => {
      const callA = rawCalls.find(c => c.id === a.id);
      const callB = rawCalls.find(c => c.id === b.id);
      return new Date(callB.timestamp).getTime() - new Date(callA.timestamp).getTime();
    });

    onCallsUpdate(sorted);
  };

  // 1. Load stored calls from AsyncStorage immediately as a quick cache
  getStoredCalls().then(stored => {
    if (stored.length > 0) {
      stored.forEach(call => {
        callsMap[call.id] = call;
      });
      rebuildCallList();
    }
  });

  // 2. Listen to updates in local GunDB
  gun.get('calls').map().on((callNode, key) => {
    if (callNode) {
      callsMap[key] = callNode;
      rebuildCallList();
    } else {
      delete callsMap[key];
      rebuildCallList();
    }
  });

  // Return unsubscribe cleanup function
  return () => {
    if (typeof unsubscribeContacts === 'function') {
      unsubscribeContacts();
    }
  };
};