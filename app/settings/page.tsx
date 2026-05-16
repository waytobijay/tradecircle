/**
 * app/settings/page.tsx
 * Account settings — all roles.
 * Spec ref: section 4.3 (Settings)
 *
 * Sections:
 *  1. Account      — name, email, phone, change password
 *  2. Privacy      — profile visibility (Public / Circle / Private)
 *  3. Notifications — toggle push / email / in-app per event type
 *  4. Location     — default city, country, radius preference
 *  5. Appearance   — Dark / Light / System theme toggle
 *  6. Danger Zone  — delete account (requires password re-entry)
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter }             from 'next/navigation';
import { useForm }               from 'react-hook-form';
import { zodResolver }           from '@hookform/resolvers/zod';
import { z }                     from 'zod';
import {
  User,
  Lock,
  Bell,
  MapPin,
  Palette,
  ShieldAlert,
  Eye,
  EyeOff,
  Check,
  Loader2,
  Sun,
  Moon,
  Monitor,
  ChevronRight,
  Phone,
  X,
  Languages,
} from 'lucide-react';
import {
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  updateEmail,
  updatePassword,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from 'firebase/auth';
import { auth, db }        from '@/services/firebase';
import { useAuthStore }    from '@/store/authStore';
import PhoneVerification   from '@/components/auth/PhoneVerification';
import type { UserCredential } from 'firebase/auth';
import { useUiStore }      from '@/store/uiStore';
import type { Theme }      from '@/store/uiStore';
import BuyerLayout         from '@/components/layouts/BuyerLayout';
import SellerLayout        from '@/components/layouts/SellerLayout';
import AdvisorLayout       from '@/components/layouts/AdvisorLayout';
import LanguageSelector    from '@/components/ui/LanguageSelector';

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = 'account' | 'privacy' | 'notifications' | 'location' | 'appearance' | 'language' | 'danger';

interface NotifPrefs {
  pushNewMessage:     boolean;
  pushEnquiry:        boolean;
  pushOrderUpdate:    boolean;
  emailNewMessage:    boolean;
  emailEnquiry:       boolean;
  emailOrderUpdate:   boolean;
  inAppNewMessage:    boolean;
  inAppEnquiry:       boolean;
  inAppOrderUpdate:   boolean;
}

const DEFAULT_NOTIF: NotifPrefs = {
  pushNewMessage:   true,
  pushEnquiry:      true,
  pushOrderUpdate:  true,
  emailNewMessage:  false,
  emailEnquiry:     true,
  emailOrderUpdate: true,
  inAppNewMessage:  true,
  inAppEnquiry:     true,
  inAppOrderUpdate: true,
};

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const accountSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters'),
  email:       z.string().email('Invalid email address'),
  phone:       z.string().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword:     z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path:    ['confirmPassword'],
  });

const locationSchema = z.object({
  city:    z.string().optional(),
  country: z.string().optional(),
  radius:  z.coerce.number().min(1).max(500).optional(),
});

type AccountForm  = z.infer<typeof accountSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;
type LocationForm = z.infer<typeof locationSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background:    'var(--color-surface)',
        border:        '1px solid var(--color-border)',
        borderRadius:  'var(--radius-xl)',
        padding:       'var(--space-5)',
        marginBottom:  'var(--space-4)',
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           'var(--space-2)',
        marginBottom:  'var(--space-4)',
        paddingBottom: 'var(--space-3)',
        borderBottom:  '1px solid var(--color-border)',
      }}
    >
      <span style={{ color: 'var(--color-primary)' }}>{icon}</span>
      <h2 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text)' }}>
        {label}
      </h2>
    </div>
  );
}

function FieldGroup({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <label
        style={{
          display:      'block',
          marginBottom: 'var(--space-1)',
          fontSize:     'var(--text-sm)',
          fontWeight:   600,
          color:        'var(--color-text-2)',
        }}
      >
        {label}
      </label>
      {children}
      {error && (
        <p style={{ margin: '4px 0 0', color: 'var(--color-error)', fontSize: 'var(--text-xs)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  width:        '100%',
  padding:      'var(--space-2) var(--space-3)',
  background:   'var(--color-surface-2)',
  border:       '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  color:        'var(--color-text)',
  fontSize:     'var(--text-sm)',
  outline:      'none',
  boxSizing:    'border-box',
  transition:   'border-color 0.15s',
};

function SaveButton({ loading, saved }: { loading: boolean; saved: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          'var(--space-2)',
        padding:      'var(--space-2) var(--space-5)',
        background:   saved ? 'var(--color-success, #10b981)' : 'var(--color-primary)',
        color:        '#fff',
        border:       'none',
        borderRadius: 'var(--radius-md)',
        fontWeight:   600,
        fontSize:     'var(--text-sm)',
        cursor:       loading ? 'not-allowed' : 'pointer',
        opacity:      loading ? 0.7 : 1,
        transition:   'background 0.2s',
      }}
    >
      {loading ? (
        <Loader2 size={15} className="animate-spin" />
      ) : saved ? (
        <Check size={15} />
      ) : null}
      {saved ? 'Saved!' : 'Save Changes'}
    </button>
  );
}

// ─── Phone Verification Modal ─────────────────────────────────────────────────

interface PhoneModalProps {
  onClose: () => void;
  onLinked: (phoneNumber: string) => void;
}

function PhoneModal({ onClose, onLinked }: PhoneModalProps) {
  const [toast, setToast] = useState('');

  async function handleVerified(credential: UserCredential) {
    const phone = credential.user.phoneNumber ?? '';
    onLinked(phone);
    setToast('Phone number linked successfully!');
    setTimeout(onClose, 1500);
  }

  return (
    <div
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          50,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         16,
        backgroundColor: 'rgba(0,0,0,0.5)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="phone-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width:        '100%',
          maxWidth:     420,
          background:   'var(--color-surface)',
          border:       '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding:      'var(--space-6) var(--space-5)',
          position:     'relative',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position:  'absolute',
            top:       12,
            right:     12,
            background: 'none',
            border:    'none',
            color:     'var(--color-text-2)',
            cursor:    'pointer',
            padding:   4,
          }}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {toast ? (
          <div
            style={{
              textAlign:  'center',
              padding:    'var(--space-6) 0',
              color:      'var(--color-success, #10b981)',
              fontWeight: 600,
              fontSize:   'var(--text-base)',
            }}
          >
            <Check size={24} style={{ margin: '0 auto 8px', display: 'block' }} />
            {toast}
          </div>
        ) : (
          <PhoneVerification
            mode="link"
            onVerified={handleVerified}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  );
}

// ─── Section: Account ─────────────────────────────────────────────────────────

function AccountSection({ uid }: { uid: string }) {
  const setUser      = useAuthStore((s) => s.setUser);
  const user         = useAuthStore((s) => s.user);
  const [saving, setSaving]       = useState(false);
  const [saved,  setSaved]        = useState(false);
  const [serverErr, setServerErr] = useState('');
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneToast, setPhoneToast]         = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<AccountForm>({
    resolver:     zodResolver(accountSchema),
    defaultValues: {
      displayName: user?.displayName ?? '',
      email:       user?.email ?? '',
      phone:       user?.phone ?? '',
    },
  });

  async function onSave(data: AccountForm) {
    if (!auth.currentUser) return;
    setSaving(true);
    setServerErr('');
    try {
      const updates: Record<string, string> = {
        displayName: data.displayName,
        email:       data.email,
        phone:       data.phone ?? '',
      };

      await updateProfile(auth.currentUser, { displayName: data.displayName });

      if (data.email !== auth.currentUser.email) {
        await updateEmail(auth.currentUser, data.email);
      }

      await updateDoc(doc(db, 'users', uid), updates);

      if (user) {
        setUser({ ...user, ...updates });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      setServerErr(err instanceof Error ? err.message : 'Failed to save — try again.');
    } finally {
      setSaving(false);
    }
  }

  const handlePhoneLinked = useCallback(async (phoneNumber: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { phone: phoneNumber });
      if (user) setUser({ ...user, phone: phoneNumber });
      setPhoneToast('Phone number updated successfully!');
      setTimeout(() => setPhoneToast(''), 3000);
    } catch {
      setPhoneToast('Phone linked but failed to save. Please refresh.');
      setTimeout(() => setPhoneToast(''), 4000);
    }
  }, [uid, user, setUser]);

  const currentPhone = user?.phone ?? '';

  return (
    <>
      <SectionCard>
        <SectionTitle icon={<User size={18} />} label="Account" />
        <form onSubmit={handleSubmit(onSave)}>
          <FieldGroup label="Full Name" error={errors.displayName?.message}>
            <input {...register('displayName')} style={INPUT_STYLE} />
          </FieldGroup>
          <FieldGroup label="Email Address" error={errors.email?.message}>
            <input {...register('email')} type="email" style={INPUT_STYLE} />
          </FieldGroup>

          {/* Phone Number row — verified via OTP */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label
              style={{
                display:      'block',
                marginBottom: 'var(--space-1)',
                fontSize:     'var(--text-sm)',
                fontWeight:   600,
                color:        'var(--color-text-2)',
              }}
            >
              Phone Number
            </label>
            <div
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                gap:            'var(--space-3)',
                padding:        'var(--space-2) var(--space-3)',
                background:     'var(--color-surface-2)',
                border:         '1px solid var(--color-border)',
                borderRadius:   'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Phone size={15} style={{ color: 'var(--color-text-3, #9ca3af)', flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: 'var(--text-sm)',
                    color:    currentPhone ? 'var(--color-text)' : 'var(--color-text-3, #9ca3af)',
                  }}
                >
                  {currentPhone || 'Not set'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPhoneModalOpen(true)}
                style={{
                  padding:      'var(--space-1) var(--space-3)',
                  background:   'var(--color-primary)',
                  color:        '#fff',
                  border:       'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize:     'var(--text-xs)',
                  fontWeight:   600,
                  cursor:       'pointer',
                  whiteSpace:   'nowrap',
                  flexShrink:   0,
                }}
              >
                {currentPhone ? 'Update' : 'Add'}
              </button>
            </div>
            {phoneToast && (
              <p style={{ margin: '6px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-success, #10b981)' }}>
                {phoneToast}
              </p>
            )}
          </div>

          {serverErr && (
            <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
              {serverErr}
            </p>
          )}
          <SaveButton loading={saving} saved={saved} />
        </form>
      </SectionCard>

      {phoneModalOpen && (
        <PhoneModal
          onClose={() => setPhoneModalOpen(false)}
          onLinked={handlePhoneLinked}
        />
      )}
    </>
  );
}

// ─── Section: Change Password ─────────────────────────────────────────────────

function PasswordSection() {
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [serverErr, setServerErr] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  async function onSave(data: PasswordForm) {
    if (!auth.currentUser?.email) return;
    setSaving(true);
    setServerErr('');
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, data.currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, data.newPassword);
      setSaved(true);
      reset();
      setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      setServerErr(err instanceof Error ? err.message : 'Incorrect current password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard>
      <SectionTitle icon={<Lock size={18} />} label="Change Password" />
      <form onSubmit={handleSubmit(onSave)}>
        <FieldGroup label="Current Password" error={errors.currentPassword?.message}>
          <div style={{ position: 'relative' }}>
            <input
              {...register('currentPassword')}
              type={showCurrent ? 'text' : 'password'}
              style={{ ...INPUT_STYLE, paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              style={{
                position:  'absolute',
                right:     10,
                top:       '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border:    'none',
                cursor:    'pointer',
                color:     'var(--color-text-3)',
                padding:   0,
              }}
            >
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </FieldGroup>
        <FieldGroup label="New Password" error={errors.newPassword?.message}>
          <div style={{ position: 'relative' }}>
            <input
              {...register('newPassword')}
              type={showNew ? 'text' : 'password'}
              style={{ ...INPUT_STYLE, paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              style={{
                position:  'absolute',
                right:     10,
                top:       '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border:    'none',
                cursor:    'pointer',
                color:     'var(--color-text-3)',
                padding:   0,
              }}
            >
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </FieldGroup>
        <FieldGroup label="Confirm New Password" error={errors.confirmPassword?.message}>
          <input {...register('confirmPassword')} type="password" style={INPUT_STYLE} />
        </FieldGroup>
        {serverErr && (
          <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
            {serverErr}
          </p>
        )}
        <SaveButton loading={saving} saved={saved} />
      </form>
    </SectionCard>
  );
}

// ─── Section: Privacy ─────────────────────────────────────────────────────────

type Visibility = 'public' | 'circle' | 'private';

function PrivacySection({ uid }: { uid: string }) {
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'users', uid)).then((snap) => {
      if (snap.exists()) {
        setVisibility((snap.data().visibility as Visibility) ?? 'public');
      }
    });
  }, [uid]);

  async function save() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', uid), { visibility });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  const OPTS: { value: Visibility; label: string; desc: string }[] = [
    { value: 'public',  label: 'Public',  desc: 'Anyone can view your profile and listings.' },
    { value: 'circle',  label: 'Circle',  desc: 'Only users in your circle can view your profile.' },
    { value: 'private', label: 'Private', desc: 'Only you can view your profile. Listings remain visible.' },
  ];

  return (
    <SectionCard>
      <SectionTitle icon={<Eye size={18} />} label="Privacy" />
      <p style={{ margin: '0 0 var(--space-4)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
        Control who can see your profile information.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        {OPTS.map((opt) => (
          <label
            key={opt.value}
            style={{
              display:      'flex',
              alignItems:   'flex-start',
              gap:          'var(--space-3)',
              padding:      'var(--space-3)',
              borderRadius: 'var(--radius-lg)',
              border:       `1px solid ${visibility === opt.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
              background:   visibility === opt.value ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'transparent',
              cursor:       'pointer',
              transition:   'border-color 0.15s, background 0.15s',
            }}
          >
            <input
              type="radio"
              name="visibility"
              value={opt.value}
              checked={visibility === opt.value}
              onChange={() => setVisibility(opt.value)}
              style={{ marginTop: 2, accentColor: 'var(--color-primary)' }}
            />
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                {opt.label}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-2)' }}>
                {opt.desc}
              </p>
            </div>
          </label>
        ))}
      </div>
      <button
        onClick={save}
        disabled={saving}
        style={{
          display:      'inline-flex',
          alignItems:   'center',
          gap:          'var(--space-2)',
          padding:      'var(--space-2) var(--space-5)',
          background:   saved ? 'var(--color-success, #10b981)' : 'var(--color-primary)',
          color:        '#fff',
          border:       'none',
          borderRadius: 'var(--radius-md)',
          fontWeight:   600,
          fontSize:     'var(--text-sm)',
          cursor:       saving ? 'not-allowed' : 'pointer',
          opacity:      saving ? 0.7 : 1,
          transition:   'background 0.2s',
        }}
      >
        {saving ? <Loader2 size={15} /> : saved ? <Check size={15} /> : null}
        {saved ? 'Saved!' : 'Save Changes'}
      </button>
    </SectionCard>
  );
}

// ─── Section: Notifications ───────────────────────────────────────────────────

function NotificationsSection({ uid }: { uid: string }) {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'users', uid)).then((snap) => {
      if (snap.exists() && snap.data().notifPrefs) {
        setPrefs({ ...DEFAULT_NOTIF, ...snap.data().notifPrefs });
      }
    });
  }, [uid]);

  async function save() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', uid), { notifPrefs: prefs });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  function toggle(key: keyof NotifPrefs) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  const ROWS: { label: string; keys: (keyof NotifPrefs)[] }[] = [
    { label: 'New Message',    keys: ['pushNewMessage',  'emailNewMessage',  'inAppNewMessage']  },
    { label: 'Enquiry',        keys: ['pushEnquiry',     'emailEnquiry',     'inAppEnquiry']     },
    { label: 'Order Update',   keys: ['pushOrderUpdate', 'emailOrderUpdate', 'inAppOrderUpdate'] },
  ];

  const COL_LABELS = ['Push', 'Email', 'In-App'];

  return (
    <SectionCard>
      <SectionTitle icon={<Bell size={18} />} label="Notifications" />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 'var(--space-2)', color: 'var(--color-text-2)', fontWeight: 600 }}>
                Event
              </th>
              {COL_LABELS.map((c) => (
                <th key={c} style={{ textAlign: 'center', padding: 'var(--space-2)', color: 'var(--color-text-2)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr key={row.label} style={{ borderTop: i === 0 ? '1px solid var(--color-border)' : '1px solid var(--color-border)' }}>
                <td style={{ padding: 'var(--space-3) var(--space-2)', color: 'var(--color-text)', fontWeight: 500 }}>
                  {row.label}
                </td>
                {row.keys.map((key) => (
                  <td key={key} style={{ textAlign: 'center', padding: 'var(--space-3) var(--space-2)' }}>
                    <input
                      type="checkbox"
                      checked={prefs[key]}
                      onChange={() => toggle(key)}
                      style={{ width: 16, height: 16, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 'var(--space-4)' }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          'var(--space-2)',
            padding:      'var(--space-2) var(--space-5)',
            background:   saved ? 'var(--color-success, #10b981)' : 'var(--color-primary)',
            color:        '#fff',
            border:       'none',
            borderRadius: 'var(--radius-md)',
            fontWeight:   600,
            fontSize:     'var(--text-sm)',
            cursor:       saving ? 'not-allowed' : 'pointer',
            opacity:      saving ? 0.7 : 1,
            transition:   'background 0.2s',
          }}
        >
          {saving ? <Loader2 size={15} /> : saved ? <Check size={15} /> : null}
          {saved ? 'Saved!' : 'Save Preferences'}
        </button>
      </div>
    </SectionCard>
  );
}

// ─── Section: Location ────────────────────────────────────────────────────────

function LocationSection({ uid }: { uid: string }) {
  const user        = useAuthStore((s) => s.user);
  const setUser     = useAuthStore((s) => s.setUser);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [serverErr, setServerErr] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<LocationForm>({
    resolver:     zodResolver(locationSchema),
    defaultValues: {
      city:    user?.city ?? '',
      country: user?.country ?? '',
      radius:  50,
    },
  });

  async function onSave(data: LocationForm) {
    setSaving(true);
    setServerErr('');
    try {
      const updates = {
        city:    data.city ?? '',
        country: data.country ?? '',
        radius:  data.radius ?? 50,
      };
      await updateDoc(doc(db, 'users', uid), updates);
      if (user) setUser({ ...user, ...updates });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      setServerErr(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard>
      <SectionTitle icon={<MapPin size={18} />} label="Location" />
      <form onSubmit={handleSubmit(onSave)}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <FieldGroup label="City" error={errors.city?.message}>
            <input {...register('city')} style={INPUT_STYLE} placeholder="Sydney" />
          </FieldGroup>
          <FieldGroup label="Country" error={errors.country?.message}>
            <input {...register('country')} style={INPUT_STYLE} placeholder="Australia" />
          </FieldGroup>
        </div>
        <FieldGroup label="Search Radius (km)" error={errors.radius?.message}>
          <input
            {...register('radius')}
            type="number"
            min={1}
            max={500}
            style={{ ...INPUT_STYLE, width: 160 }}
          />
        </FieldGroup>
        {serverErr && (
          <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
            {serverErr}
          </p>
        )}
        <SaveButton loading={saving} saved={saved} />
      </form>
    </SectionCard>
  );
}

// ─── Section: Appearance ──────────────────────────────────────────────────────

function AppearanceSection() {
  const theme    = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  type ThemeOpt = Theme | 'system';

  const [selected, setSelected] = useState<ThemeOpt>(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = localStorage.getItem('tc-theme');
    if (!stored) return 'system';
    return stored as Theme;
  });

  function apply(opt: ThemeOpt) {
    setSelected(opt);
    if (opt === 'system') {
      const sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      setTheme(sys);
      localStorage.removeItem('tc-theme');
    } else {
      setTheme(opt);
    }
  }

  const OPTS: { value: ThemeOpt; label: string; icon: React.ReactNode }[] = [
    { value: 'light',  label: 'Light',  icon: <Sun size={18} /> },
    { value: 'dark',   label: 'Dark',   icon: <Moon size={18} /> },
    { value: 'system', label: 'System', icon: <Monitor size={18} /> },
  ];

  return (
    <SectionCard>
      <SectionTitle icon={<Palette size={18} />} label="Appearance" />
      <p style={{ margin: '0 0 var(--space-4)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
        Choose your preferred colour theme.
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        {OPTS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => apply(opt.value)}
            style={{
              display:      'flex',
              flexDirection:'column',
              alignItems:   'center',
              gap:          'var(--space-2)',
              padding:      'var(--space-4) var(--space-6)',
              border:       `2px solid ${selected === opt.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-lg)',
              background:   selected === opt.value ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--color-surface-2)',
              color:        selected === opt.value ? 'var(--color-primary)' : 'var(--color-text-2)',
              cursor:       'pointer',
              transition:   'border-color 0.15s, color 0.15s, background 0.15s',
              fontWeight:   selected === opt.value ? 700 : 500,
              fontSize:     'var(--text-sm)',
              minWidth:     96,
            }}
          >
            {opt.icon}
            {opt.label}
            {selected === opt.value && (
              <Check size={14} style={{ color: 'var(--color-primary)' }} />
            )}
          </button>
        ))}
      </div>
    </SectionCard>
  );
}

// ─── Section: Language ────────────────────────────────────────────────────────

function LanguageSection() {
  return (
    <SectionCard>
      <SectionTitle icon={<Languages size={18} />} label="Display Language" />
      <p style={{ margin: '0 0 var(--space-4)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
        Choose the language used throughout the platform. Changes apply immediately — no page reload needed.
      </p>
      <LanguageSelector variant="inline" />
    </SectionCard>
  );
}

// ─── Section: Danger Zone ─────────────────────────────────────────────────────

function DangerZoneSection() {
  const router    = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [open, setOpen]       = useState(false);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError]     = useState('');

  async function handleDelete() {
    if (!auth.currentUser?.email) return;
    setDeleting(true);
    setError('');
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await deleteUser(auth.currentUser);
      clearAuth();
      router.replace('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Incorrect password or error deleting account.');
      setDeleting(false);
    }
  }

  return (
    <SectionCard>
      <SectionTitle icon={<ShieldAlert size={18} />} label="Danger Zone" />

      <div
        style={{
          border:       '1px solid var(--color-error, #ef4444)',
          borderRadius: 'var(--radius-lg)',
          padding:      'var(--space-4)',
          background:   'color-mix(in srgb, var(--color-error, #ef4444) 6%, transparent)',
        }}
      >
        <p style={{ margin: '0 0 var(--space-1)', fontWeight: 700, color: 'var(--color-error, #ef4444)', fontSize: 'var(--text-sm)' }}>
          Delete Account
        </p>
        <p style={{ margin: '0 0 var(--space-3)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            style={{
              padding:      'var(--space-2) var(--space-4)',
              background:   'var(--color-error, #ef4444)',
              color:        '#fff',
              border:       'none',
              borderRadius: 'var(--radius-md)',
              fontWeight:   600,
              fontSize:     'var(--text-sm)',
              cursor:       'pointer',
            }}
          >
            Delete My Account
          </button>
        ) : (
          <div>
            <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              Enter your password to confirm:
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Current password"
              style={{ ...INPUT_STYLE, marginBottom: 'var(--space-2)', maxWidth: 300 }}
            />
            {error && (
              <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-error, #ef4444)', fontSize: 'var(--text-sm)' }}>
                {error}
              </p>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                onClick={handleDelete}
                disabled={!password || deleting}
                style={{
                  display:      'inline-flex',
                  alignItems:   'center',
                  gap:          'var(--space-2)',
                  padding:      'var(--space-2) var(--space-4)',
                  background:   'var(--color-error, #ef4444)',
                  color:        '#fff',
                  border:       'none',
                  borderRadius: 'var(--radius-md)',
                  fontWeight:   600,
                  fontSize:     'var(--text-sm)',
                  cursor:       (!password || deleting) ? 'not-allowed' : 'pointer',
                  opacity:      (!password || deleting) ? 0.7 : 1,
                }}
              >
                {deleting && <Loader2 size={15} />}
                Yes, Delete Account
              </button>
              <button
                onClick={() => { setOpen(false); setPassword(''); setError(''); }}
                style={{
                  padding:      'var(--space-2) var(--space-4)',
                  background:   'var(--color-surface-2)',
                  border:       '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color:        'var(--color-text-2)',
                  fontSize:     'var(--text-sm)',
                  cursor:       'pointer',
                  fontWeight:   600,
                }}
              >
                Cancel
          </button>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Sidebar nav ──────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'account',       label: 'Account',       icon: <User size={16} /> },
  { id: 'privacy',       label: 'Privacy',        icon: <Eye size={16} /> },
  { id: 'notifications', label: 'Notifications',  icon: <Bell size={16} /> },
  { id: 'location',      label: 'Location',       icon: <MapPin size={16} /> },
  { id: 'appearance',    label: 'Appearance',     icon: <Palette size={16} /> },
  { id: 'language',      label: 'Language',       icon: <Languages size={16} /> },
  { id: 'danger',        label: 'Danger Zone',    icon: <ShieldAlert size={16} /> },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const user        = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const router      = useRouter();
  const [active, setActive] = useState<Section>('account');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return null;
  }

  const LayoutWrapper =
    user.role === 'seller'
      ? SellerLayout
      : user.role === 'advisor'
      ? AdvisorLayout
      : BuyerLayout;

  return (
    <LayoutWrapper>
      <div
        style={{
          maxWidth: 960,
          margin:   '0 auto',
          padding:  'var(--space-6) var(--space-4)',
        }}
      >
        <h1
          style={{
            margin:       '0 0 var(--space-6)',
            fontSize:     'var(--text-2xl)',
            fontWeight:   800,
            color:        'var(--color-text)',
          }}
        >
          Settings
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>

          {/* Sidebar */}
          <nav
            style={{
              background:   'var(--color-surface)',
              border:       '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              overflow:     'hidden',
              position:     'sticky',
              top:          80,
            }}
          >
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'space-between',
                  width:          '100%',
                  padding:        'var(--space-3) var(--space-4)',
                  background:     active === item.id
                    ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                    : 'transparent',
                  border:         'none',
                  borderLeft:     active === item.id
                    ? '3px solid var(--color-primary)'
                    : '3px solid transparent',
                  color:          item.id === 'danger'
                    ? active === item.id
                      ? 'var(--color-error, #ef4444)'
                      : 'var(--color-error, #ef4444)'
                    : active === item.id
                    ? 'var(--color-primary)'
                    : 'var(--color-text-2)',
                  cursor:         'pointer',
                  fontSize:       'var(--text-sm)',
                  fontWeight:     active === item.id ? 700 : 500,
                  textAlign:      'left',
                  transition:     'background 0.15s, color 0.15s',
                  gap:            'var(--space-2)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  {item.icon}
                  {item.label}
                </span>
                {active === item.id && <ChevronRight size={14} />}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div>
            {active === 'account' && (
              <>
                <AccountSection uid={user.uid} />
                <PasswordSection />
              </>
            )}
            {active === 'privacy'       && <PrivacySection       uid={user.uid} />}
            {active === 'notifications' && <NotificationsSection uid={user.uid} />}
            {active === 'location'      && <LocationSection      uid={user.uid} />}
            {active === 'appearance'    && <AppearanceSection />}
            {active === 'language'      && <LanguageSection />}
            {active === 'danger'        && <DangerZoneSection />}
          </div>

        </div>
      </div>

      {/* Mobile nav — horizontal scrollable pill row */}
      <style>{`
        @media (max-width: 640px) {
          .settings-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </LayoutWrapper>
  );
}
