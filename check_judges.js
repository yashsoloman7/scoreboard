const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/scoreboard";

if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

async function dbConnect() {
    if (mongoose.connection.readyState >= 1) {
        return;
    }
    return mongoose.connect(MONGODB_URI);
}

const CompetitionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    judges: [{
        id: String,
        name: String,
        password: String
    }]
});

const Competition = mongoose.models.Competition || mongoose.model('Competition', CompetitionSchema);

async function main() {
    await dbConnect();
    const comps = await Competition.find({});
    console.log("--- COMPETITIONS & JUDGES ---");
    comps.forEach(c => {
        console.log(`Competition: ${c.name} (ID: ${c._id})`);
        c.judges.forEach(j => {
            console.log(`  - Judge: ${j.name} (ID: ${j.id}) | Password: ${j.password}`);
        });
    });
    console.log("-----------------------------");
    mongoose.disconnect();
}

main();
