"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Plus,
    Search,
    RefreshCw,
    MoreHorizontal,
    FolderOpen,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Loader2,
    ExternalLink,
    Trash2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Project {
    id: string;
    pr_number: string;
    name: string;
    phase: string;
    status: string;
    drive_folder_id: string;
    synced_version: number | null;
    last_synced_at: string | null;
    created_at: string;
}

export default function ProjectsPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [tab, setTab] = useState("all");
    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState<Project[]>([]);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchProjects = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/projects');
            const data = await res.json();

            if (data.success && Array.isArray(data.projects)) {
                setProjects(data.projects);
            } else {
                setProjects([]);
            }
        } catch (error) {
            console.error('Error fetching projects:', error);
            toast.error('Failed to load projects');
            setProjects([]);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (project: Project) => {
        setProjectToDelete(project);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!projectToDelete) return;

        try {
            setIsDeleting(true);
            const res = await fetch(`/api/projects/${projectToDelete.id}`, {
                method: 'DELETE',
            });
            const data = await res.json();

            if (data.success) {
                toast.success(`Project ${projectToDelete.pr_number} deleted`);
                fetchProjects(); // Refresh list
            } else {
                toast.error(data.error || 'Failed to delete project');
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            toast.error('Failed to delete project');
        } finally {
            setIsDeleting(false);
            setDeleteDialogOpen(false);
            setProjectToDelete(null);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const filteredProjects = projects.filter((project) => {
        const matchesSearch =
            project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            project.pr_number.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTab =
            tab === "all" || project.phase === tab;
        return matchesSearch && matchesTab;
    });

    const biddingCount = projects.filter(p => p.phase === 'bidding').length;
    const executionCount = projects.filter(p => p.phase === 'execution').length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
                    <p className="text-muted-foreground">
                        Manage your Google Drive project folders
                    </p>
                </div>
                <Button asChild>
                    <Link href="/projects/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Project
                    </Link>
                </Button>
            </div>

            {/* Filters and Search */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search projects..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Tabs value={tab} onValueChange={setTab}>
                            <TabsList>
                                <TabsTrigger value="all">All ({projects.length})</TabsTrigger>
                                <TabsTrigger value="bidding">
                                    Bidding ({biddingCount})
                                </TabsTrigger>
                                <TabsTrigger value="execution">
                                    Execution ({executionCount})
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <Button variant="outline" size="icon" onClick={fetchProjects}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Projects Table */}
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project</TableHead>
                            <TableHead>Phase</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Sync Version</TableHead>
                            <TableHead>Last Synced</TableHead>
                            <TableHead>Drive</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredProjects.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    {projects.length === 0
                                        ? "No projects found. Run Drive Scan in Settings to import projects."
                                        : "No projects match your search."}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredProjects.map((project) => (
                                <TableRow key={project.id}>
                                    <TableCell>
                                        <Link
                                            href={`/projects/${project.id}`}
                                            className="flex items-center gap-3 hover:underline"
                                        >
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                                <FolderOpen className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{project.pr_number}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {project.name}
                                                </p>
                                            </div>
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                project.phase === "execution" ? "default" : "secondary"
                                            }
                                        >
                                            {project.phase === "execution" ? "Execution" : "Bidding"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{project.status || 'active'}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        {project.synced_version ? (
                                            <Badge variant="outline">v{project.synced_version}</Badge>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Clock className="h-3 w-3" />
                                            {project.last_synced_at
                                                ? new Date(project.last_synced_at).toLocaleDateString()
                                                : 'Never'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <a
                                            href={`https://drive.google.com/drive/folders/${project.drive_folder_id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline flex items-center gap-1"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                            Open
                                        </a>
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/projects/${project.id}`}>
                                                        View Details
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                    <a
                                                        href={`https://drive.google.com/drive/folders/${project.drive_folder_id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        Open in Drive
                                                    </a>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => handleDeleteClick(project)}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete Project
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{projectToDelete?.pr_number} - {projectToDelete?.name}</strong>?
                            <br /><br />
                            The folder will be moved to "Deleted Projects" in Google Drive.
                            This action cannot be easily undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? (
                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...</>
                            ) : (
                                'Delete'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
