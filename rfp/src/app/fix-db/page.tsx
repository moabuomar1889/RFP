"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from 'next/link';

export default function FixDbPage() {
    const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const runFix = async () => {
        setStatus('running');
        setMessage('Running schema fix...');
        try {
            const res = await fetch('/api/admin/fix-schema');
            const data = await res.json();
            if (data.success) {
                setStatus('success');
                setMessage('Schema fix applied successfully! You can now return to the dashboard.');
            } else {
                setStatus('error');
                setMessage('Fix failed: ' + JSON.stringify(data));
            }
        } catch (e) {
            setStatus('error');
            setMessage('Error running fix: ' + (e as Error).message);
        }
    };

    useEffect(() => {
        runFix();
    }, []);

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Database Schema Fix</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className={`p-4 rounded-md ${status === 'running' ? 'bg-blue-100 text-blue-800' :
                            status === 'success' ? 'bg-green-100 text-green-800' :
                                status === 'error' ? 'bg-red-100 text-red-800' : 'bg-gray-100'
                        }`}>
                        {message || 'Initializing...'}
                    </div>

                    {status === 'success' && (
                        <Button asChild className="w-full">
                            <Link href="/">Return to Dashboard</Link>
                        </Button>
                    )}

                    {status === 'error' && (
                        <Button onClick={runFix} className="w-full">Retry Fix</Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
