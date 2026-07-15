import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { readJson, REPO_ROOT } from './helpers/store-fixture.mjs';
import {
    buildMigrationModel,
    commitStagedStore,
    parseDomainMapping,
    parseSessionDate,
    rewriteSessionHeader,
} from '../openspec/changes/archive/2026-07-14-restructure-topics-to-knowledge-domains/migration/migrate.mjs';
import { assertExactExpectations } from '../openspec/changes/archive/2026-07-14-restructure-topics-to-knowledge-domains/migration/verify-migration.mjs';

const CHANGE_ROOT = join(REPO_ROOT, 'openspec', 'changes', 'archive', '2026-07-14-restructure-topics-to-knowledge-domains');
const MIGRATION_ROOT = join(CHANGE_ROOT, 'migration');
const MIGRATE = join(MIGRATION_ROOT, 'migrate.mjs');

function loadModel() {
    const snapshot = readJson(join(CHANGE_ROOT, 'baseline', 'concepts-v1-snapshot.json'));
    const manifest = readJson(join(MIGRATION_ROOT, 'merge-manifest.json'));
    const sessionsMap = readJson(join(MIGRATION_ROOT, 'sessions-map.json'));
    const domainMapping = parseDomainMapping(readFileSync(join(MIGRATION_ROOT, 'domain-mapping.md'), 'utf8'));
    return buildMigrationModel({ snapshot, manifest, sessionsMap, domainMapping });
}

function concept(model, conceptId) {
    const value = model.concepts.get(conceptId);
    assert.ok(value, conceptId);
    return value;
}

test('migration model rebuilds exact v2 counts and audited progress points', () => {
    const model = loadModel();
    assert.equal(model.domains.length, 10);
    assert.equal(model.concepts.size, 151);
    assert.equal(model.views.length, 6);
    assert.equal(model.explainEventTotal, 50);

    assert.deepEqual(
        Object.fromEntries(['transformer-架构', 'adas-noa-功能定义', '端到端与大模型智驾落地'].map((id) => {
            const item = concept(model, id);
            return [id, [item.explain_count, item.confidence, item.last_explained]];
        })),
        {
            'transformer-架构': [7, 0.55, '2026-07-02'],
            'adas-noa-功能定义': [4, 0.25, '2026-07-13'],
            '端到端与大模型智驾落地': [3, 0.15, '2026-07-13'],
        },
    );
    const safety = concept(model, '功能安全-iso-26262');
    assert.equal(safety.explain_count, 1);
    assert.equal(safety.last_explained, '2026-07-12');
    assert.equal(safety.status, 'in_progress');
    for (const item of model.concepts.values()) {
        assert.equal(item.practice_count, 0);
        assert.equal(item.last_practiced, null);
    }
});

test('migration verifier encodes every audited exact assertion', () => {
    const model = loadModel();
    const results = assertExactExpectations({
        concepts: model.concepts,
        domainCount: model.domains.length,
        viewCount: model.views.length,
        sessionCount: model.sessions.length,
    });
    assert.equal(results.length, 14);
    assert.ok(results.every((result) => result.ok));
    assert.deepEqual(results.map((result) => result.label).slice(-3), [
        '机器人测试用例设计方法 explain_count=2, confidence=0.1',
        '全库 explain 事件三元组总和=50',
        '全库 practice_count=0 且 last_practiced=null',
    ]);
});

test('migration model appends hard-coded split details after canonical details', () => {
    const model = loadModel();
    assert.equal(
        concept(model, '大模型预训练-pretraining').details.at(-1),
        '掌握预训练、指令微调与对齐的基本区别',
    );
    assert.equal(
        concept(model, 'prompt-工程').details.at(-1),
        '设计科研问答中的系统提示词、任务提示词与约束提示词',
    );
    assert.deepEqual(
        concept(model, '上下文设计与管理').details.slice(-2),
        [
            '控制引用材料、用户问题与工具结果在上下文中的组织顺序',
            '处理长上下文截断、冗余信息与无关证据干扰',
        ],
    );
});

test('migration views preserve source order, deduplicate targets, and use core importance', () => {
    const model = loadModel();
    assert.deepEqual(model.views.map((record) => record.view.name), [
        '机器人开发与仿真测试实习',
        '具身智能',
        '跨模态推理链自动驾驶',
        '知识增强科研问答智能体',
        '智驾系统开发',
        'ai-agent-应用开发',
    ]);
    for (const { view } of model.views) {
        assert.equal(new Set(view.concepts.map((item) => item.concept_id)).size, view.concepts.length);
        assert.ok(view.concepts.every((item) => item.importance === 'core'));
    }
});

test('session rewrite normalizes the header and preserves the body byte-for-byte', () => {
    const source = [
        '# 标题',
        '',
        '> **日期：** 2026-07-13',
        '> **主题：** 旧主题',
        '> **路径：** 旧路径',
        '> **水平：** 中级',
        '',
        '---',
        '',
        '## 正文',
        '',
        '正文一字不动喵。',
        '',
    ].join('\n');
    const rewritten = rewriteSessionHeader(source, {
        date: '2026-07-13',
        conceptIds: ['id-one', 'id-two'],
        knowledgeDomain: '目标领域',
        targetSubdomain: '目标子域',
        primaryName: '主要概念',
    });
    assert.match(rewritten, /^# 标题\n\n> \*\*Date:\*\* 2026-07-13\n> \*\*Concept-IDs:\*\* \[id-one, id-two\]\n> \*\*Knowledge Domain:\*\* 目标领域\n> \*\*Path:\*\* 旧路径\n> \*\*Level:\*\* 中级\n\n---/);
    assert.equal(rewritten.slice(rewritten.indexOf('---') + 3), source.slice(source.indexOf('---') + 3));
});

test('session date parser accepts new and legacy file names', () => {
    assert.equal(parseSessionDate('概念--2026-07-13--整体概览.md'), '2026-07-13');
    assert.equal(parseSessionDate('概念-2026-06-10.md'), '2026-06-10');
});

test('migration CLI refuses to run when a v2 domain already exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'learn-anything-idempotent-'));
    try {
        const domain = join(root, 'topics', '已有领域');
        mkdirSync(domain, { recursive: true });
        writeFileSync(join(domain, 'state.json'), JSON.stringify({ version: 2, kind: 'knowledge_domain' }), 'utf8');
        const result = spawnSync(process.execPath, [MIGRATE, '--learn-dir', root], { encoding: 'utf8' });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /v2|拒绝重跑|已存在/);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('migration commit rolls the legacy tree back when v2 installation fails', () => {
    const root = mkdtempSync(join(tmpdir(), 'learn-anything-rollback-'));
    const topics = join(root, 'topics');
    const staging = join(root, '.topics-v2-staging');
    const legacy = join(root, 'legacy-v1-topics');
    try {
        mkdirSync(join(topics, '旧主题'), { recursive: true });
        mkdirSync(join(staging, '新领域'), { recursive: true });
        writeFileSync(join(topics, '旧主题', 'state.json'), '{}', 'utf8');
        writeFileSync(join(staging, '新领域', 'state.json'), '{}', 'utf8');
        let calls = 0;
        assert.throws(() => commitStagedStore({
            topicsDir: topics,
            legacyDir: legacy,
            stagingDir: staging,
            rename: (source, destination) => {
                calls += 1;
                if (calls === 2)
                    throw new Error('injected install failure');
                renameSync(source, destination);
            },
        }), /injected install failure/);
        assert.ok(existsSync(join(topics, '旧主题', 'state.json')));
        assert.ok(existsSync(join(staging, '新领域', 'state.json')));
        assert.equal(existsSync(legacy), false);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});
