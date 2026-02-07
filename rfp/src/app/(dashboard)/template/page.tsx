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
    Download,
    X,
    Trash2,
    Users,
    CheckSquare2,
    Square,
    Edit2,
} from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    // Multi-select props
    selectionMode: 'single' | 'multi';
    selectedNodes: string[];
    onToggleSelection?: (node: any) => void;
}

function FolderNode({ node, level, onSelect, selectedId, selectionMode, selectedNodes, onToggleSelection }: FolderNodeProps) {
    const [expanded, setExpanded] = useState(node._expanded !== false);
    // Support both formats: text/nodes (new) and name/children (old)
    const nodeName = node.text || node.name || 'Untitled';
    const children = node.nodes || node.children || [];
    const hasChildren = children && children.length > 0;
    const nodeId = node.id || nodeName;
    const isSelected = selectionMode === 'multi' ? selectedNodes.includes(nodeId) : selectedId === nodeId;

    const handleClick = () => {
        if (selectionMode === 'multi' && onToggleSelection) {
            onToggleSelection(nodeId);
        } else {
            onSelect({ ...node, id: nodeId, name: nodeName });
        }
    };

    return (
        <div>
            <div
                className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer hover:bg-accent ${isSelected ? "bg-accent border-2 border-primary" : ""
                    }`}
                style={{ paddingLeft: `${level * 20 + 12}px` }}
                onClick={handleClick}
            >
                {selectionMode === 'multi' && (
                    <input
                        type="checkbox"
                        checked={selectedNodes.includes(nodeId)}
                        onChange={() => onToggleSelection?.(node)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4"
                    />
                )}
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
                            selectionMode={selectionMode}
                            selectedNodes={selectedNodes}
                            onToggleSelection={onToggleSelection}
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
    const [safeTestMode, setSafeTestMode] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [applying, setApplying] = useState(false);
    const [templateTree, setTemplateTree] = useState<any[]>([]);
    const [templateVersion, setTemplateVersion] = useState<number | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    // Multi-select states
    const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
    const [selectionMode, setSelectionMode] = useState<'single' | 'multi'>('single');

    // Add User/Group modal states
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [showAddGroupModal, setShowAddGroupModal] = useState(false);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [allGroups, setAllGroups] = useState<any[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [groupSearch, setGroupSearch] = useState('');
    const [selectedRole, setSelectedRole] = useState('writer');

    // Bulk operations dialog states
    const [showBulkDialog, setShowBulkDialog] = useState(false);
    const [bulkOperationType, setBulkOperationType] = useState<'groups' | 'users' | 'settings'>('groups');
    const [bulkSelectedGroups, setBulkSelectedGroups] = useState<string[]>([]);
    const [bulkSelectedUsers, setBulkSelectedUsers] = useState<string[]>([]);
    const [bulkRole, setBulkRole] = useState('writer');
    const [bulkLimitedAccess, setBulkLimitedAccess] = useState<boolean | null>(null);

    // Rename/Delete states
    const [showRenameDialog, setShowRenameDialog] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    // Fetch safe test mode setting
    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (data.success && data.settings?.safe_test_mode) {
                const enabled = data.settings.safe_test_mode.enabled;
                setSafeTestMode(enabled !== false); // Default to true if undefined
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

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

    // Remove user from selected node
    const handleRemoveUser = (email: string) => {
        if (!selectedNode) return;
        const currentUsers = selectedNode.users || [];
        const newUsers = currentUsers.filter((u: any) => u.email !== email);
        updateNode(selectedNode.id || selectedNode.name, { users: newUsers });
        toast.success('User removed');
    };

    // Remove group from selected node
    const handleRemoveGroup = (groupEmail: string) => {
        if (!selectedNode) return;
        const currentGroups = selectedNode.groups || [];
        const newGroups = currentGroups.filter((g: any) => g.email !== groupEmail);
        updateNode(selectedNode.id || selectedNode.name, { groups: newGroups });
        toast.success('Group removed');
    };

    // ============ BULK OPERATIONS ============

    // Helper: recursively find all nodes by their IDs
    const findNodesByIds = (nodes: any[], ids: string[]): any[] => {
        const found: any[] = [];
        const search = (nodeList: any[]) => {
            for (const node of nodeList) {
                if (ids.includes(node.id || node.name)) {
                    found.push(node);
                }
                if (node.children && node.children.length > 0) {
                    search(node.children);
                }
            }
        };
        search(nodes);
        return found;
    };

    // Toggle selection mode
    const toggleSelectionMode = () => {
        setSelectionMode(mode => mode === 'single' ? 'multi' : 'single');
        setSelectedNodes([]);
    };

    // Clear all permissions from selected folders
    const handleClearAllPermissions = () => {
        if (selectedNodes.length === 0) {
            toast.error('No folders selected');
            return;
        }

        const confirmed = window.confirm(
            `Remove ALL users and groups from ${selectedNodes.length} folder(s)?\n\nThis action cannot be undone easily.`
        );

        if (!confirmed) return;

        let newTree = [...templateTree];
        selectedNodes.forEach(nodeId => {
            newTree = updateNodeInTree(newTree, nodeId, { users: [], groups: [] });
        });

        setTemplateTree(newTree);
        setHasChanges(true);
        toast.success(`Cleared permissions from ${selectedNodes.length} folder(s)`);
        setSelectedNodes([]);
    };

    // Apply bulk updates
    const applyBulkUpdates = (updates: Record<string, Partial<any>>) => {
        let newTree = [...templateTree];

        Object.entries(updates).forEach(([nodeId, nodeUpdates]) => {
            newTree = updateNodeInTree(newTree, nodeId, nodeUpdates);
        });

        setTemplateTree(newTree);
        setHasChanges(true);
    };

    // Bulk add groups
    const handleBulkOperation = () => {
        if (selectedNodes.length === 0) {
            toast.error('No folders selected');
            return;
        }
        // Fetch groups/users for the dialog
        fetchGroups();
        fetchUsers();
        setShowBulkDialog(true);
    };

    // Apply bulk changes to all selected folders
    const handleApplyBulkChanges = () => {
        if (selectedNodes.length === 0) return;

        const updates: Record<string, Partial<any>> = {};

        selectedNodes.forEach(nodeId => {
            const node = findNodesByIds(templateTree, [nodeId])[0];
            if (!node) return;

            const update: any = {};

            // Apply groups if selected
            if (bulkOperationType === 'groups' && bulkSelectedGroups.length > 0) {
                const currentGroups = node.groups || [];
                const newGroupsToAdd = bulkSelectedGroups.map(email => ({
                    email,
                    role: bulkRole
                }));
                // Merge and deduplicate
                const mergedGroups = [...currentGroups];
                newGroupsToAdd.forEach(newGroup => {
                    if (!mergedGroups.some(g => g.email === newGroup.email)) {
                        mergedGroups.push(newGroup);
                    }
                });
                update.groups = mergedGroups;
            }

            // Apply users if selected
            if (bulkOperationType === 'users' && bulkSelectedUsers.length > 0) {
                const currentUsers = node.users || [];
                const newUsersToAdd = bulkSelectedUsers.map(email => ({
                    email,
                    role: bulkRole
                }));
                // Merge and deduplicate
                const mergedUsers = [...currentUsers];
                newUsersToAdd.forEach(newUser => {
                    if (!mergedUsers.some(u => u.email === newUser.email)) {
                        mergedUsers.push(newUser);
                    }
                });
                update.users = mergedUsers;
            }

            // Apply limited access setting
            if (bulkOperationType === 'settings' && bulkLimitedAccess !== null) {
                update.limitedAccess = bulkLimitedAccess;
            }

            updates[nodeId] = update;
        });

        applyBulkUpdates(updates);

        const action = bulkOperationType === 'groups'
            ? `Added ${bulkSelectedGroups.length} group(s)`
            : bulkOperationType === 'users'
                ? `Added ${bulkSelectedUsers.length} user(s)`
                : 'Updated limited access';

        toast.success(`${action} to ${selectedNodes.length} folder(s)`);

        // Reset bulk dialog state
        setShowBulkDialog(false);
        setBulkSelectedGroups([]);
        setBulkSelectedUsers([]);
        setBulkLimitedAccess(null);
        setSelectedNodes([]);
    };

    // Helper: recursively get all node IDs from tree
    const getAllNodeIds = (nodes: any[]): string[] => {
        const ids: string[] = [];
        const collect = (nodeList: any[]) => {
            for (const node of nodeList) {
                ids.push(node.id || node.name);
                const children = node.nodes || node.children || [];
                if (children.length > 0) {
                    collect(children);
                }
            }
        };
        collect(nodes);
        return ids;
    };

    // Helper: recursively get all child IDs of a node
    const getChildNodeIds = (node: any): string[] => {
        const ids: string[] = [];
        const children = node.nodes || node.children || [];

        const collect = (nodeList: any[]) => {
            for (const n of nodeList) {
                ids.push(n.id || n.name);
                const childNodes = n.nodes || n.children || [];
                if (childNodes.length > 0) {
                    collect(childNodes);
                }
            }
        };

        collect(children);
        return ids;
    };

    // Handle toggling node selection in multi-select mode with cascade
    const handleToggleSelection = (nodeId: string) => {
        setSelectedNodes(prev => {
            // Find the node to get its children
            const nodes = findNodesByIds(templateTree, [nodeId]);
            const node = nodes[0];

            if (prev.includes(nodeId)) {
                // Deselecting - remove node and all children
                const childIds = node ? getChildNodeIds(node) : [];
                const idsToRemove = [nodeId, ...childIds];
                return prev.filter(id => !idsToRemove.includes(id));
            } else {
                // Selecting - add node and all children
                const childIds = node ? getChildNodeIds(node) : [];
                const idsToAdd = [nodeId, ...childIds];
                // Use Set to deduplicate
                return [...new Set([...prev, ...idsToAdd])];
            }
        });
    };

    // Handle Select All
    const handleSelectAll = () => {
        const allIds = getAllNodeIds(templateTree);
        setSelectedNodes(allIds);
    };

    // Handle Deselect All
    const handleDeselectAll = () => {
        setSelectedNodes([]);
    };

    // Handle Rename Folder
    const handleRenameFolder = () => {
        if (!selectedNode) return;
        setNewFolderName(selectedNode.text || selectedNode.name || '');
        setShowRenameDialog(true);
    };

    const applyRename = () => {
        if (!selectedNode || !newFolderName.trim()) {
            toast.error('Folder name cannot be empty');
            return;
        }

        const nodeId = selectedNode.id || selectedNode.name;
        updateNode(nodeId, {
            text: newFolderName.trim(),
            name: newFolderName.trim()
        });

        setShowRenameDialog(false);
        toast.success(`Folder renamed to "${newFolderName.trim()}"`);
    };

    // Handle Delete Folder
    const handleDeleteFolder = () => {
        if (!selectedNode) return;

        const folderName = selectedNode.text || selectedNode.name || 'this folder';
        const confirmed = confirm(`Delete "${folderName}" and all its subfolders?\n\nThis action cannot be undone.`);

        if (!confirmed) return;

        const nodeId = selectedNode.id || selectedNode.name;

        // Remove node from tree
        const removeNodeFromTree = (nodes: any[], idToRemove: string): any[] => {
            return nodes.filter(n => {
                const currentId = n.id || n.name;
                if (currentId === idToRemove) return false;

                // Recursively remove from children
                if (n.nodes) {
                    n.nodes = removeNodeFromTree(n.nodes, idToRemove);
                } else if (n.children) {
                    n.children = removeNodeFromTree(n.children, idToRemove);
                }
                return true;
            });
        };

        setTemplateTree(prev => removeNodeFromTree(prev, nodeId));
        setSelectedNode(null);
        toast.success(`Folder "${folderName}" deleted`);
    };

    // ============ END BULK OPERATIONS ============

    // Apply template to all projects
    const applyToAllProjects = async () => {
        if (safeTestMode) {
            toast.error('Cannot apply in Safe Test Mode');
            return;
        }

        setApplying(true);
        try {
            const res = await fetch('/api/enforce', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ triggeredBy: 'admin' }),
            });
            const data = await res.json();

            if (data.success) {
                toast.success(`Permission enforcement started! Job ID: ${data.jobId}`);
            } else {
                toast.error(data.error || 'Failed to start enforcement');
            }
        } catch (error: any) {
            console.error('Error applying template:', error);
            toast.error('Failed to apply template to projects');
        } finally {
            setApplying(false);
        }
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
        fetchSettings();
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

                {/* Guidelines Box - Bilingual */}
                <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
                            <Folder className="h-5 w-5" />
                            📁 قواعد إنشاء المجلدات والصلاحيات | Folder & Permissions Rules
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Arabic Section (RTL) */}
                            <div className="space-y-3" dir="rtl">
                                <div className="space-y-2">
                                    <h3 className="font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
                                        <span>✔️</span>
                                        <span>اعمل</span>
                                    </h3>
                                    <ul className="text-sm space-y-1 text-muted-foreground">
                                        <li>• اتبع الـ Template فقط.</li>
                                        <li>• اجعل المجلد العام (limitedAccess=false) يرث الصلاحيات.</li>
                                        <li>• فعّل Limited Access للمجلدات الحساسة (limitedAccess=true).</li>
                                        <li>• طبّق inheritedPermissionsDisabled=true على المجلد المقفل.</li>
                                        <li>• احذف أي صلاحية غير موجودة في الـ Template داخل المجلد المقفل.</li>
                                        <li>• تحقق من الحالة الفعلية من Google Drive بعد الإنشاء.</li>
                                    </ul>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                                        <span>❌</span>
                                        <span>لا تعمل</span>
                                    </h3>
                                    <ul className="text-sm space-y-1 text-muted-foreground">
                                        <li>• لا تخترع صلاحيات من عندك.</li>
                                        <li>• لا تحذف صلاحيات موروثة من مجلد عام.</li>
                                        <li>• لا تسمح بصلاحيات موروثة داخل مجلد مقفل.</li>
                                        <li>• لا تضف domain أو anyone داخل مجلد مقفل.</li>
                                        <li>• لا تغيّر أسماء المجلدات عن الـ Template.</li>
                                    </ul>
                                </div>
                            </div>

                            {/* English Section (LTR) */}
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <h3 className="font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
                                        <span>✔️</span>
                                        <span>DO</span>
                                    </h3>
                                    <ul className="text-sm space-y-1 text-muted-foreground">
                                        <li>• Follow the template exactly.</li>
                                        <li>• Let open folders (limitedAccess=false) inherit permissions.</li>
                                        <li>• Enable Limited Access on sensitive folders (limitedAccess=true).</li>
                                        <li>• Enforce inheritedPermissionsDisabled=true on limited folders.</li>
                                        <li>• Remove any permission not defined in the template on limited folders.</li>
                                        <li>• Verify the actual state from Google Drive after creation.</li>
                                    </ul>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                                        <span>❌</span>
                                        <span>DON'T</span>
                                    </h3>
                                    <ul className="text-sm space-y-1 text-muted-foreground">
                                        <li>• Don't invent permissions.</li>
                                        <li>• Don't delete inherited permissions on open folders.</li>
                                        <li>• Don't allow inherited permissions on limited folders.</li>
                                        <li>• Don't add domain or anyone permissions to limited folders.</li>
                                        <li>• Don't change folder names from the template.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

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
                        <Button variant="outline" onClick={() => {
                            const blob = new Blob([JSON.stringify(templateTree, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `template_v${templateVersion || 1}_${new Date().toISOString().split('T')[0]}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                            toast.success('Template downloaded');
                        }}>
                            <Download className="mr-2 h-4 w-4" />
                            Download
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
                                    <Button onClick={applyToAllProjects} disabled={applying}>
                                        {applying ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Play className="mr-2 h-4 w-4" />
                                        )}
                                        {applying ? 'Applying...' : 'Apply to All Projects'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Template Editor */}
                <div className="grid gap-6 lg:grid-cols-[7fr_3fr]">
                    {/* Folder Tree */}
                    <Card className="h-[600px] flex flex-col">
                        <CardHeader className="flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <CardTitle>Folder Structure</CardTitle>
                                <div className="flex gap-2">
                                    <Button
                                        variant={selectionMode === 'multi' ? "default" : "outline"}
                                        size="sm"
                                        onClick={toggleSelectionMode}
                                    >
                                        {selectionMode === 'multi' ? (
                                            <>
                                                <CheckSquare2 className="mr-2 h-4 w-4" />
                                                Multi-Select
                                            </>
                                        ) : (
                                            <>
                                                <Square className="mr-2 h-4 w-4" />
                                                Single Select
                                            </>
                                        )}
                                    </Button>
                                    <Button variant="outline" size="sm">
                                        <FolderPlus className="mr-2 h-4 w-4" />
                                        Add Folder
                                    </Button>
                                </div>
                            </div>
                            <CardDescription>
                                {selectionMode === 'single'
                                    ? 'Click a folder to edit its permissions'
                                    : `${selectedNodes.length} folder(s) selected - Use checkboxes to select folders`}
                            </CardDescription>

                            {/* Bulk Operations Toolbar */}
                            {selectionMode === 'multi' && selectedNodes.length > 0 && (
                                <div className="mt-4 p-3 bg-muted rounded-lg border flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">
                                            {selectedNodes.length} folder(s) selected
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                if (selectedNodes.length === getAllNodeIds(templateTree).length) {
                                                    handleDeselectAll();
                                                } else {
                                                    handleSelectAll();
                                                }
                                            }}
                                        >
                                            {selectedNodes.length === getAllNodeIds(templateTree).length
                                                ? "Deselect All"
                                                : "Select All"}
                                        </Button>
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                setBulkOperationType('groups');
                                                handleBulkOperation();
                                            }}
                                        >
                                            <Users className="mr-2 h-4 w-4" />
                                            Add Groups
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                setBulkOperationType('users');
                                                handleBulkOperation();
                                            }}
                                        >
                                            <Shield className="mr-2 h-4 w-4" />
                                            Add Users
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                setBulkOperationType('settings');
                                                handleBulkOperation();
                                            }}
                                        >
                                            <Lock className="mr-2 h-4 w-4" />
                                            Limited Access
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={handleClearAllPermissions}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Clear All
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setSelectedNodes([])}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
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
                                        selectionMode={selectionMode}
                                        selectedNodes={selectedNodes}
                                        onToggleSelection={handleToggleSelection}
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
                            {selectedNode && (
                                <div className="mt-4 flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleRenameFolder}
                                    >
                                        <Edit2 className="mr-2 h-4 w-4" />
                                        Rename
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleDeleteFolder}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                    </Button>
                                </div>
                            )}
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
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline">
                                                                {group.role || 'writer'}
                                                            </Badge>
                                                            <button
                                                                onClick={() => handleRemoveGroup(group.email)}
                                                                className="text-muted-foreground hover:text-destructive transition-colors"
                                                                title="Remove group"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        </div>
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
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline">
                                                                {user.role || 'writer'}
                                                            </Badge>
                                                            <button
                                                                onClick={() => handleRemoveUser(user.email)}
                                                                className="text-muted-foreground hover:text-destructive transition-colors"
                                                                title="Remove user"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        </div>
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

            {/* Bulk Assignment Dialog */}
            <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Bulk Assignment - {selectedNodes.length} folder(s)</DialogTitle>
                    </DialogHeader>
                    <Tabs value={bulkOperationType} onValueChange={(value) => setBulkOperationType(value as 'groups' | 'users' | 'settings')}>
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="groups">Groups</TabsTrigger>
                            <TabsTrigger value="users">Users</TabsTrigger>
                            <TabsTrigger value="settings">Settings</TabsTrigger>
                        </TabsList>

                        <TabsContent value="groups" className="space-y-4 pt-4">
                            <div>
                                <Label>Select Groups to Add</Label>
                                <div className="mt-2 max-h-[300px] overflow-y-auto border rounded-md p-2 space-y-1">
                                    {allGroups.map((group) => (
                                        <div
                                            key={group.id}
                                            className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                                            onClick={() => {
                                                setBulkSelectedGroups(prev => {
                                                    if (prev.includes(group.email)) {
                                                        return prev.filter(e => e !== group.email);
                                                    } else {
                                                        return [...prev, group.email];
                                                    }
                                                });
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={bulkSelectedGroups.includes(group.email)}
                                                onChange={() => { }}
                                                className="h-4 w-4"
                                            />
                                            <div className="flex-1">
                                                <p className="font-medium text-sm">{group.name}</p>
                                                <p className="text-xs text-muted-foreground">{group.email}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {allGroups.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No groups available</p>}
                                </div>
                            </div>
                            <div>
                                <Label>Role for Selected Groups</Label>
                                <select
                                    value={bulkRole}
                                    onChange={(e) => setBulkRole(e.target.value)}
                                    className="w-full mt-2 border rounded px-3 py-2 text-sm"
                                >
                                    <option value="reader">Reader</option>
                                    <option value="writer">Writer</option>
                                    <option value="fileOrganizer">File Organizer</option>
                                    <option value="organizer">Organizer</option>
                                </select>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Selected: {bulkSelectedGroups.length} group(s)
                            </div>
                        </TabsContent>

                        <TabsContent value="users" className="space-y-4 pt-4">
                            <div>
                                <Label>Select Users to Add</Label>
                                <div className="mt-2 max-h-[300px] overflow-y-auto border rounded-md p-2 space-y-1">
                                    {allUsers.map((user) => (
                                        <div
                                            key={user.id}
                                            className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                                            onClick={() => {
                                                setBulkSelectedUsers(prev => {
                                                    if (prev.includes(user.email)) {
                                                        return prev.filter(e => e !== user.email);
                                                    } else {
                                                        return [...prev, user.email];
                                                    }
                                                });
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={bulkSelectedUsers.includes(user.email)}
                                                onChange={() => { }}
                                                className="h-4 w-4"
                                            />
                                            <div className="flex-1">
                                                <p className="font-medium text-sm">{user.name}</p>
                                                <p className="text-xs text-muted-foreground">{user.email}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {allUsers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No users available</p>}
                                </div>
                            </div>
                            <div>
                                <Label>Role for Selected Users</Label>
                                <select
                                    value={bulkRole}
                                    onChange={(e) => setBulkRole(e.target.value)}
                                    className="w-full mt-2 border rounded px-3 py-2 text-sm"
                                >
                                    <option value="reader">Reader</option>
                                    <option value="writer">Writer</option>
                                    <option value="fileOrganizer">File Organizer</option>
                                    <option value="organizer">Organizer</option>
                                </select>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Selected: {bulkSelectedUsers.length} user(s)
                            </div>
                        </TabsContent>

                        <TabsContent value="settings" className="space-y-4 pt-4">
                            <div className="space-y-4">
                                <div>
                                    <Label className="text-base">Limited Access Setting</Label>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Apply limited access to all {selectedNodes.length} selected folder(s)
                                    </p>
                                </div>
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
                                    <div className="flex gap-2">
                                        <Button
                                            variant={bulkLimitedAccess === true ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setBulkLimitedAccess(true)}
                                        >
                                            Enable
                                        </Button>
                                        <Button
                                            variant={bulkLimitedAccess === false ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setBulkLimitedAccess(false)}
                                        >
                                            Disable
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleApplyBulkChanges}>
                            Apply to {selectedNodes.length} folder(s)
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
