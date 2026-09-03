'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isInvalidCredentials, setIsInvalidCredentials] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsInvalidCredentials(false);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      toast({ type: 'error', message: 'Please enter your email address.' });
      triggerShake();
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      toast({ type: 'error', message: 'Please enter your password.' });
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, password }),
      });
      toast({ type: 'success', message: 'Welcome back! Loading your drive...' });
      router.push('/drive');
    } catch (err) {
      triggerShake();
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_CREDENTIALS' || err.status === 401) {
          setIsInvalidCredentials(true);
          setError('Invalid email or password. Please check your credentials or create an account.');
          toast({ type: 'error', message: 'Invalid credentials! Wrong email or password entered.' });
        } else if (err.code === 'RATE_LIMIT_EXCEEDED' || err.status === 429) {
          const msg = err.message || 'Too many login attempts. Please wait 15 minutes before trying again.';
          setError(msg);
          toast({ type: 'error', message: 'Too many attempts! Account locked for 15 minutes.' });
        } else {
          setError(err.message);
          toast({ type: 'error', message: err.message });
        }
      } else {
        const msg = 'Something went wrong. Please check your network connection.';
        setError(msg);
        toast({ type: 'error', message: msg });
      }
    } finally {
      setLoading(false);
    }
  }

  function triggerShake() {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 400);
  }

  return (
    <div className={`auth-card ${isShaking ? 'animate-shake' : ''}`}>
      <div className="auth-card-header">
        <div className="auth-logo" aria-hidden="true">🪐</div>
        <h1 className="auth-title">Sign in to Orbit</h1>
        <p className="auth-subtitle">Welcome back</p>
      </div>

      <form id="login-form" className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="login-email" className="form-label">Email address</label>
          <input
            id="login-email"
            type="email"
            className={`form-input ${error ? 'border-red-500/70 ring-1 ring-red-500/30' : ''}`}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError('');
            }}
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </div>

        <div className="form-field">
          <label htmlFor="login-password" className="form-label">Password</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              className={`form-input ${error ? 'border-red-500/70 ring-1 ring-red-500/30' : ''}`}
              style={{ width: '100%', paddingRight: '42px' }}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              autoComplete="current-password"
              required
              placeholder="••••••••"
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
        </div>

        <button
          id="login-submit"
          type="submit"
          className="btn btn--primary btn--full"
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="auth-switch">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="auth-link">
          Create one
        </Link>
      </p>
    </div>
  );
}
