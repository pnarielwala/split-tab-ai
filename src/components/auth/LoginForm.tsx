'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/dashboard';

  const [step, setStep] = useState<'method' | 'otp'>('method');
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
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

  async function handleMethodSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    const normalizedPhone = normalizePhone(phone);

    if (authMethod === 'phone') {
      if (!phoneRegex.test(normalizedPhone))
        newErrors.phone = 'Enter a valid phone number (e.g. 555-123-4567)';
    } else {
      if (!email.trim()) newErrors.email = 'Email is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setPhone(normalizedPhone);
    setLoading(true);
    const supabase = createClient();

    const { data: accountExists } = await supabase.rpc(
      'check_account_exists',
      authMethod === 'phone'
        ? { p_phone: normalizedPhone }
        : { p_email: email.trim() }
    );

    if (!accountExists) {
      setErrors(
        authMethod === 'phone'
          ? { phone: 'No account found with that phone number' }
          : { email: 'No account found with that email address' }
      );
      setLoading(false);
      return;
    }

    const { error } =
      authMethod === 'phone'
        ? await supabase.auth.signInWithOtp({
            phone: normalizedPhone,
            options: { shouldCreateUser: false },
          })
        : await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: { shouldCreateUser: false },
          });

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

    const { error } =
      authMethod === 'phone'
        ? await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
        : await supabase.auth.verifyOtp({ email, token, type: 'email' });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  if (step === 'otp') {
    return (
      <form onSubmit={handleOtpSubmit} className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          Code sent to {authMethod === 'email' ? email : phone}
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
          Wrong {authMethod === 'email' ? 'email' : 'number'}?{' '}
          <button
            type="button"
            onClick={() => {
              setStep('method');
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
    <form onSubmit={handleMethodSubmit} className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setAuthMethod('phone');
            setErrors({});
          }}
          className={`flex-1 rounded-full border py-1.5 text-sm font-medium transition-colors ${
            authMethod === 'phone'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-input bg-background text-muted-foreground hover:bg-muted'
          }`}
        >
          Phone
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthMethod('email');
            setErrors({});
          }}
          className={`flex-1 rounded-full border py-1.5 text-sm font-medium transition-colors ${
            authMethod === 'email'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-input bg-background text-muted-foreground hover:bg-muted'
          }`}
        >
          Email
        </button>
      </div>

      {authMethod === 'phone' ? (
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
      ) : (
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
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Sending code...' : 'Send code'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link
          href={next !== '/dashboard' ? `/signup?next=${encodeURIComponent(next)}` : '/signup'}
          className="text-primary underline underline-offset-4"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}
