'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setIsSubmitting(true);
    const result = await login({ email: email.trim(), password });
    setIsSubmitting(false);

    if (result.success) {
      router.push('/');
    } else {
      setErrorMessage(result.error || 'Invalid email or password.');
    }
  };

  return (
    <div className="min-h-screen bg-surface-subtle flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-teal flex items-center justify-center font-bold text-brand-white text-xl shadow-sm">
            P
          </div>
          <span className="text-2xl font-bold text-brand-navy tracking-tight">PropertyOS</span>
        </Link>
        <h2 className="mt-6 text-2xl font-bold text-brand-navy">Sign in to your account</h2>
        <p className="mt-2 text-xs text-surface-textSecondary">
          Commercial SaaS Property Management for Indian PG & Rental Operations
        </p>
      </div>

      {/* Login Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-brand-white py-8 px-6 shadow-sm border border-surface-border rounded-2xl sm:px-10">
          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-300 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-brand-navy shrink-0 mt-0.5" />
              <div className="text-xs text-brand-navy leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-brand-navy">
                Email Address
              </label>
              <div className="mt-1.5 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-surface-textSecondary" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@company.com"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-semibold text-brand-navy">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-brand-teal hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="mt-1.5 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-surface-textSecondary" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-surface-textSecondary hover:text-brand-navy"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full font-semibold shadow-sm"
              isLoading={isSubmitting}
            >
              Sign in to Dashboard
            </Button>
          </form>

          {/* Switch to Register */}
          <div className="mt-6 pt-6 border-t border-surface-border text-center">
            <p className="text-xs text-surface-textSecondary">
              New property owner?{' '}
              <Link href="/register" className="font-semibold text-brand-teal hover:underline">
                Register organization
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
