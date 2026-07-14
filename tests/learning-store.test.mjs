import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { makeStore, mutateJson, REPO_ROOT } from './helpers/store-fixture.mjs';

const VALIDATOR = join(REPO_ROOT, 'scripts', 'validate-learning-store.mjs');

function validate(topics) {
    return spawnSync(process.execPath, [VALIDATOR, topics], { encoding: 'utf8' });
}

test('validator accepts the isolated v2 fixture store', () => {
    const store = makeStore();
    try {
        const result = validate(store.topics);
        assert.equal(result.status, 0, result.stderr);
    }
    finally {
        store.cleanup();
    }
});

test('validator finds Concept-IDs after a title and blank line', () => {
    const store = makeStore();
    try {
        const sessionPath = join(store.topics, '应用领域', 'sessions', 'agent-系统', 'ReAct 循环--2026-07-06--跨领域概览.md');
        const original = readFileSync(sessionPath, 'utf8');
        writeFileSync(sessionPath, `# ReAct 循环\n\n${original}`, 'utf8');
        const result = validate(store.topics);
        assert.equal(result.status, 0, result.stderr);
    }
    finally {
        store.cleanup();
    }
});

test('validator rejects globally duplicated concept definitions', () => {
    const store = makeStore();
    try {
        const basePath = join(store.topics, '基础领域', 'state.json');
        const appPath = join(store.topics, '应用领域', 'state.json');
        const duplicate = JSON.parse(readFileSync(basePath, 'utf8')).domains[0].concepts[0];
        mutateJson(appPath, (state) => state.domains[0].concepts.push(duplicate));
        const result = validate(store.topics);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /transformer-架构/);
        assert.match(result.stderr, /全局.*重复|重复.*定义/);
    }
    finally {
        store.cleanup();
    }
});

test('validator rejects unresolved and duplicate references inside a view', () => {
    const store = makeStore();
    try {
        const viewPath = join(store.topics, '示例岗位.view.json');
        mutateJson(viewPath, (view) => {
            view.concepts[0].concept_id = '不存在的概念';
            view.concepts.push({ concept_id: '注意力机制', importance: 'core' });
        });
        const result = validate(store.topics);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /不存在的概念/);
        assert.match(result.stderr, /注意力机制/);
        assert.match(result.stderr, /重复/);
    }
    finally {
        store.cleanup();
    }
});

test('validator rejects unresolved Concept-IDs in session headers', () => {
    const store = makeStore();
    try {
        const sessionPath = join(store.topics, '应用领域', 'sessions', 'agent-系统', 'ReAct 循环--2026-07-06--跨领域概览.md');
        const text = readFileSync(sessionPath, 'utf8').replace('transformer-架构]', '未知-id]');
        writeFileSync(sessionPath, text, 'utf8');
        const result = validate(store.topics);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /未知-id/);
        assert.match(result.stderr, /Concept-IDs/);
    }
    finally {
        store.cleanup();
    }
});

test('validator enforces count and date equivalence', () => {
    const store = makeStore();
    try {
        const statePath = join(store.topics, '应用领域', 'state.json');
        mutateJson(statePath, (state) => {
            state.domains[0].concepts[0].explain_count = 0;
            state.domains[0].concepts[0].last_practiced = null;
        });
        const result = validate(store.topics);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /explain_count/);
        assert.match(result.stderr, /last_explained/);
        assert.match(result.stderr, /practice_count/);
        assert.match(result.stderr, /last_practiced/);
    }
    finally {
        store.cleanup();
    }
});

test('validator lists v1 files and exits nonzero', () => {
    const store = makeStore();
    try {
        const statePath = join(store.topics, '基础领域', 'state.json');
        mutateJson(statePath, (state) => {
            state.version = 1;
            delete state.kind;
        });
        const result = validate(store.topics);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /v1|迁移/i);
        assert.match(result.stderr, /基础领域.*state\.json/);
    }
    finally {
        store.cleanup();
    }
});
