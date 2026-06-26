// Faylkani wuxuu mas'uul ka yahay u dirista iyo helista fariimaha qoraalka ah.
// Waxay isku xiraysaa P2P connection-ka (WebRTC) iyo local storage-ka (GunDB).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState, DeviceEventEmitter } from 'react-native';

import * as MediaLibrary from 'expo-media-library/legacy';

// Safe Notifee Import
let notifee: any = null;
let AndroidImportance: any = { HIGH: 4 }; // Default value for safety
try {
  if (Platform.OS !== 'web') {
    const notifeeLib = require('@notifee/react-native');
    notifee = notifeeLib.default;
    if (notifeeLib.AndroidImportance) {
      AndroidImportance = notifeeLib.AndroidImportance;
    }
  }
} catch (e) {
  console.warn('[Messages] Notifee native module not found.');
}

import { gun, addMessageToDatabase, getCleanPublicKey, getStoredContacts, getStoredMessages } from './storage';
import { sendMessageDirect, registerOnMessageReceived } from './connection';
import { saveBase64ToFile } from './voiceNotes';
import * as voiceStorage from './voiceStorage';
import { receiveFileChunk, saveFileToDisk } from './fileSharing';

/**
 * Waxay abuurtaa ID u gaar ah qolka wada hadalka ee labada qof.
 */
export const getChatRoomId = (pubKey1, pubKey2) => {
  return [pubKey1, pubKey2].sort().join('_');
};

/**
 * Waxay u dirtaa fariin qoraal ah saaxiibka.
 * 1. Waxay ku kaydisaa fariinta disk-keena (Offline Storage).
 * 2. Waxay u dirtaa saaxiibka si toos ah iyadoo loo marayo WebRTC.
 * @param {string} friendPubKey - Furaha guud ee saaxiibka.
 * @param {string} text - Qoraalka fariinta.
 */
export const sendMessage = async (friendPubKey, text) => {
  const myPubKey = await getCleanPublicKey();
  if (!myPubKey) return;

  const msgId = Date.now().toString() + '_' + Math.random().toString(36).substring(7);
  const messageData = {
    id: msgId,
    senderId: myPubKey,
    receiverId: friendPubKey,
    content: text.trim(),
    timestamp: new Date().toISOString(),
    type: 'text',
    messageType: 'chat'
  };

  // 1. Save locally to our GunDB and AsyncStorage
  await addMessageToDatabase(messageData);

  // Also link the message to the room in GunDB
  const roomId = getChatRoomId(myPubKey, friendPubKey);
  gun.get('rooms').get(roomId).get('messages').get(msgId).put(messageData);

  const sentDirect = await sendMessageDirect(friendPubKey, JSON.stringify(messageData));
  if (sentDirect) {
    console.log(`[MESSAGE SERVICE] Sent message directly to ${friendPubKey}`);
    // Update local storage to show double ticks!
    messageData.status = 'sent';
    gun.get('messages').get(msgId).put({ status: 'sent' });
    gun.get('rooms').get(roomId).get('messages').get(msgId).put({ status: 'sent' });
  } else {
    console.log(`[MESSAGE SERVICE] Message saved locally. WebRTC connection pending...`);
  }
};

/**
 * Waxay u dirtaa fariin cod ah (Voice Note) saaxiibka.
 */
export const sendVoiceNote = async (friendPubKey, audioBase64, duration, mimeType = 'audio/m4a') => {
  const myPubKey = await getCleanPublicKey();
  if (!myPubKey || !audioBase64) return;

  const msgId = Date.now().toString() + '_' + Math.random().toString(36).substring(7);
  const isWeb = Platform.OS === 'web';

  // Store audio data separately (never in GunDB)
  if (isWeb) {
    voiceStorage.storeVoiceAudio(msgId, audioBase64);
    voiceStorage.storeVoiceMimeType(msgId, mimeType);
  }

  const messageData = {
    id: msgId,
    senderId: myPubKey,
    receiverId: friendPubKey,
    content: '',
    timestamp: new Date().toISOString(),
    type: 'voice',
    messageType: 'chat',
    // All fields flat — GunDB handles simple key-value reliably
    voiceNoteDuration: duration,
    voiceNoteMsgId: msgId,
    voiceNoteAudioUri: isWeb ? null : await saveBase64ToFile(audioBase64, msgId),
    audioMimeType: mimeType,
  };

  // Save clean message (no base64) to local storage
  await addMessageToDatabase(messageData);

  // Link to room
  const roomId = getChatRoomId(myPubKey, friendPubKey);
  gun.get('rooms').get(roomId).get('messages').get(msgId).put(messageData);

  // Send full payload (with base64) over WebRTC
  const fullPayload = { ...messageData, audioData: audioBase64 };
  const sentDirect = await sendMessageDirect(friendPubKey, JSON.stringify(fullPayload));

  if (sentDirect) {
    console.log('[MESSAGE SERVICE] Voice note sent directly to', friendPubKey);
    messageData.status = 'sent';
    gun.get('messages').get(msgId).put({ status: 'sent' });
    gun.get('rooms').get(roomId).get('messages').get(msgId).put({ status: 'sent' });
  } else {
    console.log('[MESSAGE SERVICE] Voice note saved locally. WebRTC pending...');
  }
};

/**
 * Waxay u dirtaa fariin fayl ah saaxiibka.
 */
export const sendFileMessage = async (friendPubKey, base64Data, fileName, mimeType, fileSize) => {
  const myPubKey = await getCleanPublicKey();
  if (!myPubKey || !base64Data) return;

  const msgId = Date.now().toString() + '_' + Math.random().toString(36).substring(7);
  const isWeb = Platform.OS === 'web';

  // Extract base64 safely if it has a data URI prefix
  const rawBase64 = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data;

  if (isWeb) {
    await voiceStorage.storeVoiceAudioAsync(msgId, rawBase64); // use AsyncStorage for files
    voiceStorage.storeVoiceMimeType(msgId, mimeType);
  }

  const messageData = {
    id: msgId,
    senderId: myPubKey,
    receiverId: friendPubKey,
    content: '',
    timestamp: new Date().toISOString(),
    type: 'file',
    messageType: 'chat',
    fileName: fileName,
    fileMimeType: mimeType,
    fileSize: fileSize,
    fileUri: isWeb ? null : await saveFileToDisk(rawBase64, fileName),
  };

  // Save clean message to GunDB
  await addMessageToDatabase(messageData);
  const roomId = getChatRoomId(myPubKey, friendPubKey);
  gun.get('rooms').get(roomId).get('messages').get(msgId).put(messageData);

  // Send metadata over WebRTC
  const sentDirect = await sendMessageDirect(friendPubKey, JSON.stringify(messageData));
  
  if (sentDirect) {
    // Start sending chunks in background
    import('./fileSharing').then(fs => fs.sendFileP2P(friendPubKey, msgId, rawBase64));
    
    messageData.status = 'sent';
    gun.get('messages').get(msgId).put({ status: 'sent' });
    gun.get('rooms').get(roomId).get('messages').get(msgId).put({ status: 'sent' });
  } else {
    console.log('[MESSAGE SERVICE] File saved locally. WebRTC pending...');
  }
};

/**
 * Waxay tirtirtaa fariin (Delete for Everyone).
 */
export const deleteMessage = async (friendPubKey, msgId) => {
  const myPubKey = await getCleanPublicKey();
  
  // 1. Delete locally from GunDB
  const deletedData = { content: 'Waa la tirtiray', isDeleted: true, type: 'text', status: 'deleted' };
  
  gun.get('messages').get(msgId).put(deletedData);
  const roomId = getChatRoomId(myPubKey, friendPubKey);
  gun.get('rooms').get(roomId).get('messages').get(msgId).put(deletedData);

  if (Platform.OS === 'web') voiceStorage.deleteVoiceAudio(msgId);

  // 2. Send delete signal to peer
  const payload = {
    type: 'delete-message',
    messageType: 'chat',
    id: msgId,
    senderId: myPubKey,
    receiverId: friendPubKey,
  };
  
  sendMessageDirect(friendPubKey, JSON.stringify(payload));
};

/**
 * Waxay dhegeysataa fariimaha cusub ee ku soo dhacaya qolka wadahadalka (Chat Room).
 * @param {string} friendPubKey - Furaha guud ee saaxiibka.
 * @param {function} onMessagesUpdate - Callback function oo la wacayo marka fariin cusub ku soo dhacdo qolka.
 */
export const listenToMessages = async (friendPubKey, onMessagesUpdate) => {
  const myPubKey = await getCleanPublicKey();
  if (!myPubKey) return;

  const messagesMap = {};

  // 1. Initial Load: Si degdeg ah uga soo akhri AsyncStorage (Xogta buuxda ee hore)
  try {
    const allStored = await getStoredMessages();
    const relevantStored = allStored.filter(msgNode => 
      (msgNode.senderId === myPubKey && msgNode.receiverId === friendPubKey) ||
      (msgNode.senderId === friendPubKey && msgNode.receiverId === myPubKey)
    );
    
    relevantStored.forEach(m => { messagesMap[m.id] = m; });
    
    const initialList = Object.values(messagesMap)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    if (initialList.length > 0) {
      onMessagesUpdate(initialList);
    }
  } catch (e) {
    console.error('Error loading initial messages:', e);
  }

  // 2. Dhegeyso fariimaha cusub ama isbedelada (status) ee ku dhacaya GunDB
  const gunListener = gun.get('messages').map().on((msgNode, key) => {
    if (msgNode && (!msgNode.messageType || msgNode.messageType === 'chat')) {
      const isRelevant = 
        (msgNode.senderId === myPubKey && msgNode.receiverId === friendPubKey) ||
        (msgNode.senderId === friendPubKey && msgNode.receiverId === myPubKey);

      if (isRelevant) {
        // Clean voice message: strip audioData before storing in memory
        const cleanMsg = { ...msgNode };
        if (cleanMsg.type === 'voice' && cleanMsg.audioData) {
          delete cleanMsg.audioData;
        }
        messagesMap[key] = cleanMsg;
        const list = Object.values(messagesMap)
          .filter(Boolean)
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        onMessagesUpdate(list);
      }
    }
  });

  const localMsgListener = DeviceEventEmitter.addListener('new_local_message', (msg) => {
    const isRelevant = 
      (msg.senderId === myPubKey && msg.receiverId === friendPubKey) ||
      (msg.senderId === friendPubKey && msg.receiverId === myPubKey);
    if (isRelevant) {
      messagesMap[msg.id] = msg;
      const list = Object.values(messagesMap)
        .filter(Boolean)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      onMessagesUpdate(list);
    }
  });

  // Return cleanup function so callers can unsubscribe
  return () => {
    gunListener.off();
    localMsgListener.remove();
  };
};

/**
 * Waxay dhegeysataa dhammaan wada-sheekaysiyada firfircoon.
 * @param {function} onChatsUpdate - Callback function oo la wacayo marka liiska sheekooyinku isbeddelo.
 */
export const listenToActiveChats = (onChatsUpdate) => {
  const contactsMap = {};
  const messagesMap = {};

  const rebuildChatList = async () => {
    try {
      const myPubKey = await getCleanPublicKey();
      if (!myPubKey) return;

      const contactList = Object.values(contactsMap).filter((contact) => contact && !contact.deleted);
      const messageList = Object.values(messagesMap).filter(Boolean).filter(m => !m.messageType || m.messageType === 'chat');

      const activeChats = contactList.map(contact => {
        // Filter fariimaha dhexmaray aniga iyo saaxiibka
        const contactMessages = messageList.filter(
          m => (m.senderId === myPubKey && m.receiverId === contact.id) ||
               (m.senderId === contact.id && m.receiverId === myPubKey)
        ).sort((a, b) => {
          const tA = new Date(a.timestamp).getTime();
          const tB = new Date(b.timestamp).getTime();
          return (tA || 0) - (tB || 0);
        });

        const lastMsg = contactMessages[contactMessages.length - 1];
        return {
          id: contact.id,
          name: contact.name,
          lastMessage: lastMsg ? (lastMsg.type === 'voice' ? '🎤 Fariin Cod ah' : lastMsg.content) : 'Diyaar u ah sheeko',
          time: lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          status: contact.status || 'maqane',
          unread: 0,
          isGroup: false,
          initials: contact.initials
        };
      }).filter(Boolean);

      // Kala sooc wada-sheekaysiyada (kan ugu dambeeyay xagga sare)
      activeChats.sort((a, b) => {
        const getSafeTime = (chatId) => {
          const msgs = messageList.filter(m => (m.senderId === myPubKey && m.receiverId === chatId) || (m.senderId === chatId && m.receiverId === myPubKey));
          if (msgs.length === 0) return 0;
          msgs.sort((x, y) => {
            const tX = new Date(x.timestamp).getTime();
            const tY = new Date(y.timestamp).getTime();
            return (tX || 0) - (tY || 0);
          });
          return new Date(msgs[msgs.length - 1].timestamp).getTime() || 0;
        };
        const timeA = getSafeTime(a.id);
        const timeB = getSafeTime(b.id);
        return timeB - timeA || String(a.name).localeCompare(String(b.name));
      });

      onChatsUpdate(activeChats);
    } catch (e) {
      console.error('Error rebuilding active chats list:', e);
    }
  };

  // Immediately load cached data to prevent empty screen
  Promise.all([getStoredContacts(), getStoredMessages()]).then(([storedContacts, storedMessages]) => {
    let shouldRebuild = false;
    if (storedContacts && storedContacts.length > 0) {
      storedContacts.forEach(c => {
        if (!contactsMap[c.id]) contactsMap[c.id] = c;
      });
      shouldRebuild = true;
    }
    if (storedMessages && storedMessages.length > 0) {
      storedMessages.forEach(m => {
        if (!messagesMap[m.id]) messagesMap[m.id] = m;
      });
      shouldRebuild = true;
    }
    if (shouldRebuild) rebuildChatList();
  }).catch(console.error);

  // 1. Dhegeyso asxaabta
  gun.get('contacts').map().on((contactNode, key) => {
    if (contactNode) {
      if (contactNode.deleted) {
        delete contactsMap[key];
      } else {
        contactNode.id = contactNode.id || key;
        contactsMap[key] = {
          ...contactsMap[key],
          ...contactNode
        };
      }
      rebuildChatList();
    }
  });

  // 2. Dhegeyso fariimaha
  gun.get('messages').map().on((msgNode, key) => {
    if (msgNode && (!msgNode.messageType || msgNode.messageType === 'chat')) {
      messagesMap[key] = msgNode;
    } else {
      delete messagesMap[key];
    }
    rebuildChatList();
  });

  const localMsgListener = DeviceEventEmitter.addListener('new_local_message', (msg) => {
    if (msg && (!msg.messageType || msg.messageType === 'chat')) {
      messagesMap[msg.id] = msg;
      rebuildChatList();
    }
  });

  // Cleanup function oo hawada ka saaraya dhegeysiga (off)
  return () => {
    gun.get('contacts').map().off();
    gun.get('messages').map().off();
    localMsgListener.remove();
  };
};

// ==================== INCOMING MESSAGE LISTENER ==================== //

// Halkan waxaan ku diwaangelinaynaa dhageyste fariimaha tooska ah ee ka imaanaya WebRTC.
// Marka fariin WebRTC ah la soo helo, waxaa loo kaydinayaa si toos ah GunDB-keena maxalliga ah.
registerOnMessageReceived(async (senderPubKey, rawMessageText) => {
  try {
    const incomingMsg = JSON.parse(rawMessageText);

    if (incomingMsg.type === 'file-chunk') {
      const completeBase64 = receiveFileChunk(incomingMsg);
      if (completeBase64) {
        const msgId = incomingMsg.msgId;
        gun.get('messages').get(msgId).once(async (metaData) => {
          if (metaData) {
            let msgToSave = { ...metaData };
            const audioData = completeBase64;
            const audioMimeType = metaData.fileMimeType || 'application/octet-stream';

            if (Platform.OS === 'web') {
              await voiceStorage.storeVoiceAudioAsync(msgId, audioData);
              voiceStorage.storeVoiceMimeType(msgId, audioMimeType);
            }
            msgToSave.fileUri = Platform.OS === 'web' ? null : await saveFileToDisk(audioData, metaData.fileName);
            msgToSave.status = 'received';

            // Auto-save image to Gallery
            if (Platform.OS !== 'web' && audioMimeType.startsWith('image/')) {
              try {
                const permission = await MediaLibrary.requestPermissionsAsync();
                if (permission.granted && msgToSave.fileUri) {
                  await MediaLibrary.saveToLibraryAsync(msgToSave.fileUri);
                }
              } catch (e) {
                console.error('[Gallery] Failed to save image:', e);
              }
            }

            await addMessageToDatabase(msgToSave);
            gun.get('messages').get(msgId).put(msgToSave);
            
            const myPubKey = await getCleanPublicKey();
            const roomId = getChatRoomId(myPubKey, senderPubKey);
            gun.get('rooms').get(roomId).get('messages').get(msgId).put(msgToSave);
          }
        });
      }
      return;
    }

    if (incomingMsg.type === 'delete-message') {
      const msgId = incomingMsg.id;
      const myPubKey = await getCleanPublicKey();
      const roomId = getChatRoomId(myPubKey, senderPubKey);
      
      const deletedData = { content: 'Waa la tirtiray', isDeleted: true, type: 'text', status: 'deleted' };
      
      gun.get('messages').get(msgId).put(deletedData);
      gun.get('rooms').get(roomId).get('messages').get(msgId).put(deletedData);
      
      if (Platform.OS === 'web') voiceStorage.deleteVoiceAudio(msgId);
      return;
    }

    if (incomingMsg?.messageType && incomingMsg.messageType !== 'chat') {
      return;
    }

    // Handle voice messages: extract audio data, store separately, save clean
    let msgToSave = { ...incomingMsg, messageType: 'chat' };

    if (incomingMsg.type === 'voice' && incomingMsg.audioData) {
      const audioData = incomingMsg.audioData;
      const audioMimeType = incomingMsg.audioMimeType || 'audio/m4a';
      delete msgToSave.audioData;

      if (Platform.OS === 'web') {
        voiceStorage.storeVoiceAudio(msgToSave.id, audioData);
        voiceStorage.storeVoiceMimeType(msgToSave.id, audioMimeType);
      }

      // Overwrite with flat fields
      msgToSave.voiceNoteDuration = incomingMsg.voiceNoteDuration || incomingMsg.voiceNote?.duration || '0:00';
      msgToSave.voiceNoteMsgId = msgToSave.id;
      msgToSave.voiceNoteAudioUri = Platform.OS === 'web' ? null : await saveBase64ToFile(audioData, msgToSave.id);
      msgToSave.audioMimeType = audioMimeType;
    }

    // 1. Save clean message (no base64 audio) to offline storage
    await addMessageToDatabase(msgToSave);

    // 2. Tusi ogeysiis (Push Notification) haddii uusan qofku ku dhex jirin chat-kaas
    const isInChat = AppState.currentState === 'active' && global.currentChatId === senderPubKey;
    
    if (!isInChat && notifee) {
      console.log(`[NOTIFICATIONS] 🔔 App is in background or not in chat! Triggering Local Notification for message from ${senderPubKey}`);
      const contactsList = await getStoredContacts();
      const sender = contactsList.find(c => c.id === senderPubKey);
      const senderName = sender?.name || 'Saaxiib Cusub';

      try {
        const channelId = await notifee.createChannel({
          id: 'fariimo_dhambaal_v2', // Changed to force Android to create a NEW high-priority channel
          name: 'Fariimaha Cusub ee Dhambaal',
          sound: 'default',
          importance: AndroidImportance.HIGH,
        });

        await notifee.displayNotification({
          title: senderName,
          body: incomingMsg.content || (incomingMsg.type === 'voice' ? '🎤 Fariin Cod ah' : 'Fariin cusub'),
          android: {
            channelId,
            smallIcon: 'ic_launcher', // Required for some Android OS versions to show heads-up
            pressAction: {
              id: 'default',
            },
          },
        });
      } catch (err) {
        console.warn('[Messages] Failed to display notification:', err);
      }
    }

    // 3. Link to the specific chat room
    const myPubKey = await getCleanPublicKey();
    if (myPubKey) {
      const roomId = getChatRoomId(myPubKey, senderPubKey);
      gun.get('rooms').get(roomId).get('messages').get(msgToSave.id).put(msgToSave);
    }
    console.log(`[MESSAGE SERVICE] Processed incoming message from ${senderPubKey}`);
  } catch (err) {
    console.error('Error handling incoming WebRTC message:', err);
  }
});
