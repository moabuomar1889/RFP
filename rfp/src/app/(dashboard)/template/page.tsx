"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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
    const [expanded, setExpanded] = useState(node._expanded !== false);
    // Support both formats: text/nodes (new) and name/children (old)
    const nodeName = node.text || node.name || 'Untitled';
    const children = node.nodes || node.children || [];
    const hasChildren = children && children.length > 0;
    const nodeId = node.id || nodeName;

    return (
        <div>
            <div
                className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer hover:bg-accent ${selectedId === nodeId ? "bg-accent" : ""
                    }`}
                style={{ paddingLeft: `${level * 20 + 12}px` }}
                onClick={() => onSelect({ ...node, id: nodeId, name: nodeName })}
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
                <span className="flex-1 text-sm">{nodeName}</span>
                {node.limitedAccess && (
                    <Lock className="h-3 w-3 text-amber-500" />
                )}
            </div>
            {hasChildren && expanded && (
                <div>
                    {children.map((child: any, index: number) => (
                        <FolderNode
                            key={child.id || child.text || child.name || index}
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


// Helper to update a node in the template tree by id/name
function updateNodeInTree(nodes: any[], nodeId: string, updates: Partial<any>): any[] {
    return nodes.map(node => {
        const currentId = node.id || node.text || node.name;
        if (currentId === nodeId) {
            return { ...node, ...updates };
        }
        const children = node.nodes || node.children;
        if (children && children.length > 0) {
            const updatedChildren = updateNodeInTree(children, nodeId, updates);
            if (node.nodes) {
                return { ...node, nodes: updatedChildren };
            } else {
                return { ...node, children: updatedChildren };
            }
        }
        return node;
    });
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

    // Add User/Group modal states
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [showAddGroupModal, setShowAddGroupModal] = useState(false);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [allGroups, setAllGroups] = useState<any[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [groupSearch, setGroupSearch] = useState('');
    const [selectedRole, setSelectedRole] = useState('writer');

    // Update a node property in the tree
    const updateNode = (nodeId: string, updates: Partial<any>) => {
        setTemplateTree(prev => updateNodeInTree(prev, nodeId, updates));
        setSelectedNode((prev: any) => prev ? { ...prev, ...updates } : null);
        setHasChanges(true);
    };

    // Fetch users for Add User modal
    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/users');
            const data = await res.json();
            if (data.success) {
                setAllUsers(data.users || []);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    // Fetch groups for Add Group modal
    const fetchGroups = async () => {
        try {
            const res = await fetch('/api/groups');
            const data = await res.json();
            if (data.success) {
                setAllGroups(data.groups || []);
            }
        } catch (error) {
            console.error('Error fetching groups:', error);
        }
    };

    // Add user to selected node
    const handleAddUser = (email: string) => {
        if (!selectedNode) return;
        const currentUsers = selectedNode.users || [];
        if (currentUsers.some((u: any) => u.email === email)) {
            toast.error('User already assigned');
            return;
        }
        const newUsers = [...currentUsers, { email, role: selectedRole }];
        updateNode(selectedNode.id || selectedNode.name, { users: newUsers });
        setShowAddUserModal(false);
        setUserSearch('');
        toast.success('User added');
    };

    // Add group to selected node
    const handleAddGroup = (groupEmail: string) => {
        if (!selectedNode) return;
        const currentGroups = selectedNode.groups || [];
        if (currentGroups.some((g: any) => g.email === groupEmail)) {
            toast.error('Group already assigned');
            return;
        }
        const newGroups = [...currentGroups, { email: groupEmail, role: selectedRole }];
        updateNode(selectedNode.id || selectedNode.name, { groups: newGroups });
        setShowAddGroupModal(false);
        setGroupSearch('');
        toast.success('Group added');
    };

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
        <>
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
                                        <Switch
                                            checked={selectedNode.limitedAccess ?? false}
                                            onCheckedChange={(checked) => {
                                                updateNode(selectedNode.id, { limitedAccess: checked });
                                            }}
                                        />
                                    </div>

                                    {/* Assigned Groups */}
                                    <div>
                                        <h4 className="font-medium mb-3 flex items-center gap-2">
                                            <Shield className="h-4 w-4" />
                                            Assigned Groups
                                        </h4>
                                        <div className="space-y-2 max-h-32 overflow-y-auto">
                                            {(selectedNode.groups || []).length > 0 ? (
                                                (selectedNode.groups || []).map((group: any, index: number) => (
                                                    <div
                                                        key={group.name || group.email || index}
                                                        className="flex items-center justify-between p-3 rounded-lg border"
                                                    >
                                                        <span className="text-sm font-medium">{group.name || group.email || 'Unknown Group'}</span>
                                                        <Badge variant="outline">
                                                            {group.role || 'writer'}
                                                        </Badge>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-muted-foreground">No groups assigned</p>
                                            )}
                                        </div>
                                        <Button variant="outline" className="w-full mt-3" onClick={() => {
                                            fetchGroups();
                                            setShowAddGroupModal(true);
                                        }}>
                                            Add Group
                                        </Button>
                                    </div>

                                    {/* Assigned Users */}
                                    <div>
                                        <h4 className="font-medium mb-3 flex items-center gap-2">
                                            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                                <circle cx="12" cy="7" r="4" />
                                            </svg>
                                            Assigned Users
                                        </h4>
                                        <div className="space-y-2 max-h-32 overflow-y-auto">
                                            {(selectedNode.users || []).length > 0 ? (
                                                (selectedNode.users || []).map((user: any, index: number) => (
                                                    <div
                                                        key={user.email || index}
                                                        className="flex items-center justify-between p-3 rounded-lg border"
                                                    >
                                                        <span className="text-sm font-medium">{user.email || 'Unknown User'}</span>
                                                        <Badge variant="outline">
                                                            {user.role || 'writer'}
                                                        </Badge>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-muted-foreground">No users assigned</p>
                                            )}
                                        </div>
                                        <Button variant="outline" className="w-full mt-3" onClick={() => {
                                            fetchUsers();
                                            setShowAddUserModal(true);
                                        }}>
                                            Add User
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

            {/* Add Group Modal */}
            <Dialog open={showAddGroupModal} onOpenChange={setShowAddGroupModal}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Group to {selectedNode?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <Input
                            placeholder="Search groups..."
                            value={groupSearch}
                            onChange={(e) => setGroupSearch(e.target.value)}
                        />
                        <div className="max-h-[250px] overflow-y-auto space-y-1 border rounded-md p-2">
                            {allGroups
                                .filter(g => g.name?.toLowerCase().includes(groupSearch.toLowerCase()) || g.email?.toLowerCase().includes(groupSearch.toLowerCase()))
                                .slice(0, 20)
                                .map(group => (
                                    <div
                                        key={group.id}
                                        className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer"
                                        onClick={() => handleAddGroup(group.email)}
                                    >
                                        <div>
                                            <p className="font-medium text-sm">{group.name}</p>
                                            <p className="text-xs text-muted-foreground">{group.email}</p>
                                        </div>
                                        <Badge variant="outline" className="text-xs">{selectedRole}</Badge>
                                    </div>
                                ))}
                            {allGroups.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No groups available</p>}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm">Role:</span>
                            <select
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                                className="flex-1 border rounded px-2 py-1 text-sm"
                            >
                                <option value="organizer">Organizer</option>
                                <option value="writer">Writer</option>
                                <option value="reader">Reader</option>
                            </select>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add User Modal */}
            <Dialog open={showAddUserModal} onOpenChange={setShowAddUserModal}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add User to {selectedNode?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <Input
                            placeholder="Search users..."
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                        />
                        <div className="max-h-[250px] overflow-y-auto space-y-1 border rounded-md p-2">
                            {allUsers
                                .filter(u => u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase()))
                                .slice(0, 20)
                                .map(user => (
                                    <div
                                        key={user.id}
                                        className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer"
                                        onClick={() => handleAddUser(user.email)}
                                    >
                                        <div>
                                            <p className="font-medium text-sm">{user.name}</p>
                                            <p className="text-xs text-muted-foreground">{user.email}</p>
                                        </div>
                                        <Badge variant="outline" className="text-xs">{selectedRole}</Badge>
                                    </div>
                                ))}
                            {allUsers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No users available</p>}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm">Role:</span>
                            <select
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                                className="flex-1 border rounded px-2 py-1 text-sm"
                            >
                                <option value="organizer">Organizer</option>
                                <option value="writer">Writer</option>
                                <option value="reader">Reader</option>
                            </select>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
