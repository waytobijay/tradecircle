/**
 * services/auth.ts
 * All Firebase Auth operations for TradeCircle.
 * Spec ref: section 4.1 (Authentication Flows)
 *
 * Usage:
 *   import { signInWithEmail, signUpWithEmail } from '@/services/auth'
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  UserCredential,
  User,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import type { UserRole } from '@/types';

// ─────────────────────────────────────────────
// Return Types
// ─────────────────────────────────────────────

export interface AuthResult {
  user: User;
  isNewUser?: boolean;
}

// ─────────────────────────────────────────────
// Error Normaliser
// Converts Firebase error codes into readable messages.
// ─────────────────────────────────────────────

function normaliseAuthError(error: unknown): never {
  const code =
    typeof error === 'object' &&
    error !== null &&
    'code' in error
      ? (error as { code: string }).code
      : '';

  const messages: Record<string, string> = {
    'auth/email-already-in-use':
      'An account with this email already exists.',
    'auth/invalid-email':
      'The email address is not valid.',
    'auth/weak-password':
      'Password must be at least 6 characters.',
    'auth/user-not-found':
      'No account found with this email address.',
    'auth/wrong-password':
      'Incorrect password. Please try again.',
    'auth/invalid-credential':
      'Incorrect email or password. Please try again.',
    'auth/too-many-requests':
      'Too many failed attempts. Please wait a moment and try again.',
    'auth/user-disabled':
      'This account has been disabled. Please contact support.',
    'auth/popup-closed-by-user':
      'Sign-in popup was closed before completing.',
    'auth/cancelled-popup-request':
      'Only one sign-in popup can be open at a time.',
    'auth/network-request-failed':
      'Network error. Please check your connection and try again.',
    'auth/requires-recent-login':
      'Please sign in again to complete this action.',
  };

  const message =
    messages[code] ?? 'An unexpected error occurred. Please try again.';

  throw new Error(message);
}

// ─────────────────────────────────────────────
// Extra fields accepted at sign-up per role
// Spec ref: section 4.1 (role-specific sign-up fields)
// ─────────────────────────────────────────────

export interface SignUpExtraFields {
  /** Seller-specific */
  brand?: string;
  /** Advisor-specific */
  specialty?: string;
  /** All roles */
  location?: {
    city: string;
    country: string;
  };
}

// ─────────────────────────────────────────────
// signInWithEmail
// ─────────────────────────────────────────────

/**
 * Signs in an existing user with email and password.
 * Spec ref: section 4.1 (Login Page)
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const credential: UserCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    return { user: credential.user };
  } catch (error) {
    normaliseAuthError(error);
  }
}

// ─────────────────────────────────────────────
// signInWithGoogle
// ─────────────────────────────────────────────

/**
 * Opens a Google OAuth popup and signs in (or creates) the user.
 * On new Google sign-ups, a Firestore user document is created.
 * Spec ref: section 4.1 (Google Sign-In)
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    const credential: UserCredential = await signInWithPopup(auth, provider);
    const { user } = credential;

    // Check if this is a brand-new Google user (no prior Firestore doc)
    const isNewUser =
      credential.user.metadata.creationTime ===
      credential.user.metadata.lastSignInTime;

    if (isNewUser) {
      await setDoc(doc(db, 'users', user.uid), {
        uid:           user.uid,
        name:          user.displayName ?? '',
        email:         user.email ?? '',
        role:          'buyer' as UserRole, // default role — user can change in onboarding
        profilePhoto:  user.photoURL ?? null,
        phone:         null,
        location:      null,
        bio:           null,
        brand:         null,
        specialty:     null,
        emailVerified: user.emailVerified,
        active:        true,
        createdAt:     serverTimestamp(),
      });
    }

    return { user, isNewUser };
  } catch (error) {
    normaliseAuthError(error);
  }
}

// ─────────────────────────────────────────────
// signUpWithEmail
// ─────────────────────────────────────────────

/**
 * Creates a new user account with email/password.
 * Also creates the Firestore user document and sets the display name.
 * Spec ref: section 4.1 (Sign Up Form)
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
  phone: string,
  role: UserRole,
  extraFields: SignUpExtraFields = {}
): Promise<AuthResult> {
  try {
    const credential: UserCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const { user } = credential;

    // Set display name on the Auth profile
    await updateProfile(user, { displayName: name });

    // Create the Firestore user document
    await setDoc(doc(db, 'users', user.uid), {
      uid:           user.uid,
      name,
      email,
      role,
      phone:         phone || null,
      location:      extraFields.location ?? null,
      profilePhoto:  null,
      coverPhoto:    null,
      bio:           null,
      brand:         extraFields.brand ?? null,
      specialty:     extraFields.specialty ?? null,
      emailVerified: false,
      active:        true,
      createdAt:     serverTimestamp(),
    });

    return { user, isNewUser: true };
  } catch (error) {
    normaliseAuthError(error);
  }
}

// ─────────────────────────────────────────────
// signOut
// ─────────────────────────────────────────────

/**
 * Signs the current user out of Firebase Auth.
 */
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    normaliseAuthError(error);
  }
}

// ─────────────────────────────────────────────
// sendVerificationEmail
// ─────────────────────────────────────────────

/**
 * Sends an email verification link to the currently signed-in user.
 * Spec ref: section 4.1 (email verification on sign-up)
 */
export async function sendVerificationEmail(): Promise<void> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('No signed-in user found. Please sign in first.');
    }
    await sendEmailVerification(currentUser);
  } catch (error) {
    normaliseAuthError(error);
  }
}

// ─────────────────────────────────────────────
// sendPasswordReset
// ─────────────────────────────────────────────

/**
 * Sends a Firebase password reset email to the given address.
 * Spec ref: section 4.1 (Password Reset Flow)
 */
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    normaliseAuthError(error);
  }
}
