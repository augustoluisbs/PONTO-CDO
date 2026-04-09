// biometricAuth.js - WebAuthn-based biometric authentication service
// Uses localStorage to store credential references (demo mode)

const BIOMETRIC_KEY = 'pontoflow_biometric_credentials';

// Check if WebAuthn / biometric is available on the device
export function isBiometricAvailable() {
  return !!(window.PublicKeyCredential && navigator.credentials);
}

// Check if biometric is supported on this platform
export async function checkBiometricSupport() {
  if (!isBiometricAvailable()) return false;
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

// Get stored biometric credentials
function getStoredCredentials() {
  const data = localStorage.getItem(BIOMETRIC_KEY);
  return data ? JSON.parse(data) : [];
}

function saveCredentials(credentials) {
  localStorage.setItem(BIOMETRIC_KEY, JSON.stringify(credentials));
}

// Check if user has registered biometric
export function hasUserBiometric(userId) {
  const creds = getStoredCredentials();
  return creds.some(c => c.userId === userId);
}

// Get all users with biometric registered
export function getBiometricUsers() {
  return getStoredCredentials();
}

// Convert ArrayBuffer to base64 for storage
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const byte of bytes) {
    str += String.fromCharCode(byte);
  }
  return btoa(str);
}

// Convert base64 back to ArrayBuffer
function base64ToBuffer(base64) {
  const str = atob(base64);
  const buffer = new ArrayBuffer(str.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return buffer;
}

// Register biometric credential for a user
export async function registerBiometric(user) {
  if (!isBiometricAvailable()) {
    throw new Error('Biometria não disponível neste dispositivo');
  }

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const userIdBuffer = new TextEncoder().encode(user.id);

  const createOptions = {
    publicKey: {
      challenge: challenge,
      rp: {
        name: 'PontoFlow',
        id: window.location.hostname,
      },
      user: {
        id: userIdBuffer,
        name: user.email,
        displayName: user.name,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256
        { alg: -257, type: 'public-key' },  // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Use device biometric
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    },
  };

  try {
    const credential = await navigator.credentials.create(createOptions);

    // Store credential reference
    const creds = getStoredCredentials();
    
    // Remove old cred for same user if exists
    const filtered = creds.filter(c => c.userId !== user.id);
    
    filtered.push({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      credentialId: bufferToBase64(credential.rawId),
      registeredAt: new Date().toISOString(),
    });
    
    saveCredentials(filtered);
    return true;
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      throw new Error('Registro cancelado pelo usuário');
    }
    throw new Error('Erro ao registrar biometria: ' + err.message);
  }
}

// Authenticate using biometric
export async function authenticateBiometric() {
  if (!isBiometricAvailable()) {
    throw new Error('Biometria não disponível neste dispositivo');
  }

  const creds = getStoredCredentials();
  if (creds.length === 0) {
    throw new Error('Nenhuma biometria registrada');
  }

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const allowCredentials = creds.map(c => ({
    id: base64ToBuffer(c.credentialId),
    type: 'public-key',
    transports: ['internal'],
  }));

  const getOptions = {
    publicKey: {
      challenge: challenge,
      allowCredentials: allowCredentials,
      userVerification: 'required',
      timeout: 60000,
    },
  };

  try {
    const assertion = await navigator.credentials.get(getOptions);
    const credId = bufferToBase64(assertion.rawId);
    const matchedCred = creds.find(c => c.credentialId === credId);

    if (!matchedCred) {
      throw new Error('Credencial não reconhecida');
    }

    return {
      userId: matchedCred.userId,
      userName: matchedCred.userName,
      userEmail: matchedCred.userEmail,
    };
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      throw new Error('Autenticação cancelada pelo usuário');
    }
    throw new Error('Erro na autenticação biométrica: ' + err.message);
  }
}

// Remove biometric for a user
export function removeBiometric(userId) {
  const creds = getStoredCredentials();
  const filtered = creds.filter(c => c.userId !== userId);
  saveCredentials(filtered);
}
