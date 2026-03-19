'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
    AlertTriangle,
    CheckCircle2,
    HelpCircle,
    FolderX,
    Search,
    ShieldAlert,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Types ───────────────────────────────────────────────────────────────────
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

// ─── Status badge helpers ─────────────────────────────────────────────────────
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

// ─── Collapsible project row ──────────────────────────────────────────────────
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
        <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-3">
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={onToggleSelect}
                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                    disabled={!hasMisplaced}
                    title={hasMisplaced ? 'Select for quarantine' : 'No misplaced folders'}
                />
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="flex items-center gap-2 flex-1 text-left"
                >
                    <span className="font-mono font-semibold text-sm">{result.projectCode}</span>
                    <span className="text-muted-foreground text-xs">({result.scanDurationMs}ms)</span>
                    {expanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                    ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                    )}
                </button>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge count={result.correctCount} label="correct" color="green" />
                    {hasMisplaced && (
                        <StatusBadge count={result.misplacedCount} label="misplaced" color="red" />
                    )}
                    {hasAmbiguous && (
                        <StatusBadge count={result.ambiguousCount} label="ambiguous" color="amber" />
                    )}
                    {!hasMisplaced && !hasAmbiguous && (
                        <StatusBadge count={0} label="issues" color="green" />
                    )}
                </div>
            </div>

            {/* Expanded detail */}
            {expanded && (result.misplaced.length > 0 || result.ambiguous.length > 0) && (
                <div className="border-t border-border/40 px-4 py-3 space-y-3 bg-muted/20">
                    {result.misplaced.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1.5">
                                <FolderX className="h-3.5 w-3.5" /> HIGH-confidence misplaced
                            </p>
                            <div className="space-y-1">
                                {result.misplaced.map(m => (
                                    <div key={m.folderId} className="text-xs bg-red-500/5 border border-red-500/20 rounded px-3 py-2">
                                        <div className="font-mono text-red-300 truncate">{m.folderName}</div>
                                        <div className="text-muted-foreground mt-0.5">{m.reason}</div>
                                        {m.matchedCorrectPath && (
                                            <div className="text-emerald-400 mt-0.5">
                                                ✓ In-root equivalent: <span className="font-mono">{m.matchedCorrectPath}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {result.ambiguous.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
                                <HelpCircle className="h-3.5 w-3.5" /> Ambiguous — will NOT be moved
                            </p>
                            <div className="space-y-1">
                                {result.ambiguous.map(a => (
                                    <div key={a.folderId} className="text-xs bg-amber-500/5 border border-amber-500/20 rounded px-3 py-2">
                                        <div className="font-mono text-amber-300 truncate">{a.folderName}</div>
                                        <div className="text-muted-foreground mt-0.5">{a.reason}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FolderRepairPage() {
    const { toast } = useToast();
    const [projectFilter, setProjectFilter] = useState('');
    const [scanning, setScanning] = useState(false);
    const [results, setResults] = useState<ProjectResult[]>([]);
    const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
    const [quarantining, setQuarantining] = useState(false);
    const [recovering, setRecovering] = useState(false);
    const [actionResults, setActionResults] = useState<any[] | null>(null);

    const totalMisplaced = results.reduce((s, r) => s + r.misplacedCount, 0);
    const totalAmbiguous = results.reduce((s, r) => s + r.ambiguousCount, 0);
    const totalCorrect = results.reduce((s, r) => s + r.correctCount, 0);

    // ── Scan ──────────────────────────────────────────────────────────────────
    const handleScan = useCallback(async () => {
        setScanning(true);
        setResults([]);
        setSelectedProjects(new Set());
        setActionResults(null);

        try {
            const params = projectFilter.trim()
                ? `?projects=${encodeURIComponent(projectFilter.trim())}`
                : '';
            const res = await fetch(`/api/admin/folder-repair${params}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('rfp_token') || ''}` },
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            setResults(data.results);

            // Auto-select all projects that have misplaced folders
            const autoSelect = new Set<string>(
                data.results.filter((r: ProjectResult) => r.misplacedCount > 0).map((r: ProjectResult) => r.projectCode)
            );
            setSelectedProjects(autoSelect);

            toast({ title: `Scan complete — ${data.results.length} projects scanned` });
        } catch (err: any) {
            toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
        } finally {
            setScanning(false);
        }
    }, [projectFilter, toast]);

    // ── Quarantine ────────────────────────────────────────────────────────────
    const handleQuarantine = useCallback(async () => {
        if (selectedProjects.size === 0) return;
        setQuarantining(true);
        setActionResults(null);
        try {
            const res = await fetch('/api/admin/folder-repair', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('rfp_token') || ''}`,
                },
                body: JSON.stringify({ action: 'quarantine', projectIds: [...selectedProjects] }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            setActionResults(data.results);
            toast({ title: `Quarantine complete — check results below` });
        } catch (err: any) {
            toast({ title: 'Quarantine failed', description: err.message, variant: 'destructive' });
        } finally {
            setQuarantining(false);
        }
    }, [selectedProjects, toast]);

    // ── Recover ───────────────────────────────────────────────────────────────
    const handleRecover = useCallback(async () => {
        if (selectedProjects.size === 0) return;
        setRecovering(true);
        try {
            const res = await fetch('/api/admin/folder-repair', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('rfp_token') || ''}`,
                },
                body: JSON.stringify({ action: 'recover', projectIds: [...selectedProjects] }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            setActionResults(data.results);
            toast({ title: `Recovery jobs queued — monitor progress in Jobs page` });
        } catch (err: any) {
            toast({ title: 'Recovery failed', description: err.message, variant: 'destructive' });
        } finally {
            setRecovering(false);
        }
    }, [selectedProjects, toast]);

    const toggleSelect = (code: string) =>
        setSelectedProjects(prev => {
            const next = new Set(prev);
            next.has(code) ? next.delete(code) : next.add(code);
            return next;
        });

    const projectsWithMisplaced = results.filter(r => r.misplacedCount > 0);

    return (
        <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Folder Repair</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Detect and quarantine folders created outside the real project root in earlier enforcement runs.
                </p>
            </div>

            {/* Scan Controls */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Phase 1 — Detection (Dry Run)</CardTitle>
                    <CardDescription>
                        Scan projects and classify folders as correct, misplaced (HIGH confidence), or ambiguous. No changes are made.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <div className="flex gap-3">
                        <Input
                            placeholder="Filter projects (e.g. PRJ-021, PRJ-022) — leave blank for all"
                            value={projectFilter}
                            onChange={e => setProjectFilter(e.target.value)}
                            className="flex-1"
                            onKeyDown={e => e.key === 'Enter' && handleScan()}
                        />
                        <Button onClick={handleScan} disabled={scanning} className="gap-2 shrink-0">
                            {scanning ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Search className="h-4 w-4" />
                            )}
                            {scanning ? 'Scanning…' : 'Run Dry-Run Scan'}
                        </Button>
                    </div>

                    {/* Summary pills */}
                    {results.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            <StatusBadge count={results.length} label="projects" color="blue" />
                            <StatusBadge count={totalCorrect} label="correct folders" color="green" />
                            <StatusBadge count={totalMisplaced} label="misplaced (HIGH)" color="red" />
                            <StatusBadge count={totalAmbiguous} label="ambiguous" color="amber" />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Results */}
            {results.length > 0 && (
                <>
                    <div className="space-y-2">
                        {results.map(r => (
                            <ProjectRow
                                key={r.projectCode}
                                result={r}
                                selected={selectedProjects.has(r.projectCode)}
                                onToggleSelect={() => toggleSelect(r.projectCode)}
                            />
                        ))}
                    </div>

                    <Separator />

                    {/* Action Panel */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Phase 2 — Quarantine</CardTitle>
                            <CardDescription>
                                Move HIGH-confidence misplaced folders to{' '}
                                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">_REPAIR_QUARANTINE</span>{' '}
                                in the Shared Drive. Ambiguous folders are never touched.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            {selectedProjects.size === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Select one or more projects above to enable quarantine.
                                </p>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    <span className="font-semibold text-foreground">{selectedProjects.size} project(s)</span> selected.{' '}
                                    {projectsWithMisplaced.filter(r => selectedProjects.has(r.projectCode)).reduce((s, r) => s + r.misplacedCount, 0)} HIGH-confidence folders will be moved.
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
                                    {quarantining ? 'Quarantining…' : 'Execute Quarantine'}
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
                                    {recovering ? 'Queueing…' : 'Run Recovery (Rebuild + Enforce)'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Action Results */}
                    {actionResults && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                    Action Results
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {actionResults.map((r: any, i: number) => (
                                        <div key={i} className="text-sm border border-border/40 rounded-lg px-4 py-3 bg-muted/20">
                                            <div className="font-mono font-semibold text-sm mb-1">{r.projectCode}</div>
                                            {r.moved !== undefined && (
                                                <div className="flex gap-3 text-xs text-muted-foreground">
                                                    <span className="text-emerald-400">✓ {r.moved} moved</span>
                                                    <span>{r.skipped} skipped</span>
                                                    {r.errors?.length > 0 && (
                                                        <span className="text-red-400">{r.errors.length} errors</span>
                                                    )}
                                                </div>
                                            )}
                                            {r.status && (
                                                <span className={`text-xs ${r.status === 'job_queued' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {r.status === 'job_queued' ? '✓ Enforce job queued' : `Error: ${r.error}`}
                                                </span>
                                            )}
                                            {r.errors?.length > 0 && (
                                                <div className="mt-2 space-y-1">
                                                    {r.errors.map((e: string, j: number) => (
                                                        <div key={j} className="text-xs text-red-400">{e}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            {/* Legend */}
            <div className="text-xs text-muted-foreground space-y-1 border-t border-border/40 pt-4">
                <p className="flex items-center gap-1.5"><FolderX className="h-3.5 w-3.5 text-red-400" /> <strong className="text-foreground">Misplaced (HIGH)</strong> — outside project root, in-root equivalent confirmed — will be quarantined</p>
                <p className="flex items-center gap-1.5"><HelpCircle className="h-3.5 w-3.5 text-amber-400" /> <strong className="text-foreground">Ambiguous</strong> — outside root, no in-root equivalent — never auto-moved, surfaced for manual review</p>
                <p className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> <strong className="text-foreground">Correct</strong> — inside the real project root, no action needed</p>
                <p className="mt-2 italic">Quarantined folders are moved to <span className="font-mono">_REPAIR_QUARANTINE</span> in the Shared Drive and logged in <span className="font-mono">repair_quarantine_log</span>. Nothing is permanently deleted.</p>
            </div>
        </div>
    );
}
