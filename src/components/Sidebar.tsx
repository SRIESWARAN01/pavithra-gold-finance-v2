'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Coins, 
  Receipt, 
  Settings, 
  LogOut,
  QrCode,
  BookOpen,
  Gavel,
  Building2,
  UserCog,
  FileText,
  Bell,
  HeadphonesIcon,
  BarChart3,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  X,
  ChevronsLeft,
  ChevronsRight,
  ShieldCheck
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import Logo from '@/components/Logo';

interface MenuSection {
  title: string;
  items: { name: string; path: string; icon: any; badge?: string }[];
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [miniMode, setMiniMode] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (onClose) onClose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const menuSections: MenuSection[] = [
    {
      title: 'Operations',
      items: [
        { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
        { name: 'Approvals Queue', path: '/admin/approvals', icon: ShieldCheck },
        { name: 'Customers', path: '/admin/customers', icon: Users },
        { name: 'Appraisal & Loans', path: '/admin/loans/new', icon: Coins },
        { name: 'Payments Ledger', path: '/admin/payments', icon: Receipt },
        { name: 'Bank Re-Pledge', path: '/admin/re-pledge', icon: Building2 },
        { name: 'Ticket Scanner', path: '/admin/loans/scan', icon: QrCode },
        { name: 'Auction Manager', path: '/admin/auctions', icon: Gavel },
      ]
    },
    {
      title: 'Finance',
      items: [
        { name: 'Live Statement', path: '/admin/statement', icon: FileText },
        { name: 'Billing Engine', path: '/admin/billing', icon: Receipt },
        { name: 'Accounting ERP', path: '/admin/accounting', icon: BookOpen },
        { name: 'Reports Center', path: '/admin/reports', icon: BarChart3 },
      ]
    },
    {
      title: 'Management',
      items: [
        { name: 'Employees', path: '/admin/employees', icon: UserCog },
        { name: 'Branches', path: '/admin/branches', icon: Building2 },
        { name: 'Documents', path: '/admin/documents', icon: FolderOpen },
        { name: 'Notifications', path: '/admin/notifications', icon: Bell },
        { name: 'Support', path: '/admin/support', icon: HeadphonesIcon },
      ]
    },
    {
      title: 'System',
      items: [
        { name: 'Settings & Security', path: '/admin/settings', icon: Settings },
      ]
    }
  ];

  const toggleSection = (title: string) => {
    setCollapsed(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pgf_bypass_session');
    }
    await auth.signOut();
    router.push('/');
  };

  const sidebarContent = (
    <aside 
      className={`${miniMode ? 'w-[72px]' : 'w-64'} bg-white border-r border-gray-200 flex flex-col justify-between h-screen overflow-hidden shrink-0 transition-all duration-300`}
      aria-label="Admin navigation"
    >
      <div className="flex flex-col overflow-y-auto scrollbar-thin">
        {/* Logo and Brand */}
        <div className={`p-4 ${miniMode ? 'px-3' : 'px-5'} border-b border-gray-100 flex items-center justify-between`}>
          {miniMode ? (
            <Logo size="sm" hideText />
          ) : (
            <Logo size="sm" />
          )}
          {/* Close button — only on mobile overlay */}
          {onClose && (
            <button 
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Close navigation menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden lg:flex justify-end px-2 pt-2">
          <button
            onClick={() => setMiniMode(!miniMode)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            aria-label={miniMode ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {miniMode ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="p-2 flex flex-col gap-0.5 mt-1">
          {menuSections.map((section) => {
            const isCollapsed = collapsed[section.title];
            const hasActiveItem = section.items.some(item => pathname.startsWith(item.path));
            return (
              <div key={section.title} className="mb-1">
                {!miniMode && (
                  <button
                    onClick={() => toggleSection(section.title)}
                    className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    <span className={hasActiveItem ? 'text-blue-600' : ''}>{section.title}</span>
                    {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  </button>
                )}
                {(miniMode || !isCollapsed) && (
                  <div className={`flex flex-col gap-0.5 ${miniMode ? '' : 'ml-1'}`}>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.path || 
                        (item.path !== '/admin/dashboard' && pathname.startsWith(item.path));
                      return (
                        <Link
                          key={item.path}
                          href={item.path}
                          title={miniMode ? item.name : undefined}
                          className={`flex items-center ${miniMode ? 'justify-center' : ''} gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                            isActive 
                              ? 'bg-blue-50 text-blue-700 shadow-sm' 
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                        >
                          <Icon size={18} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                          {!miniMode && <span className="truncate">{item.name}</span>}
                          {!miniMode && item.badge && (
                            <span className="ml-auto text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Logout Section */}
      <div className="p-3 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className={`w-full flex items-center ${miniMode ? 'justify-center' : ''} gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-red-500 hover:bg-red-50 transition-all duration-200`}
        >
          <LogOut size={18} />
          {!miniMode && 'Sign Out'}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop: permanent sidebar */}
      <div className="hidden lg:flex">
        {sidebarContent}
      </div>

      {/* Mobile/Tablet: overlay sidebar */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="sidebar-overlay lg:hidden" 
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Sliding sidebar panel */}
          <div className={`fixed inset-y-0 left-0 z-50 lg:hidden sidebar-slide ${isOpen ? 'sidebar-slide-enter' : 'sidebar-slide-exit'}`}>
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}
