import mongoose from 'mongoose';

const ScoreSchema = new mongoose.Schema({
    competitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competition', required: true },
    performerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Performer', required: true },
    judgeId: { type: String, required: true }, // Should match judge.id in Competition
    scores: {
        type: Map,
        of: Number, // key is criteria name or ID
        required: true
    },
    totalScore: { type: Number, required: true },
    feedback: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now }
});

// Compound index to ensure one score per judge per performer
ScoreSchema.index({ competitionId: 1, performerId: 1, judgeId: 1 }, { unique: true });

const Score = mongoose.models.Score || mongoose.model('Score', ScoreSchema);

export default Score;
