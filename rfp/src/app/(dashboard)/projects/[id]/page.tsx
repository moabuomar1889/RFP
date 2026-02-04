"use client";

import { use, useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    ArrowLeft,
    Play,
    RefreshCw,
    Shield,
    FolderOpen,
    ChevronRight,
    ChevronDown,
    Lock,
    CheckCircle2,
    AlertTriangle,
    ExternalLink,
    ArrowUpCircle,
    Loader2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Project {
    id: string;
    pr_number: string;
    name: string;
    status: string;
    phase: string;
    synced_version: number | null;
    last_synced_at: string | null;
    drive_folder_id: string;
}

interface FolderNodeProps {
    node: any;
    level: number;
}

function FolderNode({ node, level }: FolderNodeProps) {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div>
            <div
                className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-accent cursor-pointer"
                style={{ paddingLeft: `${level * 20 + 12}px` }}
            >
                {hasChildren ? (
                    <button onClick={() => setExpanded(!expanded)} className="p-0.5">
                        {expanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                    </button>
                ) : (
                    <span className="w-5" />
                )}
                <FolderOpen className="h-4 w-4 text-primary" />
                <span className="flex-1 text-sm">{node.name}</span>
                {node.limitedAccess && <Lock className="h-3 w-3 text-amber-500" />}
                {node.synced ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : (
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                )}
            </div>
            {hasChildren && expanded && (
                <div>
                    {node.children.map((child: any) => (
                        <FolderNode key={child.id} node={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const projectId = resolvedParams.id;

    const [loading, setLoading] = useState(true);
    const [project, setProject] = useState<Project | null>(null);
    const [folderTree, setFolderTree] = useState<any[]>([]);
    const [isRequestingUpgrade, setIsRequestingUpgrade] = useState(false);
    const [upgradeRequested, setUpgradeRequested] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [enforcing, setEnforcing] = useState(false);

    useEffect(() => {
        fetchProjectData();
    }, [projectId]);

    const fetchProjectData = async () => {
        try {
            setLoading(true);
            const timestamp = Date.now();

            // Fetch project by ID
            const res = await fetch(`/api/projects/${projectId}?t=${timestamp}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });

            if (!res.ok) {
                throw new Error('Failed to fetch project');
            }

            const data = await res.json();

            if (data.success && data.project) {
                setProject(data.project);
            } else {
                toast.error('Project not found');
            }

            // Fetch folder tree
            const foldersRes = await fetch(`/api/folders/${projectId}?t=${timestamp}`, {
                cache: 'no-store',
            });
            const foldersData = await foldersRes.json();
            if (foldersData.success) {
                setFolderTree(foldersData.folders || []);
            }

        } catch (error) {
            console.error('Error fetching project:', error);
            toast.error('Failed to load project');
        } finally {
            setLoading(false);
        }
    };

    const handleSyncProject = async () => {
        try {
            setSyncing(true);
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, triggeredBy: 'admin' }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Project sync started');
                setTimeout(() => fetchProjectData(), 3000);
            } else {
                toast.error(data.error || 'Failed to start sync');
            }
        } catch (error) {
            toast.error('Failed to trigger sync');
        } finally {
            setSyncing(false);
        }
    };

    const handleEnforceNow = async () => {
        try {
            setEnforcing(true);
            const res = await fetch('/api/enforce', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectIds: [projectId], triggeredBy: 'admin' }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Permission enforcement started');
                setTimeout(() => fetchProjectData(), 3000);
            } else {
                toast.error(data.error || 'Failed to start enforcement');
            }
        } catch (error) {
            toast.error('Failed to trigger enforcement');
        } finally {
            setEnforcing(false);
        }
    };

    const handleRequestUpgrade = async () => {
        if (!project) return;

        setIsRequestingUpgrade(true);
        try {
            const res = await fetch('/api/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestType: 'upgrade_to_pd',
                    projectName: project.name,
                    projectId: project.id,
                }),
            });

            const data = await res.json();

            if (data.success) {
                setUpgradeRequested(true);
                toast.success('Upgrade request submitted');
            } else {
                toast.error(data.error || 'Failed to submit request');
            }
        } catch (error) {
            toast.error('Failed to submit upgrade request');
        } finally {
            setIsRequestingUpgrade(false);
        }
    };

    const driveUrl = project?.drive_folder_id
        ? `https://drive.google.com/drive/folders/${project.drive_folder_id}`
        : '#';

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <AlertTriangle className="h-12 w-12 text-amber-500" />
                <h2 className="text-xl font-semibold">Project Not Found</h2>
                <Button asChild>
                    <Link href="/projects">Back to Projects</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/projects">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight">
                            {project.pr_number}
                        </h1>
                        <Badge
                            variant={project.phase === "execution" ? "default" : "secondary"}
                            className={project.phase === "execution" ? "bg-green-500" : "bg-amber-500"}
                        >
                            {project.phase === "execution" ? "🚀 Project Delivery" : "📋 Bidding"}
                        </Badge>
                        {project.status === "pending_creation" && (
                            <Badge variant="outline" className="text-amber-600 border-amber-400">
                                ⏳ Pending Folder Creation
                            </Badge>
                        )}
                    </div>
                    <p className="text-muted-foreground">{project.name}</p>
                </div>
                {project.drive_folder_id && (
                    <Button variant="outline" asChild>
                        <a href={driveUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Open in Drive
                        </a>
                    </Button>
                )}
                {project.phase === "bidding" && !upgradeRequested && (
                    <Button
                        variant="outline"
                        className="border-purple-500 text-purple-600 hover:bg-purple-50"
                        onClick={handleRequestUpgrade}
                        disabled={isRequestingUpgrade}
                    >
                        {isRequestingUpgrade ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Requesting...
                            </>
                        ) : (
                            <>
                                <ArrowUpCircle className="mr-2 h-4 w-4" />
                                Upgrade to Project Delivery
                            </>
                        )}
                    </Button>
                )}
                {upgradeRequested && project.phase === "bidding" && (
                    <Badge variant="outline" className="px-3 py-1">
                        ⏳ Upgrade Pending Approval
                    </Badge>
                )}
                <Button variant="outline" onClick={handleEnforceNow} disabled={enforcing}>
                    {enforcing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Shield className="mr-2 h-4 w-4" />
                    )}
                    {enforcing ? 'Enforcing...' : 'Enforce Now'}
                </Button>
                <Button onClick={handleSyncProject} disabled={syncing}>
                    {syncing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Play className="mr-2 h-4 w-4" />
                    )}
                    {syncing ? 'Syncing...' : 'Sync Project'}
                </Button>
            </div>

            {/* Upgrade to PD Card (for bidding phase) */}
            {project.phase === "bidding" && !upgradeRequested && (
                <Card className="border-purple-500/50 bg-purple-500/5">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
                                    <ArrowUpCircle className="h-6 w-6 text-purple-500" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Ready for Project Delivery?</h3>
                                    <p className="text-sm text-muted-foreground">
                                        If the project won the bid, you can upgrade to create Project Delivery folders.
                                    </p>
                                </div>
                            </div>
                            <Button
                                className="bg-purple-600 hover:bg-purple-700"
                                onClick={handleRequestUpgrade}
                                disabled={isRequestingUpgrade}
                            >
                                {isRequestingUpgrade ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Requesting...
                                    </>
                                ) : (
                                    <>
                                        <ArrowUpCircle className="mr-2 h-4 w-4" />
                                        Request Upgrade
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{folderTree.length || 0}</div>
                        <p className="text-sm text-muted-foreground">Indexed Folders</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">v{project.synced_version || 0}</div>
                        <p className="text-sm text-muted-foreground">Template Version</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <span className="text-2xl font-bold text-green-500">OK</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Permission Status</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-sm font-medium">
                            {project.last_synced_at
                                ? new Date(project.last_synced_at).toLocaleDateString()
                                : 'Never'}
                        </div>
                        <p className="text-sm text-muted-foreground">Last Synced</p>
                    </CardContent>
                </Card>
            </div>

            {/* Folder Tree */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Folder Structure</CardTitle>
                            <CardDescription>
                                Current folder tree with sync status
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="sm">
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Rebuild Index
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[400px]">
                        {folderTree.length > 0 ? (
                            folderTree.map((node) => (
                                <FolderNode key={node.id} node={node} level={0} />
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                                <FolderOpen className="h-12 w-12 mb-3 opacity-50" />
                                <p>No folders indexed yet</p>
                                <p className="text-sm">Click "Sync Project" to scan folders</p>
                            </div>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
