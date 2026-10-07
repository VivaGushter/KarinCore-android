import { escapeHtml } from './security';

export const DISCONNECTED_CORE_LABEL = 'idle';

export function renderPatchNotes(text: string): string {
    const groups: Array<{ title?: string; items: string[] }> = [];

    for (const sourceLine of text.split(/\r?\n/)) {
        const line = sourceLine.trim();
        if (!line) continue;

        if (/^v\s*\d/i.test(line)) {
            groups.push({ title: line, items: [] });
            continue;
        }

        const item = line.replace(/^[•*-]\s*/, '');
        if (groups.length === 0) groups.push({ items: [] });
        groups[groups.length - 1].items.push(item);
    }

    return groups.map(group => `
        <section class="patch-release">
            ${group.title ? `<h4 class="patch-release-title">${escapeHtml(group.title)}</h4>` : ''}
            <div class="patch-release-items">
                ${group.items.map(item => `<div class="patch-release-item">${escapeHtml(item)}</div>`).join('')}
            </div>
        </section>
    `).join('');
}
