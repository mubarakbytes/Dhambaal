import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

import { addContact } from './contacts';
import {
  addContactRequestToDatabase,
  gun,
  getStoredContactRequests,
  getStoredContacts,
  removeContactRequestFromDatabase,
  updateContactRequestInDatabase,
  getCleanPublicKey,
} from './storage';
import {
  registerOnMessageReceived,
  removePendingDirectMessageForRequest,
  sendMessageDirect,
} from './connection';

export type ContactRequestDirection = 'incoming' | 'outgoing';
export type ContactRequestStatus = 'pending' | 'accepted' | 'rejected';
export type ContactRequestTransportType =
  | 'contact-request'
  | 'contact-request-response'
  | 'contact-request-cancel';

export interface ContactRequest {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName?: string;
  note: string;
  direction: ContactRequestDirection;
  status: ContactRequestStatus;
  createdAt: string;
  updatedAt: string;
  respondedAt?: string;
  responderId?: string;
  responderName?: string;
  transportType?: ContactRequestTransportType;
}

interface RequestEnvelope {
  messageType?: ContactRequestTransportType;
  request?: ContactRequest;
  requestId?: string;
  status?: ContactRequestStatus;
  fromPublicKey?: string;
  fromDisplayName?: string;
  toPublicKey?: string;
  timestamp?: string;
  senderId?: string;
  receiverId?: string;
  senderName?: string;
  receiverName?: string;
  note?: string;
  id?: string;
}

interface SendContactRequestResult {
  request: ContactRequest;
  delivered: boolean;
}

interface ContactRequestActionResult {
  request: ContactRequest;
  delivered: boolean;
}

const REQUEST_ALERT_TITLE = 'Codsi Xiriir Cusub';
const RESPONSE_ALERT_TITLE = 'Jawaabta Codsiga';
const notifiedIncomingRequestIds = new Set<string>();
const notifiedResponseRequestIds = new Set<string>();

const generateUniqueRequestId = () => {
  return `request_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const readStoredPublicKey = async () => {
  return await getCleanPublicKey() || '';
};

const readStoredDisplayName = async () => {
  const displayName = await AsyncStorage.getItem('DISPLAY_NAME');
  return displayName?.trim() || 'Isticmaale';
};

const normalizeText = (value?: string) => value?.trim() || '';

const sortRequestsByNewest = (requests: ContactRequest[]) => {
  return [...requests].sort((left, right) => {
    const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
};

/**
 * Waxay soo dirtaa contact request cusub iyadoo direct P2P loo marayo haddii ay suurtagal tahay.
 */
export const sendContactRequest = async (
  receiverPubKey: string,
  note: string,
  receiverName?: string
): Promise<SendContactRequestResult> => {
  const myPublicKey = await readStoredPublicKey();
  const myDisplayName = await readStoredDisplayName();
  const cleanReceiverPubKey = normalizeText(receiverPubKey);
  const cleanNote = normalizeText(note) || 'Salaamu calaykum, waxaan jeclaan lahaa inaan kula xiriiro.';
  const cleanReceiverName = normalizeText(receiverName);

  if (!myPublicKey) {
    throw new Error('Your public key is missing.');
  }

  if (!cleanReceiverPubKey) {
    throw new Error('Receiver public key is required.');
  }

  if (cleanReceiverPubKey === myPublicKey) {
    throw new Error('You cannot send a request to yourself.');
  }

  const storedContacts = await getStoredContacts();
  const alreadyConnected = storedContacts.some(contact => contact.id === cleanReceiverPubKey);
  if (alreadyConnected) {
    throw new Error('This person is already in your contacts.');
  }

  const storedRequests = await getStoredContactRequests();
  const existingOutgoingRequest = storedRequests.find(
    request =>
      request.direction === 'outgoing' &&
      request.receiverId === cleanReceiverPubKey &&
      request.status === 'pending'
  );

  const now = new Date().toISOString();
  const request: ContactRequest = existingOutgoingRequest
    ? {
        ...existingOutgoingRequest,
        note: cleanNote,
        receiverName: cleanReceiverName || existingOutgoingRequest.receiverName,
        updatedAt: now,
        transportType: 'contact-request',
      }
    : {
        id: generateUniqueRequestId(),
        senderId: myPublicKey,
        senderName: myDisplayName,
        receiverId: cleanReceiverPubKey,
        receiverName: cleanReceiverName || undefined,
        note: cleanNote,
        direction: 'outgoing',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        transportType: 'contact-request',
      };

  await addContactRequestToDatabase(request);

  const delivered = await sendMessageDirect(
    cleanReceiverPubKey,
    JSON.stringify({
      messageType: 'contact-request',
      request,
    })
  );

  console.log("[REQUEST SENT]", {
    delivered,
    receiver: cleanReceiverPubKey,
    requestId: request.id
  });

  return { request, delivered };
};

/**
 * Waxay aqbashaa request-ka, waxayna ku dartaa qofka cusub contacts-ka.
 */
export const acceptContactRequest = async (requestId: string): Promise<ContactRequestActionResult> => {
  const myPublicKey = await readStoredPublicKey();
  const myDisplayName = await readStoredDisplayName();
  const requests = await getStoredContactRequests();
  const request = requests.find(item => item.id === requestId);

  if (!request) {
    throw new Error('Request not found.');
  }

  const now = new Date().toISOString();
  const acceptedRequest: ContactRequest = {
    ...request,
    status: 'accepted',
    updatedAt: now,
    respondedAt: now,
    responderId: myPublicKey,
    responderName: myDisplayName,
    transportType: 'contact-request-response',
  };

  await addContact(request.senderId, request.senderName || request.senderId);
  await updateContactRequestInDatabase(requestId, acceptedRequest);

  const delivered = await sendMessageDirect(
    request.senderId,
    JSON.stringify({
      messageType: 'contact-request-response',
      requestId: request.id,
      status: 'accepted',
      fromPublicKey: myPublicKey,
      fromDisplayName: myDisplayName,
      toPublicKey: request.senderId,
      timestamp: now,
    })
  );

  return { request: acceptedRequest, delivered };
};

/**
 * Waxay diiddaa request-ka, waxayna qofka soo diray u dirtay jawaab toos ah.
 */
export const rejectContactRequest = async (requestId: string): Promise<ContactRequestActionResult> => {
  const myPublicKey = await readStoredPublicKey();
  const myDisplayName = await readStoredDisplayName();
  const requests = await getStoredContactRequests();
  const request = requests.find(item => item.id === requestId);

  if (!request) {
    throw new Error('Request not found.');
  }

  const now = new Date().toISOString();
  const rejectedRequest: ContactRequest = {
    ...request,
    status: 'rejected',
    updatedAt: now,
    respondedAt: now,
    responderId: myPublicKey,
    responderName: myDisplayName,
    transportType: 'contact-request-response',
  };

  await updateContactRequestInDatabase(requestId, rejectedRequest);

  const delivered = await sendMessageDirect(
    request.senderId,
    JSON.stringify({
      messageType: 'contact-request-response',
      requestId: request.id,
      status: 'rejected',
      fromPublicKey: myPublicKey,
      fromDisplayName: myDisplayName,
      toPublicKey: request.senderId,
      timestamp: now,
    })
  );

  return { request: rejectedRequest, delivered };
};

/**
 * Waxay joojisaa request-ka aad adigu dirtay.
 * Request-ku wuu ka baxayaa liiskaaga, waxaana loo diraa cancellation haddii suurtagal tahay.
 */
export const cancelContactRequest = async (requestId: string): Promise<ContactRequestActionResult> => {
  const myPublicKey = await readStoredPublicKey();
  const myDisplayName = await readStoredDisplayName();
  const requests = await getStoredContactRequests();
  const request = requests.find(item => item.id === requestId);

  if (!request) {
    throw new Error('Request not found.');
  }

  if (request.direction !== 'outgoing' || request.status !== 'pending') {
    throw new Error('Only pending outgoing requests can be cancelled.');
  }

  const now = new Date().toISOString();

  await removePendingDirectMessageForRequest(request.receiverId, request.id);
  await removeContactRequestFromDatabase(requestId);

  const delivered = await sendMessageDirect(
    request.receiverId,
    JSON.stringify({
      messageType: 'contact-request-cancel',
      requestId: request.id,
      fromPublicKey: myPublicKey,
      fromDisplayName: myDisplayName,
      toPublicKey: request.receiverId,
      timestamp: now,
    })
  );

  return { request, delivered };
};

/**
 * Waxay dhegeysataa request-yada ku jira kaydka maxalliga ah.
 */
export const listenToContactRequests = (onRequestsUpdate: (requests: ContactRequest[]) => void) => {
  const requestsMap: Record<string, ContactRequest> = {};
  const gunListener = gun.get('contactRequests').map();
  let isActive = true;

  const emitRequests = () => {
    const requestList = sortRequestsByNewest(Object.values(requestsMap).filter(Boolean));
    onRequestsUpdate(requestList);
  };

  getStoredContactRequests().then((storedRequests) => {
    if (!isActive) return;
    storedRequests.forEach((request: ContactRequest) => {
      requestsMap[request.id] = request;
    });
    emitRequests();
  });

  gunListener.on((requestNode: ContactRequest | null, requestId: string) => {
    if (requestNode) {
      requestsMap[requestId] = {
        ...(requestsMap[requestId] || {}),
        ...requestNode,
      };
    } else {
      delete requestsMap[requestId];
    }

    emitRequests();
  });

  return () => {
    isActive = false;
    gunListener.off();
  };
};

const handleIncomingContactRequest = async (envelope: RequestEnvelope) => {
  const myPublicKey = await readStoredPublicKey();
  if (!myPublicKey) return;

  const requestPayload = envelope.request || envelope;
  const requestId = requestPayload.id || envelope.requestId;
  const senderId = requestPayload.senderId || envelope.fromPublicKey;
  const receiverId = requestPayload.receiverId || envelope.toPublicKey;

  if (!requestId || !senderId || !receiverId) return;
  if (receiverId !== myPublicKey) return;

  const now = new Date().toISOString();
  const incomingRequest: ContactRequest = {
    id: requestId,
    senderId,
    senderName: normalizeText(requestPayload.senderName || envelope.fromDisplayName) || senderId,
    receiverId,
    receiverName: normalizeText(requestPayload.receiverName || envelope.receiverName) || undefined,
    note: normalizeText(requestPayload.note),
    direction: 'incoming',
    status: requestPayload.status || 'pending',
    createdAt: requestPayload.createdAt || envelope.timestamp || now,
    updatedAt: requestPayload.updatedAt || envelope.timestamp || now,
    transportType: 'contact-request',
  };

  await addContactRequestToDatabase(incomingRequest);

  if (incomingRequest.status === 'pending' && !notifiedIncomingRequestIds.has(incomingRequest.id)) {
    notifiedIncomingRequestIds.add(incomingRequest.id);
    Alert.alert(
      REQUEST_ALERT_TITLE,
      `Qof cusub ayaa raba in uu kugu soo biiro!\n\n${incomingRequest.senderName} wuxuu leeyahay:\n"${incomingRequest.note || 'Fariin la soo dirin'}"`
    );
  }
};

const handleIncomingContactRequestResponse = async (envelope: RequestEnvelope) => {
  const myPublicKey = await readStoredPublicKey();
  if (!myPublicKey) return;

  const requestId = envelope.requestId;
  const senderId = envelope.fromPublicKey || envelope.senderId;
  const receiverId = envelope.toPublicKey || envelope.receiverId;

  if (!requestId || !senderId || !receiverId) return;
  if (receiverId !== myPublicKey) return;

  const requests = await getStoredContactRequests();
  const request = requests.find(item => item.id === requestId);
  const now = new Date().toISOString();

  if (!request || request.direction !== 'outgoing' || request.status !== 'pending') {
    return;
  }

  const updatedRequest: ContactRequest = {
    id: requestId,
    senderId: request?.senderId || senderId,
    senderName: request?.senderName || request?.senderId || senderId,
    receiverId: request?.receiverId || receiverId,
    receiverName: request?.receiverName,
    note: request?.note || '',
    direction: request?.direction || 'outgoing',
    status: envelope.status || 'pending',
    createdAt: request?.createdAt || envelope.timestamp || now,
    updatedAt: envelope.timestamp || now,
    respondedAt: envelope.timestamp || now,
    responderId: senderId,
    responderName: normalizeText(envelope.fromDisplayName) || senderId,
    transportType: 'contact-request-response',
  };

  await updateContactRequestInDatabase(requestId, updatedRequest);

  if (updatedRequest.status === 'accepted') {
    await addContact(
      senderId,
      normalizeText(envelope.fromDisplayName) || request?.senderName || senderId
    );
    if (!notifiedResponseRequestIds.has(requestId)) {
      notifiedResponseRequestIds.add(requestId);
      Alert.alert(
        RESPONSE_ALERT_TITLE,
        `${normalizeText(envelope.fromDisplayName) || 'Saaxiibkaaga'} wuu aqbalay codsigaaga! ✅`
      );
    }
  }

  if (updatedRequest.status === 'rejected') {
    if (!notifiedResponseRequestIds.has(requestId)) {
      notifiedResponseRequestIds.add(requestId);
      Alert.alert(
        RESPONSE_ALERT_TITLE,
        `${normalizeText(envelope.fromDisplayName) || 'Saaxiibkaaga'} wuu diiday codsigaaga.`
      );
    }
  }
};

const handleIncomingContactRequestCancel = async (envelope: RequestEnvelope) => {
  const myPublicKey = await readStoredPublicKey();
  if (!myPublicKey) return;

  const requestId = envelope.requestId;
  const senderId = envelope.fromPublicKey || envelope.senderId;
  const receiverId = envelope.toPublicKey || envelope.receiverId;

  if (!requestId || !senderId || !receiverId) return;
  if (receiverId !== myPublicKey) return;

  const requests = await getStoredContactRequests();
  const request = requests.find(item => item.id === requestId);
  if (!request || request.status !== 'pending') {
    return;
  }

  await removeContactRequestFromDatabase(requestId);
  Alert.alert(
    RESPONSE_ALERT_TITLE,
    `${normalizeText(envelope.fromDisplayName) || 'Saaxiibkaaga'} wuu joojiyay codsigii.`
  );
};

registerOnMessageReceived(async (_senderPubKey, rawMessageText) => {
  try {
    const parsedMessage = JSON.parse(rawMessageText) as RequestEnvelope;
    if (!parsedMessage || typeof parsedMessage !== 'object') return;

    if (parsedMessage.messageType === 'contact-request') {
      await handleIncomingContactRequest(parsedMessage);
    }

    if (parsedMessage.messageType === 'contact-request-response') {
      await handleIncomingContactRequestResponse(parsedMessage);
    }

    if (parsedMessage.messageType === 'contact-request-cancel') {
      await handleIncomingContactRequestCancel(parsedMessage);
    }
  } catch (error) {
    // Ignore non-JSON payloads here; chat messages are handled by the messages service.
  }
});
