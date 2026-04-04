import { describe, expect, it } from 'vitest';
import {
    extractTemplateGroupEmails,
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
});
