"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CompetitionForm from '@/components/CompetitionForm';
import { createCompetition } from '@/actions/competitions';

export default function CreateCompetition() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (data: any) => {
        setLoading(true);
        try {
            // Map the generic form data to the strict Supabase Postgres schema
            const compPayload = {
                code: data.name.replace(/[^A-Za-z0-9]/g, '').substring(0, 10).toUpperCase() + '-' + Math.floor(Math.random() * 1000),
                name: data.name,
                description: 'Created from Admin Dashboard',
                venue: 'Main Stage',
                startDate: data.date,
                endDate: data.date,
                environment: 'live' as const,
            };

            await createCompetition(compPayload);

            router.push('/admin/dashboard');
        } catch (error) {
            console.error('Failed to create competition:', error);
            alert(error instanceof Error ? error.message : 'Failed to create competition');
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

