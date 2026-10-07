import { describe, expect, it } from 'vitest';
import { escapeHtml } from './security';

describe('escapeHtml', () => {
    it('neutralizes element and event-handler payloads from subscription remarks', () => {
        expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
            '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
        );
    });

    it('neutralizes quoted data-attribute payloads', () => {
        expect(escapeHtml(`x" autofocus onfocus='steal()'`)).toBe(
            'x&quot; autofocus onfocus=&#39;steal()&#39;'
        );
    });
});
