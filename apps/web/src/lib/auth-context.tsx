'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, AuthOrganization, ApiResponse, AuthResponseData } from '@propertyos/types';
import { RegisterOwnerInput, LoginInput } from '@propertyos/validation';

interface AuthContextType {
  user: AuthUser | null;
  organization: AuthOrganization | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<{ success: boolean; error?: string }>;
  register: (input: RegisterOwnerInput) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organization, setOrganization] = useState<AuthOrganization | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: 'GET',
        credentials: 'include',
      });

      if (res.ok) {
        const json: ApiResponse<{ user: AuthUser }> = await res.json();
        if (json.data?.user) {
          setUser(json.data.user);
          setOrganization({
            id: json.data.user.organizationId,
            name: json.data.user.organizationName || 'My Organization',
          });
        } else {
          setUser(null);
          setOrganization(null);
        }
      } else {
        setUser(null);
        setOrganization(null);
      }
    } catch {
      setUser(null);
      setOrganization(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (input: LoginInput): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });

      const json: ApiResponse<AuthResponseData> = await res.json();

      if (!res.ok || !json.success) {
        return {
          success: false,
          error: json.error?.message || 'Invalid email or password.',
        };
      }

      if (json.data) {
        setUser(json.data.user);
        setOrganization(json.data.organization);
      }

      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Unable to connect to the authentication server. Please try again.',
      };
    }
  };

  const register = async (input: RegisterOwnerInput): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });

      const json: ApiResponse<AuthResponseData> = await res.json();

      if (!res.ok || !json.success) {
        const detailMsg = json.error?.details?.[0]?.message;
        return {
          success: false,
          error: detailMsg || json.error?.message || 'Registration failed.',
        };
      }

      if (json.data) {
        setUser(json.data.user);
        setOrganization(json.data.organization);
      }

      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Unable to connect to the registration server. Please try again.',
      };
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Clear state regardless
    } finally {
      setUser(null);
      setOrganization(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
