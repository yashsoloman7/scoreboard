import mongoose from 'mongoose';

const CriterionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    maxScore: { type: Number, required: true },
    description: { type: String },
});

const JudgeSchema = new mongoose.Schema({
    id: { type: String, required: true }, // Simple unique ID for login/identification (e.g. "judge1")
    name: { type: String, required: true },
    role: { type: String }, // e.g. "Lead Judge", "Technical Judge"
    password: { type: String, required: true, default: '1234' }, // Default password for migration
});

const CompetitionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    date: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['upcoming', 'active', 'completed'],
        default: 'upcoming'
    },
    streamUrl: { type: String }, // Optional link to live stream (YouTube, Twitch, etc.)
    scoringSystem: {
        type: String,
        enum: ['standard', 'olympic'],
        default: 'standard'
    },
    performerType: {
        type: String,
        enum: ['mixed', 'solo'],
        default: 'mixed'
    },
    isPublished: { type: Boolean, default: false }, // Controls visibility on /live page
    winnersRevealed: { type: Boolean, default: false }, // Controls visibility of the podium on /live page
    criteria: [CriterionSchema],
    judges: [JudgeSchema],
    prizeCategories: [{
        name: { type: String, required: true },
        description: { type: String }
    }],
    likes: [{ type: String }], // Array of user IDs
    comments: [{
        userId: String,
        userName: String,
        text: String,
        timestamp: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now },
});

const Competition = mongoose.models.Competition || (mongoose.model('Competition', CompetitionSchema) as any);

export default Competition;
