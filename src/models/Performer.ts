import mongoose from 'mongoose';

const PerformerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    bio: { type: String, default: '' },
    image: { type: String, default: '' }, // URL or base64
    competitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competition', required: true },
    type: {
        type: String,
        enum: ['Solo', 'Duet', 'Group'],
        default: 'Solo'
    },
    groupMembers: [String], // List of names if it is a group or duet
    teamName: { type: String, default: '' }, // For grouping performers (e.g. "Gryffindor")
    performanceOrder: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
});

const Performer = mongoose.models.Performer || (mongoose.model('Performer', PerformerSchema) as any);

export default Performer;
