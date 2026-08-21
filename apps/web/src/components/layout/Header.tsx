'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PropertyType, PropertyDto, ApiResponse } from '@propertyos/types';
import { useAuth } from '@/lib/auth-context';
import { Building2, Bell, Shield, LogOut, LogIn, UserPlus, ChevronDown, Plus } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface HeaderProps {
  currentPropertyType: PropertyType;
  onPropertyTypeChange: (type: PropertyType) => void;
  selectedPropertyName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentPropertyType,
  onPropertyTypeChange,
  selectedPropertyName,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const [properties, setProperties] = useState<PropertyDto[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<PropertyDto | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetch(`${API_BASE}/properties?pageSize=50`, {
        method: 'GET',
        credentials: 'include',
      })
        .then((res) => res.json())
        .then((json: ApiResponse<PropertyDto[]>) => {
          if (json.success && json.data && json.data.length > 0) {
            setProperties(json.data);
            setSelectedProperty(json.data[0]);
            onPropertyTypeChange(json.data[0].propertyType);
          }
        })
        .catch(() => {
          // Fallback to default state if offline/unauthorized
        });
    }
  }, [isAuthenticated]);

  const handleSelectProperty = (prop: PropertyDto) => {
    setSelectedProperty(prop);
    onPropertyTypeChange(prop.propertyType);
    setIsDropdownOpen(false);
  };

  const displayName =
    selectedProperty?.name ||
    selectedPropertyName ||
    (currentPropertyType === PropertyType.PG
      ? 'GreenGlen PG Residency'
      : 'Indiranagar Heights Flat #402');

  return (
    <header className="h-16 bg-brand-white border-b border-surface-border px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Property Switcher & Context */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-surface-subtle border border-surface-border hover:bg-slate-100 transition-colors text-xs font-semibold text-brand-navy"
          >
            <Building2 className="w-4 h-4 text-brand-teal shrink-0" />
            <span className="max-w-[200px] truncate">{displayName}</span>
            <ChevronDown className="w-3.5 h-3.5 text-surface-textSecondary" />
          </button>

          {isDropdownOpen && (
            <div className="absolute left-0 mt-2 w-72 bg-brand-white rounded-xl border border-surface-border shadow-xl py-2 z-50">
              <div className="px-3 py-1 text-[11px] font-bold text-surface-textSecondary uppercase tracking-wider">
                Select Property
              </div>
              <div className="max-h-60 overflow-y-auto">
                {properties.length > 0 ? (
                  properties.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectProperty(p)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-surface-subtle transition-colors ${
                        selectedProperty?.id === p.id ? 'bg-teal-50/60 text-brand-teal font-bold' : 'text-brand-navy'
                      }`}
                    >
                      <div className="truncate">
                        <p className="font-semibold truncate">{p.name}</p>
                        <p className="text-[10px] text-surface-textSecondary font-mono">{p.code} • {p.city}</p>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          p.propertyType === PropertyType.PG
                            ? 'bg-teal-50 text-brand-teal'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {p.propertyType === PropertyType.PG ? 'PG' : 'Rental'}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-surface-textSecondary">
                    No registered properties found
                  </div>
                )}
              </div>
              <div className="pt-2 mt-1 border-t border-surface-border px-2">
                <Link
                  href="/properties/new"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-brand-teal hover:bg-teal-50 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add New Property
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Operating Model Toggle */}
        <div className="flex items-center bg-surface-subtle p-1 rounded-lg border border-surface-border text-xs font-medium">
          <button
            onClick={() => onPropertyTypeChange(PropertyType.PG)}
            className={`px-3 py-1 rounded-md transition-all ${
              currentPropertyType === PropertyType.PG
                ? 'bg-brand-navy text-brand-white shadow-sm font-semibold'
                : 'text-surface-textSecondary hover:text-brand-navy'
            }`}
          >
            PG Model
          </button>
          <button
            onClick={() => onPropertyTypeChange(PropertyType.RENTAL_HOUSE)}
            className={`px-3 py-1 rounded-md transition-all ${
              currentPropertyType === PropertyType.RENTAL_HOUSE
                ? 'bg-brand-navy text-brand-white shadow-sm font-semibold'
                : 'text-surface-textSecondary hover:text-brand-navy'
            }`}
          >
            Rental House Model
          </button>
        </div>
      </div>

      {/* Right Actions & Auth Status */}
      <div className="flex items-center gap-4">
        {/* Zero-AI Deterministic Guarantee Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-50 border border-teal-200 text-[11px] font-semibold text-brand-teal">
          <Shield className="w-3.5 h-3.5" />
          <span>Deterministic Core Active</span>
        </div>

        {/* Notification Bell */}
        <button
          aria-label="Notifications"
          className="p-2 rounded-lg text-surface-textSecondary hover:bg-surface-subtle hover:text-brand-navy transition-colors relative"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-teal" />
        </button>

        {/* User / Authentication Actions */}
        <div className="flex items-center gap-3 pl-2 border-l border-surface-border">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-semibold text-brand-navy">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-[10px] text-brand-teal font-medium uppercase">
                  {user.roles[0] || 'OWNER'}
                </p>
              </div>
              <button
                onClick={() => logout()}
                title="Sign Out"
                className="p-2 rounded-lg text-surface-textSecondary hover:bg-slate-100 hover:text-brand-navy transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-subtle border border-surface-border text-brand-navy hover:bg-brand-white transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-teal text-brand-white hover:bg-teal-700 transition-colors shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
