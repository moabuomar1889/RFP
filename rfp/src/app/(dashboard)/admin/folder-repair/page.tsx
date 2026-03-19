'use client';

import { useCallback, useState } from 'react';
import {
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Download,
    FolderX,
    HelpCircle,
    Loader2,
    RefreshCw,
    Search,
    ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface MisplacedEntry {
    folderId: string;
    folderName: string;
    normalizedPath: string;
    reason: string;
    confidence: string;
    matchedCorrectFolderId?: string;
    matchedCorrectPath?: string;
}

interface AmbiguousEntry {
    folderId: string;
    folderName: string;
    normalizedPath: string;
    reason: string;
}

interface ProjectResult {
    projectId: string;
    projectCode: string;
    projectRootId: string;
    correctCount: number;
    misplacedCount: number;
    ambiguousCount: number;
    scanDurationMs: number;
    misplaced: MisplacedEntry[];
    ambiguous: AmbiguousEntry[];
}

function StatusBadge({ count, label, color }: { count: number; label: string; color: string }) {
    const colors: Record<string, string> = {
        green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        red: 'bg-red-500/15 text-red-400 border-red-500/30',
        blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    };

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[color]}`}>
            {count} {label}
        </span>
    );
}

function ProjectRow({
    result,
    selected,
    onToggleSelect,
}: {
    result: ProjectResult;
    selected: boolean;
    onToggleSelect: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const hasMisplaced = result.misplacedCount > 0;
    const hasAmbiguous = result.ambiguousCount > 0;

    return (
        <div className="overflow-hidden rounded-lg border border-border/50 bg-card">
            <div className="flex items-center gap-3 px-4 py-3">
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={onToggleSelect}
                    className="h-4 w-4 cursor-pointer rounded accent-primary"
                    disabled={!hasMisplaced}
                    title={hasMisplaced ? 'Select for quarantine' : 'No high-confidence misplaced roots'}
                />
                <button
                    onClick={() => setExpanded(current => !current)}
                    className="flex flex-1 items-center gap-2 text-left"
                >
                    <span className="font-mono text-sm font-semibold">{result.projectCode}</span>
                    <span className="text-xs text-muted-foreground">({result.scanDurationMs}ms)</span>
                    {expanded ? (
                        <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                        <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                    )}
                </button>
                <div className="flex flex-shrink-0 items-center gap-2">
                    <StatusBadge count={result.correctCount} label="correct" color="green" />
                    {hasMisplaced ? <StatusBadge count={result.misplacedCount} label="misplaced" color="red" /> : null}
                    {hasAmbiguous ? <StatusBadge count={result.ambiguousCount} label="ambiguous" color="amber" /> : null}
                    {!hasMisplaced && !hasAmbiguous ? <StatusBadge count={0} label="issues" color="green" /> : null}
                </div>
            </div>

            {expanded && (result.misplaced.length > 0 || result.ambiguous.length > 0) ? (
                <div className="space-y-3 border-t border-border/40 bg-muted/20 px-4 py-3">
                    {result.misplaced.length > 0 ? (
                        <div>
                            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-red-400">
                                <FolderX className="h-3.5 w-3.5" /> High-confidence misplaced roots
                            </p>
                            <div className="space-y-1">
                                {result.misplaced.map(item => (
                                    <div
                                        key={item.folderId}
                                        className="rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs"
                                    >
                                        <div className="truncate font-mono text-red-300">{item.folderName}</div>
                                        <div className="mt-0.5 text-muted-foreground">{item.reason}</div>
                                        {item.matchedCorrectPath ? (
                                            <div className="mt-0.5 text-emerald-400">
                                                Confirmed in-root equivalent:{' '}
                                                <span className="font-mono">{item.matchedCorrectPath}</span>
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {result.ambiguous.length > 0 ? (
                        <div>
                            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                                <HelpCircle className="h-3.5 w-3.5" /> Ambiguous - never auto-moved
                            </p>
                            <div className="space-y-1">
                                {result.ambiguous.map(item => (
                                    <div
                                        key={item.folderId}
                                        className="rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs"
                                    >
                                        <div className="truncate font-mono text-amber-300">{item.folderName}</div>
                                        <div className="mt-0.5 text-muted-foreground">{item.reason}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export default function FolderRepairPage() {
    const [projectFilter, setProjectFilter] = useState('');
    const [scanning, setScanning] = useState(false);
    const [results, setResults] = useState<ProjectResult[]>([]);
    const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
    const [quarantining, setQuarantining] = useState(false);
    const [recovering, setRecovering] = useState(false);
    const [actionResults, setActionResults] = useState<any[] | null>(null);

    const totalMisplaced = results.reduce((sum, result) => sum + result.misplacedCount, 0);
    const totalAmbiguous = results.reduce((sum, result) => sum + result.ambiguousCount, 0);
    const totalCorrect = results.reduce((sum, result) => sum + result.correctCount, 0);

    const handleScan = useCallback(async () => {
        setScanning(true);
        setResults([]);
        setSelectedProjects(new Set());
        setActionResults(null);

        try {
            const params = projectFilter.trim()
                ? `?projects=${encodeURIComponent(projectFilter.trim())}`
                : '';
            const response = await fetch(`/api/admin/folder-repair${params}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('rfp_token') || ''}`,
                },
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            setResults(data.results);
            const autoSelected = new Set<string>(
                data.results
                    .filter((result: ProjectResult) => result.misplacedCount > 0)
                    .map((result: ProjectResult) => result.projectCode)
            );
            setSelectedProjects(autoSelected);

            toast.success(`Scan complete - ${data.results.length} projects scanned`);
        } catch (error: any) {
            toast.error(error.message || 'Scan failed');
        } finally {
            setScanning(false);
        }
    }, [projectFilter]);

    const handleQuarantine = useCallback(async () => {
        if (selectedProjects.size === 0) return;

        setQuarantining(true);
        setActionResults(null);

        try {
            const response = await fetch('/api/admin/folder-repair', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('rfp_token') || ''}`,
                },
                body: JSON.stringify({ action: 'quarantine', projectIds: [...selectedProjects] }),
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            setActionResults(data.results);
            toast.success('Quarantine complete - review the results below');
        } catch (error: any) {
            toast.error(error.message || 'Quarantine failed');
        } finally {
            setQuarantining(false);
        }
    }, [selectedProjects]);

    const handleRecover = useCallback(async () => {
        if (selectedProjects.size === 0) return;

        setRecovering(true);
        try {
            const response = await fetch('/api/admin/folder-repair', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('rfp_token') || ''}`,
                },
                body: JSON.stringify({ action: 'recover', projectIds: [...selectedProjects] }),
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            setActionResults(data.results);
            toast.success('Recovery jobs queued - monitor progress in Jobs page');
        } catch (error: any) {
            toast.error(error.message || 'Recovery failed');
        } finally {
            setRecovering(false);
        }
    }, [selectedProjects]);

    const handleExportJson = useCallback(() => {
        if (results.length === 0) return;
        const payload = {
            exportedAt: new Date().toISOString(),
            totalProjects: results.length,
            summary: {
                correct: results.reduce((s, r) => s + r.correctCount, 0),
                misplaced: results.reduce((s, r) => s + r.misplacedCount, 0),
                ambiguous: results.reduce((s, r) => s + r.ambiguousCount, 0),
            },
            projects: results,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `folder-repair-scan-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('JSON exported');
    }, [results]);

    const toggleSelect = (projectCode: string) => {
        setSelectedProjects(previous => {
            const next = new Set(previous);
            if (next.has(projectCode)) {
                next.delete(projectCode);
            } else {
                next.add(projectCode);
            }
            return next;
        });
    };

    const selectedMisplacedCount = results
        .filter(result => selectedProjects.has(result.projectCode))
        .reduce((sum, result) => sum + result.misplacedCount, 0);

    return (
        <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Folder Repair</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Detect and quarantine misplaced top-level project-tagged roots created outside the real
                    project root in earlier enforcement runs.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Phase 1 - Detection (Dry Run)</CardTitle>
                    <CardDescription>
                        Scan projects and classify folders as correct, misplaced top-level roots, or ambiguous.
                        No changes are made.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <div className="flex gap-3">
                        <Input
                            placeholder="Filter projects (e.g. PRJ-021, PRJ-022) - leave blank for all"
                            value={projectFilter}
                            onChange={event => setProjectFilter(event.target.value)}
                            className="flex-1"
                            onKeyDown={event => event.key === 'Enter' && handleScan()}
                        />
                        <Button onClick={handleScan} disabled={scanning} className="shrink-0 gap-2">
                            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            {scanning ? 'Scanning...' : 'Run Dry-Run Scan'}
                        </Button>
                        {results.length > 0 && (
                            <Button variant="outline" onClick={handleExportJson} className="shrink-0 gap-2">
                                <Download className="h-4 w-4" />
                                Export JSON
                            </Button>
                        )}
                    </div>

                    {results.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                            <StatusBadge count={results.length} label="projects" color="blue" />
                            <StatusBadge count={totalCorrect} label="correct folders" color="green" />
                            <StatusBadge count={totalMisplaced} label="misplaced roots" color="red" />
                            <StatusBadge count={totalAmbiguous} label="ambiguous" color="amber" />
                        </div>
                    ) : null}
                </CardContent>
            </Card>

            {results.length > 0 ? (
                <>
                    <div className="space-y-2">
                        {results.map(result => (
                            <ProjectRow
                                key={result.projectCode}
                                result={result}
                                selected={selectedProjects.has(result.projectCode)}
                                onToggleSelect={() => toggleSelect(result.projectCode)}
                            />
                        ))}
                    </div>

                    <Separator />

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Phase 2 - Quarantine</CardTitle>
                            <CardDescription>
                                Move only HIGH-confidence misplaced roots to{' '}
                                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                                    _REPAIR_QUARANTINE
                                </span>{' '}
                                under the same parent as the affected project roots. Ambiguous folders are never
                                touched.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            {selectedProjects.size === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Select one or more projects above to enable quarantine.
                                </p>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    <span className="font-semibold text-foreground">
                                        {selectedProjects.size} project(s)
                                    </span>{' '}
                                    selected. {selectedMisplacedCount} high-confidence misplaced roots will be moved.
                                </p>
                            )}

                            <div className="flex gap-3">
                                <Button
                                    variant="destructive"
                                    onClick={handleQuarantine}
                                    disabled={quarantining || selectedProjects.size === 0 || totalMisplaced === 0}
                                    className="gap-2"
                                >
                                    {quarantining ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <ShieldAlert className="h-4 w-4" />
                                    )}
                                    {quarantining ? 'Quarantining...' : 'Execute Quarantine'}
                                </Button>

                                <Button
                                    variant="outline"
                                    onClick={handleRecover}
                                    disabled={recovering || selectedProjects.size === 0}
                                    className="gap-2"
                                >
                                    {recovering ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="h-4 w-4" />
                                    )}
                                    {recovering ? 'Queueing...' : 'Run Recovery (Enforce + built-in reindex)'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {actionResults ? (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                    Action Results
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {actionResults.map((result: any, index: number) => (
                                        <div
                                            key={index}
                                            className="rounded-lg border border-border/40 bg-muted/20 px-4 py-3 text-sm"
                                        >
                                            <div className="mb-1 font-mono text-sm font-semibold">
                                                {result.projectCode}
                                            </div>
                                            {result.moved !== undefined ? (
                                                <div className="flex gap-3 text-xs text-muted-foreground">
                                                    <span className="text-emerald-400">{result.moved} moved</span>
                                                    <span>{result.skipped} skipped</span>
                                                    {result.errors?.length > 0 ? (
                                                        <span className="text-red-400">
                                                            {result.errors.length} errors
                                                        </span>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                            {result.status ? (
                                                <span
                                                    className={`text-xs ${
                                                        result.status === 'job_queued'
                                                            ? 'text-emerald-400'
                                                            : 'text-red-400'
                                                    }`}
                                                >
                                                    {result.status === 'job_queued'
                                                        ? 'Enforce job queued'
                                                        : `Error: ${result.error}`}
                                                </span>
                                            ) : null}
                                            {result.errors?.length > 0 ? (
                                                <div className="mt-2 space-y-1">
                                                    {result.errors.map((message: string, errorIndex: number) => (
                                                        <div key={errorIndex} className="text-xs text-red-400">
                                                            {message}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ) : null}
                </>
            ) : null}

            <div className="space-y-1 border-t border-border/40 pt-4 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5">
                    <FolderX className="h-3.5 w-3.5 text-red-400" />
                    <strong className="text-foreground">Misplaced (HIGH)</strong> - top-level suspect root outside the
                    project root, with one confirmed in-root equivalent
                </p>
                <p className="flex items-center gap-1.5">
                    <HelpCircle className="h-3.5 w-3.5 text-amber-400" />
                    <strong className="text-foreground">Ambiguous</strong> - nested under another suspect root, or no
                    single safe in-root equivalent
                </p>
                <p className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <strong className="text-foreground">Correct</strong> - inside the real project root, no action
                    needed
                </p>
                <p className="mt-2 italic">
                    Quarantined folders are moved to <span className="font-mono">_REPAIR_QUARANTINE</span> and logged
                    in <span className="font-mono">repair_quarantine_log</span>. Nothing is permanently deleted.
                </p>
            </div>
        </div>
    );
}
