'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import {
  Building2,
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    organizationName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password validation criteria
  const hasMinLen = formData.password.length >= 8;
  const hasUpper = /[A-Z]/.test(formData.password);
  const hasLower = /[a-z]/.test(formData.password);
  const hasNumber = /[0-9]/.test(formData.password);
  const hasSpecial = /[^A-Za-z0-9]/.test(formData.password);
  const isPasswordValid = hasMinLen && hasUpper && hasLower && hasNumber && hasSpecial;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isPasswordValid) {
      setErrorMessage('Please ensure your password meets all complexity requirements.');
      return;
    }

    setIsSubmitting(true);
    const result = await register({
      organizationName: formData.organizationName.trim(),
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      password: formData.password,
    });
    setIsSubmitting(false);

    if (result.success) {
      router.push('/');
    } else {
      setErrorMessage(result.error || 'Registration failed. Please check your inputs.');
    }
  };

  return (
    <div className="min-h-screen bg-surface-subtle flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center">
        <Link href="/" className="inline-flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-teal flex items-center justify-center font-bold text-brand-white text-xl shadow-sm">
            P
          </div>
          <span className="text-2xl font-bold text-brand-navy tracking-tight">PropertyOS</span>
        </Link>
        <h2 className="mt-4 text-2xl font-bold text-brand-navy">Create Owner Account</h2>
        <p className="mt-1 text-xs text-surface-textSecondary">
          Set up your organization to manage PG, Co-Living, and Whole-Unit Rental properties.
        </p>
      </div>

      {/* Registration Form Card */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-brand-white py-8 px-6 shadow-sm border border-surface-border rounded-2xl sm:px-10">
          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-300 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-brand-navy shrink-0 mt-0.5" />
              <div className="text-xs text-brand-navy leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Organization Name */}
            <div>
              <label htmlFor="organizationName" className="block text-xs font-semibold text-brand-navy">
                Organization / Company Name
              </label>
              <div className="mt-1 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Building2 className="h-4 w-4 text-surface-textSecondary" />
                </div>
                <input
                  id="organizationName"
                  name="organizationName"
                  type="text"
                  required
                  value={formData.organizationName}
                  onChange={handleChange}
                  placeholder="e.g. Omkar Living Spaces Pvt Ltd"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Name Fields (2 Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-xs font-semibold text-brand-navy">
                  First Name
                </label>
                <div className="mt-1 relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-surface-textSecondary" />
                  </div>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="Rajesh"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="lastName" className="block text-xs font-semibold text-brand-navy">
                  Last Name
                </label>
                <div className="mt-1 relative rounded-lg shadow-sm">
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Sharma"
                    className="block w-full px-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-brand-navy">
                Work Email Address
              </label>
              <div className="mt-1 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-surface-textSecondary" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="rajesh@omkarliving.in"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Phone Field */}
            <div>
              <label htmlFor="phone" className="block text-xs font-semibold text-brand-navy">
                Mobile Number (India)
              </label>
              <div className="mt-1 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Phone className="h-4 w-4 text-surface-textSecondary" />
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="9845012345"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-brand-white border border-surface-border rounded-lg text-sm text-brand-navy placeholder-surface-disabled focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent transition-all"
                />
              </div>
              <p className="mt-1 text-[11px] text-surface-textSecondary">
                10-digit Indian mobile number (+91 prefix optional)
              </p>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-brand-navy">
                Password
              </label>
              <div className="mt-1 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-surface-textSecondary" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a strong password"
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

              {/* Live Password Strength Checklist */}
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

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full font-semibold shadow-sm"
                isLoading={isSubmitting}
              >
                Create Account & Organization
              </Button>
            </div>
          </form>

          {/* Switch to Login */}
          <div className="mt-6 pt-6 border-t border-surface-border text-center">
            <p className="text-xs text-surface-textSecondary">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-brand-teal hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
