// Faylkani wuxuu mas'uul ka yahay maaraynta asxaabta (contacts) ku kaydsan aaladda.
// Mid kasta wuxuu leeyahay Magac iyo Furaha Guud (Public Key).

import { 
  gun, 
  addContactToDatabase,
  removeContactFromDatabase,
  removeContactRequestsForPeer,
  getStoredContacts,
} from './storage';
import { clearPendingDirectMessagesForPeer, disconnectPeer } from './connection';

/**
 * Waxay ku dartaa saaxiib cusub liiska xiriirada.
 * @param {string} publicKey - Furaha guud ee saaxiibka (wuxuu u shaqeeyaa sidii ID/Username).
 * @param {string} displayName - Magaca loo bixiyay saaxiibka.
 */
export const addContact = async (publicKey, displayName) => {
  if (!publicKey || !displayName) {
    throw new Error('Fadlan geli furaha guud iyo magaca labadaba.');
  }

  const cleanPublicKey = publicKey.trim();
  const cleanName = displayName.trim();

  const newContact = {
    id: cleanPublicKey,
    name: cleanName,
    status: 'maqane', // Default to offline (maqane)
    initials: cleanName.substring(0, 2).toUpperCase(),
    shortId: cleanPublicKey.substring(0, 8) + '...'
  };

  // Ku kaydi disk-ga iyo GunDB adoo isticmaalaya storage helper-ka
  await addContactToDatabase(newContact);
  console.log(`[CONTACT SERVICE] Added/Updated saaxiib: ${cleanName}`);
};

/**
 * Waxay tirtirtaa contact-ka si nadiif ah.
 * Waxay sidoo kale tirtirtaa request-yada la xiriira oo xireysaa connection-ka hadda furan.
 */
export const removeContact = async (publicKey) => {
  if (!publicKey) {
    throw new Error('Public key is required to delete a contact.');
  }

  const cleanPublicKey = publicKey.trim();
  if (!cleanPublicKey) {
    throw new Error('Public key is required to delete a contact.');
  }

  try {
    await removeContactRequestsForPeer(cleanPublicKey);
    await clearPendingDirectMessagesForPeer(cleanPublicKey);
    await removeContactFromDatabase(cleanPublicKey);
    disconnectPeer(cleanPublicKey);
    console.log(`[CONTACT SERVICE] Removed saaxiib: ${cleanPublicKey}`);
  } catch (error) {
    console.error('Error removing contact:', error);
    throw error;
  }
};

/**
 * Waxay keenaysaa liiska asxaabta iyadoo la adeegsanayo callback si loogu cusbooneysiiyo UI-ga si toos ah.
 * @param {function} onContactsUpdate - Callback function oo la wacayo marka liisku isbeddelo.
 */
export const listenToContacts = (onContactsUpdate) => {
  const contactsMap = {};

  // Immediately load cached contacts to prevent empty screen
  getStoredContacts().then((stored) => {
    if (stored && stored.length > 0) {
      stored.forEach((c) => {
        if (!contactsMap[c.id]) {
          contactsMap[c.id] = c;
        }
      });
      onContactsUpdate(Object.values(contactsMap).filter((contact) => contact && !contact.deleted));
    }
  }).catch(console.error);

  const listener = gun.get('contacts').map();

  listener.on((contactNode, key) => {
    if (contactNode && !contactNode.deleted) {
      contactsMap[key] = contactNode;
    } else {
      delete contactsMap[key];
    }

    onContactsUpdate(
      Object.values(contactsMap).filter((contact) => contact && !contact.deleted)
    );
  });

  return () => {
    listener.off();
  };
};
