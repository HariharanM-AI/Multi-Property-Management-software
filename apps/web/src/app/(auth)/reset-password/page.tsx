'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { ApiResponse } from '@propertyos/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    }
  }, [searchParams]);

  // Password validation criteria
  const hasMinLen = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const isPasswordValid = hasMinLen && hasUpper && hasLower && hasNumber && hasSpecial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!token.trim()) {
      setErrorMessage('Reset token is missing or invalid.');
      return;
    }

    if (!isPasswordValid) {
      setErrorMessage('Please ensure your new password meets all complexity requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          newPassword,
        }),
      });

      const json: ApiResponse<{ message: string }> = await res.json();

      if (res.ok && json.success) {
        setIsSuccess(true);
      } else {
        const detailMsg = json.error?.details?.[0]?.message;
        setErrorMessage(detailMsg || json.error?.message || 'Password reset failed. The token may be expired or invalid.');
      }
    } catch {
      setErrorMessage('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-brand-white py-8 px-6 shadow-sm border border-surface-border rounded-2xl sm:px-10">
      {isSuccess ? (
        <div className="space-y-6 text-center">
          <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200 text-brand-teal flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-brand-navy">Password Reset Complete</h3>
            <p className="text-xs text-surface-textSecondary mt-2 leading-relaxed">
              Your password has been updated and all active sessions have been securely invalidated.
            </p>
          </div>
          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              className="w-full font-semibold shadow-sm"
              onClick={() => router.push('/login')}
            >
              Sign In with New Password
            </Button>
          </div>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          {errorMessage && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-300 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-brand-navy shrink-0 mt-0.5" />
              <div className="text-xs text-brand-navy leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Reset Token Input */}
          <div>
            <label htmlFor="token" className="block text-xs font-semibold text-brand-navy">
              Reset Token
            </label>
            <div className="mt-1 relative rounded-lg shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <KeyRound className="h-4 w-4 text-surface-textSecondary" />
              </div>
              <input
                id="token"
                name="token"
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your reset token"
                className="block w-full pl-10 pr-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-xs font-mono text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* New Password Input */}
          <div>
            <label htmlFor="newPassword" className="block text-xs font-semibold text-brand-navy">
              New Password
            </label>
            <div className="mt-1 relative rounded-lg shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-surface-textSecondary" />
              </div>
              <input
                id="newPassword"
                name="newPassword"
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
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

            {/* Password Checklist */}
            <div className="mt-2.5 p-3 rounded-lg bg-surface-subtle border border-surface-border space-y-1 text-[11px]">
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${hasMinLen ? 'text-brand-teal' : 'text-surface-disabled'}`}
                />
                <span className={hasMinLen ? 'text-brand-navy font-medium' : 'text-surface-textSecondary'}>
                  At least 8 characters
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${hasUpper && hasLower ? 'text-brand-teal' : 'text-surface-disabled'}`}
                />
                <span className={hasUpper && hasLower ? 'text-brand-navy font-medium' : 'text-surface-textSecondary'}>
                  Uppercase & lowercase letters
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${hasNumber && hasSpecial ? 'text-brand-teal' : 'text-surface-disabled'}`}
                />
                <span className={hasNumber && hasSpecial ? 'text-brand-navy font-medium' : 'text-surface-textSecondary'}>
                  At least one number & special symbol
                </span>
              </div>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-semibold text-brand-navy">
              Confirm New Password
            </label>
            <div className="mt-1 relative rounded-lg shadow-sm">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="block w-full px-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full font-semibold shadow-sm"
              isLoading={isSubmitting}
            >
              Update Password
            </Button>
          </div>

          <div className="pt-4 border-t border-surface-border text-center">
            <Link
              href="/login"
              className="text-xs font-semibold text-brand-navy hover:text-brand-teal"
            >
              Cancel and Return to Sign In
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-surface-subtle flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-teal flex items-center justify-center font-bold text-brand-white text-xl shadow-sm">
            P
          </div>
          <span className="text-2xl font-bold text-brand-navy tracking-tight">PropertyOS</span>
        </Link>
        <h2 className="mt-6 text-2xl font-bold text-brand-navy">Set New Password</h2>
        <p className="mt-2 text-xs text-surface-textSecondary">
          Enter your token and choose a secure replacement password.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Suspense fallback={<div className="p-8 text-center text-xs text-surface-textSecondary">Loading reset form...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
