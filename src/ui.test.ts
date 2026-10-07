import { describe, expect, it } from 'vitest';
import { DISCONNECTED_CORE_LABEL, renderPatchNotes } from './ui';

describe('mobile status presentation', () => {
    it('uses a user-facing idle state instead of leaking a null sentinel', () => {
        expect(DISCONNECTED_CORE_LABEL).toBe('idle');
        expect(DISCONNECTED_CORE_LABEL).not.toBe('null');
    });
});

describe('patch notes presentation', () => {
    it('turns versions and bullets into separate readable blocks', () => {
        const html = renderPatchNotes('v 1.2.0 — Release\n• First change\n• Second change\n\nv 1.1.0\n• Previous change');

        expect(html.match(/patch-release-title/g)).toHaveLength(2);
        expect(html.match(/class="patch-release-item"/g)).toHaveLength(3);
        expect(html).toContain('First change');
    });

    it('escapes translated patch-note content', () => {
        expect(renderPatchNotes('v 1.0\n• <img src=x onerror=alert(1)>')).not.toContain('<img');
    });
});
