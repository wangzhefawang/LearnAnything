import assert from 'node:assert/strict';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { makeStore, REPO_ROOT } from './helpers/store-fixture.mjs';

const RENDERER = join(REPO_ROOT, 'scripts', 'render-views.mjs');

function render(topics, ...args) {
    return spawnSync(process.execPath, [RENDERER, ...args, topics], { encoding: 'utf8' });
}

test('render-views generates deterministic Chinese reports with input hashes', () => {
    const store = makeStore();
    try {
        const first = render(store.topics);
        assert.equal(first.status, 0, first.stderr);
        const reportPath = join(store.topics, '示例岗位.md');
        const firstBytes = readFileSync(reportPath);
        const second = render(store.topics);
        assert.equal(second.status, 0, second.stderr);
        const secondBytes = readFileSync(reportPath);
        assert.deepEqual(secondBytes, firstBytes);
        const text = secondBytes.toString('utf8');
        assert.match(text, /自动生成勿手改/);
        assert.match(text, /输入摘要.*[0-9a-f]{12}/);
        assert.match(text, /平均掌握度/);
        assert.match(text, /所属领域/);
        assert.ok(text.indexOf('ReAct 循环') < text.indexOf('Transformer 架构'));
        assert.ok(text.indexOf('Transformer 架构') < text.indexOf('注意力机制'));
    }
    finally {
        store.cleanup();
    }
});

test('render-views --check is read-only and reports stale files', () => {
    const store = makeStore();
    try {
        assert.equal(render(store.topics).status, 0);
        const reportPath = join(store.topics, '示例岗位.md');
        writeFileSync(reportPath, '过期内容\n', 'utf8');
        const before = readFileSync(reportPath);
        const beforeMtime = statSync(reportPath).mtimeMs;
        const result = render(store.topics, '--check');
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /示例岗位\.md/);
        assert.deepEqual(readFileSync(reportPath), before);
        assert.equal(statSync(reportPath).mtimeMs, beforeMtime);
    }
    finally {
        store.cleanup();
    }
});

test('render-views --check succeeds after reports are current', () => {
    const store = makeStore();
    try {
        assert.equal(render(store.topics).status, 0);
        const result = render(store.topics, '--check');
        assert.equal(result.status, 0, result.stderr);
    }
    finally {
        store.cleanup();
    }
});
