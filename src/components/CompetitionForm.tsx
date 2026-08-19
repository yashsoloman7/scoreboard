"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PlusCircle, Trash2, Trophy, Music, Users, Award } from 'lucide-react';
import { motion } from 'framer-motion';

interface Criterion {
    name: string;
    maxScore: number;
}

interface Judge {
    id: string;
    name: string;
    password?: string;
}

interface Prize {
    name: string;
    description: string;
}

interface CompetitionFormProps {
    initialData?: {
        name: string;
        date: string;
        criteria: Criterion[];
        judges: Judge[];
        prizeCategories: Prize[];
        scoringSystem?: 'standard' | 'olympic';
        performerType?: 'mixed' | 'solo';
        streamUrl?: string;
    };
    onSubmit: (data: any) => Promise<void>;
    loading: boolean;
    title: string;
    submitText: string;
}

export default function CompetitionForm({ initialData, onSubmit, loading, title, submitText }: CompetitionFormProps) {
    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        date: initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        scoringSystem: initialData?.scoringSystem || 'standard',
        performerType: initialData?.performerType || 'mixed',
        streamUrl: initialData?.streamUrl || '',
    });

    const [criteria, setCriteria] = useState<Criterion[]>(initialData?.criteria || [
        { name: 'Technical Ability', maxScore: 10 },
        { name: 'Performance & Stage Presence', maxScore: 10 },
        { name: 'Musicality & Interpretation', maxScore: 10 }
    ]);

    const [judges, setJudges] = useState<Judge[]>(initialData?.judges || [{ id: 'judge1', name: 'Judge 1' }]);

    const [prizes, setPrizes] = useState<Prize[]>(initialData?.prizeCategories || [
        { name: 'Best Solo Performer', description: 'Awarded to the highest scoring solo act' },
        { name: 'Best Group Performance', description: 'Awarded to the highest scoring group' }
    ]);

    // Update state if initialData changes (e.g. after fetch)
    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                date: new Date(initialData.date).toISOString().split('T')[0],
                scoringSystem: initialData.scoringSystem || 'standard',
                performerType: initialData.performerType || 'mixed',
                streamUrl: initialData.streamUrl || '',
            });
            setCriteria(initialData.criteria);
            setJudges(initialData.judges);
            setPrizes(initialData.prizeCategories || []);
        }
    }, [initialData]);

    const handleCriterionChange = (index: number, field: keyof Criterion, value: string | number) => {
        const newCriteria = [...criteria];
        // @ts-ignore
        newCriteria[index][field] = value;
        setCriteria(newCriteria);
    };

    const addCriterion = () => setCriteria([...criteria, { name: '', maxScore: 10 }]);
    const removeCriterion = (index: number) => setCriteria(criteria.filter((_, i) => i !== index));

    const handleJudgeChange = (index: number, field: keyof Judge, value: string) => {
        const newJudges = [...judges];
        newJudges[index] = { ...newJudges[index], [field]: value };
        setJudges(newJudges);
    };

    const addJudge = () => {
        const id = `judge${judges.length + 1}`;
        setJudges([...judges, { id, name: `Judge ${judges.length + 1}` }]);
    };
    const removeJudge = (index: number) => setJudges(judges.filter((_, i) => i !== index));

    const handlePrizeChange = (index: number, field: keyof Prize, value: string) => {
        const newPrizes = [...prizes];
        newPrizes[index] = { ...newPrizes[index], [field]: value };
        setPrizes(newPrizes);
    };

    const addPrize = () => setPrizes([...prizes, { name: '', description: '' }]);
    const removePrize = (index: number) => setPrizes(prizes.filter((_, i) => i !== index));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            ...formData,
            criteria,
            judges,
            prizeCategories: prizes
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-3xl overflow-hidden shadow-2xl shadow-purple-900/20"
        >
            <div className="bg-gradient-to-r from-purple-900/50 to-indigo-900/50 p-8 border-b border-white/5">
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Music className="text-purple-400" /> {title}
                </h1>
                <p className="text-indigo-200 mt-2">Set up your event details, scoring criteria, judges, and awards.</p>
            </div>

            <div className="p-8">
                <form onSubmit={handleSubmit} className="space-y-10">
                    {/* Basic Details */}
                    <section className="space-y-6">
                        <h3 className="text-xl font-semibold flex items-center gap-2 text-purple-300">
                            <Users className="w-5 h-5" /> Event Details
                        </h3>
                        <div className="grid md:grid-cols-2 gap-6">
                            <Input
                                label="Competition Name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                placeholder="e.g. Grand Music Championship 2024"
                                className="bg-black/20 border-white/10 focus:border-purple-500"
                            />
                            <Input
                                type="date"
                                label="Date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                required
                                className="bg-black/20 border-white/10 focus:border-purple-500"
                            />
                        </div>
                        <Input
                            label="Live Stream URL (Optional)"
                            value={formData.streamUrl}
                            onChange={(e) => setFormData({ ...formData, streamUrl: e.target.value })}
                            placeholder="https://youtube.com/live/..."
                            className="bg-black/20 border-white/10 focus:border-purple-500"
                        />

                        <div>
                            <label className="block text-sm font-medium text-purple-300 mb-2">Scoring System</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div
                                    onClick={() => setFormData({ ...formData, scoringSystem: 'standard' })}
                                    className={`cursor-pointer p-4 rounded-xl border transition-all ${formData.scoringSystem === 'standard' ? 'bg-purple-500/20 border-purple-500' : 'bg-black/20 border-white/10 hover:border-white/20'}`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${formData.scoringSystem === 'standard' ? 'border-purple-400' : 'border-slate-500'}`}>
                                            {formData.scoringSystem === 'standard' && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                                        </div>
                                        <h4 className="font-bold text-white">Standard Average</h4>
                                    </div>
                                    <p className="text-xs text-slate-400 ml-6">Total / Judges. All scores count.</p>
                                </div>

                                <div
                                    onClick={() => setFormData({ ...formData, scoringSystem: 'olympic' })}
                                    className={`cursor-pointer p-4 rounded-xl border transition-all ${formData.scoringSystem === 'olympic' ? 'bg-purple-500/20 border-purple-500' : 'bg-black/20 border-white/10 hover:border-white/20'}`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${formData.scoringSystem === 'olympic' ? 'border-purple-400' : 'border-slate-500'}`}>
                                            {formData.scoringSystem === 'olympic' && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                                        </div>
                                        <h4 className="font-bold text-white">Olympic (Trimmed)</h4>
                                    </div>
                                    <p className="text-xs text-slate-400 ml-6">Drops highest & lowest scores. Reduces bias.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Prizes Section */}
                    <section className="space-y-6 pt-6 border-t border-white/5">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-semibold flex items-center gap-2 text-yellow-300">
                                <Trophy className="w-5 h-5" /> Custom Awards & Prizes
                            </h3>
                            <button type="button" onClick={addPrize} className="text-sm px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition-colors flex items-center gap-2">
                                <PlusCircle className="w-4 h-4" /> Add Award
                            </button>
                        </div>
                        <div className="grid gap-4">
                            {prizes.map((prize, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex flex-col md:flex-row gap-4 items-start bg-black/20 p-4 rounded-xl border border-white/5 hover:border-yellow-500/30 transition-colors"
                                >
                                    <div className="flex-1 w-full">
                                        <Input
                                            placeholder="Award Name (e.g. Best Vocalist)"
                                            value={prize.name}
                                            onChange={(e) => handlePrizeChange(index, 'name', e.target.value)}
                                            required
                                            className="bg-transparent border-white/10 focus:border-yellow-500 mb-2"
                                        />
                                        <Input
                                            placeholder="Description (Optional)"
                                            value={prize.description}
                                            onChange={(e) => handlePrizeChange(index, 'description', e.target.value)}
                                            className="bg-transparent border-white/10 text-xs py-1 h-8"
                                        />
                                    </div>
                                    {prizes.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removePrize(index)}
                                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors mt-1"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </section>

                    {/* Criteria Section */}
                    <section className="space-y-6 pt-6 border-t border-white/5">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-semibold flex items-center gap-2 text-pink-300">
                                <Award className="w-5 h-5" /> Scoring Criteria
                            </h3>
                            <button type="button" onClick={addCriterion} className="text-sm px-3 py-1.5 rounded-lg bg-pink-500/20 text-pink-300 hover:bg-pink-500/30 transition-colors flex items-center gap-2">
                                <PlusCircle className="w-4 h-4" /> Add Criterion
                            </button>
                        </div>
                        <div className="space-y-3">
                            {criteria.map((criterion, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex gap-4 items-end bg-black/20 p-4 rounded-xl border border-white/5"
                                >
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-400 mb-1 block">Criterion Name</label>
                                        <Input
                                            placeholder="e.g. Intonation"
                                            value={criterion.name}
                                            onChange={(e) => handleCriterionChange(index, 'name', e.target.value)}
                                            required
                                            className="bg-transparent border-white/10 focus:border-pink-500"
                                        />
                                    </div>
                                    <div className="w-32">
                                        <label className="text-xs text-gray-400 mb-1 block">Max Points</label>
                                        <Input
                                            type="number"
                                            placeholder="10"
                                            value={criterion.maxScore}
                                            onChange={(e) => handleCriterionChange(index, 'maxScore', parseInt(e.target.value))}
                                            required
                                            className="bg-transparent border-white/10 focus:border-pink-500 text-center font-mono"
                                        />
                                    </div>
                                    {criteria.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeCriterion(index)}
                                            className="p-2.5 mb-0.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </section>

                    {/* Judges Section */}
                    <section className="space-y-6 pt-6 border-t border-white/5">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-semibold flex items-center gap-2 text-blue-300">
                                <Users className="w-5 h-5" /> Judges Panel
                            </h3>
                            <button type="button" onClick={addJudge} className="text-sm px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors flex items-center gap-2">
                                <PlusCircle className="w-4 h-4" /> Add Judge
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {judges.map((judge, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex flex-col md:flex-row gap-3 items-end bg-black/20 p-4 rounded-xl border border-white/5 relative group col-span-1 md:col-span-3"
                                >
                                    <div className="w-full md:w-1/4">
                                        <label className="text-xs text-gray-400 mb-1 block">Judge ID</label>
                                        <Input
                                            placeholder="judge1"
                                            value={judge.id}
                                            onChange={(e) => handleJudgeChange(index, 'id', e.target.value)}
                                            required
                                            className="bg-transparent border-white/10 focus:border-blue-500 font-mono text-sm"
                                        />
                                    </div>
                                    <div className="w-full md:w-1/2">
                                        <label className="text-xs text-gray-400 mb-1 block">Full Name</label>
                                        <Input
                                            placeholder="Name"
                                            value={judge.name}
                                            onChange={(e) => handleJudgeChange(index, 'name', e.target.value)}
                                            required
                                            className="bg-transparent border-white/10 focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="w-full md:w-1/4">
                                        <label className="text-xs text-gray-400 mb-1 block">Password</label>
                                        <Input
                                            type="text"
                                            placeholder="Password"
                                            value={judge.password || ''}
                                            onChange={(e) => handleJudgeChange(index, 'password', e.target.value)}
                                            className="bg-transparent border-white/10 focus:border-blue-500 font-mono text-sm"
                                        />
                                    </div>
                                    {judges.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeJudge(index)}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </section>

                    <div className="pt-8">
                        <Button
                            type="submit"
                            className="w-full py-4 text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-xl shadow-purple-900/40 rounded-xl"
                            isLoading={loading}
                        >
                            {submitText}
                        </Button>
                    </div>
                </form>
            </div>
        </motion.div>
    );
}
