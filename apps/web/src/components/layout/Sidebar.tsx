'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PropertyType } from '@propertyos/types';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  Building2,
  Users,
  ReceiptText,
  Wrench,
  UserCheck,
  UserMinus,
  ShieldCheck,
  Package,
  CircleDollarSign,
  FileSpreadsheet,
  FileSignature,
  Settings,
  BedDouble,
  UtensilsCrossed,
  Zap,
  Receipt,
  Bell,
  Sparkles,
  History,
  CalendarClock,
  UserCircle,
} from 'lucide-react';

interface SidebarProps {
  currentPropertyType: PropertyType;
  activePath?: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  pgOnly?: boolean;
  rentalOnly?: boolean;
}

interface NavCategory {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPropertyType, activePath }) => {
  const { user, organization, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const currentPath = (pathname || activePath || '/').replace(/\/$/, '') || '/';

  const navCategories: NavCategory[] = [
    {
      title: 'Core Management',
      items: [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        { name: 'Properties', href: '/properties', icon: Building2 },
        { name: 'Tenants', href: '/tenants', icon: Users },
        { name: 'Agreements', href: '/agreements', icon: FileSignature },
      ],
    },
    {
      title: 'Financial Suite',
      items: [
        { name: 'Billing', href: '/billing', icon: ReceiptText },
        { name: 'Invoices', href: '/invoices', icon: FileSpreadsheet },
        { name: 'Payments', href: '/payments', icon: CircleDollarSign },
        { name: 'Financials', href: '/financials', icon: Zap },
        { name: 'Expenses', href: '/expenses', icon: Receipt },
        { name: 'Reports & P&L', href: '/reports', icon: FileSpreadsheet },
      ],
    },
    {
      title: 'Property Operations',
      items: [
        { name: 'Maintenance & Facility', href: '/services', icon: Wrench },
        { name: 'Staff & Roster', href: '/staff', icon: UserCheck },
        { name: 'Visitors', href: '/visitors', icon: ShieldCheck },
        { name: 'Inventory', href: '/inventory', icon: Package },
        { name: 'Meal & Mess', href: '/meals', icon: UtensilsCrossed, pgOnly: true },
      ],
    },
    {
      title: 'System & Governance',
      items: [
        { name: 'Notifications', href: '/notifications', icon: Bell },
        { name: 'Audit Trail', href: '/audit', icon: History },
        { name: 'Jobs & Automation', href: '/jobs', icon: CalendarClock },
        { name: 'Profile', href: '/profile', icon: UserCircle },
        { name: 'Settings', href: '/settings/organization', icon: Settings },
      ],
    },
  ];

  const isRouteActive = (itemHref: string) => {
    if (itemHref === '/') {
      return currentPath === '/';
    }
    if (itemHref === '/services') {
      return (
        currentPath === '/services' ||
        currentPath.startsWith('/services/') ||
        currentPath === '/maintenance' ||
        currentPath.startsWith('/maintenance/')
      );
    }
    if (itemHref === '/settings/organization') {
      return currentPath.startsWith('/settings');
    }
    if (itemHref === '/profile') {
      return currentPath.startsWith('/profile');
    }
    return currentPath === itemHref || currentPath.startsWith(itemHref + '/');
  };

  const getInitials = () => {
    if (!user) return 'PO';
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <aside className="w-64 bg-brand-navy text-brand-white flex flex-col h-screen border-r border-slate-800 shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-base bg-brand-teal shadow-xs">
          P
        </div>
        <div>
          <h1 className="font-bold text-base tracking-tight text-brand-white">PropertyOS</h1>
          <p className="text-[10px] text-slate-400 font-medium tracking-wide">Enterprise Management</p>
        </div>
      </div>

      {/* Operating Model Context Badge */}
      <div className="px-4 py-2.5 bg-slate-900/70 border-b border-slate-800/80">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">Active Mode:</span>
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold border bg-brand-teal/20 text-teal-300 border-brand-teal/30">
            {currentPropertyType === PropertyType.PG ? 'PG / Co-Living' : 'Whole-Unit Rental'}
          </span>
        </div>
      </div>

      {/* Categorized Navigation Links */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
        {navCategories.map((category) => {
          const filteredCategoryItems = category.items.filter((item) => {
            if (item.pgOnly && currentPropertyType !== PropertyType.PG) return false;
            if (item.rentalOnly && currentPropertyType !== PropertyType.RENTAL_HOUSE) return false;
            return true;
          });

          if (filteredCategoryItems.length === 0) return null;

          return (
            <div key={category.title} className="space-y-1">
              <div className="px-3 pb-1 pt-0.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                {category.title}
              </div>

              {filteredCategoryItems.map((item) => {
                const Icon = item.icon;
                const isActive = isRouteActive(item.href);

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-brand-teal text-brand-white shadow-sm font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-brand-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-opacity ${
                          isActive ? 'opacity-100 text-white' : 'opacity-80 text-slate-400'
                        }`}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User / Organization Footer */}
      <div className="p-3.5 border-t border-slate-800 flex items-center gap-3 bg-slate-900/40">
        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-brand-teal shrink-0">
          {getInitials()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-brand-white truncate">
            {organization?.name || (isAuthenticated ? 'My Organization' : 'PropertyOS Enterprise')}
          </p>
          <p className="text-[11px] text-slate-400 truncate">
            {user ? `${user.roles[0] || 'OWNER'} Account` : 'Guest Session'}
          </p>
        </div>
      </div>
    </aside>
  );
};
