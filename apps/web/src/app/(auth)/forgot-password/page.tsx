'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { ApiResponse } from '@propertyos/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [devResetToken, setDevResetToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const json: ApiResponse<{ message: string; devResetToken?: string }> = await res.json();

      if (res.ok && json.success) {
        setIsSuccess(true);
        if (json.data?.devResetToken) {
          setDevResetToken(json.data.devResetToken);
        }
      } else {
        setErrorMessage(json.error?.message || 'Unable to process request.');
      }
    } catch {
      setErrorMessage('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
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
        <h2 className="mt-6 text-2xl font-bold text-brand-navy">Reset your password</h2>
        <p className="mt-2 text-xs text-surface-textSecondary">
          Enter your registered email address to receive password reset instructions.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-brand-white py-8 px-6 shadow-sm border border-surface-border rounded-2xl sm:px-10">
          {isSuccess ? (
            <div className="space-y-6 text-center">
              <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200 text-brand-teal flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-brand-navy">Instructions Sent</h3>
                <p className="text-xs text-surface-textSecondary mt-2 leading-relaxed">
                  If an account exists for <span className="font-semibold text-brand-navy">{email}</span>, password reset instructions have been generated.
                </p>
              </div>

              {process.env.NODE_ENV === 'development' && devResetToken && (
                <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl text-left space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-brand-teal">
                    Development Reset Link
                  </div>
                  <p className="text-xs text-brand-navy break-all font-mono">
                    Token: {devResetToken}
                  </p>
                  <Link
                    href={`/reset-password?token=${devResetToken}`}
                    className="inline-block mt-2 text-xs font-semibold text-brand-teal hover:underline"
                  >
                    Proceed to Reset Password Screen →
                  </Link>
                </div>
              )}

              <div className="pt-4 border-t border-surface-border">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-brand-navy hover:text-brand-teal"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {errorMessage && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-300 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-brand-navy shrink-0 mt-0.5" />
                  <div className="text-xs text-brand-navy leading-relaxed">{errorMessage}</div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-brand-navy">
                  Registered Email Address
                </label>
                <div className="mt-1.5 relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-surface-textSecondary" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@company.com"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full font-semibold shadow-sm"
                isLoading={isSubmitting}
              >
                Send Reset Instructions
              </Button>

              <div className="pt-4 border-t border-surface-border text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-brand-navy hover:text-brand-teal"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
