#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    aggregateView,
    LearningStoreError,
    loadLearningStore,
    renderViewMarkdown,
} from './learning-store-lib.mjs';

function parseArgs(args) {
    let check = false;
    let topicsDir;
    for (const arg of args) {
        if (arg === '--check')
            check = true;
        else if (arg.startsWith('--'))
            throw new Error(`未知参数：${arg}`);
        else if (topicsDir == null)
            topicsDir = arg;
        else
            throw new Error(`多余参数：${arg}`);
    }
    return { check, topicsDir: resolve(topicsDir ?? '.learn/topics') };
}

function main() {
    try {
        const { check, topicsDir } = parseArgs(process.argv.slice(2));
        const store = loadLearningStore(topicsDir);
        const stale = [];
        for (const viewRecord of store.views) {
            const expected = renderViewMarkdown(aggregateView(store, viewRecord));
            if (check) {
                const actual = existsSync(viewRecord.reportPath)
                    ? readFileSync(viewRecord.reportPath, 'utf8')
                    : null;
                if (actual !== expected)
                    stale.push(viewRecord.reportPath);
            }
            else {
                const actual = existsSync(viewRecord.reportPath)
                    ? readFileSync(viewRecord.reportPath, 'utf8')
                    : null;
                if (actual !== expected)
                    writeFileSync(viewRecord.reportPath, expected, 'utf8');
            }
        }
        if (check && stale.length > 0) {
            console.error('以下视图报告已过期：');
            for (const filePath of stale)
                console.error(`- ${filePath}`);
            process.exitCode = 1;
            return;
        }
        console.log(check ? '所有视图报告均为最新。' : `已渲染 ${store.views.length} 份视图报告。`);
    }
    catch (error) {
        if (error instanceof LearningStoreError) {
            console.error('视图渲染失败：');
            for (const message of error.errors)
                console.error(`- ${message}`);
        }
        else {
            console.error(`视图渲染失败：${error instanceof Error ? error.message : String(error)}`);
        }
        process.exitCode = 1;
    }
}

main();
