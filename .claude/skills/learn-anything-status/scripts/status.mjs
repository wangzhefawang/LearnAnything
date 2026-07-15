#!/usr/bin/env node
/**
 * status.mjs — standalone script
 * Reads the v2 learning store and outputs a formatted learning heatmap to stdout.
 *
 * Usage:
 *   node status.mjs <topics-dir> <name>                  Domain or view heatmap
 *   node status.mjs --locale zh-CN <topics-dir> <name>   Chinese heatmap
 *   node status.mjs --all [--locale zh-CN] <topics-dir>  All domains and views
 *
 * This file is compiled from src/scripts/status.mts via tsc and
 * copied into learn-anything-status skill's scripts/ directory by init/update.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateStateV2, totalCount, masteredCount, STATUS_ICON, } from './utils.mjs';
import {
    aggregateView,
    formatConfidence,
    IMPORTANCE_LABEL,
    LearningStoreError,
    loadLearningStore,
    STATUS_LABEL,
    stateSummary,
    viewSummary,
} from '../../../../scripts/learning-store-lib.mjs';
const EN = {
    title: (topic) => `🌟 ${topic} Learning Status`,
    mastered: 'Mastered',
    active: 'Active',
    practice: 'Practice',
    unexplored: 'Unexplored',
    progress: 'Progress',
    statsTitle: '📊 Learning Stats',
    lastPractice: (name, rel) => `💪 Last Practice: ${name} (${rel})`,
    startedLearning: (date) => `📅 Started Learning: ${date}`,
    daysLearning: (days) => `⏱️  Days Learning: ${days}`,
    legend: 'Legend',
    statusLabel: {
        mastered: 'mastered',
        in_progress: 'in progress',
        needs_practice: 'needs practice',
        unexplored: 'unexplored',
    },
    statusMeaning: {
        mastered: 'Mastered — passed practice, high confidence',
        in_progress: 'In Progress — started but not yet mastered',
        needs_practice: 'Needs Practice — understand but need reinforcement',
        unexplored: 'Unexplored — haven\'t started learning yet',
    },
    practiceCount: (n) => n === 1 ? '1 practice' : `${n} practices`,
    confidence: (pct) => `${pct}% confidence`,
    relativeToday: 'today',
    relativeYesterday: 'yesterday',
    relativeDaysAgo: (n) => `${n} days ago`,
    allTopicsTitle: '🌟 Learning Status — All Topics',
    topic: 'Topic',
    days: 'Days',
    total: 'Total',
    noTopics: '📭 No learning topics found.',
    startJourney: 'Run `/learn <topic-name>` to start your learning journey!',
    noData: (path) => `📭 No learning data found at ${path}`,
};
const ZH_CN = {
    title: (topic) => `🌟 ${topic} 学习状态`,
    mastered: STATUS_LABEL.mastered,
    active: STATUS_LABEL.in_progress,
    practice: STATUS_LABEL.needs_practice,
    unexplored: STATUS_LABEL.unexplored,
    progress: '进度',
    statsTitle: '📊 学习统计',
    lastPractice: (name, rel) => `💪 最近练习: ${name} (${rel})`,
    startedLearning: (date) => `📅 开始学习: ${date}`,
    daysLearning: (days) => `⏱️  学习天数: ${days}`,
    legend: '图例',
    statusLabel: STATUS_LABEL,
    statusMeaning: {
        mastered: '已掌握 — 通过练习，掌握度高',
        in_progress: '学习中 — 已开始但尚未掌握',
        needs_practice: '需练习 — 理解但需要巩固',
        unexplored: '未探索 — 尚未开始学习',
    },
    practiceCount: (n) => n === 1 ? '1 次练习' : `${n} 次练习`,
    confidence: (pct) => `${pct}% 掌握度`,
    relativeToday: '今天',
    relativeYesterday: '昨天',
    relativeDaysAgo: (n) => `${n} 天前`,
    allTopicsTitle: '🌟 学习状态 — 所有主题',
    topic: '主题',
    days: '天数',
    total: '合计',
    noTopics: '📭 暂无学习主题。',
    startJourney: '运行 `/learn <主题名>` 开始你的学习之旅！',
    noData: (path) => `📭 未找到学习数据: ${path}`,
};
const STRINGS = { en: EN, 'zh-CN': ZH_CN };
/* ------------------------------------------------------------------ */
/*  Display width helpers                                             */
/* ------------------------------------------------------------------ */
function dw(s) {
    let w = 0;
    for (const ch of s) {
        const cp = ch.codePointAt(0);
        w += cp > 0xffff || isCJK(cp) ? 2 : 1;
    }
    return w;
}
/** Check if a code point is a CJK / fullwidth character (display width = 2). */
function isCJK(cp) {
    return ((cp >= 0x4e00 && cp <= 0x9fff) // CJK Unified Ideographs
        || (cp >= 0x3400 && cp <= 0x4dbf) // CJK Extension A
        || (cp >= 0xf900 && cp <= 0xfaff) // CJK Compatibility Ideographs
        || (cp >= 0x2e80 && cp <= 0x2eff) // CJK Radicals Supplement
        || (cp >= 0x3000 && cp <= 0x303f) // CJK Symbols and Punctuation
        || (cp >= 0x3040 && cp <= 0x309f) // Hiragana
        || (cp >= 0x30a0 && cp <= 0x30ff) // Katakana
        || (cp >= 0xff01 && cp <= 0xff60) // Fullwidth Forms
        || (cp >= 0xac00 && cp <= 0xd7af) // Hangul Syllables
    );
}
function padEnd(s, width) {
    return s + ' '.repeat(Math.max(0, width - dw(s)));
}
/* ------------------------------------------------------------------ */
/*  Shared helpers                                                    */
/* ------------------------------------------------------------------ */
function countByStatus(state, status) {
    return state.domains.reduce((sum, d) => sum + d.concepts.filter((c) => c.status === status).length, 0);
}
function formatStatusCount(value, status, locale) {
    return locale === 'zh-CN' ? String(value) : `${value} ${STATUS_ICON[status]}`;
}
function relativeDate(dateStr, t, now = Date.now()) {
    const then = new Date(dateStr.replace(' ', 'T')).getTime();
    const days = Math.floor((now - then) / 86400000);
    if (days <= 0)
        return t.relativeToday;
    if (days === 1)
        return t.relativeYesterday;
    return t.relativeDaysAgo(days);
}
function daysBetween(dateStr, now = Date.now()) {
    const then = new Date(dateStr.replace(' ', 'T')).getTime();
    return Math.max(1, Math.floor((now - then) / 86400000));
}
function readStateJson(filePath) {
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    if (data.version === 1 || data.kind == null) {
        throw new Error(`检测到 v1/未迁移格式：${filePath}，请先完成数据迁移`);
    }
    const errors = validateStateV2(data);
    if (errors.length > 0) {
        throw new Error(`state.json validation failed:\n${errors.map((e) => `  .${e.path}: ${e.message}`).join('\n')}`);
    }
    return data;
}
export function renderViewStatus(aggregate, locale = 'en') {
    const t = STRINGS[locale];
    const importance = locale === 'zh-CN'
        ? IMPORTANCE_LABEL
        : { core: 'core', recommended: 'recommended', optional: 'optional' };
    const lines = [t.title(aggregate.viewRecord.view.name), ''];
    for (const [index, item] of aggregate.concepts.entries()) {
        lines.push(`${index + 1}. [${importance[item.importance]}] ${conceptLine(item.concept, t)} · ${item.knowledge_domain}`);
    }
    lines.push('');
    lines.push(locale === 'zh-CN'
        ? `汇总：${aggregate.total} 个概念 · 已掌握 ${aggregate.mastered}/${aggregate.total} · 平均掌握度 ${formatConfidence(aggregate.meanConfidence)}`
        : `Summary: ${aggregate.total} concepts · mastered ${aggregate.mastered}/${aggregate.total} · mean confidence ${formatConfidence(aggregate.meanConfidence)}`);
    lines.push('');
    return lines.join('\n');
}

export function renderAllStore(store, locale = 'en') {
    const domainSummaries = store.states.map(stateSummary);
    const viewSummaries = store.views.map((viewRecord) => viewSummary(store, viewRecord));
    const typeLabel = locale === 'zh-CN'
        ? { knowledge_domain: '知识领域', learning_view: '学习视图' }
        : { knowledge_domain: 'Knowledge Domain', learning_view: 'Learning View' };
    const lines = [
        locale === 'zh-CN' ? '🌟 学习状态 — 所有知识领域与学习视图' : '🌟 Learning Status — All Domains and Views',
        '',
        locale === 'zh-CN'
            ? '| 类型 | 名称 | 概念数 | 平均掌握度 | 已掌握 / 总数 |'
            : '| Type | Name | Concepts | Mean Confidence | Mastered / Total |',
        '| --- | --- | --- | --- | --- |',
    ];
    for (const summary of [...domainSummaries, ...viewSummaries]) {
        lines.push(`| ${typeLabel[summary.kind]} | ${summary.name} | ${summary.total} | ${formatConfidence(summary.meanConfidence)} | ${summary.mastered} / ${summary.total} |`);
    }
    lines.push('');
    return lines.join('\n');
}
/* ------------------------------------------------------------------ */
/*  Single topic — detailed heatmap                                   */
/* ------------------------------------------------------------------ */
function findLastPracticed(state) {
    let best = null;
    for (const d of state.domains) {
        for (const c of d.concepts) {
            if (c.last_practiced && (!best || c.last_practiced > best.date)) {
                best = { name: c.name, date: c.last_practiced };
            }
        }
    }
    return best;
}
function conceptLine(concept, t) {
    const icon = STATUS_ICON[concept.status];
    const label = t.statusLabel[concept.status];
    const subject = label.startsWith(`${icon} `) ? concept.name : `${icon} ${concept.name}`;
    if (concept.status === 'unexplored') {
        return `${subject}  ${label}`;
    }
    const parts = [label];
    if (concept.practice_count > 0)
        parts.push(t.practiceCount(concept.practice_count));
    if (concept.confidence > 0)
        parts.push(t.confidence(Math.round(concept.confidence * 100)));
    return `${subject}  ${parts.join(' · ')}`;
}
export function renderStatus(state, now, locale = 'en') {
    const t = STRINGS[locale];
    const lines = [];
    const total = totalCount(state);
    const mastered = masteredCount(state);
    const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
    // Title
    lines.push(t.title(state.topic));
    lines.push('');
    // Tree-structured heatmap
    for (const domain of state.domains) {
        if (domain.concepts.length === 0)
            continue;
        const domainMastered = domain.concepts.filter((c) => c.status === 'mastered').length;
        lines.push(`${domain.name}  [${domainMastered}/${domain.concepts.length} ${t.mastered.toLowerCase()}]`);
        const last = domain.concepts.length - 1;
        for (let i = 0; i <= last; i++) {
            const prefix = i === last ? '└──' : '├──';
            lines.push(`${prefix} ${conceptLine(domain.concepts[i], t)}`);
        }
        lines.push('');
    }
    // Summary panel — column widths based on locale
    const active = countByStatus(state, 'in_progress');
    const practice = countByStatus(state, 'needs_practice');
    const unexplored = countByStatus(state, 'unexplored');
    // Compute column widths to fit headers + data
    const colM = Math.max(dw(t.mastered) + 2, 10);
    const colA = Math.max(dw(t.active) + 2, 9);
    const colP = Math.max(dw(t.practice) + 2, 10);
    const colU = Math.max(dw(t.unexplored) + 2, 11);
    const colR = Math.max(dw(t.progress) + 2, 9);
    const totalW = 1 + colM + 1 + colA + 1 + colP + 1 + colU + 1 + colR + 1;
    const hLine = '─'.repeat(totalW - 2);
    lines.push(`┌${hLine}┐`);
    lines.push(`│${padEnd(`    ${t.statsTitle}`, totalW - 2)}│`);
    lines.push(`├${'─'.repeat(colM)}┬${'─'.repeat(colA)}┬${'─'.repeat(colP)}┬${'─'.repeat(colU)}┬${'─'.repeat(colR)}┤`);
    lines.push(`│${padEnd(` ${t.mastered}`, colM)}│${padEnd(` ${t.active}`, colA)}│${padEnd(` ${t.practice}`, colP)}│${padEnd(` ${t.unexplored}`, colU)}│${padEnd(` ${t.progress}`, colR)}│`);
    lines.push(`│${padEnd(` ${formatStatusCount(mastered, 'mastered', locale)}`, colM)}│${padEnd(` ${formatStatusCount(active, 'in_progress', locale)}`, colA)}│${padEnd(` ${formatStatusCount(practice, 'needs_practice', locale)}`, colP)}│${padEnd(` ${formatStatusCount(unexplored, 'unexplored', locale)}`, colU)}│${padEnd(` ${pct}%`, colR)}│`);
    lines.push(`├${'─'.repeat(colM)}┴${'─'.repeat(colA)}┴${'─'.repeat(colP)}┴${'─'.repeat(colU)}┴${'─'.repeat(colR)}┤`);
    const contentW = totalW - 2;
    const lastP = findLastPracticed(state);
    if (lastP) {
        const rel = relativeDate(lastP.date, t, now);
        lines.push(`│${padEnd(` ${t.lastPractice(lastP.name, rel)}`, contentW)}│`);
    }
    const started = state.created.split(' ')[0];
    lines.push(`│${padEnd(` ${t.startedLearning(started)}`, contentW)}│`);
    const days = daysBetween(state.created, now);
    lines.push(`│${padEnd(` ${t.daysLearning(days)}`, contentW)}│`);
    lines.push(`└${hLine}┘`);
    lines.push('');
    // Legend
    lines.push(`## ${t.legend}`);
    lines.push('');
    if (locale === 'zh-CN') {
        lines.push(`| Status | Meaning |`);
        lines.push(`|--------|---------|`);
        for (const status of ['mastered', 'in_progress', 'needs_practice', 'unexplored']) {
            lines.push(`| ${t.statusLabel[status]} | ${t.statusMeaning[status]} |`);
        }
    }
    else {
        lines.push(`| Icon | Status | Meaning |`);
        lines.push(`|------|--------|---------|`);
        for (const status of ['mastered', 'in_progress', 'needs_practice', 'unexplored']) {
            lines.push(`| ${STATUS_ICON[status]} | ${t.statusLabel[status]} | ${t.statusMeaning[status]} |`);
        }
    }
    return lines.join('\n').trimEnd() + '\n';
}
function scanTopics(baseDir) {
    const summaries = [];
    let entries;
    try {
        entries = readdirSync(baseDir);
    }
    catch {
        return summaries;
    }
    for (const name of entries) {
        const fullPath = join(baseDir, name);
        try {
            if (!statSync(fullPath).isDirectory())
                continue;
        }
        catch {
            continue;
        }
        const statePath = join(fullPath, 'state.json');
        try {
            const state = readStateJson(statePath);
            const total = totalCount(state);
            const mastered = masteredCount(state);
            let lastPracticed = null;
            for (const d of state.domains) {
                for (const c of d.concepts) {
                    if (c.last_practiced && (!lastPracticed || c.last_practiced > lastPracticed)) {
                        lastPracticed = c.last_practiced;
                    }
                }
            }
            summaries.push({
                topic: state.topic,
                slug: state.slug,
                total,
                mastered,
                active: countByStatus(state, 'in_progress'),
                practice: countByStatus(state, 'needs_practice'),
                unexplored: countByStatus(state, 'unexplored'),
                pct: total > 0 ? Math.round((mastered / total) * 100) : 0,
                lastPracticed,
                days: daysBetween(state.created),
            });
        }
        catch {
            // Skip dirs without valid state.json
        }
    }
    return summaries;
}
export function renderAllTopics(summaries, now, locale = 'en') {
    const t = STRINGS[locale];
    const lines = [];
    lines.push(t.allTopicsTitle);
    lines.push('');
    if (summaries.length === 0) {
        lines.push(t.noTopics);
        lines.push(t.startJourney);
        lines.push('');
        return lines.join('\n').trimEnd() + '\n';
    }
    // Compute column display widths
    const topicCol = Math.max(dw(t.topic) + 2, ...summaries.map((s) => dw(s.topic) + 2));
    const masterCol = Math.max(dw(t.mastered) + 2, 12);
    const activeCol = Math.max(dw(t.active) + 2, 8);
    const practiceCol = Math.max(dw(t.practice) + 2, 10);
    const progressCol = Math.max(dw(t.progress) + 2, 10);
    const daysCol = Math.max(dw(t.days) + 2, 8);
    const sep = `┼${'─'.repeat(topicCol)}┼${'─'.repeat(masterCol)}┼${'─'.repeat(activeCol)}┼${'─'.repeat(practiceCol)}┼${'─'.repeat(progressCol)}┼${'─'.repeat(daysCol)}┤`;
    const top = `┌${'─'.repeat(topicCol)}┬${'─'.repeat(masterCol)}┬${'─'.repeat(activeCol)}┬${'─'.repeat(practiceCol)}┬${'─'.repeat(progressCol)}┬${'─'.repeat(daysCol)}┐`;
    const bot = `└${'─'.repeat(topicCol)}┴${'─'.repeat(masterCol)}┴${'─'.repeat(activeCol)}┴${'─'.repeat(practiceCol)}┴${'─'.repeat(progressCol)}┴${'─'.repeat(daysCol)}┘`;
    lines.push(top);
    lines.push(`│ ${padEnd(t.topic, topicCol - 1)}│ ${padEnd(t.mastered, masterCol - 1)}│ ${padEnd(t.active, activeCol - 1)}│ ${padEnd(t.practice, practiceCol - 1)}│ ${padEnd(t.progress, progressCol - 1)}│ ${padEnd(t.days, daysCol - 1)}│`);
    lines.push(sep);
    for (const s of summaries) {
        lines.push(`│ ${padEnd(s.topic, topicCol - 1)}│ ${padEnd(formatStatusCount(`${s.mastered}/${s.total}`, 'mastered', locale), masterCol - 1)}│ ${padEnd(formatStatusCount(s.active, 'in_progress', locale), activeCol - 1)}│ ${padEnd(formatStatusCount(s.practice, 'needs_practice', locale), practiceCol - 1)}│ ${padEnd(`${s.pct}%`, progressCol - 1)}│ ${padEnd(`${s.days}`, daysCol - 1)}│`);
    }
    // Overall totals
    const grandTotal = summaries.reduce((s, acc) => s + acc.total, 0);
    const grandMastered = summaries.reduce((s, acc) => s + acc.mastered, 0);
    const grandActive = summaries.reduce((s, acc) => s + acc.active, 0);
    const grandPractice = summaries.reduce((s, acc) => s + acc.practice, 0);
    const grandPct = grandTotal > 0 ? Math.round((grandMastered / grandTotal) * 100) : 0;
    lines.push(sep);
    lines.push(`│ ${padEnd(t.total, topicCol - 1)}│ ${padEnd(formatStatusCount(`${grandMastered}/${grandTotal}`, 'mastered', locale), masterCol - 1)}│ ${padEnd(formatStatusCount(grandActive, 'in_progress', locale), activeCol - 1)}│ ${padEnd(formatStatusCount(grandPractice, 'needs_practice', locale), practiceCol - 1)}│ ${padEnd(`${grandPct}%`, progressCol - 1)}│ ${padEnd('', daysCol - 1)}│`);
    lines.push(bot);
    lines.push('');
    // Find latest practice across all topics
    let latestTopic = '';
    let latestDate = null;
    for (const s of summaries) {
        if (s.lastPracticed && (!latestDate || s.lastPracticed > latestDate)) {
            latestDate = s.lastPracticed;
            latestTopic = s.topic;
        }
    }
    if (latestDate) {
        lines.push(t.lastPractice(latestTopic, relativeDate(latestDate, t, now)));
    }
    lines.push('');
    // Legend
    lines.push(`## ${t.legend}`);
    lines.push('');
    if (locale === 'zh-CN') {
        lines.push(`| Status |`);
        lines.push(`|--------|`);
        for (const status of ['mastered', 'in_progress', 'needs_practice', 'unexplored']) {
            lines.push(`| ${t.statusLabel[status]} |`);
        }
    }
    else {
        lines.push(`| Icon | Status |`);
        lines.push(`|------|--------|`);
        for (const status of ['mastered', 'in_progress', 'needs_practice', 'unexplored']) {
            lines.push(`| ${STATUS_ICON[status]} | ${t.statusLabel[status]} |`);
        }
    }
    return lines.join('\n').trimEnd() + '\n';
}
/* ------------------------------------------------------------------ */
/*  CLI                                                               */
/* ------------------------------------------------------------------ */
function usage() {
    const script = process.argv[1]?.split('/').pop() || 'status.mjs';
    console.error(`Usage:`);
    console.error(`  node ${script} [--locale en|zh-CN] <topics-dir> <name>`);
    console.error(`  node ${script} --all [--locale en|zh-CN] <topics-dir>`);
    process.exit(1);
}
function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        usage();
    }
    // Parse flags
    let locale = 'en';
    let isAll = false;
    const positional = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--all') {
            isAll = true;
        }
        else if (args[i] === '--locale' && args[i + 1]) {
            const val = args[++i];
            if (val === 'en' || val === 'zh-CN') {
                locale = val;
            }
            else {
                console.error(`Unknown locale: ${val}. Supported: en, zh-CN`);
                process.exit(1);
            }
        }
        else if (!args[i].startsWith('--'))
            positional.push(args[i]);
    }
    if ((isAll && positional.length !== 1) || (!isAll && positional.length !== 2)) {
        usage();
    }
    const topicsDir = resolve(positional[0]);
    try {
        const store = loadLearningStore(topicsDir);
        if (isAll) {
            console.log(renderAllStore(store, locale));
            return;
        }
        const name = positional[1];
        const viewRecord = store.views.find((item) => item.fileName === `${name}.view.json`);
        if (viewRecord) {
            console.log(renderViewStatus(aggregateView(store, viewRecord), locale));
            return;
        }
        const stateRecord = store.states.find((item) => item.dirName === name);
        if (stateRecord) {
            console.log(renderStatus(stateRecord.state, undefined, locale));
            return;
        }
        console.error(STRINGS[locale].noData(join(topicsDir, name)));
        process.exitCode = 1;
    }
    catch (err) {
        if (err instanceof LearningStoreError) {
            console.error('Error: 学习存储校验失败');
            for (const message of err.errors)
                console.error(`  ${message}`);
        }
        else {
            console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        }
        process.exitCode = 1;
    }
}
const isMain = process.argv[1] != null &&
    fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
    main();
}
//# sourceMappingURL=status.mjs.map
