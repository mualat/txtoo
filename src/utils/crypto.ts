function base64urlEncode(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function base64urlDecode(str: string): Uint8Array {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) {
        str += '=';
    }
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt as BufferSource,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encryptText(text: string, password: string): Promise<{ cipherText: string; iv: string }> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const key = await deriveKey(password, salt);

    const encryptedData = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        key,
        data
    );

    const combinedBuffer = new Uint8Array(salt.length + encryptedData.byteLength);
    combinedBuffer.set(salt, 0);
    combinedBuffer.set(new Uint8Array(encryptedData), salt.length);

    const cipherText = base64urlEncode(combinedBuffer.buffer);
    const ivString = base64urlEncode(iv.buffer);

    return {
        cipherText,
        iv: ivString
    };
}

export async function decryptText(cipherText: string, ivString: string, password: string): Promise<string> {
    const combinedBuffer = base64urlDecode(cipherText);
    const iv = base64urlDecode(ivString);

    const salt = combinedBuffer.slice(0, 16);
    const encryptedData = combinedBuffer.slice(16);

    const key = await deriveKey(password, salt);

    const decryptedData = await crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: iv as BufferSource
        },
        key,
        encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
}
