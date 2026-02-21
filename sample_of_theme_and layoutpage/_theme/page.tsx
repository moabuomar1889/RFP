'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

// UI Components
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// Icons
import {
    Palette, Save, ArrowLeft, Moon, Sun, Check, Loader2,
    AlertCircle, RefreshCw, RotateCcw, Type, Circle
} from 'lucide-react';

// Theme options
const MODES = [
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'light', label: 'Light', icon: Sun },
];

const BASE_COLORS = [
    { value: 'gray', label: 'Gray', color: 'oklch(0.55 0.02 265)' },
    { value: 'theme-gray', label: 'Theme Gray', color: 'oklch(0.45 0.025 265)' },
    { value: 'zinc', label: 'Zinc', color: 'oklch(0.55 0.01 286)' },
    { value: 'slate', label: 'Slate', color: 'oklch(0.55 0.03 265)' },
    { value: 'neutral', label: 'Neutral', color: 'oklch(0.55 0 0)' },
    { value: 'stone', label: 'Stone', color: 'oklch(0.55 0.015 56)' },
];

const ACCENT_COLORS = [
    { value: 'gray', label: 'Gray', color: 'oklch(0.55 0 0)', description: 'Match base color' },
    { value: 'amber', label: 'Amber', color: 'oklch(0.77 0.16 70)' },
    { value: 'blue', label: 'Blue', color: 'oklch(0.62 0.21 260)' },
    { value: 'cyan', label: 'Cyan', color: 'oklch(0.72 0.16 200)' },
    { value: 'emerald', label: 'Emerald', color: 'oklch(0.70 0.19 160)' },
    { value: 'fuchsia', label: 'Fuchsia', color: 'oklch(0.68 0.25 320)' },
    { value: 'green', label: 'Green', color: 'oklch(0.72 0.22 150)' },
    { value: 'indigo', label: 'Indigo', color: 'oklch(0.59 0.23 277)' },
    { value: 'lime', label: 'Lime', color: 'oklch(0.80 0.22 130)' },
    { value: 'orange', label: 'Orange', color: 'oklch(0.71 0.21 47)' },
    { value: 'pink', label: 'Pink', color: 'oklch(0.70 0.20 350)' },
    { value: 'red', label: 'Red', color: 'oklch(0.64 0.24 25)' },
    { value: 'rose', label: 'Rose', color: 'oklch(0.65 0.25 16)' },
    { value: 'violet', label: 'Violet', color: 'oklch(0.61 0.25 293)' },
];

const ICON_MODES = [
    { value: 'semantic', label: 'Semantic', description: 'Muted icons with accent highlights' },
    { value: 'muted', label: 'Muted', description: 'All icons are subtle' },
    { value: 'primary', label: 'Primary', description: 'Icons use accent color' },
];

const RADII = [
    { value: '0', label: 'None', preview: '0' },
    { value: '0.3rem', label: 'Small', preview: '4.8px' },
    { value: '0.5rem', label: 'Medium', preview: '8px' },
    { value: '0.625rem', label: 'Default', preview: '10px' },
    { value: '0.75rem', label: 'Large', preview: '12px' },
    { value: '1rem', label: 'XL', preview: '16px' },
];

const FONTS = [
    { value: 'inter', label: 'Inter', sample: 'Designers love packing quirky glyphs' },
    { value: 'noto-sans', label: 'Noto Sans', sample: 'Designers love packing quirky glyphs' },
    { value: 'nunito-sans', label: 'Nunito Sans', sample: 'Designers love packing quirky glyphs' },
    { value: 'figtree', label: 'Figtree', sample: 'Designers love packing quirky glyphs' },
    { value: 'roboto', label: 'Roboto', sample: 'Designers love packing quirky glyphs' },
    { value: 'raleway', label: 'Raleway', sample: 'Designers love packing quirky glyphs' },
    { value: 'dm-sans', label: 'DM Sans', sample: 'Designers love packing quirky glyphs' },
    { value: 'public-sans', label: 'Public Sans', sample: 'Designers love packing quirky glyphs' },
    { value: 'outfit', label: 'Outfit', sample: 'Designers love packing quirky glyphs' },
    { value: 'jetbrains-mono', label: 'JetBrains Mono', sample: 'const code = true;' },
    { value: 'tajawal', label: 'Tajawal', sample: 'المصممون يحبون الخطوط العربية' },
    { value: 'cairo', label: 'Cairo', sample: 'المصممون يحبون الخطوط العربية' },
];

interface ThemeSettings {
    mode: string;
    base: string;
    accent: string;
    icon_mode: string;
    radius: string;
    font: string;
}

const DEFAULT_SETTINGS: ThemeSettings = {
    mode: 'dark',
    base: 'gray',
    accent: 'amber',
    icon_mode: 'semantic',
    radius: '0.625rem',
    font: 'inter',
};

export default function ThemeSettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);

    const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_SETTINGS);
    const [originalSettings, setOriginalSettings] = useState<ThemeSettings>(DEFAULT_SETTINGS);

    // Check if settings have changed (dirty state)
    const isDirty = useMemo(() => {
        return JSON.stringify(settings) !== JSON.stringify(originalSettings);
    }, [settings, originalSettings]);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const res = await fetch('/evaluation/api/settings/theme', { cache: 'no-store' });
            const data = await res.json();
            if (data.settings) {
                const loaded = { ...DEFAULT_SETTINGS, ...data.settings };
                setSettings(loaded);
                setOriginalSettings(loaded);
            }
        } catch (err) {
            console.error('Failed to load theme settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        try {
            setSaving(true);
            setError('');
            setSaved(false);

            const res = await fetch('/evaluation/api/settings/theme', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to save');
            }

            setSaved(true);
            setOriginalSettings(settings);
            setTimeout(() => setSaved(false), 2000);

            // Refresh the layout to apply new theme
            router.refresh();
        } catch (err: any) {
            setError(err.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const resetSettings = () => {
        setSettings(originalSettings);
    };

    const updateSetting = (key: keyof ThemeSettings, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setSaved(false);
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto p-4">
                <div className="sticky top-0 z-20 -mx-4 px-4 py-3 backdrop-blur-md bg-background/80 border-b mb-6">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-9 w-9" />
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-9 w-28 ml-auto" />
                    </div>
                </div>
                <div className="space-y-6">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 -mx-4 px-4 py-3 backdrop-blur-md bg-background/80 border-b mb-6">
                <div className="flex items-center gap-4">
                    <Link
                        href="/evaluation/admin/settings"
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>

                    <div className="flex-1">
                        <h1 className="text-lg font-semibold flex items-center gap-2">
                            <Palette className="w-5 h-5 text-primary" />
                            Theme Settings
                        </h1>
                        <p className="text-xs text-muted-foreground">Customize the Evaluation module</p>
                    </div>

                    <div className="flex items-center gap-2">
                        {isDirty && (
                            <Button variant="outline" size="sm" onClick={resetSettings}>
                                <RotateCcw className="w-4 h-4 mr-1" />
                                Reset
                            </Button>
                        )}
                        <Button onClick={saveSettings} disabled={saving || !isDirty} size="sm">
                            {saving ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : saved ? (
                                <Check className="w-4 h-4 mr-1" />
                            ) : (
                                <Save className="w-4 h-4 mr-1" />
                            )}
                            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <Card className="border-destructive mb-6">
                    <CardContent className="p-4 flex items-center gap-3 text-destructive">
                        <AlertCircle className="w-5 h-5" />
                        {error}
                        <Button variant="ghost" size="sm" onClick={loadSettings} className="ml-auto">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            )}

            <div className="space-y-6">
                {/* Mode */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Appearance Mode</CardTitle>
                        <CardDescription>Light or dark mode</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-3">
                            {MODES.map(mode => (
                                <button
                                    key={mode.value}
                                    onClick={() => updateSetting('mode', mode.value)}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all",
                                        settings.mode === mode.value
                                            ? "border-primary bg-primary/10"
                                            : "border-border hover:border-muted-foreground/50"
                                    )}
                                >
                                    <mode.icon className={cn("w-4 h-4", settings.mode === mode.value && "text-primary")} />
                                    <span className="font-medium text-sm">{mode.label}</span>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Base Color */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Base Color</CardTitle>
                        <CardDescription>Neutral tone for backgrounds and cards</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {BASE_COLORS.map(base => (
                                <button
                                    key={base.value}
                                    onClick={() => updateSetting('base', base.value)}
                                    className={cn(
                                        "flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all",
                                        settings.base === base.value
                                            ? "border-primary"
                                            : "border-transparent hover:border-muted-foreground/30"
                                    )}
                                >
                                    <div
                                        className="w-8 h-8 rounded-md border"
                                        style={{ background: base.color }}
                                    />
                                    <span className="text-[10px] font-medium">{base.label}</span>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Accent Color */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Accent Color</CardTitle>
                        <CardDescription>Primary color for buttons and highlights</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                            {ACCENT_COLORS.map(accent => (
                                <button
                                    key={accent.value}
                                    onClick={() => updateSetting('accent', accent.value)}
                                    className={cn(
                                        "flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all",
                                        settings.accent === accent.value
                                            ? "border-primary bg-primary/5"
                                            : "border-transparent hover:border-muted-foreground/30"
                                    )}
                                >
                                    <div
                                        className="w-10 h-10 rounded-lg shadow-sm"
                                        style={{ background: accent.color }}
                                    />
                                    <span className="text-[10px] font-medium">{accent.label}</span>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Radius */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Border Radius</CardTitle>
                        <CardDescription>Roundness of UI elements</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {RADII.map(r => (
                                <button
                                    key={r.value}
                                    onClick={() => updateSetting('radius', r.value)}
                                    className={cn(
                                        "flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all",
                                        settings.radius === r.value
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-muted-foreground/50"
                                    )}
                                >
                                    <div
                                        className="w-10 h-10 bg-primary/20 border-2 border-primary"
                                        style={{ borderRadius: r.value }}
                                    />
                                    <span className="text-[10px] font-medium">{r.label}</span>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Font */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Type className="w-4 h-4" />
                            Font Family
                        </CardTitle>
                        <CardDescription>Typography for the module</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {FONTS.map(font => {
                                // Map font value to actual CSS font-family
                                const fontFamilyMap: Record<string, string> = {
                                    'inter': '"Inter", sans-serif',
                                    'noto-sans': '"Noto Sans", sans-serif',
                                    'nunito-sans': '"Nunito Sans", sans-serif',
                                    'figtree': '"Figtree", sans-serif',
                                    'roboto': '"Roboto", sans-serif',
                                    'raleway': '"Raleway", sans-serif',
                                    'dm-sans': '"DM Sans", sans-serif',
                                    'public-sans': '"Public Sans", sans-serif',
                                    'outfit': '"Outfit", sans-serif',
                                    'jetbrains-mono': '"JetBrains Mono", monospace',
                                    'tajawal': '"Tajawal", sans-serif',
                                    'cairo': '"Cairo", sans-serif',
                                };
                                const fontFamily = fontFamilyMap[font.value] || 'inherit';
                                const isArabic = font.value === 'tajawal' || font.value === 'cairo';

                                return (
                                    <button
                                        key={font.value}
                                        onClick={() => updateSetting('font', font.value)}
                                        className={cn(
                                            "flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all text-left min-h-[100px]",
                                            settings.font === font.value
                                                ? "border-primary bg-primary/5 shadow-sm"
                                                : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"
                                        )}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{font.label}</span>
                                            {settings.font === font.value && (
                                                <Badge variant="default" className="text-[9px] px-1.5">Selected</Badge>
                                            )}
                                        </div>
                                        <span
                                            className="text-xl leading-relaxed"
                                            style={{ fontFamily }}
                                            dir={isArabic ? 'rtl' : 'ltr'}
                                        >
                                            {font.sample}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Icon Mode */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Icon Style</CardTitle>
                        <CardDescription>How icons appear throughout</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {ICON_MODES.map(mode => (
                                <button
                                    key={mode.value}
                                    onClick={() => updateSetting('icon_mode', mode.value)}
                                    className={cn(
                                        "flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left",
                                        settings.icon_mode === mode.value
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-muted-foreground/50"
                                    )}
                                >
                                    <Circle className={cn(
                                        "w-4 h-4",
                                        mode.value === 'primary' && "text-primary fill-primary",
                                        mode.value === 'muted' && "text-muted-foreground",
                                        mode.value === 'semantic' && settings.icon_mode === mode.value && "text-primary"
                                    )} />
                                    <div>
                                        <div className="text-sm font-medium">{mode.label}</div>
                                        <div className="text-[10px] text-muted-foreground">{mode.description}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Current Configuration */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Current Configuration</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                            <div><Label className="text-muted-foreground text-[10px]">Mode</Label><div className="font-mono">{settings.mode}</div></div>
                            <div><Label className="text-muted-foreground text-[10px]">Base</Label><div className="font-mono">{settings.base}</div></div>
                            <div><Label className="text-muted-foreground text-[10px]">Accent</Label><div className="font-mono">{settings.accent}</div></div>
                            <div><Label className="text-muted-foreground text-[10px]">Radius</Label><div className="font-mono">{settings.radius}</div></div>
                            <div><Label className="text-muted-foreground text-[10px]">Font</Label><div className="font-mono">{settings.font}</div></div>
                            <div><Label className="text-muted-foreground text-[10px]">Icons</Label><div className="font-mono">{settings.icon_mode}</div></div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
