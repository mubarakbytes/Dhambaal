import { Platform } from 'react-native';
// @ts-ignore
import msrcrypto from 'msrcrypto';
import { TextEncoder, TextDecoder } from 'text-encoding';
import { Buffer } from 'buffer';

// 1. Bridge msrcrypto's event-driven subtle methods to modern Promises
const baseSubtle = msrcrypto.subtle;
const promisedSubtle = {};
const cryptoMethods = ['generateKey', 'exportKey', 'importKey', 'sign', 'verify', 'encrypt', 'decrypt', 'digest'];

cryptoMethods.forEach(method => {
  if (baseSubtle && baseSubtle[method]) {
    promisedSubtle[method] = function (...args) {
      return new Promise((resolve, reject) => {
        try {
          const op = baseSubtle[method](...args);
          if (op && typeof op.then === 'function') {
            return op.then(resolve, reject);
          }
          if (op) {
            op.oncomplete = (e) => resolve(e.target.result);
            op.onerror = (e) => reject(e);
          } else {
            reject(new Error(`Crypto error: ${method} returned an invalid operation.`));
          }
        } catch (err) {
          reject(err);
        }
      });
    };
  }
});

// 2. Set up global layers for React Native / Non-web platforms
if (Platform.OS !== 'web') {
  // Polyfill self and window so GunDB can resolve SEA.window as globalThis
  globalThis.self = globalThis;
  globalThis.window = globalThis;
  global.self = global;
  global.window = global;

  const cryptoPolyfill = {
    ...msrcrypto,
    subtle: promisedSubtle,
    getRandomValues: (array) => msrcrypto.getRandomValues(array)
  };

  globalThis.crypto = cryptoPolyfill;
  global.crypto = cryptoPolyfill;
}

// 3. Set up TextEncoder/Decoder and Buffer globals
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;
globalThis.Buffer = Buffer;

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.Buffer = Buffer;

// 4. Set up process and process.nextTick polyfills for web/browser environment
if (typeof process === 'undefined') {
  globalThis.process = {
    browser: true,
    env: { NODE_ENV: 'development' },
    nextTick: (fn, ...args) => setTimeout(() => fn(...args), 0),
  };
} else if (!process.nextTick) {
  process.nextTick = (fn, ...args) => setTimeout(() => fn(...args), 0);
}

console.log('[Polyfill] Cryptography, Buffer and Process environment successfully initialized.');

