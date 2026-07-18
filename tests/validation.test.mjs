import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { fixturePath, REPO_ROOT } from './helpers/store-fixture.mjs';
import {
    validateStateV2,
    validateViewV2,
} from '../.claude/skills/learn-anything-topic/scripts/utils.mjs';

test('validateStateV2 accepts a complete v2 knowledge domain', () => {
    const state = JSON.parse(readFileSync(fixturePath('topics', '基础领域', 'state.json'), 'utf8'));
    assert.deepEqual(validateStateV2(state), []);
});

test('validateStateV2 rejects non-canonical concept_id forms', () => {
    const invalidIds = [
        'Transformer-架构',
        'transformer 架构',
        'transformer--架构',
        '-transformer',
        'transformer-',
        'e\u0301',
        'a'.repeat(65),
        'transformer:架构',
    ];
    const base = JSON.parse(readFileSync(fixturePath('topics', '基础领域', 'state.json'), 'utf8'));
    for (const conceptId of invalidIds) {
        const state = structuredClone(base);
        state.domains[0].concepts[0].concept_id = conceptId;
        const errors = validateStateV2(state);
        assert.ok(errors.some((error) => error.path.endsWith('.concept_id')), conceptId);
    }
});

test('validateStateV2 checks all concept fields, status, and confidence', () => {
    const state = JSON.parse(readFileSync(fixturePath('topics', '基础领域', 'state.json'), 'utf8'));
    delete state.domains[0].concepts[0].details;
    state.domains[0].concepts[1].status = 'studying';
    state.domains[0].concepts[1].confidence = 1.1;
    const paths = validateStateV2(state).map((error) => error.path);
    assert.ok(paths.includes('domains[0].concepts[0].details'));
    assert.ok(paths.includes('domains[0].concepts[1].status'));
    assert.ok(paths.includes('domains[0].concepts[1].confidence'));
});

test('validateViewV2 enforces exact entry keys and importance enum', () => {
    const view = JSON.parse(readFileSync(fixturePath('topics', '示例岗位.view.json'), 'utf8'));
    assert.deepEqual(validateViewV2(view), []);
    view.concepts[0].importance = 'critical';
    view.concepts[1].progress = 0.5;
    const errors = validateViewV2(view);
    assert.ok(errors.some((error) => error.path === 'concepts[0].importance'));
    assert.ok(errors.some((error) => error.path === 'concepts[1].progress'));
});

test('validateViewV2 accepts an optional non-empty note up to 30 characters', () => {
    const view = JSON.parse(readFileSync(fixturePath('topics', '示例岗位.view.json'), 'utf8'));
    view.concepts[0].note = '实习直接重合';
    view.concepts[1].note = '标'.repeat(30);

    assert.deepEqual(validateViewV2(view), []);
});

test('validateViewV2 rejects invalid notes', () => {
    const invalidNotes = ['', '   ', '标'.repeat(31), 42];
    const base = JSON.parse(readFileSync(fixturePath('topics', '示例岗位.view.json'), 'utf8'));

    for (const note of invalidNotes) {
        const view = structuredClone(base);
        view.concepts[0].note = note;
        const errors = validateViewV2(view);
        assert.ok(errors.some((error) => error.path === 'concepts[0].note'), JSON.stringify(note));
    }
});

test('all five utils.mjs copies remain byte-identical', () => {
    const skills = ['topic', 'explain', 'practice', 'quiz', 'status'];
    const copies = skills.map((skill) => readFileSync(
        join(REPO_ROOT, '.claude', 'skills', `learn-anything-${skill}`, 'scripts', 'utils.mjs'),
        'utf8',
    ));
    assert.equal(new Set(copies).size, 1);
});
