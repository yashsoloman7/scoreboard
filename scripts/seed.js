const fs = require('fs');
const path = require('path');

async function seed() {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-data.json'), 'utf8'));

    if (!process.env.MONGODB_URI) {
        console.error('Please define the MONGODB_URI environment variable inside .env.local');
        // For local dev convenience, we can try to load it from .env.local if not present in environment
        const envPath = path.resolve(__dirname, '../.env.local');
        if (fs.existsSync(envPath)) {
            require('dotenv').config({ path: envPath });
        }
    }

    // Very basic fetch implementation to post data to the running API
    // This assumes the Next.js app is running on localhost:3000
    for (const comp of data) {
        try {
            const res = await fetch('http://localhost:3000/api/competitions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(comp)
            });
            if (res.ok) {
                console.log(`Seeded: ${comp.name}`);
            } else {
                console.error(`Failed to seed ${comp.name}: ${res.statusText}`);
            }
        } catch (e) {
            console.error(`Error seeding ${comp.name}:`, e);
        }
    }
}

seed();
