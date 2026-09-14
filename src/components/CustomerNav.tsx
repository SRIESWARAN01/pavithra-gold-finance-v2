'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Coins, 
  Receipt, 
  FileText,
  User 
} from 'lucide-react';

export default function CustomerNav() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', path: '/customer/dashboard', icon: LayoutDashboard },
    { name: 'Statement', path: '/customer/statement', icon: FileText },
    { name: 'Collateral', path: '/customer/collateral', icon: Coins },
    { name: 'Payments', path: '/customer/payments', icon: Receipt },
    { name: 'Profile', path: '/customer/profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-200 flex items-center justify-around z-20 px-4 md:hidden h-16 safe-bottom shadow-lg shadow-black/5">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.path;
        return (
          <Link
            key={item.path}
            href={item.path}
            className={`flex flex-col items-center gap-1 transition-all duration-200 ${
              isActive ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-blue-50' : ''}`}>
              <Icon size={20} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
            </div>
            <span className={`text-[10px] font-medium tracking-wide ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
