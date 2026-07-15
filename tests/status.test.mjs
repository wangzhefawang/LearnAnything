import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { makeStore, mutateJson, REPO_ROOT } from './helpers/store-fixture.mjs';

const STATUS = join(REPO_ROOT, '.claude', 'skills', 'learn-anything-status', 'scripts', 'status.mjs');

function runStatus(...args) {
    return spawnSync(process.execPath, [STATUS, '--locale', 'zh-CN', ...args], { encoding: 'utf8' });
}

test('status renders a v2 knowledge domain selected by topics root and name', () => {
    const store = makeStore();
    try {
        const result = runStatus(store.topics, '基础领域');
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /基础领域.*学习状态/);
        assert.match(result.stdout, /Transformer 架构/);
        assert.match(result.stdout, /注意力机制/);
        assert.match(result.stdout, /Transformer 架构\s+🔵 学习中/);
        assert.match(result.stdout, /注意力机制\s+🟢 已掌握/);
        assert.match(result.stdout, /🟢 已掌握.*🔵 学习中.*🟠 需练习.*⚪ 未探索/);
        assert.match(result.stdout, /^\| 🔵 学习中 \| 学习中 — 已开始但尚未掌握 \|$/m);
        assert.doesNotMatch(result.stdout, /^\| 🔵 \| 🔵 学习中 \|/m);
        for (const line of result.stdout.split(/\r?\n/).filter((item) => /Transformer 架构|注意力机制/.test(item))) {
            assert.ok((line.match(/[🔵🟢]/gu) ?? []).length <= 1, line);
        }
    }
    finally {
        store.cleanup();
    }
});

test('status renders a learning view in declared view order', () => {
    const store = makeStore();
    try {
        const result = runStatus(store.topics, '示例岗位');
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /示例岗位.*学习状态/);
        assert.ok(result.stdout.indexOf('ReAct 循环') < result.stdout.indexOf('Transformer 架构'));
        assert.ok(result.stdout.indexOf('Transformer 架构') < result.stdout.indexOf('注意力机制'));
        assert.match(result.stdout, /\[🔴 核心\]/);
        assert.match(result.stdout, /\[🟡 推荐\]/);
        assert.match(result.stdout, /\[⚪ 可选\]/);
    }
    finally {
        store.cleanup();
    }
});

test('status --all includes all knowledge domains and learning views', () => {
    const store = makeStore();
    try {
        const result = runStatus('--all', store.topics);
        assert.equal(result.status, 0, result.stderr);
        for (const name of ['基础领域', '应用领域', '示例岗位', '研究视图']) {
            assert.match(result.stdout, new RegExp(name));
        }
        assert.match(result.stdout, /知识领域/);
        assert.match(result.stdout, /学习视图/);
    }
    finally {
        store.cleanup();
    }
});

test('status rejects v1 state files instead of silently skipping them', () => {
    const store = makeStore();
    try {
        const statePath = join(store.topics, '基础领域', 'state.json');
        mutateJson(statePath, (state) => {
            state.version = 1;
            delete state.kind;
        });
        const result = runStatus(store.topics, '基础领域');
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /v1|迁移/i);
    }
    finally {
        store.cleanup();
    }
});
