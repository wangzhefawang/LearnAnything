import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SKILLS = ['topic', 'explain', 'practice', 'quiz', 'review', 'status'];

function read(relativePath) {
    return readFileSync(join(ROOT, relativePath), 'utf8');
}

function skill(name) {
    return read(`.claude/skills/learn-anything-${name}/SKILL.md`);
}

for (const name of SKILLS) {
    test(`${name} declares the shared v2 store and concept resolution contract`, () => {
        const text = skill(name);
        assert.match(text, /state\.json v2|version\s*:\s*2/i, `${name}: v2 state`);
        assert.match(text, /knowledge_domain/, `${name}: knowledge_domain kind`);
        assert.match(text, /learning_view/, `${name}: learning_view kind`);
        assert.match(text, /concept_id.*(?:权威|authoritative)/i, `${name}: concept_id authority`);
        assert.match(text, /歧义|ambiguous/i, `${name}: ambiguous resolution`);
        assert.match(text, /version.?1|v1/i, `${name}: v1 detection`);
        assert.match(text, /缺少\s*`?kind`?|missing.+kind/i, `${name}: missing kind detection`);
        assert.match(text, /停止|stop/i, `${name}: v1 refusal`);
        assert.match(text, /node scripts\/render-views\.mjs \.learn\/topics/, `${name}: same-turn view refresh`);
    });
}

test('topic skill distinguishes knowledge-domain maintenance from view assembly', () => {
    const text = skill('topic');
    assert.match(text, /知识领域模式/);
    assert.match(text, /视图组装模式/);
    assert.match(text, /已有.*知识领域|existing knowledge domains/i);
    assert.match(text, /确实.*(?:无法.*容纳|容纳不了).*(?:create|新建)/is);
    assert.match(text, /importance.*core.*recommended.*optional/s);
    assert.match(text, /严禁.*独立概念树/s);
    assert.match(text, /validate-learning-store\.mjs \.learn\/topics/);
    assert.match(text, /NFC/);
    assert.match(text, /64/);
});

test('explain skill writes one multi-concept session under the owning domain', () => {
    const text = skill('explain');
    assert.match(text, /sessions\/<子域-slug>/);
    assert.match(text, /<概念名原样>--YYYY-MM-DD--<子主题-kebab>\.md/);
    for (const field of ['Date:', 'Concept-IDs:', 'Knowledge Domain:', 'Path:', 'Level:'])
        assert.match(text, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(text, /primary.*(?:first|首位)|(?:first|首位).*primary/i);
    assert.match(text, /(?:multiple concepts|多概念).*?(?:exactly one|只写一份)|(?:exactly one|只写一份).*?(?:multiple concepts|多概念)/is);
});

test('practice uses a concept_id directory in the owning domain', () => {
    assert.match(skill('practice'), /<知识领域>\/exercises\/<concept_id>/);
});

test('quiz uses a concept_id directory and only covers learned concepts', () => {
    const quiz = skill('quiz');
    assert.match(quiz, /<知识领域>\/quizzes\/<concept_id>/);
    assert.match(quiz, /explain_count\s*>\s*0/);
    assert.match(quiz, /status\s*!==?\s*["'`]unexplored["'`]/);
});

test('review supports domain and view scopes with importance as tie-breaker only', () => {
    const text = skill('review');
    assert.match(text, /知识领域名.*视图名|视图名.*知识领域名/s);
    assert.match(text, /view\.json/);
    assert.match(text, /importance.*priority.*(?:equal|相同)/is);
    assert.match(text, /core\s*>\s*recommended\s*>\s*optional/);
    assert.match(text, /来自.*知识领域|state which knowledge domain owns/is);
    assert.match(text, /priority = \(1 - confidence\).*days_since_last_practice.*w/s);
});

test('status skill delegates both scopes to the v2 CLI', () => {
    const text = skill('status');
    assert.match(text, /status\.mjs \[--locale zh-CN\] \.learn\/topics <名称>/);
    assert.match(text, /--all/);
    assert.match(text, /知识领域.*视图|视图.*知识领域|knowledge domains.*learning views|learning views.*knowledge domains/is);
});

test('command stubs stay lightweight and use v2 terminology', () => {
    for (const name of SKILLS) {
        const text = read(`.claude/commands/learn/${name}.md`);
        assert.ok(Buffer.byteLength(text) < 1300, `${name}: command stub copied too much logic`);
        assert.doesNotMatch(text, /state\.json \(v1|render\.mjs|<topic-name>|<topic>/i, `${name}: stale v1 detail`);
        assert.match(text, /learn-anything-/);
    }
});

test('prompt files use the actual /learn:* command namespace', () => {
    const files = [
        ...SKILLS.map((name) => `.claude/skills/learn-anything-${name}/SKILL.md`),
        ...SKILLS.map((name) => `.claude/commands/learn/${name}.md`),
        'CLAUDE.md',
    ];
    for (const file of files)
        assert.doesNotMatch(read(file), /\/learn-(?:topic|explain|practice|quiz|review|status)/, file);
});

test('CLAUDE.md describes only the v2 contract and keeps required invariants', () => {
    const text = read('CLAUDE.md');
    assert.doesNotMatch(text, /state\.yaml/);
    assert.doesNotMatch(text, /开始学习时同步跨 topic 知识点进度/);
    assert.match(text, /state\.json.*version.*2/is);
    assert.match(text, /concept_id/);
    assert.match(text, /\.view\.json/);
    assert.match(text, /自动生成.*\.md|\.md.*自动生成/s);
    assert.match(text, /validate-learning-store\.mjs/);
    assert.match(text, /render-views\.mjs/);
    assert.match(text, /Concept-IDs:/);
    assert.match(text, /unexplored.*in_progress.*needs_practice.*mastered/s);
    assert.match(text, /priority = \(1 - confidence\).*days_since_last_practice.*w/s);
    assert.match(text, /同回合.*render-views\.mjs/s);
});

test('SessionEnd refreshes views before git and ignores render failure', () => {
    const settings = JSON.parse(read('.claude/settings.json'));
    const command = settings.hooks.SessionEnd[0].hooks[0].command;
    assert.ok(command.indexOf('node scripts/render-views.mjs .learn/topics') >= 0);
    assert.ok(command.indexOf('node scripts/render-views.mjs .learn/topics') < command.indexOf('git add -A'));
    assert.match(command, /LASTEXITCODE|try|2>\$null/i);
});

test('teaching and persistence invariants remain present', () => {
    assert.match(skill('explain'), /Analogies build intuition/);
    assert.match(skill('explain'), /Socratic, not interrogative/);
    assert.match(skill('explain'), /confidence < 0\.3/);
    assert.match(skill('practice'), /Socratic Feedback/);
    assert.match(skill('practice'), /Dynamic Difficulty/);
    assert.match(skill('quiz'), /multiple_choice.*true_false.*fill_in_blank.*error_correction/s);
    assert.match(skill('quiz'), /⚠️|CRITICAL/);
});
