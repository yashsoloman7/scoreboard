"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Home, Trophy, User, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Navbar() {
    const { data: session } = useSession();
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    return (
        <nav className="bg-[#020617]/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 group">
                    <Trophy className="w-6 h-6 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
                    <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 group-hover:from-cyan-300 group-hover:to-blue-400 transition-all">
                        Scoreboard
                    </span>
                </Link>

                <div className="flex items-center gap-6">
                    <Link href="/" className={`text-sm font-medium transition-colors hover:text-cyan-400 ${isActive('/') ? 'text-white' : 'text-slate-400'}`}>
                        Home
                    </Link>
                    <Link href="/live" className={`text-sm font-medium transition-colors hover:text-cyan-400 ${isActive('/live') ? 'text-white' : 'text-slate-400'}`}>
                        Live Results
                    </Link>

                    {session ? (
                        <div className="flex items-center gap-4">
                            {session.user?.role === 'admin' && (
                                <Link href="/admin">
                                    <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/5">
                                        Host Dashboard
                                    </Button>
                                </Link>
                            )}
                            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                                <div className="text-right hidden sm:block">
                                    <div className="text-xs text-slate-400">Signed in as</div>
                                    <div className="text-sm font-bold text-cyan-300">{session.user?.name}</div>
                                </div>
                                {session.user?.image ? (
                                    <img src={session.user.image} alt={session.user.name || "User"} className="w-8 h-8 rounded-full border border-white/20" />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
                                        <User className="w-4 h-4 text-cyan-300" />
                                    </div>
                                )}
                                <div className="ml-2">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => signOut()}
                                        className="text-red-400 hover:bg-red-500/10 hover:text-red-300 px-2"
                                    >
                                        <LogOut className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <Link href="/auth/signin">
                            <Button
                                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/20"
                            >
                                Sign In
                            </Button>
                        </Link>
                    )}
                </div>
            </div>
        </nav >
    );
}
