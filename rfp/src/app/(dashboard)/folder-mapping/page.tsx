"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Link2,
    Link2Off,
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    FolderOpen,
    ExternalLink,
    Search,
} from "lucide-react";

interface UnmappedFolder {
    drive_folder_id: string;
    project_id: string;
    project_name: string;
    template_path: string;
    normalized_template_path: string | null;
    current_node_id: string | null;
}

interface TemplateNode {
    node_id: string;
    path: string;
    name: string;
    limitedAccess: boolean;
}

interface MapResult {
    folderId: string;
    status: "success" | "error" | "loading" | null;
    message?: string;
}

export default function FolderMappingPage() {
    const [unmapped, setUnmapped] = useState<UnmappedFolder[]>([]);
    const [templateNodes, setTemplateNodes] = useState<TemplateNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedProject, setSelectedProject] = useState<string>("all");
    const [search, setSearch] = useState("");
    const [selectedMappings, setSelectedMappings] = useState<Record<string, string>>({});
    const [results, setResults] = useState<Record<string, MapResult>>({});
    const [stats, setStats] = useState({ total: 0, bound: 0, unbound: 0 });

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [unmappedRes, nodesRes] = await Promise.all([
                fetch("/api/admin/unmapped-folders"),
                fetch("/api/admin/template-nodes"),
            ]);

            if (!unmappedRes.ok) {
                throw new Error(`Failed to load unmapped folders: ${unmappedRes.statusText}`);
            }
            if (!nodesRes.ok) {
                throw new Error(`Failed to load template nodes: ${nodesRes.statusText}`);
            }

            const unmappedData = await unmappedRes.json();
            const nodesData = await nodesRes.json();

            setUnmapped(unmappedData.folders || []);
            setTemplateNodes(nodesData.nodes || []);
            setStats({
                total: unmappedData.stats?.total || 0,
                bound: unmappedData.stats?.bound || 0,
                unbound: unmappedData.stats?.unbound || 0,
            });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleMap = async (folderId: string) => {
        const nodeId = selectedMappings[folderId];
        if (!nodeId) return;

        setResults((previous) => ({
            ...previous,
            [folderId]: { folderId, status: "loading" },
        }));

        try {
            const res = await fetch("/api/admin/map-folder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ drive_folder_id: folderId, template_node_id: nodeId }),
            });
            const data = await res.json();

            if (res.ok) {
                setResults((previous) => ({
                    ...previous,
                    [folderId]: {
                        folderId,
                        status: "success",
                        message: "Mapped successfully",
                    },
                }));
                setUnmapped((previous) => previous.filter((folder) => folder.drive_folder_id !== folderId));
                setStats((previous) => ({
                    ...previous,
                    bound: previous.bound + 1,
                    unbound: Math.max(0, previous.unbound - 1),
                }));
            } else {
                setResults((previous) => ({
                    ...previous,
                    [folderId]: {
                        folderId,
                        status: "error",
                        message: data.error || "Failed",
                    },
                }));
            }
        } catch (err: any) {
            setResults((previous) => ({
                ...previous,
                [folderId]: {
                    folderId,
                    status: "error",
                    message: err.message,
                },
            }));
        }
    };

    const projects = Array.from(
        new Map(unmapped.map((folder) => [folder.project_id, folder.project_name])).entries()
    );

    const filtered = unmapped.filter((folder) => {
        const matchProject =
            selectedProject === "all" || folder.project_id === selectedProject;
        const searchLower = search.toLowerCase();
        const displayPath = folder.normalized_template_path || folder.template_path;
        const matchSearch =
            !search ||
            displayPath.toLowerCase().includes(searchLower) ||
            folder.project_name?.toLowerCase().includes(searchLower);

        return matchProject && matchSearch;
    });

    const boundPct = stats.total > 0 ? Math.round((stats.bound * 100) / stats.total) : 100;

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Link2 className="w-6 h-6 text-blue-500" />
                        Folder Node Mapping
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Emergency recovery tool for folders that were not created by the system template flow
                    </p>
                </div>
                <Button onClick={loadData} variant="outline" size="sm" disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-sm font-semibold text-amber-400">
                                Do not use this page for system-created folders
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Folders created by the system from the active template are auto-bound and should never appear here.
                                Anything visible on this page should be a user-created folder or an exceptional recovery/debugging case.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10">
                                <FolderOpen className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.total}</p>
                                <p className="text-xs text-muted-foreground">Total Indexed Folders</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-500/10">
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.bound}</p>
                                <p className="text-xs text-muted-foreground">Bound ({boundPct}%)</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div
                                className={`p-2 rounded-lg ${
                                    stats.unbound > 0 ? "bg-orange-500/10" : "bg-green-500/10"
                                }`}
                            >
                                {stats.unbound > 0 ? (
                                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                                ) : (
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                )}
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.unbound}</p>
                                <p className="text-xs text-muted-foreground">Exceptional Unmapped</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {stats.unbound === 0 && !loading && (
                <Card className="border-green-500/30 bg-green-500/5">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3 text-green-600">
                            <CheckCircle2 className="w-5 h-5" />
                            <div>
                                <p className="font-semibold">No manual mapping is needed.</p>
                                <p className="text-sm opacity-80">
                                    All system-managed folders are already bound to stable template node IDs.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {error && (
                <Card className="border-red-500/30 bg-red-500/5">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-red-500">
                            <XCircle className="w-4 h-4" />
                            <span className="text-sm">{error}</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {stats.unbound > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Link2Off className="w-4 h-4 text-orange-500" />
                            Manual / Exceptional Folders
                            <Badge variant="outline" className="ml-1">
                                {filtered.length} showing
                            </Badge>
                        </CardTitle>

                        <div className="flex gap-3 mt-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    className="w-full pl-9 pr-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="Search by folder path or project..."
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                />
                            </div>
                            <Select value={selectedProject} onValueChange={setSelectedProject}>
                                <SelectTrigger className="w-56">
                                    <SelectValue placeholder="All Projects" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Projects</SelectItem>
                                    {projects.map(([id, name]) => (
                                        <SelectItem key={id} value={id}>
                                            {name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0">
                        <ScrollArea className="h-[500px]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[200px]">Project</TableHead>
                                        <TableHead>Drive Folder Path</TableHead>
                                        <TableHead>Drive ID</TableHead>
                                        <TableHead className="w-[280px]">Map to Template Node</TableHead>
                                        <TableHead className="w-[100px]">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                                No exceptional folders match your filters
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filtered.map((folder) => {
                                            const displayPath = folder.normalized_template_path || folder.template_path;
                                            const result = results[folder.drive_folder_id];

                                            return (
                                                <TableRow key={folder.drive_folder_id}>
                                                    <TableCell>
                                                        <span className="text-sm font-medium">
                                                            {folder.project_name || "—"}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <FolderOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                                            <span className="text-sm font-mono text-xs">
                                                                {displayPath}
                                                            </span>
                                                            <a
                                                                href={`https://drive.google.com/drive/folders/${folder.drive_folder_id}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-blue-500 hover:text-blue-400 flex-shrink-0"
                                                            >
                                                                <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-mono text-xs text-muted-foreground">
                                                            {folder.drive_folder_id.slice(0, 12)}…
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {result?.status === "success" ? (
                                                            <div className="flex items-center gap-1 text-green-500 text-sm">
                                                                <CheckCircle2 className="w-4 h-4" />
                                                                {result.message}
                                                            </div>
                                                        ) : (
                                                            <Select
                                                                value={selectedMappings[folder.drive_folder_id] || ""}
                                                                onValueChange={(value) =>
                                                                    setSelectedMappings((current) => ({
                                                                        ...current,
                                                                        [folder.drive_folder_id]: value,
                                                                    }))
                                                                }
                                                            >
                                                                <SelectTrigger className="h-8 text-xs">
                                                                    <SelectValue placeholder="Select template node..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {templateNodes
                                                                        .sort((a, b) => a.path.localeCompare(b.path))
                                                                        .map((node) => (
                                                                            <SelectItem key={node.node_id} value={node.node_id}>
                                                                                {node.path}
                                                                                {node.limitedAccess && (
                                                                                    <span className="ml-1 text-orange-400">🔒</span>
                                                                                )}
                                                                            </SelectItem>
                                                                        ))}
                                                                </SelectContent>
                                                            </Select>
                                                        )}
                                                        {result?.status === "error" && (
                                                            <p className="text-xs text-red-500 mt-1">{result.message}</p>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {result?.status !== "success" && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 text-xs"
                                                                disabled={
                                                                    !selectedMappings[folder.drive_folder_id] ||
                                                                    result?.status === "loading"
                                                                }
                                                                onClick={() => handleMap(folder.drive_folder_id)}
                                                            >
                                                                {result?.status === "loading" ? (
                                                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                                                ) : (
                                                                    <Link2 className="w-3 h-3 mr-1" />
                                                                )}
                                                                Bind
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}

            <Card className="border-blue-500/20 bg-blue-500/5">
                <CardContent className="pt-4">
                    <h3 className="text-sm font-semibold mb-2 text-blue-400">How it works</h3>
                    <ul className="text-xs text-muted-foreground space-y-1">
                        <li>• Each managed folder in Google Drive is bound to a template node via a stable UUID (<code>template_node_id</code>)</li>
                        <li>• That binding survives folder renames, path changes, and normalization differences</li>
                        <li>• Folders created by the system are auto-bound and intentionally hidden from this page</li>
                        <li>• Anything shown here should be a user-created folder or a special recovery/debugging case</li>
                        <li>• After binding an exceptional folder, the next enforce run will use the node ID instead of path text for permission resolution</li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}
