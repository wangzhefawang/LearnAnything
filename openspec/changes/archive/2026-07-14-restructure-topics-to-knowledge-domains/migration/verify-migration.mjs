#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadLearningStore } from '../../../../scripts/learning-store-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..');

function result(label, ok, actual) {
  return { label, ok, actual };
}

function exactConcept(concepts, conceptId, expected) {
  const concept = concepts.get(conceptId);
  if (!concept)
    return result(`${conceptId} 存在`, false, '缺失');
  const pairs = Object.entries(expected);
  const ok = pairs.every(([field, value]) => Object.is(concept[field], value));
  const expectedText = pairs.map(([field, value]) => `${field}=${String(value)}`).join(', ');
  const actual = Object.fromEntries(pairs.map(([field]) => [field, concept[field]]));
  return result(`${conceptId} ${expectedText}`, ok, actual);
}

export function assertExactExpectations({ concepts, domainCount, viewCount, sessionCount }) {
  const results = [
    result('知识领域总数=10', domainCount === 10, domainCount),
    result('目标概念定义总数=151', concepts.size === 151, concepts.size),
    result('view 总数=6', viewCount === 6, viewCount),
    result('会话文件总数=36', sessionCount === 36, sessionCount),
    exactConcept(concepts, 'transformer-架构', {
      explain_count: 7,
      confidence: 0.55,
      last_explained: '2026-07-02',
    }),
    exactConcept(concepts, 'adas-noa-功能定义', {
      explain_count: 4,
      confidence: 0.25,
    }),
    exactConcept(concepts, '端到端与大模型智驾落地', {
      explain_count: 3,
      confidence: 0.15,
    }),
    exactConcept(concepts, 'prompt-工程', {
      explain_count: 1,
      last_explained: '2026-06-10',
      practice_count: 0,
      last_practiced: null,
    }),
    exactConcept(concepts, '文档解析与分块', {
      explain_count: 2,
      confidence: 0.2,
    }),
    exactConcept(concepts, '功能安全-iso-26262', {
      explain_count: 1,
      last_explained: '2026-07-12',
      status: 'in_progress',
    }),
    exactConcept(concepts, 'function-calling-工具调用', {
      confidence: 0.05,
      explain_count: 1,
    }),
    exactConcept(concepts, '机器人测试用例设计方法', {
      explain_count: 2,
      confidence: 0.1,
    }),
  ];
  const explainTotal = [...concepts.values()]
    .reduce((sum, concept) => sum + concept.explain_count, 0);
  results.push(result('全库 explain 事件三元组总和=50', explainTotal === 50, explainTotal));
  const practiceClean = [...concepts.values()]
    .every((concept) => concept.practice_count === 0 && concept.last_practiced === null);
  results.push(result('全库 practice_count=0 且 last_practiced=null', practiceClean, practiceClean));
  return results;
}

function collectSessionFiles(topicsDir) {
  const files = [];
  function visit(directory, insideSessions) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory())
        visit(path, insideSessions || entry.name === 'sessions');
      else if (insideSessions && entry.isFile() && entry.name.endsWith('.md'))
        files.push(path);
    }
  }
  visit(topicsDir, false);
  return files;
}

function verifySessionHeaders(sessionFiles, definitions) {
  const errors = [];
  for (const filePath of sessionFiles) {
    const header = readFileSync(filePath, 'utf8').split(/\r?\n/, 20).join('\n');
    const match = header.match(/^>\s*\*\*Concept-IDs:\*\*\s*\[([^\]]*)\]\s*$/m);
    if (!match) {
      errors.push(`${filePath}: 缺少 Concept-IDs`);
      continue;
    }
    const ids = match[1].split(',').map((value) => value.trim()).filter(Boolean);
    for (const conceptId of ids) {
      const count = definitions.get(conceptId)?.length ?? 0;
      if (count !== 1)
        errors.push(`${filePath}: ${conceptId} 解析到 ${count} 个定义`);
    }
  }
  if (errors.length > 0)
    throw new Error(errors.join('\n'));
}

function runNode(scriptPath, args) {
  const command = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (command.error)
    throw command.error;
  if (command.status !== 0) {
    const output = [command.stdout, command.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${scriptPath} 退出码 ${command.status}${output ? `\n${output}` : ''}`);
  }
  return command.stdout.trim();
}

export function verifyMigration({ topicsDir = join(REPO_ROOT, '.learn', 'topics') } = {}) {
  const absoluteTopics = resolve(topicsDir);
  const store = loadLearningStore(absoluteTopics);
  const concepts = new Map();
  for (const [conceptId, definitions] of store.definitions) {
    if (definitions.length !== 1)
      throw new Error(`${conceptId} 应恰有一个定义，实际为 ${definitions.length}`);
    concepts.set(conceptId, definitions[0].concept);
  }
  const sessionFiles = collectSessionFiles(absoluteTopics);
  verifySessionHeaders(sessionFiles, store.definitions);
  const results = assertExactExpectations({
    concepts,
    domainCount: store.states.length,
    viewCount: store.views.length,
    sessionCount: sessionFiles.length,
  });
  const failures = results.filter((item) => !item.ok);
  if (failures.length > 0) {
    throw new Error(failures.map((item) => `${item.label}，实际：${JSON.stringify(item.actual)}`).join('\n'));
  }

  const validatorOutput = runNode(join(REPO_ROOT, 'scripts', 'validate-learning-store.mjs'), [absoluteTopics]);
  const rendererOutput = runNode(join(REPO_ROOT, 'scripts', 'render-views.mjs'), [absoluteTopics, '--check']);
  return { results, sessionHeaders: sessionFiles.length, validatorOutput, rendererOutput };
}

function parseArgs(args) {
  let topicsDir = join(REPO_ROOT, '.learn', 'topics');
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--topics-dir' && args[index + 1])
      topicsDir = args[++index];
    else
      throw new Error(`未知参数：${args[index]}`);
  }
  return { topicsDir };
}

function main() {
  try {
    const verification = verifyMigration(parseArgs(process.argv.slice(2)));
    console.log('迁移验证通过：');
    for (const item of verification.results)
      console.log(`- 通过：${item.label}`);
    console.log(`- 通过：${verification.sessionHeaders} 份会话的 Concept-IDs 全部唯一解析`);
    console.log(`- 通过：${verification.validatorOutput}`);
    console.log(`- 通过：${verification.rendererOutput}`);
  }
  catch (error) {
    console.error(`迁移验证失败：${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] != null && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain)
  main();
