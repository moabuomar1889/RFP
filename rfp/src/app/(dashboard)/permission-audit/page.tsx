'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, AlertCircle, ChevronDown, ChevronRight, Download, Shield, Loader2 } from 'lucide-react';

interface PermissionComparison {
    folderPath: string;
    normalizedPath: string;
    driveFolderId: string;
    expectedGroups: { email: string; role: string }[];
    expectedUsers: { email: string; role: string }[];
    actualPermissions: { email: string; role: string; type: string; inherited?: boolean }[];
    // Enhanced status
    status: 'exact_match' | 'compliant' | 'non_compliant';
    statusLabel: 'Exact Match' | 'Compliant (Inheritance Allowed)' | 'Non-Compliant';
    discrepancies: string[];
    // Detailed counters
    expectedCount: number;
    directActualCount: number;
    inheritedActualCount: number;
    totalActualCount: number;
    limitedAccessExpected: boolean;
}

interface AuditResult {
    projectId: string;
    projectName: string;
    projectCode: string;
    totalFolders: number;
    matchCount: number;
    extraCount: number;
    missingCount: number;
    mismatchCount: number;
    comparisons: PermissionComparison[];
}

interface Project {
    id: string;
    name: string;
    project_code: string;
}

const getRoleLabel = (role: string) => {
    const roleMap: Record<string, string> = {
        'owner': 'Owner',
        'organizer': 'Manager',
        'fileOrganizer': 'Content Manager',
        'writer': 'Contributor',
        'commenter': 'Commenter',
        'reader': 'Viewer'
    };
    return roleMap[role] || role;
};

const getStatusIcon = (status: string) => {
    switch (status) {
        case 'exact_match':
            return <CheckCircle2 className="h-5 w-5 text-green-500" />;
        case 'compliant':
            return <Shield className="h-5 w-5 text-blue-500" />;
        case 'non_compliant':
            return <XCircle className="h-5 w-5 text-red-500" />;
        // Backward compatibility
        case 'match':
            return <CheckCircle2 className="h-5 w-5 text-green-500" />;
        default:
            return null;
    }
};

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'exact_match':
            return <Badge className="bg-green-500 hover:bg-green-600">Exact Match</Badge>;
        case 'compliant':
            return <Badge className="bg-blue-500 hover:bg-blue-600">Compliant (Inheritance Allowed)</Badge>;
        case 'non_compliant':
            return <Badge className="bg-red-500 hover:bg-red-600">Non-Compliant</Badge>;
        // Backward compatibility
        case 'match':
            return <Badge className="bg-green-500">Match</Badge>;
        case 'extra':
            return <Badge className="bg-yellow-500">Extra Access</Badge>;
        case 'missing':
            return <Badge className="bg-red-500">Missing</Badge>;
        case 'mismatch':
            return <Badge className="bg-orange-500">Mismatch</Badge>;
        default:
            return null;
    }
};

export default function PermissionAuditPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'issues'>('all');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await fetch('/api/projects');
                const data = await res.json();
                if (data.success) {
                    setProjects(data.projects || []);
                }
            } catch (error) {
                console.error('Error fetching projects:', error);
            }
        };
        fetchProjects();
    }, []);

    const runAudit = useCallback(async () => {
        if (!selectedProjectId) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/audit/permissions?projectId=${selectedProjectId}`);
            const data = await res.json();
            if (data.success) {
                setAuditResult(data.result);
            } else {
                console.error('Audit failed:', data.error);
            }
        } catch (error) {
            console.error('Error running audit:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedProjectId]);

    const enforceProject = useCallback(async () => {
        if (!selectedProjectId) return;

        setLoading(true);
        try {
            const res = await fetch('/api/jobs/enforce-permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: selectedProjectId })
            });
            const data = await res.json();
            if (data.success) {
                window.location.href = '/jobs';
            } else {
                console.error('Enforce failed:', data.error);
                alert('Failed to start enforcement job: ' + data.error);
            }
        } catch (error) {
            console.error('Error starting enforcement:', error);
            alert('Error starting enforcement job');
        } finally {
            setLoading(false);
        }
    }, [selectedProjectId]);

    const enforceAllProjects = useCallback(async () => {
        const confirmed = confirm('Enforce permissions for ALL projects? This will create a job for each project.');
        if (!confirmed) return;

        setLoading(true);
        try {
            const res = await fetch('/api/jobs/enforce-permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ all: true })
            });
            const data = await res.json();
            if (data.success) {
                window.location.href = '/jobs';
            } else {
                console.error('Enforce all failed:', data.error);
                alert('Failed to start enforcement jobs: ' + data.error);
            }
        } catch (error) {
            console.error('Error starting enforcement:', error);
            alert('Error starting enforcement jobs');
        } finally {
            setLoading(false);
        }
    }, []);

    const filteredComparisons = auditResult?.comparisons.filter(c =>
        filter === 'all' || c.status !== 'exact_match'
    ) || [];

    const toggleFolder = (path: string) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(path)) {
                newSet.delete(path);
            } else {
                newSet.add(path);
            }
            return newSet;
        });
    };

    const exportCSV = () => {
        if (!auditResult) return;

        const rows = [['Folder Path', 'Status', 'Expected', 'Actual', 'Discrepancies']];
        for (const c of auditResult.comparisons) {
            rows.push([
                c.normalizedPath,
                c.status,
                [...c.expectedGroups.map(g => `${g.email} (${g.role})`), ...c.expectedUsers.map(u => `${u.email} (${u.role})`)].join('; '),
                c.actualPermissions.map(p => `${p.email} (${p.role})`).join('; '),
                c.discrepancies.join('; ')
            ]);
        }

        const csv = rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `permission-audit-${auditResult.projectCode}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Shield className="h-8 w-8" />
                        Permission Audit
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Compare template permissions with actual Google Drive permissions
                    </p>
                </div>
                {auditResult && (
                    <Button variant="outline" onClick={exportCSV}>
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>
                )}
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a project to audit" />
                                </SelectTrigger>
                                <SelectContent>
                                    {projects.map(p => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.project_code} - {p.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={runAudit} disabled={!selectedProjectId || loading}>
                            {loading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            Run Audit
                        </Button>
                        <Button
                            onClick={enforceProject}
                            disabled={!selectedProjectId || loading}
                            variant="default"
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Shield className="h-4 w-4 mr-2" />
                            )}
                            Enforce This Project
                        </Button>
                        <Button
                            onClick={enforceAllProjects}
                            disabled={loading}
                            variant="destructive"
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Shield className="h-4 w-4 mr-2" />
                            )}
                            Enforce All Projects
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {auditResult && (
                <div className="grid grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{auditResult.matchCount}</p>
                                    <p className="text-sm text-muted-foreground">Match</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900">
                                    <AlertTriangle className="h-6 w-6 text-yellow-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{auditResult.extraCount}</p>
                                    <p className="text-sm text-muted-foreground">Extra Access</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-full bg-red-100 dark:bg-red-900">
                                    <XCircle className="h-6 w-6 text-red-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{auditResult.missingCount}</p>
                                    <p className="text-sm text-muted-foreground">Missing</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900">
                                    <AlertCircle className="h-6 w-6 text-orange-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{auditResult.mismatchCount}</p>
                                    <p className="text-sm text-muted-foreground">Mismatch</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {auditResult && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Folder Comparisons</CardTitle>
                                <CardDescription>
                                    {auditResult.totalFolders} folders analyzed for {auditResult.projectCode}
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant={filter === 'all' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setFilter('all')}
                                >
                                    All
                                </Button>
                                <Button
                                    variant={filter === 'issues' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setFilter('issues')}
                                >
                                    Issues Only
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {filteredComparisons.map((c, idx) => (
                                <div key={idx} className="border rounded-lg">
                                    <div
                                        className={`flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 ${c.status !== 'exact_match' ? 'bg-muted/30' : ''
                                            }`}
                                        onClick={() => toggleFolder(c.folderPath)}
                                    >
                                        <div className="flex items-center gap-3">
                                            {expandedFolders.has(c.folderPath) ? (
                                                <ChevronDown className="h-4 w-4" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4" />
                                            )}
                                            {getStatusIcon(c.status)}
                                            <span className="font-medium">{c.normalizedPath}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm text-muted-foreground">
                                                Expected: {c.expectedCount} |
                                                Direct: {c.directActualCount} |
                                                Inherited: {c.inheritedActualCount} |
                                                Total: {c.totalActualCount}
                                            </span>
                                            {getStatusBadge(c.status)}
                                        </div>
                                    </div>

                                    {expandedFolders.has(c.folderPath) && (
                                        <div className="p-4 bg-muted/20 border-t">
                                            <div className="grid grid-cols-2 gap-6">
                                                <div>
                                                    <h4 className="font-semibold mb-2 text-sm">Expected (Template)</h4>
                                                    <div className="space-y-1">
                                                        {c.expectedGroups.map((g, i) => (
                                                            <div key={`g-${i}`} className="flex items-center justify-between text-sm">
                                                                <span className="flex items-center gap-2">
                                                                    <Badge variant="outline" className="text-xs">Group</Badge>
                                                                    {g.email}
                                                                </span>
                                                                <span className="text-muted-foreground">{getRoleLabel(g.role)}</span>
                                                            </div>
                                                        ))}
                                                        {c.expectedUsers.map((u, i) => (
                                                            <div key={`u-${i}`} className="flex items-center justify-between text-sm">
                                                                <span className="flex items-center gap-2">
                                                                    <Badge variant="outline" className="text-xs">User</Badge>
                                                                    {u.email}
                                                                </span>
                                                                <span className="text-muted-foreground">{getRoleLabel(u.role)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div>
                                                    <h4 className="font-semibold mb-2 text-sm">Actual (Google Drive)</h4>
                                                    <div className="space-y-1">
                                                        {c.actualPermissions.map((p, i) => (
                                                            <div key={i} className="flex items-center justify-between text-sm">
                                                                <span className="flex items-center gap-2">
                                                                    <Badge variant="outline" className="text-xs capitalize">{p.type}</Badge>
                                                                    {p.email}
                                                                </span>
                                                                <span className="text-muted-foreground">{getRoleLabel(p.role)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {c.discrepancies.length > 0 && (
                                                <div className="mt-4 pt-4 border-t">
                                                    <h4 className="font-semibold mb-2 text-sm text-red-500">Discrepancies</h4>
                                                    <ul className="list-disc list-inside text-sm space-y-1">
                                                        {c.discrepancies.map((d, i) => (
                                                            <li key={i} className={d.startsWith('Missing') ? 'text-red-600' : 'text-yellow-600'}>
                                                                {d}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {filteredComparisons.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                    {filter === 'issues'
                                        ? 'No issues found! All permissions match the template.'
                                        : 'No folders to display. Run the audit first.'}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
