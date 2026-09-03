'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [loading, setLoading] = useState(false);

  // Validate Name constraint in real-time
  const nameIsNumbersOnly = useMemo(() => {
    const trimmed = name.trim();
    return trimmed.length > 0 && /^\d+$/.test(trimmed);
  }, [name]);

  // Compute Password Strength
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: 'transparent', width: '0%' };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;

    if (score <= 2) {
      return { score, label: 'Weak', color: '#f87171', width: '33%' };
    } else if (score <= 4) {
      return { score, label: 'Medium', color: '#fbbf24', width: '66%' };
    } else {
      return { score, label: 'Strong', color: '#34d399', width: '100%' };
    }
  }, [password]);

  function triggerShake() {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 400);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2) {
      const msg = 'Name must be at least 2 characters.';
      setError(msg);
      toast({ type: 'error', message: msg });
      triggerShake();
      return;
    }

    if (/^\d+$/.test(cleanName)) {
      const msg = 'Name cannot be numbers only. Please use letters or your real name.';
      setError(msg);
      toast({ type: 'error', message: msg });
      triggerShake();
      return;
    }

    if (!cleanEmail) {
      const msg = 'Please enter a valid email address.';
      setError(msg);
      toast({ type: 'error', message: msg });
      triggerShake();
      return;
    }

    if (passwordStrength.score < 5) {
      const msg = 'Please choose a strong password (at least 8 chars, uppercase, lowercase, number, and special character).';
      setError(msg);
      toast({ type: 'error', message: msg });
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, name: cleanName, password }),
      });
      toast({ type: 'success', message: 'Account created successfully! Welcome to Orbit.' });
      router.push('/drive');
    } catch (err) {
      triggerShake();
      if (err instanceof ApiError) {
        setError(err.message);
        toast({ type: 'error', message: err.message });
      } else {
        const msg = 'Something went wrong. Please try again.';
        setError(msg);
        toast({ type: 'error', message: msg });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`auth-card ${isShaking ? 'animate-shake' : ''}`}>
      <div className="auth-card-header">
        <div className="auth-logo" aria-hidden="true">🪐</div>
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Join Orbit today</p>
      </div>

      <form id="register-form" className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="register-name" className="form-label">Full name</label>
          <input
            id="register-name"
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            placeholder="Jane Smith"
          />
          {nameIsNumbersOnly && (
            <div style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>
              Name cannot be numbers only. Please use letters.
            </div>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="register-email" className="form-label">Email address</label>
          <input
            id="register-email"
            type="email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </div>

        <div className="form-field">
          <label htmlFor="register-password" className="form-label">Password</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              style={{ width: '100%', paddingRight: '42px' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Min 8 chars, 1 uppercase, 1 special"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: '10px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
              }}
            >
              {showPassword ? '👁️' : '🔒'}
            </button>
          </div>

          {password.length > 0 && (
            <div style={{ marginTop: '6px' }}>
              <div
                style={{
                  height: '4px',
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: passwordStrength.width,
                    background: passwordStrength.color,
                    transition: 'width 0.25s ease, background-color 0.25s ease',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '4px',
                  fontSize: '11px',
                  color: passwordStrength.color,
                  fontWeight: 500,
                }}
              >
                <span>Password Strength: {passwordStrength.label}</span>
                <span style={{ color: 'var(--text-muted, #94a3b8)' }}>
                  Requires: A-Z, a-z, 0-9, special
                </span>
              </div>
            </div>
          )}
        </div>

        <button
          id="register-submit"
          type="submit"
          className="btn btn--primary btn--full"
          disabled={loading || nameIsNumbersOnly}
          aria-busy={loading}
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account?{' '}
        <Link href="/login" className="auth-link">
          Sign in
        </Link>
      </p>
    </div>
  );
}
