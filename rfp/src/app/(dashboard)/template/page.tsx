"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Save,
    History,
    Play,
    FolderPlus,
    ChevronRight,
    ChevronDown,
    Shield,
    Lock,
    Folder,
    Loader2,
    RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// Default template structure
const defaultTemplate = [
    {
        id: "1",
        name: "Bidding",
        path: "/Bidding",
        limitedAccess: false,
        roles: ["ADMIN"],
        children: [
            {
                id: "1-1",
                name: "SOW",
                path: "/Bidding/SOW",
                limitedAccess: true,
                roles: ["ADMIN", "PROJECT_MANAGER"],
                children: [],
            },
            {
                id: "1-2",
                name: "Technical Proposal",
                path: "/Bidding/Technical Proposal",
                limitedAccess: true,
                roles: ["ADMIN", "TECHNICAL_TEAM"],
                children: [
                    {
                        id: "1-2-1",
                        name: "TBE",
                        path: "/Bidding/Technical Proposal/TBE",
                        limitedAccess: true,
                        roles: ["ADMIN", "TECHNICAL_TEAM"],
                        children: [],
                    },
                ],
            },
            {
                id: "1-3",
                name: "Commercial",
                path: "/Bidding/Commercial",
                limitedAccess: true,
                roles: ["ADMIN", "QUANTITY_SURVEYOR"],
                children: [],
            },
        ],
    },
    {
        id: "2",
        name: "Project Delivery",
        path: "/Project Delivery",
        limitedAccess: false,
        roles: ["ADMIN"],
        children: [
            {
                id: "2-1",
                name: "Project Management",
                path: "/Project Delivery/Project Management",
                limitedAccess: true,
                roles: ["ADMIN", "PROJECT_MANAGER", "EXECUTION_TEAM"],
                children: [],
            },
            {
                id: "2-2",
                name: "QC",
                path: "/Project Delivery/QC",
                limitedAccess: true,
                roles: ["ADMIN", "TECHNICAL_TEAM"],
                children: [],
            },
        ],
    },
];

interface FolderNodeProps {
    node: any;
    level: number;
    onSelect: (node: any) => void;
    selectedId: string | null;
}

function FolderNode({ node, level, onSelect, selectedId }: FolderNodeProps) {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div>
            <div
                className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer hover:bg-accent ${selectedId === node.id ? "bg-accent" : ""
                    }`}
                style={{ paddingLeft: `${level * 20 + 12}px` }}
                onClick={() => onSelect(node)}
            >
                {hasChildren ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setExpanded(!expanded);
                        }}
                        className="p-0.5"
                    >
                        {expanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                    </button>
                ) : (
                    <span className="w-5" />
                )}
                <Folder className="h-4 w-4 text-primary" />
                <span className="flex-1 text-sm">{node.name}</span>
                {node.limitedAccess && (
                    <Lock className="h-3 w-3 text-amber-500" />
                )}
            </div>
            {hasChildren && expanded && (
                <div>
                    {node.children.map((child: any) => (
                        <FolderNode
                            key={child.id}
                            node={child}
                            level={level + 1}
                            onSelect={onSelect}
                            selectedId={selectedId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function TemplatePage() {
    const [selectedNode, setSelectedNode] = useState<any>(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [safeTestMode] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [templateTree, setTemplateTree] = useState<any[]>([]);
    const [templateVersion, setTemplateVersion] = useState<number | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    // Fetch template from database
    const fetchTemplate = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/template');
            const data = await res.json();

            if (data.success && data.template && Array.isArray(data.template.template_json)) {
                setTemplateTree(data.template.template_json);
                setTemplateVersion(data.template.version_number);
                setLastUpdated(data.template.created_at);
            } else {
                // Use default template if none exists or data is invalid
                setTemplateTree(defaultTemplate);
                setTemplateVersion(null);
                setLastUpdated(null);
            }
        } catch (error) {
            console.error('Error fetching template:', error);
            setTemplateTree(defaultTemplate);
            toast.error('Failed to load template');
        } finally {
            setLoading(false);
        }
    };

    // Save template to database
    const saveTemplate = async () => {
        try {
            setSaving(true);
            const res = await fetch('/api/template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ template_json: templateTree }),
            });
            const data = await res.json();

            if (data.success) {
                setTemplateVersion(data.version);
                setHasChanges(false);
                toast.success(`Template saved as Version ${data.version}`);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error saving template:', error);
            toast.error('Failed to save template');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        fetchTemplate();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Safe Test Mode Warning */}
            {safeTestMode && (
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
                        <Lock className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                        <p className="font-medium text-blue-600 dark:text-blue-400">Safe Test Mode Active</p>
                        <p className="text-sm text-muted-foreground">
                            Bulk operations disabled. Go to Settings → Safe Test to enable after approval.
                        </p>
                    </div>
                </div>
            )}

            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Template</h1>
                    <p className="text-muted-foreground">
                        Define folder structure and permission rules
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchTemplate}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                    <Button variant="outline">
                        <History className="mr-2 h-4 w-4" />
                        Version History
                    </Button>
                    <Button onClick={saveTemplate} disabled={!hasChanges || saving}>
                        {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Save Template
                    </Button>
                </div>
            </div>

            {/* Current Version Info */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Badge variant="outline" className="text-lg px-3 py-1">
                                {templateVersion ? `Version ${templateVersion}` : 'No Version Saved'}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                                {lastUpdated
                                    ? `Last updated: ${new Date(lastUpdated).toLocaleString()}`
                                    : 'Not saved yet'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {safeTestMode ? (
                                <Button disabled className="cursor-not-allowed">
                                    <Lock className="mr-2 h-4 w-4" />
                                    Apply to All Projects (Disabled in Safe Test Mode)
                                </Button>
                            ) : (
                                <Button>
                                    <Play className="mr-2 h-4 w-4" />
                                    Apply to All Projects
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Template Editor */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Folder Tree */}
                <Card className="h-[600px] flex flex-col">
                    <CardHeader className="flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <CardTitle>Folder Structure</CardTitle>
                            <Button variant="outline" size="sm">
                                <FolderPlus className="mr-2 h-4 w-4" />
                                Add Folder
                            </Button>
                        </div>
                        <CardDescription>
                            Click a folder to edit its permissions
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full">
                            {templateTree.map((node) => (
                                <FolderNode
                                    key={node.id}
                                    node={node}
                                    level={0}
                                    onSelect={setSelectedNode}
                                    selectedId={selectedNode?.id}
                                />
                            ))}
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* Folder Details */}
                <Card className="h-[600px] flex flex-col">
                    <CardHeader className="flex-shrink-0">
                        <CardTitle>
                            {selectedNode ? selectedNode.name : "Folder Details"}
                        </CardTitle>
                        <CardDescription>
                            {selectedNode
                                ? selectedNode.path
                                : "Select a folder to view and edit details"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                        {selectedNode ? (
                            <div className="space-y-6">
                                {/* Limited Access Toggle */}
                                <div className="flex items-center justify-between p-4 rounded-lg border">
                                    <div className="flex items-center gap-3">
                                        <Lock className="h-5 w-5 text-amber-500" />
                                        <div>
                                            <p className="font-medium">Limited Access</p>
                                            <p className="text-sm text-muted-foreground">
                                                Restrict folder permissions
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant={selectedNode.limitedAccess ? "default" : "secondary"}>
                                        {selectedNode.limitedAccess ? "Enabled" : "Disabled"}
                                    </Badge>
                                </div>

                                {/* Assigned Roles */}
                                <div>
                                    <h4 className="font-medium mb-3 flex items-center gap-2">
                                        <Shield className="h-4 w-4" />
                                        Assigned Roles
                                    </h4>
                                    <div className="space-y-2">
                                        {selectedNode.roles.map((role: string) => (
                                            <div
                                                key={role}
                                                className="flex items-center justify-between p-3 rounded-lg border"
                                            >
                                                <span className="text-sm font-medium">{role}</span>
                                                <Badge variant="outline">
                                                    {role === "ADMIN" ? "organizer" : "writer"}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                    <Button variant="outline" className="w-full mt-3">
                                        Add Role
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                Select a folder from the tree to edit
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
