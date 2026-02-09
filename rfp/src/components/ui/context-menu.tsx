"use client";

import { useEffect, useRef } from "react";
import { LucideIcon } from "lucide-react";

interface ContextMenuOption {
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
    disabled?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    options: ContextMenuOption[];
    onClose: () => void;
}

export function ContextMenu({ x, y, options, onClose }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            className="fixed z-50 min-w-[200px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            style={{
                left: `${x}px`,
                top: `${y}px`,
            }}
        >
            {options.map((option, index) => {
                const Icon = option.icon;
                return (
                    <button
                        key={index}
                        disabled={option.disabled}
                        onClick={() => {
                            option.onClick();
                            onClose();
                        }}
                        className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                    >
                        {Icon && <Icon className="mr-2 h-4 w-4" />}
                        <span>{option.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
