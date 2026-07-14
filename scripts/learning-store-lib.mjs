import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

import {
    validateStateV2,
    validateViewV2,
} from '../.claude/skills/learn-anything-status/scripts/utils.mjs';

const STATUS_LABEL = {
    unexplored: '未探索',
    in_progress: '学习中',
    needs_practice: '待练习',
    mastered: '已掌握',
};

const IMPORTANCE_LABEL = {
    core: '核心',
    recommended: '推荐',
    optional: '可选',
};

function compareName(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}

function relativePath(topicsDir, filePath) {
    return relative(topicsDir, filePath).replaceAll('\\', '/');
}

function readJson(filePath, topicsDir, errors) {
    try {
        return JSON.parse(readFileSync(filePath, 'utf8'));
    }
    catch (error) {
        errors.push(`${relativePath(topicsDir, filePath)}: JSON 解析失败：${error.message}`);
        return null;
    }
}

function appendSchemaErrors(errors, topicsDir, filePath, schemaErrors) {
    const relative = relativePath(topicsDir, filePath);
    for (const error of schemaErrors) {
        const field = error.path ? `.${error.path}` : '';
        errors.push(`${relative}${field}: ${error.message}`);
    }
}

export class LearningStoreError extends Error {
    constructor(errors) {
        super(errors.join('\n'));
        this.name = 'LearningStoreError';
        this.errors = errors;
    }
}

export function loadLearningStore(topicsDir) {
    const errors = [];
    const states = [];
    const views = [];
    let entries;
    try {
        entries = readdirSync(topicsDir, { withFileTypes: true })
            .sort((a, b) => compareName(a.name, b.name));
    }
    catch (error) {
        throw new LearningStoreError([`无法读取 topics 根目录 ${topicsDir}：${error.message}`]);
    }

    for (const entry of entries) {
        if (entry.isDirectory()) {
            const filePath = join(topicsDir, entry.name, 'state.json');
            if (!existsSync(filePath))
                continue;
            const state = readJson(filePath, topicsDir, errors);
            if (!state)
                continue;
            if (state.version === 1 || state.kind == null) {
                errors.push(`${relativePath(topicsDir, filePath)}: 检测到 v1/未迁移格式，请先完成数据迁移`);
                continue;
            }
            const schemaErrors = validateStateV2(state);
            appendSchemaErrors(errors, topicsDir, filePath, schemaErrors);
            if (schemaErrors.length === 0)
                states.push({ dirName: entry.name, filePath, state });
        }
        else if (entry.isFile() && entry.name.endsWith('.view.json')) {
            const filePath = join(topicsDir, entry.name);
            const view = readJson(filePath, topicsDir, errors);
            if (!view)
                continue;
            if (view.version === 1 || view.kind == null) {
                errors.push(`${relativePath(topicsDir, filePath)}: 检测到 v1/未迁移格式，请先完成数据迁移`);
                continue;
            }
            const schemaErrors = validateViewV2(view);
            appendSchemaErrors(errors, topicsDir, filePath, schemaErrors);
            if (schemaErrors.length === 0) {
                views.push({
                    fileName: entry.name,
                    filePath,
                    reportPath: join(topicsDir, entry.name.replace(/\.view\.json$/, '.md')),
                    view,
                });
            }
        }
    }

    if (errors.length > 0)
        throw new LearningStoreError(errors);

    const definitions = new Map();
    for (const stateRecord of states) {
        for (const domain of stateRecord.state.domains) {
            for (const concept of domain.concepts) {
                const definition = {
                    concept,
                    domain,
                    state: stateRecord.state,
                    stateRecord,
                };
                const current = definitions.get(concept.concept_id) ?? [];
                current.push(definition);
                definitions.set(concept.concept_id, current);
            }
        }
    }

    return { topicsDir, states, views, definitions };
}

export function aggregateView(store, viewRecord) {
    const concepts = [];
    for (const reference of viewRecord.view.concepts) {
        const definitions = store.definitions.get(reference.concept_id) ?? [];
        if (definitions.length !== 1) {
            throw new LearningStoreError([
                `${viewRecord.fileName}: concept_id ${reference.concept_id} 应解析到恰好一个定义，实际为 ${definitions.length}`,
            ]);
        }
        const definition = definitions[0];
        concepts.push({
            concept_id: reference.concept_id,
            importance: reference.importance,
            concept: definition.concept,
            domain_name: definition.domain.name,
            knowledge_domain: definition.state.topic,
            state_slug: definition.state.slug,
        });
    }
    const total = concepts.length;
    const confidenceSum = concepts.reduce((sum, item) => sum + item.concept.confidence, 0);
    return {
        viewRecord,
        concepts,
        total,
        meanConfidence: total === 0 ? 0 : confidenceSum / total,
        mastered: concepts.filter((item) => item.concept.status === 'mastered').length,
    };
}

function canonicalValue(value) {
    if (Array.isArray(value))
        return value.map(canonicalValue);
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
            Object.keys(value).sort(compareName).map((key) => [key, canonicalValue(value[key])]),
        );
    }
    return value;
}

export function canonicalJson(value) {
    return JSON.stringify(canonicalValue(value));
}

export function viewInputDigest(aggregate) {
    const input = {
        view: aggregate.viewRecord.view,
        state_slices: aggregate.concepts.map((item) => ({
            concept: item.concept,
            domain_name: item.domain_name,
            knowledge_domain: item.knowledge_domain,
            state_slug: item.state_slug,
        })),
    };
    return createHash('sha256').update(canonicalJson(input), 'utf8').digest('hex').slice(0, 12);
}

function latestLearningDate(concept) {
    const dates = [concept.last_explained, concept.last_practiced].filter(Boolean);
    return dates.length === 0 ? '—' : dates.sort(compareName).at(-1);
}

function escapeTable(value) {
    return String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

export function formatConfidence(confidence) {
    return `${Math.round(confidence * 100)}%`;
}

export function renderViewMarkdown(aggregate) {
    const digest = viewInputDigest(aggregate);
    const lines = [
        `<!-- 自动生成勿手改；输入摘要：${digest} -->`,
        `# ${aggregate.viewRecord.view.name} 学习进度`,
        '',
        `> 本报告自动生成勿手改，输入摘要：\`${digest}\`。`,
        '',
        '## 汇总',
        '',
        `- 概念数：${aggregate.total}`,
        `- 平均掌握度 mean(confidence)：${formatConfidence(aggregate.meanConfidence)}`,
        `- 已掌握：${aggregate.mastered} / ${aggregate.total}`,
        '',
        '## 概念进度',
        '',
        '| 概念名 | 重要性 | 状态 | 掌握度 | 最近学习日期 | 所属领域 |',
        '| --- | --- | --- | --- | --- | --- |',
    ];
    for (const item of aggregate.concepts) {
        lines.push(`| ${escapeTable(item.concept.name)} | ${IMPORTANCE_LABEL[item.importance]} | ${STATUS_LABEL[item.concept.status]} | ${formatConfidence(item.concept.confidence)} | ${latestLearningDate(item.concept)} | ${escapeTable(item.knowledge_domain)} |`);
    }
    lines.push('');
    return lines.join('\n');
}

export function stateSummary(stateRecord) {
    const concepts = stateRecord.state.domains.flatMap((domain) => domain.concepts);
    const total = concepts.length;
    return {
        kind: 'knowledge_domain',
        name: stateRecord.state.topic,
        total,
        mastered: concepts.filter((concept) => concept.status === 'mastered').length,
        meanConfidence: total === 0 ? 0 : concepts.reduce((sum, concept) => sum + concept.confidence, 0) / total,
    };
}

export function viewSummary(store, viewRecord) {
    const aggregate = aggregateView(store, viewRecord);
    return {
        kind: 'learning_view',
        name: viewRecord.view.name,
        total: aggregate.total,
        mastered: aggregate.mastered,
        meanConfidence: aggregate.meanConfidence,
    };
}

export function viewNameFromFile(filePath) {
    return basename(filePath).replace(/\.view\.json$/, '');
}
