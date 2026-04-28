"use client"

import { Coffee, Clock, ArrowRight, UserCircle } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../components/ui/AnimatedContainer';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';

export default function StaffDashboard() {
  const { user } = useAuth();

  return (
    <PageTransition>
      <div className="space-y-10">
        {/* Welcome Header */}
        <SlideIn direction="down">
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-sm p-10 border border-gray-100 dark:border-zinc-800 text-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <UserCircle size={120} />
            </div>

            <div className="inline-flex items-center justify-center h-20 w-20 rounded-3xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-6 border border-amber-100 dark:border-amber-500/20 shadow-inner">
              <Coffee size={40} strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-zinc-100 tracking-tighter leading-none mb-4">
              Welcome back, <span className="text-amber-600">{user?.name?.split(' ')[0]}</span>!
            </h1>
            <p className="text-gray-500 dark:text-zinc-500 font-medium tracking-tight">
              Staff dashboard for the <span className="text-gray-900 dark:text-zinc-200 font-black">{user?.assignedLocation?.city}</span> branch.
            </p>
          </div>
        </SlideIn>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <SlideIn delay={0.1}>
            <CardHover>
              <Link href="/dashboard/staff/tables">
                <div className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-sm p-8 border border-gray-100 dark:border-zinc-800 h-full flex flex-col group">
                  <div className="h-14 w-14 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-6 group-hover:scale-110 transition-transform duration-500 border border-amber-100 dark:border-amber-500/20">
                    <Coffee size={28} />
                  </div>
                  <h2 className="text-xl font-black text-gray-900 dark:text-zinc-100 mb-3 tracking-tight flex items-center">
                    Tables & Orders
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-zinc-500 font-medium leading-relaxed mb-8 flex-grow">
                    Manage active tables, take orders, and generate real-time bills for your assigned customers.
                  </p>
                  <div className="flex items-center text-amber-600 font-black text-xs uppercase tracking-widest group-hover:translate-x-2 transition-transform">
                    Open Tables <ArrowRight size={14} className="ml-2" />
                  </div>
                </div>
              </Link>
            </CardHover>
          </SlideIn>

          <SlideIn delay={0.2}>
            <CardHover>
              <div className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-sm p-8 border border-gray-100 dark:border-zinc-800 h-full flex flex-col group">
                <div className="h-14 w-14 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6 group-hover:scale-110 transition-transform duration-500 border border-blue-100 dark:border-blue-500/20">
                  <Clock size={28} />
                </div>
                <h2 className="text-xl font-black text-gray-900 dark:text-zinc-100 mb-3 tracking-tight">
                  Time Logs
                </h2>
                <p className="text-sm text-gray-500 dark:text-zinc-500 font-medium leading-relaxed flex-grow">
                  Attendance is recorded by your Branch Admin. Review your monthly presence and salary disbursements through notifications.
                </p>
                <div className="mt-8 px-4 py-2 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] w-fit">
                  Active
                </div>
              </div>
            </CardHover>
          </SlideIn>
        </div>
      </div>
    </PageTransition>
  );
}
