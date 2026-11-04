# Resume–JD Gap Analyzer

Compare your resume with a job description and see exactly where you fall short. You get a **0–100 match score**, the skills you're **missing or only partly cover**, **JD keyword gaps**, **ATS / resume-quality checks**, and a **prioritized action plan** that shows how many points each fix is worth, plus a learning roadmap with time estimates.

Everything runs **in your browser**. Your resume is never uploaded. There is no backend, no API key and no build step.

**Live demo:** https://lopamudra2727.github.io/resume-jd-gap-analyzer/

[![CI](https://github.com/Lopamudra2727/resume-jd-gap-analyzer/actions/workflows/ci.yml/badge.svg)](https://github.com/Lopamudra2727/resume-jd-gap-analyzer/actions/workflows/ci.yml)

---

## Features

- **Upload PDF / DOCX / TXT, or paste.** PDF.js and Mammoth load lazily from cdnjs only when you upload a file.
- **Required vs. preferred detection.** The JD is split into sections (Requirements, Nice to have, Benefits…). Per-sentence cues ("is a plus", "familiarity with", "must") override the section.
- **Smart skill matching** over a taxonomy of **270 skills / 623 aliases** in 14 categories:
  - **Matched:** the skill is on your resume.
  - **Inferred:** your resume implies it (Django ⇒ Python, GitHub Actions ⇒ CI/CD). 134 implication rules.
  - **Related:** you know a sibling tool (Flask for FastAPI, RabbitMQ for Kafka). 35 skill families.
  - **Missing.**
- **Ambiguity guards.** "Go above and beyond", "the rest of the team", "Series C", "react quickly", "Excel at…", "Spring 2025 internship" and "express interest" are not counted as skills. Longest match wins ("React Native" is not "React").
- **Experience calculation.** Employment date ranges are merged, so overlapping jobs aren't double-counted. Handles `Jan 2020 – Present`, `03/2019 – 06/2020` and `2018 – 2020`.
- **Education check.** Compares degree levels and respects "or equivalent experience".
- **11 ATS checks.** Contact info, standard headings, quantified bullets, action verbs, weak phrasing ("responsible for"), length and pronouns.
- **Action plan ranked by score gain.** Every suggestion says how many points it's worth.
- **Learning roadmap.** Estimated hours per missing skill, ranked by points gained per hour.
- **Export** as a Markdown report or JSON, or copy a short summary.
- Responsive, with dark mode and reduced-motion support.

## Scoring model

The overall score is a weighted sum of six components. If a component doesn't apply (for example, the JD states no years of experience or no degree), it is dropped and the remaining weights are re-normalised to 100%.

| Component | Weight | How it's scored |
|---|---:|---|
| Required skills | **45%** | Weighted coverage of required JD skills. Credit per skill: matched **1.0**, inferred **0.75**, related **0.5**, missing **0**. |
| Preferred skills | **15%** | Same rules, for nice-to-have / bonus / "familiarity with" items. |
| JD keyword coverage | **10%** | Share of the JD's 15 most frequent non-skill terms that appear in the resume, frequency-weighted. Company names and boilerplate are filtered out, and domain words rank higher. |
| Years of experience | **15%** | `min(1, yours ÷ required) ^ 1.2 × 100`. Example: 4 of 5 years scores 77. |
| Education | **5%** | Meets the requirement = 100, one level below = 60 (at least 75 if "or equivalent"), two or more below = 25. |
| Resume quality (ATS) | **10%** | Sum of 11 checks worth 100 points: email 8, phone 4, links 4, Experience heading 14, Education heading 8, Skills heading 10, quantified bullets 22 (target 40%+), action verbs 12 (target 60%+), weak phrasing 6, length 8, pronouns 4. |

**Skill importance inside the JD:**

```
weight = (soft skill ? 0.5 : 1.0) × (1 + 0.15 × min(mentions − 1, 4)) × (in job title ? 1.3 : 1.0)
```

**Point gain of a fix:** the analytic increase in the overall score if that gap were closed. For a skill this is
`componentWeight × 100 × weight × (1 − credit) ÷ Σweights`. By construction, **score + all suggested gains = 100**, and a unit test checks this.

**Score bands:** 85+ Excellent · 70–84 Strong · 55–69 Moderate · 40–54 Weak · below 40 Low.

### Learning-time estimates

These are rough focused-study hours to reach "can put it on a resume and discuss it in an interview." Every skill in the taxonomy has a difficulty level from 1 to 5.

| Difficulty | Hours | Examples |
|---:|---:|---|
| 1 | ~10 h | Jira, Git, Tailwind CSS, Postman, Excel |
| 2 | ~25 h | Flask, Docker, Tableau, GraphQL, Redis |
| 3 | ~50 h | Terraform, React, PostgreSQL, Snowflake, Python |
| 4 | ~100 h | Kubernetes, Go, Spark, Machine Learning, System Design |
| 5 | ~200 h | Haskell, Reinforcement Learning, Assembly |

If you already know a related tool (e.g. Flask → FastAPI), the estimate is halved. The roadmap assumes 10 h/week. Soft skills get no learning hours, because closing them is a wording gap, not a learning gap.

## Measured results

| Metric | Value |
|---|---|
| Skill taxonomy | 270 skills · 623 aliases · 14 categories · 35 families · 134 implication rules |
| Automated tests | 25 unit / integration tests (run in Node CI and in the browser) |
| Skill extraction, **held-out set** (15 unseen sentences, 45 labels) | **Precision 100% · Recall 91.1% · F1 95.3%** |
| Skill extraction, development set (25 sentences, 89 labels) | F1 100%. This set was used to tune aliases, so it overstates accuracy. |
| Analysis speed | ~5–15 ms per resume + JD in Chrome |
| Server cost / data sent | $0 / none. Static site, fully client-side. |

The held-out recall misses are honest: phrasing like "juggle multiple priorities" (Time Management), "presented findings" (Presentation Skills) and "regression suites" (Test Automation) isn't caught by alias matching. Those sentences were written and labelled after development and were never used to tune the matcher.

## Run locally

No install needed. Any static server works:

```bash
python -m http.server 8000
# open http://localhost:8000
```

You can also open `index.html` directly. Pasting text works from `file://`; uploading a PDF/DOCX needs internet access to load the parser from cdnjs.

## Run the tests

```bash
node tests/run-node.js        # or: npm test
```

Or open `tests/index.html` in a browser. CI runs the suite and the benchmark on every push (`.github/workflows/ci.yml`).

## Project structure

```
index.html            UI shell
css/styles.css        Design tokens, light/dark themes, responsive layout
js/skills.js          Skill taxonomy, families, implication rules, learning hours
js/analyzer.js        Analysis engine (pure functions, runs in browser and Node)
js/parsers.js         PDF / DOCX / TXT → text (lazy-loaded libraries)
js/app.js             Rendering and interactions
js/samples.js         Fictional sample resume + JD
samples/              Sample resume as PDF and DOCX for trying uploads
tests/                Shared test suite, labelled benchmark, Node + browser runners
```

## Limitations

- This is keyword-and-rule based, not semantic. It won't recognise a skill described only in prose ("kept our clusters healthy" ≠ Kubernetes).
- Skills outside the taxonomy aren't detected. Add them in `js/skills.js` as `"Canonical|alias|alias~difficulty"`.
- Scanned (image-only) PDFs have no text layer. Paste the text instead.
- The score is a heuristic to guide edits. Don't add skills you don't have.

## License

MIT
