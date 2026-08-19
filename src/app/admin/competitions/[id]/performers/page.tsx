"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ArrowLeft, Save, GripVertical, CheckCircle, ArrowUp, ArrowDown, Sparkles, Edit2, X, PlusCircle, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Performer {
    _id: string;
    name: string;
    type: 'Solo' | 'Duet' | 'Group';
    competitionId: string;
    performanceOrder: number;
    groupMembers?: string[];
    teamName?: string;
}

export default function ManagePerformers() {
    const params = useParams();
    const router = useRouter();
    const competitionId = params.id as string;

    const [performers, setPerformers] = useState<Performer[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Edit State
    const [editingPerformer, setEditingPerformer] = useState<Performer | null>(null);
    const [editForm, setEditForm] = useState<{ name: string; type: string; groupMembers: string; teamName: string }>({
        name: '',
        type: 'Solo',
        groupMembers: '',
        teamName: ''
    });

    const [competition, setCompetition] = useState<any>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [addForm, setAddForm] = useState<{ name: string; type: string; groupMembers: string; teamName: string }>({
        name: '',
        type: 'Solo',
        groupMembers: '',
        teamName: ''
    });

    useEffect(() => {
        fetchData();
    }, [competitionId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [perfRes, compRes] = await Promise.all([
                fetch(`/api/performer?competitionId=${competitionId}`),
                fetch(`/api/competitions/${competitionId}`)
            ]);

            if (perfRes.ok && compRes.ok) {
                const performersData = await perfRes.json();
                const competitionData = await compRes.json();
                setPerformers(performersData);
                setCompetition(competitionData);
            }
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleReorder = (newOrder: Performer[]) => {
        setPerformers(newOrder);
        setHasChanges(true);
    };

    const moveItem = (index: number, direction: 'up' | 'down') => {
        const newOrder = [...performers];
        if (direction === 'up' && index > 0) {
            [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
        } else if (direction === 'down' && index < newOrder.length - 1) {
            [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
        }
        setPerformers(newOrder);
        setHasChanges(true);
    };

    const autoSort = () => {
        const sorted = [...performers].sort((a, b) => {
            // Sort by Team Name first if available
            if (a.teamName && b.teamName && a.teamName !== b.teamName) {
                return a.teamName.localeCompare(b.teamName);
            }
            const typeOrder: Record<string, number> = { 'Group': 1, 'Duet': 2, 'Solo': 3 };
            return (typeOrder[a.type] || 4) - (typeOrder[b.type] || 4);
        });
        setPerformers(sorted);
        setHasChanges(true);
    };

    const saveOrder = async () => {
        setSaving(true);
        try {
            const orderPayload = performers.map((p, index) => ({
                _id: p._id,
                performanceOrder: index + 1
            }));

            const res = await fetch(`/api/competitions/${competitionId}/performers/reorder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: orderPayload })
            });

            if (res.ok) {
                setHasChanges(false);
            }
        } catch (error) {
            console.error("Failed to save order", error);
        } finally {
            setSaving(false);
        }
    };

    const handleAddPerformer = async () => {
        try {
            const type = competition?.performerType === 'solo' ? 'Solo' : addForm.type;
            const newPerformer = {
                name: addForm.name,
                type,
                competitionId,
                groupMembers: type === 'Solo' ? [] : addForm.groupMembers.split(',').map(s => s.trim()).filter(Boolean),
                teamName: addForm.teamName,
                performanceOrder: performers.length + 1
            };

            const res = await fetch('/api/performer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPerformer)
            });

            if (res.ok) {
                const added = await res.json();
                setPerformers([...performers, added]);
                setIsAdding(false);
                setAddForm({ name: '', type: 'Solo', groupMembers: '', teamName: '' });
            }
        } catch (error) {
            console.error("Error adding performer:", error);
        }
    };

    const openEditModal = (performer: Performer) => {
        setEditingPerformer(performer);
        setEditForm({
            name: performer.name,
            type: performer.type,
            groupMembers: performer.groupMembers ? performer.groupMembers.join(', ') : '',
            teamName: performer.teamName || ''
        });
    };

    const closeEditModal = () => {
        setEditingPerformer(null);
    };

    const handleUpdatePerformer = async () => {
        if (!editingPerformer) return;

        try {
            const type = competition?.performerType === 'solo' ? 'Solo' : editForm.type;
            const updatedData = {
                name: editForm.name,
                type,
                groupMembers: type === 'Solo' ? [] : editForm.groupMembers.split(',').map(s => s.trim()).filter(Boolean),
                teamName: editForm.teamName
            };

            const res = await fetch(`/api/performer?id=${editingPerformer._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            if (res.ok) {
                const updated = await res.json();
                setPerformers(performers.map(p => p._id === updated._id ? updated : p));
                closeEditModal();
            } else {
                alert("Failed to update performer");
            }
        } catch (error) {
            console.error("Error updating performer:", error);
        }
    };


    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-[#020617]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#020617] text-white">
            <nav className="border-b border-white/10 bg-[#0f172a]/50 backdrop-blur-md sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-slate-400 hover:text-white">
                            <ArrowLeft className="w-5 h-5 mr-1" /> Back
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                                Program Manager
                            </h1>
                            <p className="text-xs text-slate-400">Design the flow of the competition</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={() => setIsAdding(true)}
                            size="sm"
                            className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20"
                        >
                            <PlusCircle className="w-4 h-4 mr-2" /> Add Performer
                        </Button>
                        <Button
                            onClick={autoSort}
                            variant="secondary"
                            size="sm"
                            className="text-xs bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/20"
                        >
                            <Sparkles className="w-3 h-3 mr-2" /> Auto-Sort
                        </Button>
                        <Button
                            onClick={saveOrder}
                            disabled={!hasChanges}
                            isLoading={saving}
                            className={`transition-all ${hasChanges ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20' : 'bg-slate-800 text-slate-500'}`}
                        >
                            <Save className="w-4 h-4 mr-2" /> {hasChanges ? 'Save Changes' : 'Saved'}
                        </Button>
                    </div>
                </div>
            </nav>

            <div className="container mx-auto px-4 py-8 max-w-3xl">
                <div className="bg-[#0f172a]/40 border border-white/5 rounded-xl overflow-hidden p-6">
                    <div className="mb-4 flex justify-between items-center text-slate-400 text-sm uppercase tracking-wider font-semibold">
                        <span>Performance Order</span>
                        <span>{performers.length} Acts</span>
                    </div>

                    <div className="space-y-2">
                        {performers.length === 0 ? (
                            <div className="text-center py-10 text-slate-500">No performers added yet.</div>
                        ) : (
                            performers.map((performer, index) => (
                                <motion.div
                                    key={performer._id}
                                    layoutId={performer._id}
                                    className="glass-card flex items-center gap-4 p-4 rounded-lg bg-[#1e293b]/50 border border-white/5 hover:border-cyan-500/30 transition-colors group"
                                >
                                    <div className="text-slate-500 font-mono w-6 text-center text-lg font-bold">{index + 1}</div>

                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <div className="font-bold text-lg text-white">{performer.name}</div>
                                            <button
                                                onClick={() => openEditModal(performer)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-cyan-400"
                                            >
                                                <Edit2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            {performer.teamName && (
                                                <div className="text-xs text-purple-400 inline-block px-1.5 py-0.5 rounded bg-purple-900/20 border border-purple-500/20 font-semibold">
                                                    {performer.teamName}
                                                </div>
                                            )}
                                            <div className="text-xs text-cyan-400 inline-block px-1.5 py-0.5 rounded bg-cyan-900/20 border border-cyan-500/20">
                                                {performer.type}
                                            </div>
                                            {performer.groupMembers && performer.groupMembers.length > 0 && (
                                                <div className="text-xs text-slate-400 truncate max-w-[200px]">
                                                    w/ {performer.groupMembers.join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => moveItem(index, 'up')}
                                            disabled={index === 0}
                                            className="p-2 hover:bg-white/10 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <ArrowUp className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => moveItem(index, 'down')}
                                            disabled={index === performers.length - 1}
                                            className="p-2 hover:bg-white/10 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <ArrowDown className="w-4 h-4" />
                                        </button>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Add Performer Modal */}
            <AnimatePresence>
                {isAdding && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
                        >
                            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                                <h3 className="font-bold text-lg">Add New Performer</h3>
                                <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 space-y-4">
                                <Input
                                    label="Name / Act Title"
                                    placeholder="e.g. John Doe or The Rocking Band"
                                    value={addForm.name}
                                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                                />
                                <Input
                                    label="Team / Group Name (Optional)"
                                    placeholder="e.g. Gryffindor / University A"
                                    value={addForm.teamName}
                                    onChange={(e) => setAddForm({ ...addForm, teamName: e.target.value })}
                                />
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Type</label>
                                    <div className="flex gap-2">
                                        {['Solo', 'Duet', 'Group'].map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setAddForm({ ...addForm, type })}
                                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors border ${addForm.type === type
                                                    ? 'bg-cyan-600 text-white border-cyan-500'
                                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
                                                    }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {addForm.type !== 'Solo' && (
                                    <Input
                                        label="Members"
                                        placeholder="Alice, Bob, Charlie..."
                                        value={addForm.groupMembers}
                                        onChange={(e) => setAddForm({ ...addForm, groupMembers: e.target.value })}
                                    />
                                )}
                            </div>
                            <div className="p-4 border-t border-white/10 flex justify-end gap-2 bg-black/20">
                                <Button variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
                                <Button onClick={handleAddPerformer} className="bg-cyan-600 hover:bg-cyan-500">Add Performer</Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Edit Modal */}
            <AnimatePresence>
                {editingPerformer && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
                        >
                            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                                <h3 className="font-bold text-lg">Edit Performer</h3>
                                <button onClick={closeEditModal} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 space-y-4">
                                <Input
                                    label="Name"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                />
                                <Input
                                    label="Team / Group Name"
                                    value={editForm.teamName}
                                    onChange={(e) => setEditForm({ ...editForm, teamName: e.target.value })}
                                />
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Type</label>
                                    <div className="flex gap-2">
                                        {['Solo', 'Duet', 'Group'].map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setEditForm({ ...editForm, type })}
                                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors border ${editForm.type === type
                                                    ? 'bg-cyan-600 text-white border-cyan-500'
                                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
                                                    }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {editForm.type !== 'Solo' && (
                                    <Input
                                        label="Team Members"
                                        placeholder="Alice, Bob, Charlie..."
                                        value={editForm.groupMembers}
                                        onChange={(e) => setEditForm({ ...editForm, groupMembers: e.target.value })}
                                    />
                                )}
                            </div>
                            <div className="p-4 border-t border-white/10 flex justify-end gap-2 bg-black/20">
                                <Button variant="ghost" onClick={closeEditModal}>Cancel</Button>
                                <Button onClick={handleUpdatePerformer} className="bg-cyan-600 hover:bg-cyan-500">Save Changes</Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
