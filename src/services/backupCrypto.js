import { Buffer } from 'buffer';

function rightRotate(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

export function sha256(ascii) {
  var hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  
  var k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  var bytes = Buffer.from(ascii, 'utf8');
  var byteLength = bytes.length;
  
  var padLen = 64 - ((byteLength + 9) % 64);
  if (padLen === 64) padLen = 0;
  
  var totalLen = byteLength + 1 + padLen + 8;
  var padded = Buffer.alloc(totalLen);
  bytes.copy(padded, 0);
  padded[byteLength] = 0x80;
  
  var bitLength = byteLength * 8;
  padded.writeUInt32BE((bitLength / 0x100000000) | 0, totalLen - 8);
  padded.writeUInt32BE(bitLength & 0xffffffff, totalLen - 4);

  for (var i = 0; i < totalLen; i += 64) {
    var w = new Array(64);
    for (var t = 0; t < 16; t++) {
      w[t] = padded.readUInt32BE(i + t * 4);
    }
    
    for (var t = 16; t < 64; t++) {
      var s0 = rightRotate(w[t - 15], 7) ^ rightRotate(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      var s1 = rightRotate(w[t - 2], 17) ^ rightRotate(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    
    var a = hash[0], b = hash[1], c = hash[2], d = hash[3],
        e = hash[4], f = hash[5], g = hash[6], h = hash[7];
        
    for (var t = 0; t < 64; t++) {
      var S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      var ch = (e & f) ^ (~e & g);
      var temp1 = (h + S1 + ch + k[t] + w[t]) | 0;
      var S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var temp2 = (S0 + maj) | 0;
      
      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    
    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }
  
  var hex = "";
  for (var i = 0; i < 8; i++) {
    var val = hash[i];
    if (val < 0) val += 0x100000000;
    var strVal = val.toString(16);
    while (strVal.length < 8) strVal = "0" + strVal;
    hex += strVal;
  }
  return hex;
}

export function encryptString(plaintext, pin) {
  var salt = "";
  var chars = "0123456789abcdef";
  for (var i = 0; i < 16; i++) {
    salt += chars.charAt(Math.floor(Math.random() * 16));
  }
  
  var plainBuf = Buffer.from(plaintext, 'utf8');
  var cipherBuf = Buffer.alloc(plainBuf.length);
  
  var blockHash = sha256(pin + salt);
  var streamIndex = 0;
  var keyStreamBytes = Buffer.alloc(32);
  
  function fillKeyStream() {
    blockHash = sha256(blockHash + pin + salt);
    for (var k = 0; k < 32; k++) {
      keyStreamBytes[k] = parseInt(blockHash.substr(k * 2, 2), 16);
    }
    streamIndex = 0;
  }
  
  fillKeyStream();
  
  for (var i = 0; i < plainBuf.length; i++) {
    if (streamIndex >= 32) {
      fillKeyStream();
    }
    cipherBuf[i] = plainBuf[i] ^ keyStreamBytes[streamIndex++];
  }
  
  return salt + cipherBuf.toString('base64');
}

export function decryptString(cipherText, pin) {
  if (cipherText.length < 16) return null;
  var salt = cipherText.substring(0, 16);
  var base64Payload = cipherText.substring(16);
  
  var cipherBuf = Buffer.from(base64Payload, 'base64');
  var plainBuf = Buffer.alloc(cipherBuf.length);
  
  var blockHash = sha256(pin + salt);
  var streamIndex = 0;
  var keyStreamBytes = Buffer.alloc(32);
  
  function fillKeyStream() {
    blockHash = sha256(blockHash + pin + salt);
    for (var k = 0; k < 32; k++) {
      keyStreamBytes[k] = parseInt(blockHash.substr(k * 2, 2), 16);
    }
    streamIndex = 0;
  }
  
  fillKeyStream();
  
  for (var i = 0; i < cipherBuf.length; i++) {
    if (streamIndex >= 32) {
      fillKeyStream();
    }
    plainBuf[i] = cipherBuf[i] ^ keyStreamBytes[streamIndex++];
  }
  
  return plainBuf.toString('utf8');
}
