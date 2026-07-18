import assert from 'node:assert/strict';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { renderViewMarkdown, viewInputDigest } from '../scripts/learning-store-lib.mjs';
import { makeStore, mutateJson, REPO_ROOT } from './helpers/store-fixture.mjs';

const RENDERER = join(REPO_ROOT, 'scripts', 'render-views.mjs');

function render(topics, ...args) {
    return spawnSync(process.execPath, [RENDERER, ...args, topics], { encoding: 'utf8' });
}

test('renderViewMarkdown prefixes every Chinese status and importance label with its colored dot', () => {
    const concepts = [
        ['未探索概念', 'unexplored', 'core'],
        ['学习中概念', 'in_progress', 'recommended'],
        ['需练习概念', 'needs_practice', 'optional'],
        ['已掌握概念', 'mastered', 'core'],
    ].map(([name, status, importance], index) => ({
        concept_id: `concept-${index}`,
        importance,
        concept: {
            name,
            status,
            confidence: 0,
            last_explained: null,
            last_practiced: null,
        },
        domain_name: '示例领域',
        knowledge_domain: '示例知识领域',
        state_slug: 'example',
    }));
    const report = renderViewMarkdown({
        viewRecord: {
            view: {
                name: '标签测试',
                concepts: concepts.map(({ concept_id, importance }) => ({ concept_id, importance })),
            },
        },
        concepts,
        total: concepts.length,
        meanConfidence: 0,
        mastered: 1,
    });

    assert.match(report, /\| 未探索概念 \| 🔴 核心 \| ⚪ 未探索 \|/);
    assert.match(report, /\| 学习中概念 \| 🟡 推荐 \| 🔵 学习中 \|/);
    assert.match(report, /\| 需练习概念 \| ⚪ 可选 \| 🟠 需练习 \|/);
    assert.match(report, /\| 已掌握概念 \| 🔴 核心 \| 🟢 已掌握 \|/);
});

test('render-views adds a note column, bolds noted concepts, and italicizes notes', () => {
    const store = makeStore();
    try {
        const viewPath = join(store.topics, '示例岗位.view.json');
        mutateJson(viewPath, (view) => {
            view.concepts[0].note = '实习直接重合';
        });

        const result = render(store.topics);
        assert.equal(result.status, 0, result.stderr);
        const report = readFileSync(join(store.topics, '示例岗位.md'), 'utf8');
        assert.match(report, /\| 概念名 \| 标注 \| 重要性 \| 状态 \| 掌握度 \| 最近学习日期 \| 所属领域 \|/);
        assert.match(report, /\| \*\*ReAct 循环\*\* \| \*实习直接重合\* \|/);
        assert.match(report, /\| Transformer 架构 \| — \|/);
    }
    finally {
        store.cleanup();
    }
});

test('render-views preserves visible note and concept text when Markdown characters are present', () => {
    const store = makeStore();
    try {
        const viewPath = join(store.topics, '示例岗位.view.json');
        mutateJson(viewPath, (view) => {
            view.concepts[0].note = ' *实习|强相关* ';
        });
        const statePath = join(store.topics, '应用领域', 'state.json');
        mutateJson(statePath, (state) => {
            state.domains[0].concepts[0].name = 'ReAct *循环*';
        });

        const result = render(store.topics);
        assert.equal(result.status, 0, result.stderr);
        const report = readFileSync(join(store.topics, '示例岗位.md'), 'utf8');
        assert.ok(report.includes('| **ReAct \\*循环\\*** | *&#32;\\*实习\\|强相关\\*&#32;* |'));
    }
    finally {
        store.cleanup();
    }
});

test('viewInputDigest changes when a note changes', () => {
    const aggregate = {
        viewRecord: {
            view: {
                name: '摘要测试',
                concepts: [{ concept_id: 'concept-0', importance: 'core', note: '实习直接重合' }],
            },
        },
        concepts: [],
    };
    const changed = structuredClone(aggregate);
    changed.viewRecord.view.concepts[0].note = '实习强相关';

    assert.notEqual(viewInputDigest(aggregate), viewInputDigest(changed));
});

test('renderViewMarkdown preserves the legacy output when no concept has a note', () => {
    const concepts = [{
        concept_id: 'concept-0',
        importance: 'core',
        concept: {
            name: '未标注概念',
            status: 'unexplored',
            confidence: 0,
            last_explained: null,
            last_practiced: null,
        },
        domain_name: '示例领域',
        knowledge_domain: '示例知识领域',
        state_slug: 'example',
    }];
    const aggregate = {
        viewRecord: {
            view: {
                name: '兼容性测试',
                concepts: [{ concept_id: 'concept-0', importance: 'core' }],
            },
        },
        concepts,
        total: 1,
        meanConfidence: 0,
        mastered: 0,
    };
    const digest = viewInputDigest(aggregate);
    const expected = [
        `<!-- 自动生成勿手改；输入摘要：${digest} -->`,
        '# 兼容性测试 学习进度',
        '',
        `> 本报告自动生成勿手改，输入摘要：\`${digest}\`。`,
        '',
        '## 汇总',
        '',
        '- 概念数：1',
        '- 平均掌握度 mean(confidence)：0%',
        '- 已掌握：0 / 1',
        '',
        '## 概念进度',
        '',
        '| 概念名 | 重要性 | 状态 | 掌握度 | 最近学习日期 | 所属领域 |',
        '| --- | --- | --- | --- | --- | --- |',
        '| 未标注概念 | 🔴 核心 | ⚪ 未探索 | 0% | — | 示例知识领域 |',
        '',
    ].join('\n');

    assert.equal(renderViewMarkdown(aggregate), expected);
});

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
