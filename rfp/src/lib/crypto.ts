import CryptoJS from 'crypto-js';
import { APP_CONFIG } from './config';

/**
 * Encrypt a string using AES-256
 */
export function encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, APP_CONFIG.tokenEncryptionKey).toString();
}

/**
 * Decrypt an AES-256 encrypted string
 */
export function decrypt(ciphertext: string): string {
    const bytes = CryptoJS.AES.decrypt(ciphertext, APP_CONFIG.tokenEncryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
}

/**
 * Hash a string using SHA-256 (for permission comparison)
 */
export function hashPermissions(permissions: object[]): string {
    const sorted = JSON.stringify(
        permissions.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    );
    return CryptoJS.SHA256(sorted).toString();
}
