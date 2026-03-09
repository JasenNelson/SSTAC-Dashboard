'use client';

import React from 'react';
import { gradients } from '@/lib/design-tokens';

export interface StatCard {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'sky' | 'teal' | 'purple' | 'amber' | 'rose' | 'green' | 'orange';
}

interface AdminPageLayoutProps {
  title: string;
  subtitle?: string;
  stats?: StatCard[];
  children: React.ReactNode;
}

const colorMap = {
  sky:    { bg: 'bg-sky-100 dark:bg-sky-900/40',    text: 'text-sky-700 dark:text-sky-300',    value: 'text-sky-700 dark:text-sky-300' },
  teal:   { bg: 'bg-teal-100 dark:bg-teal-900/40',   text: 'text-teal-700 dark:text-teal-300',   value: 'text-teal-700 dark:text-teal-300' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', value: 'text-purple-700 dark:text-purple-300' },
  amber:  { bg: 'bg-amber-100 dark:bg-amber-900/40',  text: 'text-amber-700 dark:text-amber-300',  value: 'text-amber-700 dark:text-amber-300' },
  rose:   { bg: 'bg-rose-100 dark:bg-rose-900/40',   text: 'text-rose-700 dark:text-rose-300',   value: 'text-rose-700 dark:text-rose-300' },
  green:  { bg: 'bg-green-100 dark:bg-green-900/40',  text: 'text-green-700 dark:text-green-300',  value: 'text-green-700 dark:text-green-300' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', value: 'text-orange-700 dark:text-orange-300' },
} as const;

export default function AdminPageLayout({ title, subtitle, stats, children }: AdminPageLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Hero header */}
      <div className={`${gradients.hero} text-white shadow-2xl`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">{title}</h1>
            {subtitle && (
              <p className="text-xl text-sky-200 max-w-3xl mx-auto">{subtitle}</p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-8 relative z-10">
        {/* Stat cards */}
        {stats && stats.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {stats.map((stat) => {
              const c = colorMap[stat.color];
              return (
                <div
                  key={stat.label}
                  className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
                      <p className={`text-3xl font-bold ${c.value}`}>{stat.value}</p>
                    </div>
                    <div className={`w-12 h-12 ${c.bg} rounded-xl flex items-center justify-center`}>
                      <span className={c.text}>{stat.icon}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Page content */}
        {children}
      </div>
    </div>
  );
}
