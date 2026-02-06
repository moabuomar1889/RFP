'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminDebugPage() {
    const [projectId, setProjectId] = useState('30ac6ea8-7d52-442b-b10f-2d30f377de41');
    const [jobId, setJobId] = useState('');
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<any>(null);
    const [error, setError] = useState('');

    const triggerReset = async () => {
        setLoading(true);
        setError('');
        setResponse(null);

        try {
            const res = await fetch('/api/test/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || `HTTP ${res.status}`);
            } else {
                setResponse(data);
                setJobId(data.jobId || '');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const checkProgress = async () => {
        if (!jobId) {
            setError('No job ID');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch(`/api/test/reset?jobId=${jobId}`);
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || `HTTP ${res.status}`);
            } else {
                setResponse(data);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Admin Debug Console</h1>
                <p className="text-muted-foreground">Test permission reset API and monitor jobs</p>
            </div>

            {/* Trigger Reset */}
            <Card>
                <CardHeader>
                    <CardTitle>1. Trigger Permission Reset</CardTitle>
                    <CardDescription>Start a reset job for a project</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Project ID</label>
                        <Input
                            value={projectId}
                            onChange={(e) => setProjectId(e.target.value)}
                            placeholder="UUID"
                        />
                    </div>
                    <Button onClick={triggerReset} disabled={loading || !projectId}>
                        {loading ? 'Starting...' : 'Start Reset Job'}
                    </Button>
                </CardContent>
            </Card>

            {/* Check Progress */}
            <Card>
                <CardHeader>
                    <CardTitle>2. Check Job Progress</CardTitle>
                    <CardDescription>Monitor a running job</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Job ID</label>
                        <Input
                            value={jobId}
                            onChange={(e) => setJobId(e.target.value)}
                            placeholder="Job UUID from reset response"
                        />
                    </div>
                    <Button onClick={checkProgress} disabled={loading || !jobId} variant="secondary">
                        {loading ? 'Checking...' : 'Check Progress'}
                    </Button>
                </CardContent>
            </Card>

            {/* Response Display */}
            {(response || error) && (
                <Card>
                    <CardHeader>
                        <CardTitle>Response</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {error && (
                            <div className="bg-destructive/10 text-destructive p-4 rounded-md font-mono text-sm">
                                ❌ Error: {error}
                            </div>
                        )}
                        {response && (
                            <pre className="bg-muted p-4 rounded-md overflow-auto text-sm">
                                {JSON.stringify(response, null, 2)}
                            </pre>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Helpful Queries */}
            <Card>
                <CardHeader>
                    <CardTitle>3. Helpful SQL Queries</CardTitle>
                    <CardDescription>Run these in Supabase SQL Editor</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <p className="text-sm font-medium">Get all projects:</p>
                        <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                            {`SELECT id, name FROM rfp.projects LIMIT 10;`}
                        </pre>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium">Check compliance for project:</p>
                        <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                            {`SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN is_compliant THEN 1 END) as compliant
FROM rfp.folder_index
WHERE project_id = 'YOUR_PROJECT_ID';`}
                        </pre>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium">View recent reset jobs:</p>
                        <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                            {`SELECT 
    id, status, total_folders, 
    successful_folders, failed_folders,
    created_at
FROM rfp.reset_jobs
ORDER BY created_at DESC
LIMIT 5;`}
                        </pre>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium">View audit trail for job:</p>
                        <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                            {`SELECT action, result, COUNT(*) 
FROM rfp.permission_audit 
WHERE job_id = 'YOUR_JOB_ID'
GROUP BY action, result;`}
                        </pre>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
