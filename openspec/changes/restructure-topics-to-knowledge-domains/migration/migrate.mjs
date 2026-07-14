#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHANGE_ROOT = resolve(HERE, '..');
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..');
const CREATED = '2026-07-14';

const DEFAULT_PATHS = {
  manifest: join(HERE, 'merge-manifest.json'),
  sessionsMap: join(HERE, 'sessions-map.json'),
  snapshot: join(CHANGE_ROOT, 'baseline', 'concepts-v1-snapshot.json'),
  domainMapping: join(HERE, 'domain-mapping.md'),
};

const SPLIT_DETAIL_ASSIGNMENTS = new Map([
  [
    '知识增强科研问答智能体|LLM 基础与本地部署|大语言模型 LLM 基本原理',
    new Map([
      ['llm-工作原理与-token', [0]],
      ['大模型预训练-pretraining', [1]],
      ['本地大模型部署与推理', [2]],
    ]),
  ],
  [
    '知识增强科研问答智能体|LLM 基础与本地部署|提示词 Prompt 与上下文管理',
    new Map([
      ['prompt-工程', [0]],
      ['上下文设计与管理', [1, 2]],
    ]),
  ],
  [
    'ai-agent-应用开发|Agent 智能体|Agent 架构与 ReAct 模式',
    new Map([
      ['agent-架构基础', []],
      ['react-推理与行动循环', []],
    ]),
  ],
]);

function sourceKey(source) {
  return `${source.topic}|${source.domain}|${source.concept}`;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function pushUnique(target, values) {
  const seen = new Set(target);
  for (const value of values) {
    if (!seen.has(value)) {
      target.push(value);
      seen.add(value);
    }
  }
}

/** 与 build-manifest.mjs 完全相同的 slugify。 */
export function slugify(name) {
  const id = name
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  if (id.length === 0 || id.length > 64)
    throw new Error(`非法 slug: "${id}"（来自 "${name}"）`);
  return id;
}

export function parseDomainMapping(markdown) {
  const mapping = new Map();
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^\|\s*\d+\s*\|\s*(.*?)\s*\|\s*`([^`]+)`\s*\|$/);
    if (!match)
      continue;
    const [, topic, slug] = match;
    mapping.set(slug, { slug, topic });
  }
  if (mapping.size !== 10)
    throw new Error(`domain-mapping.md 应包含 10 个领域，实际为 ${mapping.size}`);
  return mapping;
}

export function parseSessionDate(sessionPath) {
  const modern = sessionPath.match(/--(\d{4}-\d{2}-\d{2})--/);
  if (modern)
    return modern[1];
  const legacy = sessionPath.match(/-(\d{4}-\d{2}-\d{2})\.md$/);
  if (legacy)
    return legacy[1];
  throw new Error(`无法从会话文件名提取日期：${sessionPath}`);
}

function latestActivity(source) {
  return [source.last_explained, source.last_practiced].filter(Boolean).sort().at(-1) ?? '';
}

function selectStatus(sources, explainCount) {
  const maxConfidence = Math.max(...sources.map((item) => item.snapshot.confidence));
  const candidates = sources.filter((item) => item.snapshot.confidence === maxConfidence);
  let selected = candidates[0];
  for (const candidate of candidates.slice(1)) {
    if (latestActivity(candidate.snapshot) > latestActivity(selected.snapshot))
      selected = candidate;
  }
  if (explainCount > 0 && sources.every((item) => item.snapshot.status === 'unexplored'))
    return 'in_progress';
  return selected.snapshot.status;
}

function renderKnowledgeMap(domain) {
  const lines = [`# ${domain.topic}`, ''];
  for (const subdomain of domain.domains) {
    lines.push(`## ${subdomain.name}`, '');
    for (const concept of subdomain.concepts) {
      lines.push(`- ${concept.name}`);
      for (const detail of concept.details)
        lines.push(`  - ${detail}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

export function buildMigrationModel({ snapshot, manifest, sessionsMap, domainMapping }) {
  if (snapshot.length !== 158 || manifest.length !== 158)
    throw new Error(`冻结输入计数错误：snapshot=${snapshot.length}, manifest=${manifest.length}`);
  if (sessionsMap.length !== 36)
    throw new Error(`sessions-map 应为 36 条，实际为 ${sessionsMap.length}`);

  const snapshotByKey = new Map(snapshot.map((item) => [sourceKey(item), item]));
  const manifestByKey = new Map();
  const targetRecords = new Map();
  const domainsBySlug = new Map();

  for (const [manifestIndex, entry] of manifest.entries()) {
    const key = sourceKey(entry.source);
    const source = snapshotByKey.get(key);
    if (!source)
      throw new Error(`manifest 来源不在 snapshot：${key}`);
    if (manifestByKey.has(key))
      throw new Error(`manifest 来源重复：${key}`);
    manifestByKey.set(key, entry);
    for (const target of entry.targets) {
      if (!domainMapping.has(target.target_domain))
        throw new Error(`未知目标领域：${target.target_domain}`);
      let record = targetRecords.get(target.concept_id);
      if (!record) {
        record = {
          concept_id: target.concept_id,
          name: target.name,
          target_domain: target.target_domain,
          target_subdomain: target.target_subdomain,
          firstIndex: manifestIndex,
          sources: [],
        };
        targetRecords.set(target.concept_id, record);
      }
      else if (
        record.name !== target.name
        || record.target_domain !== target.target_domain
        || record.target_subdomain !== target.target_subdomain
      ) {
        throw new Error(`目标定义元数据冲突：${target.concept_id}`);
      }
      record.sources.push({ entry, snapshot: source, key });
    }
  }
  if (manifestByKey.size !== snapshotByKey.size)
    throw new Error(`manifest 与 snapshot 未一一覆盖：${manifestByKey.size}/${snapshotByKey.size}`);
  if (targetRecords.size !== 151)
    throw new Error(`目标概念数应为 151，实际为 ${targetRecords.size}`);

  const eventsByConcept = new Map();
  const allTriples = new Set();
  for (const session of sessionsMap) {
    if (session.activity_type !== 'explain')
      throw new Error(`不支持的 activity_type：${session.activity_type}`);
    const date = parseSessionDate(session.source_session_path);
    for (const conceptId of session.concept_ids) {
      if (!targetRecords.has(conceptId))
        throw new Error(`session 引用了未知目标：${conceptId}`);
      const triple = `${session.source_session_path}\0${session.activity_type}\0${conceptId}`;
      if (allTriples.has(triple))
        throw new Error(`学习事件三元组重复：${session.source_session_path} / ${conceptId}`);
      allTriples.add(triple);
      const events = eventsByConcept.get(conceptId) ?? [];
      events.push({ session, date });
      eventsByConcept.set(conceptId, events);
    }
  }
  if (allTriples.size !== 50)
    throw new Error(`explain 事件三元组应为 50，实际为 ${allTriples.size}`);

  const concepts = new Map();
  const conceptLocations = new Map();
  for (const record of targetRecords.values()) {
    const events = eventsByConcept.get(record.concept_id) ?? [];
    const baseDetails = [];
    for (const source of record.sources) {
      if (source.entry.action !== 'split')
        pushUnique(baseDetails, source.snapshot.details);
    }
    for (const source of record.sources) {
      if (source.entry.action !== 'split')
        continue;
      const assignments = SPLIT_DETAIL_ASSIGNMENTS.get(source.key);
      if (!assignments)
        throw new Error(`缺少 split details 分配：${source.key}`);
      const indexes = assignments.get(record.concept_id);
      if (indexes == null)
        throw new Error(`split 未覆盖目标 ${record.concept_id}：${source.key}`);
      pushUnique(baseDetails, indexes.map((index) => source.snapshot.details[index]));
    }
    const confidence = Math.max(...record.sources.map((item) => item.snapshot.confidence));
    const concept = {
      concept_id: record.concept_id,
      name: record.name,
      status: selectStatus(record.sources, events.length),
      confidence,
      practice_count: 0,
      explain_count: events.length,
      last_explained: events.length === 0 ? null : events.map((item) => item.date).sort().at(-1),
      last_practiced: null,
      details: baseDetails,
    };
    concepts.set(record.concept_id, concept);
    conceptLocations.set(record.concept_id, {
      target_domain: record.target_domain,
      target_subdomain: record.target_subdomain,
      name: record.name,
    });

    let domain = domainsBySlug.get(record.target_domain);
    if (!domain) {
      const mapped = domainMapping.get(record.target_domain);
      domain = {
        slug: record.target_domain,
        topic: mapped.topic,
        created: CREATED,
        subdomains: new Map(),
      };
      domainsBySlug.set(record.target_domain, domain);
    }
    let subdomain = domain.subdomains.get(record.target_subdomain);
    if (!subdomain) {
      subdomain = {
        name: record.target_subdomain,
        slug: slugify(record.target_subdomain),
        concepts: [],
      };
      domain.subdomains.set(record.target_subdomain, subdomain);
    }
    subdomain.concepts.push(concept);
  }

  const domains = [...domainsBySlug.values()].map((domain) => ({
    slug: domain.slug,
    topic: domain.topic,
    state: {
      version: 2,
      kind: 'knowledge_domain',
      topic: domain.topic,
      slug: domain.slug,
      created: domain.created,
      domains: [...domain.subdomains.values()],
    },
  }));

  const viewsByTopic = new Map();
  for (const source of snapshot) {
    let record = viewsByTopic.get(source.topic);
    if (!record) {
      record = { ids: [], seen: new Set() };
      viewsByTopic.set(source.topic, record);
    }
    const entry = manifestByKey.get(sourceKey(source));
    for (const target of entry.targets) {
      if (!record.seen.has(target.concept_id)) {
        record.ids.push(target.concept_id);
        record.seen.add(target.concept_id);
      }
    }
  }
  const views = [...viewsByTopic.entries()].map(([topic, record]) => ({
    fileName: `${topic}.view.json`,
    view: {
      version: 2,
      kind: 'learning_view',
      name: topic,
      slug: topic,
      created: CREATED,
      concepts: record.ids.map((conceptId) => ({ concept_id: conceptId, importance: 'core' })),
    },
  }));
  if (views.length !== 6)
    throw new Error(`学习视图数应为 6，实际为 ${views.length}`);

  const sessions = sessionsMap.map((session) => {
    const primary = session.concept_ids[0];
    const location = conceptLocations.get(primary);
    if (location.target_domain !== session.target_domain || location.target_subdomain !== session.target_subdomain)
      throw new Error(`session primary 落点与映射不一致：${session.source_session_path}`);
    return { ...session, date: parseSessionDate(session.source_session_path), location };
  });

  return {
    domains,
    concepts,
    conceptLocations,
    views,
    sessions,
    explainEventTotal: allTriples.size,
  };
}

function extractHeaderValue(lines, names) {
  for (const line of lines) {
    for (const name of names) {
      const match = line.match(new RegExp(`^>\\s*\\*\\*${name}\\*\\*\\s*(.*)$`));
      if (match)
        return match[1].trim();
    }
  }
  return null;
}

export function rewriteSessionHeader(sourceText, options) {
  const text = sourceText.replace(/^\uFEFF/, '');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const separator = text.match(/^---(?=\r?$)/m);
  if (!separator)
    throw new Error('会话文件缺少头部 --- 分隔线');
  const prefix = text.slice(0, separator.index);
  const lines = prefix.split(/\r?\n/);
  const title = lines.find((line) => line.startsWith('# ')) ?? `# ${options.primaryName} — 学习会话`;
  const date = extractHeaderValue(lines, ['Date:', 'Date：', '日期:', '日期：']) ?? options.date;
  const path = extractHeaderValue(lines, ['Path:', 'Path：', '路径:', '路径：'])
    ?? `${options.targetSubdomain} → ${options.primaryName}`;
  const level = extractHeaderValue(lines, ['Level:', 'Level：', '水平:', '水平：']) ?? 'beginner';
  const header = [
    title,
    '',
    `> **Date:** ${date}`,
    `> **Concept-IDs:** [${options.conceptIds.join(', ')}]`,
    `> **Knowledge Domain:** ${options.knowledgeDomain}`,
    `> **Path:** ${path}`,
    `> **Level:** ${level}`,
    '',
    '---',
  ].join(eol);
  return header + text.slice(separator.index + 3);
}

export function ensureMigrationCanRun(learnDir, sourceTopics) {
  const topicsDir = join(learnDir, 'topics');
  if (!existsSync(topicsDir))
    throw new Error(`topics 目录不存在：${topicsDir}`);
  for (const entry of readdirSync(topicsDir, { withFileTypes: true })) {
    if (!entry.isDirectory())
      continue;
    const statePath = join(topicsDir, entry.name, 'state.json');
    if (!existsSync(statePath))
      continue;
    const state = readJson(statePath);
    if (state.version === 2 || state.kind === 'knowledge_domain')
      throw new Error(`已存在 v2 知识领域 ${entry.name}，拒绝重跑迁移`);
  }
  const legacyDir = join(learnDir, 'legacy-v1-topics');
  if (existsSync(legacyDir))
    throw new Error(`legacy-v1-topics 已存在，拒绝覆盖：${legacyDir}`);
  for (const topic of sourceTopics) {
    if (!existsSync(join(topicsDir, topic)))
      throw new Error(`缺少冻结 v1 topic：${topic}`);
  }
}

export function commitStagedStore({ topicsDir, legacyDir, stagingDir, rename = renameSync }) {
  let legacyMoved = false;
  try {
    rename(topicsDir, legacyDir);
    legacyMoved = true;
    rename(stagingDir, topicsDir);
  }
  catch (error) {
    if (legacyMoved) {
      try {
        rename(legacyDir, topicsDir);
      }
      catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          '安装 v2 topics 失败，且 v1 topics 自动回滚失败，请人工恢复目录',
        );
      }
    }
    throw error;
  }
}

export function migrateStore({ learnDir, manifest, sessionsMap, snapshot, domainMapping }) {
  const sourceTopics = [...new Set(snapshot.map((item) => item.topic))];
  ensureMigrationCanRun(learnDir, sourceTopics);
  const model = buildMigrationModel({ snapshot, manifest, sessionsMap, domainMapping });
  const topicsDir = join(learnDir, 'topics');
  const legacyDir = join(learnDir, 'legacy-v1-topics');
  const stagingDir = join(learnDir, '.topics-v2-staging');
  if (existsSync(stagingDir))
    throw new Error(`迁移 staging 已存在，请人工检查：${stagingDir}`);
  mkdirSync(stagingDir, { recursive: false });

  try {
    for (const domain of model.domains) {
      const domainDir = join(stagingDir, domain.slug);
      mkdirSync(domainDir, { recursive: true });
      writeJson(join(domainDir, 'state.json'), domain.state);
      writeFileSync(join(domainDir, 'knowledge-map.md'), renderKnowledgeMap({
        topic: domain.topic,
        domains: domain.state.domains,
      }), 'utf8');
    }
    for (const view of model.views)
      writeJson(join(stagingDir, view.fileName), view.view);

    const destinations = new Set();
    for (const session of model.sessions) {
      const sourcePath = join(topicsDir, session.source_session_path);
      if (!existsSync(sourcePath))
        throw new Error(`会话源文件不存在：${session.source_session_path}`);
      const destination = join(
        stagingDir,
        session.target_domain,
        'sessions',
        slugify(session.target_subdomain),
        basename(session.source_session_path),
      );
      if (destinations.has(destination))
        throw new Error(`会话目标路径冲突：${destination}`);
      destinations.add(destination);
      mkdirSync(dirname(destination), { recursive: true });
      const rewritten = rewriteSessionHeader(readFileSync(sourcePath, 'utf8'), {
        date: session.date,
        conceptIds: session.concept_ids,
        knowledgeDomain: domainMapping.get(session.target_domain).topic,
        targetSubdomain: session.target_subdomain,
        primaryName: session.location.name,
      });
      writeFileSync(destination, rewritten, 'utf8');
    }

    commitStagedStore({ topicsDir, legacyDir, stagingDir });
  }
  catch (error) {
    if (existsSync(stagingDir))
      rmSync(stagingDir, { recursive: true, force: true });
    throw error;
  }

  return {
    domains: model.domains.length,
    concepts: model.concepts.size,
    views: model.views.length,
    sessions: model.sessions.length,
    explainEvents: model.explainEventTotal,
    legacyDir,
  };
}

function parseArgs(args) {
  let learnDir = join(REPO_ROOT, '.learn');
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--learn-dir' && args[index + 1]) {
      learnDir = resolve(args[++index]);
    }
    else {
      throw new Error(`未知参数：${args[index]}`);
    }
  }
  return { learnDir };
}

function main() {
  try {
    const { learnDir } = parseArgs(process.argv.slice(2));
    const manifest = readJson(DEFAULT_PATHS.manifest);
    const sessionsMap = readJson(DEFAULT_PATHS.sessionsMap);
    const snapshot = readJson(DEFAULT_PATHS.snapshot);
    const domainMapping = parseDomainMapping(readFileSync(DEFAULT_PATHS.domainMapping, 'utf8'));
    const result = migrateStore({ learnDir, manifest, sessionsMap, snapshot, domainMapping });
    console.log('迁移完成：');
    console.log(`- 知识领域：${result.domains}`);
    console.log(`- 概念定义：${result.concepts}`);
    console.log(`- 学习视图：${result.views}`);
    console.log(`- 会话文件：${result.sessions}`);
    console.log(`- explain 事件三元组：${result.explainEvents}`);
    console.log(`- v1 旧树：${result.legacyDir}`);
  }
  catch (error) {
    console.error(`迁移失败：${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] != null && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain)
  main();
