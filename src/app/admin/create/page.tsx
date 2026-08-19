"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CompetitionForm from '@/components/CompetitionForm';

export default function CreateCompetition() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (data: any) => {
        setLoading(true);
        try {
            const res = await fetch('/api/competitions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                router.push('/');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen py-12 px-4 container mx-auto max-w-4xl text-white">
            <CompetitionForm
                onSubmit={handleSubmit}
                loading={loading}
                title="Create New Competition"
                submitText="Launch Competition"
            />
        </div>
    );
}

