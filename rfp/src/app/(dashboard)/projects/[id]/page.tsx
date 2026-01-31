"use client";

import { use, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

// Mock project data
const project = {
    id: "1",
    prNumber: "PR-001",
    name: "Al Madinah Tower",
    status: "active",
    phase: "bidding", // 'bidding' or 'execution'
    syncedVersion: 12,
    lastSynced: "2024-01-26T10:00:00Z",
    lastEnforced: "2024-01-26T11:00:00Z",
    driveFolderId: "1abc123xyz",
    driveUrl: "https://drive.google.com/drive/folders/1abc123xyz",
    foldersCount: 52,
    hasViolations: false,
    hasPendingUpgrade: false,
};

// Mock folder structure
const folderTree = [
    {
        id: "1",
        name: "PRJ-PR-001-RFP",
        path: "/Bidding",
        limitedAccess: false,
        synced: true,
        children: [
            { id: "1-1", name: "1-PR-001-RFP-SOW", path: "/Bidding/SOW", limitedAccess: true, synced: true, children: [] },
            { id: "1-2", name: "2-PR-001-RFP-Technical", path: "/Bidding/Technical", limitedAccess: true, synced: true, children: [] },
            { id: "1-3", name: "3-PR-001-RFP-Commercial", path: "/Bidding/Commercial", limitedAccess: true, synced: true, children: [] },
        ],
    },
];

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
    const [isRequestingUpgrade, setIsRequestingUpgrade] = useState(false);
    const [upgradeRequested, setUpgradeRequested] = useState(project.hasPendingUpgrade);

    const handleRequestUpgrade = async () => {
        setIsRequestingUpgrade(true);
        // In real implementation, call API
        setTimeout(() => {
            setIsRequestingUpgrade(false);
            setUpgradeRequested(true);
        }, 1500);
    };

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
                            {project.prNumber}
                        </h1>
                        <Badge
                            variant={project.phase === "execution" ? "default" : "secondary"}
                            className={project.phase === "execution" ? "bg-green-500" : "bg-amber-500"}
                        >
                            {project.phase === "execution" ? "🚀 Execution" : "📋 Bidding"}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground">{project.name}</p>
                </div>
                <Button variant="outline" asChild>
                    <a href={project.driveUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open in Drive
                    </a>
                </Button>
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
                <Button variant="outline">
                    <Shield className="mr-2 h-4 w-4" />
                    Enforce Now
                </Button>
                <Button>
                    <Play className="mr-2 h-4 w-4" />
                    Sync Project
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
                        <div className="text-2xl font-bold">{project.foldersCount}</div>
                        <p className="text-sm text-muted-foreground">Indexed Folders</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">v{project.syncedVersion}</div>
                        <p className="text-sm text-muted-foreground">Template Version</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2">
                            {project.hasViolations ? (
                                <>
                                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                                    <span className="text-2xl font-bold text-amber-500">2</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    <span className="text-2xl font-bold text-green-500">OK</span>
                                </>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground">Permission Status</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-sm font-medium">
                            {new Date(project.lastSynced).toLocaleDateString()}
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
                        {folderTree.map((node) => (
                            <FolderNode key={node.id} node={node} level={0} />
                        ))}
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
