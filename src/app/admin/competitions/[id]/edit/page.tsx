"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import CompetitionForm from '@/components/CompetitionForm';
import { Button } from '@/components/ui/Button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function EditCompetition() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [initialData, setInitialData] = useState<any>(null);

    useEffect(() => {
        if (id) {
            fetchCompetition();
        }
    }, [id]);

    const fetchCompetition = async () => {
        try {
            const res = await fetch(`/api/competitions/${id}`);
            if (res.ok) {
                const data = await res.json();
                setInitialData(data);
            } else {
                console.error("Failed to fetch competition");
                router.push('/admin');
            }
        } catch (error) {
            console.error(error);
            router.push('/admin');
        } finally {
            setFetching(false);
        }
    };

    const handleSubmit = async (data: any) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/competitions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                router.push('/admin');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0f0c29]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen py-12 px-4 container mx-auto max-w-4xl text-white">
            <Link href="/admin" className="mb-6 inline-block">
                <Button variant="ghost" className="text-gray-400 hover:text-white pl-0 hover:bg-transparent">
                    <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
                </Button>
            </Link>

            <CompetitionForm
                initialData={initialData}
                onSubmit={handleSubmit}
                loading={loading}
                title="Edit Competition"
                submitText="Update Competition"
            />
        </div>
    );
}
