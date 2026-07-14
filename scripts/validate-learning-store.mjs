#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LearningStoreError, loadLearningStore } from './learning-store-lib.mjs';

function displayPath(topicsDir, filePath) {
    return relative(topicsDir, filePath).replaceAll('\\', '/');
}

function walkMarkdown(directory) {
    const files = [];
    let entries;
    try {
        entries = readdirSync(directory, { withFileTypes: true });
    }
    catch {
        return files;
    }
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const entry of entries) {
        const path = join(directory, entry.name);
        if (entry.isDirectory())
            files.push(...walkMarkdown(path));
        else if (entry.isFile() && entry.name.endsWith('.md'))
            files.push(path);
    }
    return files;
}

export function validateLearningStore(topicsDir) {
    let store;
    try {
        store = loadLearningStore(topicsDir);
    }
    catch (error) {
        if (error instanceof LearningStoreError)
            return error.errors;
        return [error instanceof Error ? error.message : String(error)];
    }

    const errors = [];
    for (const [conceptId, definitions] of store.definitions) {
        if (definitions.length > 1) {
            const files = definitions.map((item) => displayPath(topicsDir, item.stateRecord.filePath));
            errors.push(`concept_id ${conceptId} 存在全局重复定义：${files.join(', ')}`);
        }
    }

    for (const viewRecord of store.views) {
        const seen = new Set();
        for (const reference of viewRecord.view.concepts) {
            if (seen.has(reference.concept_id))
                errors.push(`${viewRecord.fileName}: 视图内重复引用 concept_id ${reference.concept_id}`);
            seen.add(reference.concept_id);
            const count = (store.definitions.get(reference.concept_id) ?? []).length;
            if (count !== 1)
                errors.push(`${viewRecord.fileName}: concept_id ${reference.concept_id} 应解析到恰好一个定义，实际为 ${count}`);
        }
    }

    for (const stateRecord of store.states) {
        for (const domain of stateRecord.state.domains) {
            for (const concept of domain.concepts) {
                const explainHasCount = concept.explain_count > 0;
                const explainHasDate = concept.last_explained !== null;
                if (explainHasCount !== explainHasDate) {
                    errors.push(`${displayPath(topicsDir, stateRecord.filePath)}: ${concept.concept_id} 的 explain_count 与 last_explained 不一致`);
                }
                const practiceHasCount = concept.practice_count > 0;
                const practiceHasDate = concept.last_practiced !== null;
                if (practiceHasCount !== practiceHasDate) {
                    errors.push(`${displayPath(topicsDir, stateRecord.filePath)}: ${concept.concept_id} 的 practice_count 与 last_practiced 不一致`);
                }
            }
        }
    }

    for (const stateRecord of store.states) {
        const sessionsDir = join(topicsDir, stateRecord.dirName, 'sessions');
        for (const sessionPath of walkMarkdown(sessionsDir)) {
            const text = readFileSync(sessionPath, 'utf8');
            const header = text.split(/\r?\n/, 20).join('\n');
            const match = header.match(/^>\s*\*\*Concept-IDs:\*\*\s*\[([^\]]*)\]\s*$/m);
            const shown = displayPath(topicsDir, sessionPath);
            if (!match) {
                errors.push(`${shown}: 会话头部缺少 Concept-IDs 数组`);
                continue;
            }
            const conceptIds = match[1].split(',').map((item) => item.trim()).filter(Boolean);
            if (conceptIds.length === 0) {
                errors.push(`${shown}: Concept-IDs 数组不能为空`);
                continue;
            }
            for (const conceptId of conceptIds) {
                const count = (store.definitions.get(conceptId) ?? []).length;
                if (count !== 1)
                    errors.push(`${shown}: Concept-IDs 中的 ${conceptId} 应解析到恰好一个定义，实际为 ${count}`);
            }
        }
    }
    return errors;
}

function main() {
    const topicsDir = resolve(process.argv[2] ?? '.learn/topics');
    const errors = validateLearningStore(topicsDir);
    if (errors.length > 0) {
        console.error(`学习存储校验失败（${errors.length} 项）：`);
        for (const error of errors)
            console.error(`- ${error}`);
        process.exitCode = 1;
        return;
    }
    console.log(`学习存储校验通过：${topicsDir}`);
}

const isMain = process.argv[1] != null && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain)
    main();
