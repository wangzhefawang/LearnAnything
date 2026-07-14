---
name: "Learn: Quiz"
description: "Quick text Q&A quiz — generates, grades, and saves a reusable question deck per concept"
category: Learning
tags: [learning, quiz, assessment, grading]
---

Use the `learn-anything-quiz` skill to handle `/learn:quiz <concept-or-scope>`.
Forward the request unchanged. The skill owns eligible-concept resolution, domain-owned `concept_id` decks, grading, v2 state persistence, and same-turn view refresh; do not copy quiz logic here.
