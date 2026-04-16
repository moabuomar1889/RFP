import { describe, expect, it } from 'vitest';
import {
    compareSharedDriveRoles,
    extractTemplateGroupEmails,
    extractTemplateSharedDriveMembers,
    parseSharedDriveVisibilityGroups,
} from '@/server/shared-drive-members';

describe('shared-drive-members helpers', () => {
    it('parses configured group emails from object settings', () => {
        expect(
            parseSharedDriveVisibilityGroups({
                emails: [' Projects-Managers@dtgsa.com ', 'technical-team@dtgsa.com'],
            })
        ).toEqual(['projects-managers@dtgsa.com', 'technical-team@dtgsa.com']);
    });

    it('parses configured group emails from comma-separated strings', () => {
        expect(
            parseSharedDriveVisibilityGroups('projects-managers@dtgsa.com, hse-team@dtgsa.com')
        ).toEqual(['projects-managers@dtgsa.com', 'hse-team@dtgsa.com']);
    });

    it('extracts unique group emails from phased templates', () => {
        const template = {
            phases: {
                bidding: {
                    folders: [
                        {
                            name: 'SOW',
                            groups: [{ email: 'projects-managers@dtgsa.com' }],
                        },
                    ],
                },
                project_delivery: {
                    folders: [
                        {
                            name: 'HSE',
                            groups: [{ email: 'hse-team@dtgsa.com' }, { email: 'projects-managers@dtgsa.com' }],
                        },
                    ],
                },
            },
        };

        expect(extractTemplateGroupEmails(template)).toEqual([
            'hse-team@dtgsa.com',
            'projects-managers@dtgsa.com',
        ]);
    });

    it('extracts unique group emails from array templates', () => {
        const template = [
            {
                text: 'Bidding',
                nodes: [
                    {
                        text: 'Commercial Proposal',
                        groups: [{ email: 'projects-managers@dtgsa.com' }],
                        nodes: [
                            {
                                text: 'Admin Only',
                                groups: [{ email: 'admin@dtgsa.com' }],
                            },
                        ],
                    },
                ],
            },
        ];

        expect(extractTemplateGroupEmails(template)).toEqual([
            'admin@dtgsa.com',
            'projects-managers@dtgsa.com',
        ]);
    });

    it('extracts desired Shared Drive roles from template groups and users', () => {
        const template = [
            {
                name: 'Project Delivery',
                children: [
                    {
                        name: 'Document Control',
                        groups: [
                            { email: 'DC-Team@dtgsa.com', role: 'writer' },
                            { email: 'Projects-Managers@dtgsa.com', role: 'reader' },
                        ],
                        users: [{ email: 'A.Albaz@dtgsa.com', role: 'writer' }],
                    },
                ],
            },
        ];

        expect(extractTemplateSharedDriveMembers(template)).toEqual([
            { type: 'user', email: 'a.albaz@dtgsa.com', role: 'writer', sources: ['template'] },
            { type: 'group', email: 'dc-team@dtgsa.com', role: 'writer', sources: ['template'] },
            { type: 'group', email: 'projects-managers@dtgsa.com', role: 'reader', sources: ['template'] },
        ]);
    });

    it('keeps the strongest Shared Drive role when the same principal appears twice', () => {
        const template = [
            {
                name: 'Bidding',
                groups: [{ email: 'dc-team@dtgsa.com', role: 'reader' }],
                children: [
                    {
                        name: 'SOW',
                        groups: [{ email: 'DC-Team@dtgsa.com', role: 'writer' }],
                    },
                ],
            },
        ];

        expect(extractTemplateSharedDriveMembers(template)).toEqual([
            { type: 'group', email: 'dc-team@dtgsa.com', role: 'writer', sources: ['template'] },
        ]);
    });

    it('classifies reader as weaker than writer for Shared Drive desktop access', () => {
        expect(compareSharedDriveRoles('reader', 'writer')).toBe('weaker');
        expect(compareSharedDriveRoles('writer', 'reader')).toBe('stronger');
        expect(compareSharedDriveRoles('writer', 'writer')).toBe('match');
    });});
