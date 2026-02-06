"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

export default function CleanupPage() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const runCleanup = async (dryRun: boolean) => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const res = await fetch('/api/cleanup/hse-team', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dryRun })
            });

            const data = await res.json();

            if (!data.success) {
                setError(data.error || 'Unknown error');
            } else {
                setResult(data);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6">🧹 Permission Cleanup</h1>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Trash2 className="h-5 w-5" />
                        Remove HSE-Team from Bidding Folders
                    </CardTitle>
                    <CardDescription>
                        This will remove HSE-Team@dtgsa.com from all Bidding folders across all projects.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
                        <AlertTriangle className="h-4 w-4" />
                        <span>
                            Run <strong>Dry Run</strong> first to see what will be affected without making changes.
                        </span>
                    </div>

                    <div className="flex gap-4">
                        <Button
                            variant="outline"
                            onClick={() => runCleanup(true)}
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            🔍 Dry Run (Preview)
                        </Button>

                        <Button
                            variant="destructive"
                            onClick={() => runCleanup(false)}
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            🗑️ Execute Cleanup
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {error && (
                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 mb-6">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{error}</span>
                </div>
            )}

            {result && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            {result.dryRun ? 'Dry Run Results' : 'Cleanup Complete'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            <div className="text-center p-4 bg-gray-100 rounded-lg">
                                <div className="text-2xl font-bold">{result.summary?.totalFolders || 0}</div>
                                <div className="text-sm text-gray-500">Total Folders</div>
                            </div>
                            <div className="text-center p-4 bg-green-100 rounded-lg">
                                <div className="text-2xl font-bold text-green-600">{result.summary?.removed || 0}</div>
                                <div className="text-sm text-gray-500">{result.dryRun ? 'Would Remove' : 'Removed'}</div>
                            </div>
                            <div className="text-center p-4 bg-gray-100 rounded-lg">
                                <div className="text-2xl font-bold">{result.summary?.skipped || 0}</div>
                                <div className="text-sm text-gray-500">Skipped</div>
                            </div>
                            <div className="text-center p-4 bg-red-100 rounded-lg">
                                <div className="text-2xl font-bold text-red-600">{result.summary?.failed || 0}</div>
                                <div className="text-sm text-gray-500">Failed</div>
                            </div>
                        </div>

                        {result.results && result.results.length > 0 && (
                            <div>
                                <h3 className="font-semibold mb-2">Details:</h3>
                                <div className="max-h-96 overflow-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="p-2 text-left">Folder</th>
                                                <th className="p-2 text-left">Email</th>
                                                <th className="p-2 text-left">Role</th>
                                                <th className="p-2 text-left">Inherited</th>
                                                <th className="p-2 text-left">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.results.map((r: any, i: number) => (
                                                <tr key={i} className="border-b">
                                                    <td className="p-2">{r.template_path}</td>
                                                    <td className="p-2">{r.email}</td>
                                                    <td className="p-2">{r.role}</td>
                                                    <td className="p-2">{r.inherited ? 'Yes' : 'No'}</td>
                                                    <td className="p-2">
                                                        <span className={`px-2 py-1 rounded text-xs ${r.action === 'removed' || r.action === 'would_remove'
                                                            ? 'bg-green-100 text-green-700'
                                                            : r.action === 'failed'
                                                                ? 'bg-red-100 text-red-700'
                                                                : 'bg-gray-100'
                                                            }`}>
                                                            {r.action}
                                                        </span>
                                                        {r.error && <span className="text-red-500 ml-2">{r.error}</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
