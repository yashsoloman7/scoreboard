"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Heart, MessageSquare, Send, Trophy, Calendar, User, Video } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Button } from './ui/Button';

interface Comment {
    userId: string;
    userName: string;
    text: string;
    timestamp: string;
}

interface CompetitionProps {
    competition: {
        _id: string;
        name: string;
        date: string;
        status: 'upcoming' | 'active' | 'completed';
        judges: any[];
        likes?: string[];
        comments?: Comment[];
        streamUrl?: string; // Optional
    };
}

export default function CompetitionCard({ competition: initialData }: CompetitionProps) {
    const { data: session } = useSession();
    const [competition, setCompetition] = useState(initialData);
    const [showComments, setShowComments] = useState(false);
    const [commentText, setCommentText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isLiked = session?.user?.email && competition.likes?.includes(session.user.email);

    const handleLike = async () => {
        if (!session) return;

        // Optimistic update
        const prevLikes = competition.likes || [];
        const isCurrentlyLiked = isLiked;
        const userEmail = session.user?.email || "";

        const newLikes = isCurrentlyLiked
            ? prevLikes.filter(email => email !== userEmail)
            : [...prevLikes, userEmail];

        setCompetition({ ...competition, likes: newLikes });

        try {
            const res = await fetch(`/api/competitions/${competition._id}/interact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'like' }),
            });

            if (!res.ok) {
                setCompetition({ ...competition, likes: prevLikes }); // Revert
            }
        } catch (error) {
            setCompetition({ ...competition, likes: prevLikes }); // Revert
        }
    };

    const handleComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim() || !session) return;

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/competitions/${competition._id}/interact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'comment', text: commentText }),
            });

            if (res.ok) {
                const data = await res.json();
                setCompetition({ ...competition, comments: data.comments });
                setCommentText("");
            }
        } catch (error) {
            console.error("Failed to post comment");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="glass-card rounded-2xl overflow-hidden hover:shadow-2xl hover:shadow-cyan-500/10 transition-all duration-300 group border border-white/5 bg-[#0f172a]/60 flex flex-col h-full">
            <div className="h-32 bg-gradient-to-r from-slate-900 to-slate-800 p-6 flex flex-col justify-end relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-cyan-500/20 transition-colors duration-500" />
                <h3 className="text-2xl font-bold relative z-10 line-clamp-1 text-white">{competition.name}</h3>
                <p className="text-slate-400 text-sm relative z-10 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {new Date(competition.date).toLocaleDateString([], { dateStyle: 'long' })}
                </p>
            </div>

            <div className="p-6 flex flex-col flex-grow">
                <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${competition.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        competition.status === 'completed' ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20' :
                            'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                        {competition.status}
                    </span>
                    <span className="text-sm text-slate-400 font-medium">
                        {competition.judges.length} Judges
                    </span>
                </div>

                {/* Social Actions */}
                <div className="flex items-center gap-4 mb-4 pt-4 border-t border-white/5">
                    <button
                        onClick={handleLike}
                        disabled={!session}
                        className={`flex items-center gap-2 text-sm transition-colors ${isLiked ? 'text-pink-500' : 'text-slate-400 hover:text-pink-400'}`}
                    >
                        <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                        {competition.likes?.length || 0}
                    </button>
                    <button
                        onClick={() => setShowComments(!showComments)}
                        className={`flex items-center gap-2 text-sm transition-colors ${showComments ? 'text-cyan-400' : 'text-slate-400 hover:text-cyan-400'}`}
                    >
                        <MessageSquare className="w-4 h-4" />
                        {competition.comments?.length || 0}
                    </button>
                </div>

                {/* Comments Section */}
                {showComments && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mb-4 bg-slate-900/50 rounded-xl p-3 text-sm"
                    >
                        <div className="max-h-40 overflow-y-auto mb-3 space-y-3 custom-scrollbar">
                            {competition.comments?.length === 0 && (
                                <p className="text-slate-500 text-center py-2">No comments yet</p>
                            )}
                            {competition.comments?.map((comment, i) => (
                                <div key={i} className="flex gap-2">
                                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0">
                                        <User className="w-3 h-3 text-cyan-400" />
                                    </div>
                                    <div>
                                        <p className="text-cyan-200 text-xs font-bold">{comment.userName}</p>
                                        <p className="text-slate-300">{comment.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {session ? (
                            <form onSubmit={handleComment} className="flex gap-2">
                                <input
                                    type="text"
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    placeholder="Write a comment..."
                                    className="flex-1 bg-slate-800 border-none rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-cyan-500 outline-none text-white"
                                />
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !commentText.trim()}
                                    className="p-1.5 bg-cyan-600 rounded-lg text-white hover:bg-cyan-500 disabled:opacity-50"
                                >
                                    <Send className="w-3 h-3" />
                                </button>
                            </form>
                        ) : (
                            <p className="text-xs text-slate-500 text-center">Sign in to comment</p>
                        )}
                    </motion.div>
                )}

                <div className="mt-auto">
                    {competition.streamUrl && (
                        <a href={competition.streamUrl} target="_blank" rel="noopener noreferrer" className="block mb-3">
                            <button className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 transition-all text-white text-sm font-bold shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 group-hover:scale-105 active:scale-95 duration-200 animate-pulse">
                                <Video className="w-4 h-4" /> Watch Live Stream
                            </button>
                        </a>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <Link href={`/live?id=${competition._id}`} className="w-full">
                            <button className="w-full py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-colors text-sm font-semibold text-slate-300 hover:text-white">
                                Results
                            </button>
                        </Link>
                        {/* Only show judge button if user is admin or potentially a judge (logic can be refined) */}
                        {/* For now keeping it but maybe disable/hide for regular users if required? 
                        The prompt says "users can only see results...". 
                        I'll condition this possibly? 
                        Actually, let's keep it but maybe it requires login. 
                        For now, I'll update it to match the requested constrained view.
                        If "users can only see results", maybe I should HIDE this for non-admins?
                        Let's verify the requirement: "users can only see results leaderboards and make comments... and can like".
                        It implies they shouldn't see Judge/Manage.
                    */}
                        {!session || session.user?.role === 'admin' ? (
                            <Link href={`/judge/${competition._id}`} className="w-full">
                                <button className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition-all text-white text-sm font-semibold shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2 group-hover:scale-105 active:scale-95 duration-200">
                                    Judge <ArrowRight className="w-4 h-4" />
                                </button>
                            </Link>
                        ) : null}

                    </div>
                </div>
            </div>
        </div>
    );
}
