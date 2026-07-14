import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FIXTURE_ROOT = fileURLToPath(new URL('../fixtures/v2-store/', import.meta.url));

export function makeStore() {
    const root = mkdtempSync(join(tmpdir(), 'learn-anything-v2-'));
    cpSync(FIXTURE_ROOT, root, { recursive: true });
    return {
        root,
        topics: join(root, 'topics'),
        cleanup: () => rmSync(root, { recursive: true, force: true }),
    };
}

export function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeJson(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function mutateJson(path, mutate) {
    const value = readJson(path);
    mutate(value);
    writeJson(path, value);
}

export function fixturePath(...parts) {
    return join(FIXTURE_ROOT, ...parts);
}

export function parent(path) {
    return dirname(path);
}
