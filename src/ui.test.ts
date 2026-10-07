import { describe, expect, it } from 'vitest';
import { DISCONNECTED_CORE_LABEL } from './ui';

describe('mobile status presentation', () => {
    it('uses a user-facing idle state instead of leaking a null sentinel', () => {
        expect(DISCONNECTED_CORE_LABEL).toBe('idle');
        expect(DISCONNECTED_CORE_LABEL).not.toBe('null');
    });
});
