/**
 * services/phoneAuth.ts
 * Firebase Phone Authentication utilities.
 * Spec ref: section 4.1 (Phone Auth)
 *
 * Usage:
 *   import { setupRecaptcha, sendOTP, verifyOTP, linkPhoneToAccount } from '@/services/phoneAuth'
 */

import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  linkWithCredential,
  ConfirmationResult,
  UserCredential,
} from 'firebase/auth';
import { auth } from '@/services/firebase';

// ─────────────────────────────────────────────
// Error normaliser
// ─────────────────────────────────────────────

function normalisePhoneAuthError(error: unknown): never {
  const code =
    typeof error === 'object' &&
    error !== null &&
    'code' in error
      ? (error as { code: string }).code
      : '';

  const messages: Record<string, string> = {
    'auth/invalid-phone-number':
      'Invalid phone number. Include country code e.g. +61412345678',
    'auth/missing-phone-number':
      'Phone number is required.',
    'auth/quota-exceeded':
      'SMS quota exceeded. Please try again later.',
    'auth/user-disabled':
      'This account has been disabled.',
    'auth/operation-not-allowed':
      'Phone sign-in is not enabled. Contact support.',
    'auth/too-many-requests':
      'Too many attempts. Please wait a moment and try again.',
    'auth/invalid-verification-code':
      'The OTP code you entered is incorrect. Please try again.',
    'auth/code-expired':
      'The OTP code has expired. Please request a new one.',
    'auth/missing-verification-code':
      'Please enter the OTP code.',
    'auth/provider-already-linked':
      'This phone number is already linked to another account.',
    'auth/credential-already-in-use':
      'This phone number is already associated with a different account.',
    'auth/requires-recent-login':
      'Please sign in again before linking your phone number.',
  };

  const message =
    messages[code] ??
    (error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.');

  throw new Error(message);
}

// ─────────────────────────────────────────────
// setupRecaptcha
// ─────────────────────────────────────────────

/**
 * Set up invisible reCAPTCHA on a container element ID.
 * Call once on mount. The container div must already exist in the DOM.
 */
export function setupRecaptcha(containerId: string): RecaptchaVerifier {
  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved — OTP request will proceed
    },
    'expired-callback': () => {
      // reCAPTCHA expired — user will need to retry
    },
  });
  return verifier;
}

// ─────────────────────────────────────────────
// sendOTP
// ─────────────────────────────────────────────

/**
 * Send OTP to the given phone number.
 * @returns A ConfirmationResult used to verify the code.
 */
export async function sendOTP(
  phoneNumber: string,
  recaptchaVerifier: RecaptchaVerifier,
): Promise<ConfirmationResult> {
  try {
    const confirmationResult = await signInWithPhoneNumber(
      auth,
      phoneNumber,
      recaptchaVerifier,
    );
    return confirmationResult;
  } catch (error) {
    normalisePhoneAuthError(error);
  }
}

// ─────────────────────────────────────────────
// verifyOTP
// ─────────────────────────────────────────────

/**
 * Verify the OTP code entered by the user.
 * @returns UserCredential on success.
 */
export async function verifyOTP(
  confirmationResult: ConfirmationResult,
  code: string,
): Promise<UserCredential> {
  try {
    const credential = await confirmationResult.confirm(code);
    return credential;
  } catch (error) {
    normalisePhoneAuthError(error);
  }
}

// ─────────────────────────────────────────────
// linkPhoneToAccount
// ─────────────────────────────────────────────

/**
 * Link a phone number to the currently signed-in user.
 * Sends an OTP first; call verifyOTP then linkWithCredential to complete.
 * @returns ConfirmationResult — pass to verifyOTP to get the credential,
 *          then call linkPhoneCredential with it.
 */
export async function linkPhoneToAccount(
  phoneNumber: string,
  recaptchaVerifier: RecaptchaVerifier,
): Promise<ConfirmationResult> {
  try {
    const confirmationResult = await signInWithPhoneNumber(
      auth,
      phoneNumber,
      recaptchaVerifier,
    );
    return confirmationResult;
  } catch (error) {
    normalisePhoneAuthError(error);
  }
}

// ─────────────────────────────────────────────
// linkPhoneCredential
// ─────────────────────────────────────────────

/**
 * Complete the phone link flow by attaching the credential to the
 * currently signed-in user.
 */
export async function linkPhoneCredential(
  verificationId: string,
  code: string,
): Promise<UserCredential> {
  try {
    if (!auth.currentUser) {
      throw new Error('No signed-in user found. Please sign in first.');
    }
    const credential = PhoneAuthProvider.credential(verificationId, code);
    const result = await linkWithCredential(auth.currentUser, credential);
    return result;
  } catch (error) {
    normalisePhoneAuthError(error);
  }
}
