/**
 * utils.mts — shared types, validation, and helpers for scripts.
 *
 * This file is compiled from src/scripts/utils.mts via tsc and
 * copied into each skill's scripts/ directory by init/update.
 * It MUST NOT import any project modules — only Node.js built-ins.
 */
/* ------------------------------------------------------------------ */
/*  Status display helpers                                            */
/* ------------------------------------------------------------------ */
export const STATUS_ICON = {
    mastered: '🟢',
    in_progress: '🔵',
    needs_practice: '🟠',
    unexplored: '⚪',
};
export const STATUS_LABEL = {
    mastered: 'mastered',
    in_progress: 'in progress',
    needs_practice: 'needs practice',
    unexplored: 'unexplored',
};
/* ------------------------------------------------------------------ */
/*  Text helpers                                                      */
/* ------------------------------------------------------------------ */
/** Escape underscores in text destined for Markdown output. */
export const esc = (s) => s.replace(/_/g, '\\_');
// ── Checker factories ────────────────────────────────────────────────
const literal = (expected) => (v) => v !== expected ? `Must be ${JSON.stringify(expected)}` : null;
const str = (min = 1) => (v) => typeof v !== 'string' || v.length < min
    ? `Must be a non-empty string`
    : null;
const num = (opts) => (v) => {
    if (typeof v !== 'number')
        return 'Must be a number';
    if (opts?.min !== undefined && v < opts.min)
        return `Must be >= ${opts.min}`;
    if (opts?.max !== undefined && v > opts.max)
        return `Must be <= ${opts.max}`;
    if (opts?.int && !Number.isInteger(v))
        return 'Must be an integer';
    return null;
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;
const dateStr = (v) => typeof v !== 'string' || !DATE_RE.test(v)
    ? 'Must match YYYY-MM-DD or YYYY-MM-DD HH:mm:ss'
    : null;
const nullable = (inner) => (v) => v === null ? null : inner(v);
const arr = (itemChecker) => (v) => {
    if (!Array.isArray(v))
        return 'Must be an array';
    if (itemChecker)
        for (const item of v) {
            const err = itemChecker(item);
            if (err)
                return err;
        }
    return null;
};
const oneOf = (...values) => (v) => !values.includes(v) ? `Must be one of: ${values.join(', ')}` : null;
const optional = (inner) => (v) => v === undefined ? null : inner(v);
const note = (v) => {
    if (typeof v !== 'string' || v.trim().length === 0)
        return 'Must be a non-empty string after trimming';
    if ([...v].length > 30)
        return 'Must be at most 30 characters';
    return null;
};
// ── Validation schemas ───────────────────────────────────────────────
const STATE_RULES = {
    version: literal(1),
    topic: str(),
    slug: str(),
    created: dateStr,
    domains: arr(),
};
const DOMAIN_RULES = {
    name: str(),
    slug: str(),
    concepts: arr(),
};
const CONCEPT_RULES = {
    name: str(),
    slug: str(),
    status: oneOf('unexplored', 'in_progress', 'needs_practice', 'mastered'),
    confidence: num({ min: 0, max: 1 }),
    practice_count: num({ min: 0, int: true }),
    explain_count: num({ min: 0, int: true }),
    last_explained: nullable(dateStr),
    last_practiced: nullable(dateStr),
    details: arr(str()),
};
const CONCEPT_ID_RE = /^[\p{Script=Han}a-z0-9]+(?:-[\p{Script=Han}a-z0-9]+)*$/u;
const conceptId = (v) => {
    if (typeof v !== 'string' || v.length === 0)
        return 'Must be a non-empty string';
    if (v.normalize('NFC') !== v)
        return 'Must use Unicode NFC normalization';
    if ([...v].length > 64)
        return 'Must be at most 64 characters';
    if (!CONCEPT_ID_RE.test(v))
        return 'Must contain only Han characters, lowercase ASCII letters, digits, and single hyphens';
    return null;
};
const STATE_V2_RULES = {
    version: literal(2),
    kind: literal('knowledge_domain'),
    topic: str(),
    slug: str(),
    created: dateStr,
    domains: arr(),
};
const CONCEPT_V2_RULES = {
    concept_id: conceptId,
    name: str(),
    status: oneOf('unexplored', 'in_progress', 'needs_practice', 'mastered'),
    confidence: num({ min: 0, max: 1 }),
    practice_count: num({ min: 0, int: true }),
    explain_count: num({ min: 0, int: true }),
    last_explained: nullable(dateStr),
    last_practiced: nullable(dateStr),
    details: arr(str()),
};
const VIEW_V2_RULES = {
    version: literal(2),
    kind: literal('learning_view'),
    name: str(),
    slug: str(),
    created: dateStr,
    concepts: arr(),
};
const VIEW_CONCEPT_RULES = {
    concept_id: conceptId,
    importance: oneOf('core', 'recommended', 'optional'),
    note: optional(note),
};
// ── Core engine ──────────────────────────────────────────────────────
function checkFields(obj, rules, prefix, errors) {
    if (obj === null || typeof obj !== 'object')
        return;
    const record = obj;
    for (const [key, checker] of Object.entries(rules)) {
        const msg = checker(record[key]);
        if (msg)
            errors.push({ path: prefix ? `${prefix}.${key}` : key, message: msg });
    }
}
export function validateStateV1(data) {
    if (data === null || typeof data !== 'object' || Array.isArray(data))
        return [{ path: '', message: 'Expected a non-null object' }];
    const errors = [];
    checkFields(data, STATE_RULES, '', errors);
    if (Array.isArray(data.domains)) {
        const domains = data.domains;
        for (const [di, domain] of domains.entries()) {
            const dp = `domains[${di}]`;
            checkFields(domain, DOMAIN_RULES, dp, errors);
            if (Array.isArray(domain.concepts)) {
                const concepts = domain.concepts;
                for (const [ci, concept] of concepts.entries())
                    checkFields(concept, CONCEPT_RULES, `${dp}.concepts[${ci}]`, errors);
            }
        }
    }
    return errors;
}
export function validateStateV2(data) {
    if (data === null || typeof data !== 'object' || Array.isArray(data))
        return [{ path: '', message: 'Expected a non-null object' }];
    const errors = [];
    checkFields(data, STATE_V2_RULES, '', errors);
    if (Array.isArray(data.domains)) {
        for (const [di, domain] of data.domains.entries()) {
            const dp = `domains[${di}]`;
            if (domain === null || typeof domain !== 'object' || Array.isArray(domain)) {
                errors.push({ path: dp, message: 'Expected a non-null object' });
                continue;
            }
            checkFields(domain, DOMAIN_RULES, dp, errors);
            if (Array.isArray(domain.concepts)) {
                for (const [ci, concept] of domain.concepts.entries()) {
                    const cp = `${dp}.concepts[${ci}]`;
                    if (concept === null || typeof concept !== 'object' || Array.isArray(concept)) {
                        errors.push({ path: cp, message: 'Expected a non-null object' });
                        continue;
                    }
                    checkFields(concept, CONCEPT_V2_RULES, cp, errors);
                }
            }
        }
    }
    return errors;
}
export function validateViewV2(data) {
    if (data === null || typeof data !== 'object' || Array.isArray(data))
        return [{ path: '', message: 'Expected a non-null object' }];
    const errors = [];
    checkFields(data, VIEW_V2_RULES, '', errors);
    if (Array.isArray(data.concepts)) {
        for (const [ci, concept] of data.concepts.entries()) {
            const cp = `concepts[${ci}]`;
            if (concept === null || typeof concept !== 'object' || Array.isArray(concept)) {
                errors.push({ path: cp, message: 'Expected a non-null object' });
                continue;
            }
            checkFields(concept, VIEW_CONCEPT_RULES, cp, errors);
            for (const key of Object.keys(concept)) {
                if (!(key in VIEW_CONCEPT_RULES))
                    errors.push({ path: `${cp}.${key}`, message: 'Unexpected field' });
            }
        }
    }
    return errors;
}
const strOrBool = (v) => typeof v !== 'string' && typeof v !== 'boolean' ? 'Must be a string or boolean' : null;
const optArr = (itemChecker) => (v) => v === undefined ? null : arr(itemChecker)(v);
const DECK_RULES = {
    version: literal(1),
    topic: str(),
    topic_slug: str(),
    concept_slug: str(),
    concept_name: str(),
    created: dateStr,
    questions: arr(),
};
const QUESTION_RULES = {
    id: str(),
    type: oneOf('multiple_choice', 'true_false', 'fill_in_blank', 'error_correction'),
    gradeable: oneOf('exact', 'accepted', 'ai_only'),
    prompt: str(),
    explanation: str(),
    options: optArr(str()),
    answer: strOrBool,
    accepted_answers: optArr(str()),
};
const TYPE_GRADEABLE = {
    multiple_choice: 'exact',
    true_false: 'exact',
    fill_in_blank: 'accepted',
    error_correction: 'ai_only',
};
export function validateQuizDeck(data) {
    if (data === null || typeof data !== 'object' || Array.isArray(data))
        return [{ path: '', message: 'Expected a non-null object' }];
    const errors = [];
    checkFields(data, DECK_RULES, '', errors);
    const questions = data.questions;
    if (Array.isArray(questions)) {
        for (const [qi, q] of questions.entries()) {
            const qp = `questions[${qi}]`;
            checkFields(q, QUESTION_RULES, qp, errors);
            const rec = q;
            const type = rec.type;
            const gradeable = rec.gradeable;
            if (typeof type === 'string' && type in TYPE_GRADEABLE) {
                const expected = TYPE_GRADEABLE[type];
                if (gradeable !== expected)
                    errors.push({
                        path: `${qp}.gradeable`,
                        message: `Must be "${expected}" for type "${type}"`,
                    });
                if (type === 'multiple_choice') {
                    const opts = rec.options;
                    if (!Array.isArray(opts) || opts.length < 2)
                        errors.push({
                            path: `${qp}.options`,
                            message: 'multiple_choice requires options[] with at least 2 items',
                        });
                }
                if (type === 'true_false') {
                    if (typeof rec.answer !== 'boolean')
                        errors.push({
                            path: `${qp}.answer`,
                            message: 'true_false answer must be a boolean',
                        });
                }
                if (type === 'fill_in_blank') {
                    const acc = rec.accepted_answers;
                    if (!Array.isArray(acc) || acc.length < 1)
                        errors.push({
                            path: `${qp}.accepted_answers`,
                            message: 'fill_in_blank requires accepted_answers[] with at least 1 item',
                        });
                }
            }
        }
    }
    return errors;
}
/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
export function totalCount(state) {
    return state.domains.reduce((sum, d) => sum + d.concepts.length, 0);
}
export function masteredCount(state) {
    return state.domains.reduce((sum, d) => sum + d.concepts.filter((c) => c.status === 'mastered').length, 0);
}
//# sourceMappingURL=utils.mjs.map
