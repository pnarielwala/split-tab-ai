'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { linkUserIdentifiers } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/dashboard';

  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [delivery, setDelivery] = useState<'email' | 'phone'>('email');
  const [token, setToken] = useState('');
  const [smsConsent, setSmsConsent] = useState(false);
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const phoneRegex = /^\+[1-9]\d{7,14}$/;

  function normalizePhone(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    if (value.startsWith('+')) return `+${digits}`;
    return value;
  }

  async function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    const normalizedPhone = normalizePhone(phone);

    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!email.trim()) newErrors.email = 'Email is required';
    if (!phoneRegex.test(normalizedPhone))
      newErrors.phone = 'Enter a valid phone number (e.g. 555-123-4567)';
    if (!smsConsent)
      newErrors.smsConsent =
        'You must agree to receive SMS reminders to continue';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setPhone(normalizedPhone);
    setLoading(true);
    const supabase = createClient();

    const { error } =
      delivery === 'email'
        ? await supabase.auth.signInWithOtp({ email })
        : await supabase.auth.signInWithOtp({ phone: normalizedPhone });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setStep('otp');
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (!/^\d{6}$/.test(token)) {
      setErrors({ token: 'Enter the 6-digit code' });
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error } =
      delivery === 'email'
        ? await supabase.auth.verifyOtp({ email, token, type: 'email' })
        : await supabase.auth.verifyOtp({ phone, token, type: 'sms' });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    let user = data.user;
    if (!user) {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      user = currentUser;
    }

    if (user) {
      try {
        const { error: linkError } = await linkUserIdentifiers(
          user.id,
          email.trim(),
          phone.trim()
        );
        if (linkError) {
          toast.error('Failed to link account: ' + linkError);
          setLoading(false);
          return;
        }
      } catch {
        toast.error('Failed to link account');
        setLoading(false);
        return;
      }

      const { error: upsertError } = await supabase.from('profiles').upsert({
        id: user.id,
        email: email.trim() || null,
        phone: phone.trim() || null,
        display_name: `${firstName} ${lastName}`.trim(),
        sms_consent_given_at: new Date().toISOString(),
      });
      if (upsertError) {
        toast.error('Failed to save profile: ' + upsertError.message);
        setLoading(false);
        return;
      }
    }

    router.push(next);
    router.refresh();
  }

  if (step === 'otp') {
    return (
      <form onSubmit={handleOtpSubmit} className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          Code sent to {delivery === 'email' ? email : phone}
        </p>

        <div className="space-y-1">
          <Label htmlFor="token">Verification code</Label>
          <Input
            id="token"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            autoComplete="one-time-code"
            value={token}
            onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
          />
          {errors.token && (
            <p className="text-xs text-destructive">{errors.token}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Verifying...' : 'Verify code'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Wrong {delivery === 'email' ? 'email' : 'number'}?{' '}
          <button
            type="button"
            onClick={() => {
              setStep('details');
              setToken('');
            }}
            className="text-primary underline underline-offset-4"
          >
            Go back
          </button>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={handleDetailsSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            type="text"
            placeholder="Jane"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          {errors.firstName && (
            <p className="text-xs text-destructive">{errors.firstName}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            type="text"
            placeholder="Smith"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          {errors.lastName && (
            <p className="text-xs text-destructive">{errors.lastName}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="jane@example.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="phone">Phone number</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="555-123-4567"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {errors.phone && (
          <p className="text-xs text-destructive">{errors.phone}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label>Send code via</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDelivery('email')}
            className={`flex-1 rounded-full border py-1.5 text-sm font-medium transition-colors ${
              delivery === 'email'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-input bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => setDelivery('phone')}
            className={`flex-1 rounded-full border py-1.5 text-sm font-medium transition-colors ${
              delivery === 'phone'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-input bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            Phone
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={smsConsent}
            onChange={(e) => setSmsConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border border-input accent-primary cursor-pointer"
          />
          <span className="text-sm text-muted-foreground leading-snug">
            I agree to receive SMS payment reminders from Split Tab AI.{' '}
            <button
              type="button"
              onClick={() => setConsentDialogOpen(true)}
              className="text-primary underline underline-offset-4"
            >
              Learn more
            </button>
          </span>
        </label>
        {errors.smsConsent && (
          <p className="text-xs text-destructive">{errors.smsConsent}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Sending code...' : 'Send code'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href="/login"
          className="text-primary underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>

      <Dialog open={consentDialogOpen} onOpenChange={setConsentDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>SMS messaging consent</DialogTitle>
            <DialogDescription>What you&apos;re agreeing to</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              By checking this box, you consent to receive automated SMS payment
              reminder messages from Split Tab AI to the phone number you provided.
            </p>
            <p>
              <strong className="text-foreground">Message types:</strong> You
              will receive messages when a bill owner requests payment from you,
              including your amount owed and their payment details.
            </p>
            <p>
              <strong className="text-foreground">Message frequency:</strong>{' '}
              Message frequency varies based on bill activity.
            </p>
            <p>
              <strong className="text-foreground">Opt-out:</strong> Reply{' '}
              <strong className="text-foreground">STOP</strong> to any message
              to unsubscribe. Reply{' '}
              <strong className="text-foreground">HELP</strong> for help.
            </p>
            <p>
              Message and data rates may apply. Consent is not a condition of
              purchase or use of the service.
            </p>
          </div>
          <DialogClose asChild>
            <Button className="w-full">Got it</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </form>
  );
}
