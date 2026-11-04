/*
 * Resume–JD Gap Analyzer — analysis engine.
 * Pure functions, no DOM access: runs in the browser (window.GapAnalyzer) and in Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./skills.js'));
  else root.GapAnalyzer = factory(root.GapSkills);
})(typeof self !== 'undefined' ? self : this, function (Taxonomy) {
  'use strict';

  // ───────────────────────────── Scoring model ─────────────────────────────
  // Component weights (sum = 100). Components that don't apply to a JD (e.g. no years
  // requirement stated) are dropped and the remaining weights are re-normalised.
  const WEIGHTS = { required: 45, preferred: 15, keywords: 10, experience: 15, education: 5, ats: 10 };
  const COMPONENT_LABELS = {
    required: 'Required skills', preferred: 'Preferred skills', keywords: 'JD keyword coverage',
    experience: 'Years of experience', education: 'Education', ats: 'Resume quality (ATS)',
  };
  // Credit a resume earns for a JD skill.
  const CREDIT = { matched: 1, inferred: 0.75, related: 0.5, missing: 0 };
  const SOFT_SKILL_WEIGHT = 0.5;     // soft skills count half as much as hard skills
  const FREQ_BOOST = 0.15;           // +15% importance per extra JD mention (max 4 extra)
  const TITLE_BOOST = 1.3;           // skills named in the job title are 30% more important
  const RELATED_HOURS_FACTOR = 0.5;  // ramp-up time when you already know a sibling tool
  const TOP_KEYWORDS = 15;
  const HOURS_PER_WEEK = 10;

  // ───────────────────────────── Text utilities ─────────────────────────────
  function normalize(text) {
    return String(text == null ? '' : text)
      .replace(/\r\n?/g, '\n')
      .replace(/[‐-―−]/g, '-')
      .replace(/[‘’ʼ′]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[   \t\f\v]/g, ' ')
      .replace(/[•▪●◦‣⁃►➢]/g, '•')
      .replace(/ {2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function stripUrls(text) {
    return text
      .replace(/\b(?:https?:\/\/|www\.)\S+/gi, ' ')
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, ' ')
      .replace(/\b[\w-]+\.(?:com|io|dev|org|me|ai|co|app)\/\S*/gi, ' ');
  }

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  const wordCount = (s) => (String(s).match(/[A-Za-z0-9][A-Za-z0-9'+#.\-]*/g) || []).length;
  const round = (n, d = 0) => { const f = Math.pow(10, d); return Math.round(n * f) / f; };
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  // ───────────────────────────── Skill index ─────────────────────────────
  // Extra context guards for ambiguous names (keyed by lower-cased alias).
  const GUARDS = {
    c: { before: '(?<!(?:[Ss]eries|[Vv]itamin|[Gg]rade|[Tt]ype|[Pp]lan|[Cc]lass)\\s)' },
    r: { before: '(?<!(?:[Ss]eries|[Gg]rade|[Tt]ype|[Cc]lass)\\s)' },
    go: { after: '(?!\\s+(?:to|above|beyond|live|through|ahead|for|get|back|over|out|the)\\b)' },
    react: { after: '(?![\\s-]+[Nn]ative)(?!\\s+(?:to|quickly|fast|swiftly)\\b)' },
    java: { after: '(?![\\s-]*[Ss]cript)' },
    express: { after: '(?!\\s+(?:interest|written|consent|permission|delivery|entry|lane|ideas|yourself)\\b)' },
    spring: { after: "(?!\\s*'?\\d)(?!\\s+(?:semester|term|break|internship|quarter|season)\\b)" },
    node: { after: '(?!\\s+(?:of|in|and)\\b)' },
    excel: { after: '(?!\\s+(?:in|at|as|under|with)\\b)' },
    spark: { after: '(?!\\s+(?:innovation|ideas|change|joy|curiosity|conversations?|growth|interest)\\b)' },
  };

  function compileAlias(text, caseSensitive) {
    let body = escapeRe(text).replace(/-/g, '[\\s-]?').replace(/ +/g, '[\\s-]+');
    if (!caseSensitive && /[a-z]$/i.test(text) && text.length >= 3) body += "(?:e?s|'s)?";
    const short = text.replace(/[^A-Za-z0-9]/g, '').length <= 2;
    const strict = short && caseSensitive;
    const lead = strict ? "(?<![A-Za-z0-9+#\\-&'./])" : '(?<![A-Za-z0-9+#])';
    const trail = strict ? "(?![A-Za-z0-9+#\\-&'])" : '(?![A-Za-z0-9+#])';
    const g = GUARDS[text.toLowerCase()] || {};
    return new RegExp((g.before || '') + lead + '(?:' + body + ')' + trail + (g.after || ''), caseSensitive ? 'g' : 'gi');
  }

  function buildIndex(tax) {
    const skills = [];
    const byName = new Map();
    for (const cat of tax.CATEGORIES) {
      for (const entry of cat.skills) {
        const [spec, diff] = entry.split('~');
        const parts = spec.split('|');
        const name = parts[0].replace(/^=/, '');
        if (byName.has(name)) throw new Error('Duplicate skill in taxonomy: ' + name);
        const aliases = parts.map((p) => ({ text: p.replace(/^=/, ''), cs: p.startsWith('=') }));
        const skill = {
          name, category: cat.name, soft: !!cat.soft,
          difficulty: diff ? Number(diff) : cat.difficulty,
          aliases: aliases.map((a) => a.text),
          patterns: aliases.map((a) => compileAlias(a.text, a.cs)),
        };
        byName.set(name, skill);
        skills.push(skill);
      }
    }
    const families = new Map();
    for (const [fam, members] of Object.entries(tax.FAMILIES)) {
      for (const m of members) {
        if (!byName.has(m)) throw new Error(`Unknown skill "${m}" in family "${fam}"`);
        if (!families.has(m)) families.set(m, []);
        families.get(m).push(fam);
      }
    }
    const implies = new Map();
    for (const [child, parents] of Object.entries(tax.IMPLIES)) {
      if (!byName.has(child)) throw new Error(`Unknown skill "${child}" in IMPLIES`);
      for (const p of parents) if (!byName.has(p)) throw new Error(`Unknown skill "${p}" implied by "${child}"`);
      implies.set(child, parents);
    }
    const closure = new Map();
    for (const name of byName.keys()) {
      const seen = new Set();
      const queue = [...(implies.get(name) || [])];
      while (queue.length) {
        const n = queue.shift();
        if (seen.has(n) || n === name) continue;
        seen.add(n);
        queue.push(...(implies.get(n) || []));
      }
      closure.set(name, seen);
    }
    const aliasWords = new Set();
    for (const s of skills) for (const a of s.aliases) for (const w of a.toLowerCase().split(/[^a-z0-9+#]+/)) if (w) aliasWords.add(w);
    return { skills, byName, families, implies, closure, aliasWords };
  }

  const INDEX = buildIndex(Taxonomy);

  /** Find skills in text. Overlapping hits resolve to the longest one ("React Native" beats "React"),
   *  except when the longer skill implies the shorter one ("AWS" inside "AWS Lambda" counts too). */
  function extractSkills(text) {
    const clean = stripUrls(normalize(text));
    const hits = [];
    for (const s of INDEX.skills) {
      for (const re of s.patterns) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(clean))) {
          if (!m[0]) { re.lastIndex++; continue; }
          hits.push({ skill: s.name, start: m.index, end: m.index + m[0].length });
        }
      }
    }
    hits.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
    const accepted = [];
    const counts = new Map();
    const bump = (k) => counts.set(k, (counts.get(k) || 0) + 1);
    for (const h of hits) {
      const host = accepted.find((a) => h.start < a.end && a.start < h.end);
      if (!host) { accepted.push(h); bump(h.skill); continue; }
      // Only whole words inside the host count ("AWS" in "AWS Lambda", not "js" in "Node.js").
      const wordStart = h.start === host.start || /\s/.test(clean[h.start - 1]);
      if (host.skill !== h.skill && wordStart && h.start >= host.start && h.end <= host.end &&
          INDEX.closure.get(host.skill).has(h.skill)) {
        if (!host.subsumed) host.subsumed = new Set();
        if (!host.subsumed.has(h.skill)) { host.subsumed.add(h.skill); bump(h.skill); }
      }
    }
    return counts;
  }

  // ───────────────────────────── Shared patterns ─────────────────────────────
  const EDU_LEVELS = [
    { level: 4, label: 'PhD', re: /\b(?:ph\.?\s?d\b|doctorate|doctoral)/i },
    { level: 3, label: "Master's", re: /\b(?:master'?s\b|master of\b|master degree|m\.s\.|m\.sc\b|msc\b|m\.tech\b|mtech\b|mba\b|m\.eng\b|meng\b|mca\b|m\.?s\.?\s+(?:in|of)\s|m\.?s\.?(?=\s*(?:\/|or\b|,)))/i },
    { level: 2, label: "Bachelor's", re: /\b(?:bachelor'?s?\b|bachelor of\b|b\.s\.|b\.sc\b|bsc\b|b\.tech\b|btech\b|b\.e\.|b\.eng\b|beng\b|b\.a\.|bca\b|undergraduate degree|(?:4|four)[\s-]year degree|b\.?[sa]\.?\s+(?:in|of)\s|b\.?[sa]\.?(?=\s*(?:\/|or\b|,))|(?:college|university) degree|degree in\b)/i },
    { level: 1, label: 'Associate', re: /\bassociate'?s?\s+degree\b/i },
  ];
  const EDU_LABEL = { 0: 'None detected', 1: 'Associate', 2: "Bachelor's", 3: "Master's", 4: 'PhD' };
  const EQUIVALENT_RE = /\bor equivalent\b|equivalent (?:practical |work |professional |industry )?experience|or related (?:practical )?experience/i;

  function eduLevelsIn(text) {
    return EDU_LEVELS.filter((e) => e.re.test(text)).map((e) => e.level);
  }

  const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const DATE_SRC = "(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s*,?\\s*'?\\d{2,4}|\\d{1,2}\\s*[/.]\\s*\\d{4}|(?:19|20)\\d{2})";
  const END_SRC = '(?:present|current|currently|now|today|ongoing|till date|to date|date)';
  const RANGE_RE = new RegExp(`(${DATE_SRC})\\s*(?:-|to|until|till|through|–|—)\\s*(${DATE_SRC}|${END_SRC})`, 'gi');

  function parseMonth(s, now) {
    s = s.toLowerCase().trim();
    if (new RegExp(`^${END_SRC}$`).test(s)) return { m: now.getFullYear() * 12 + now.getMonth(), precise: false };
    let m = s.match(/^([a-z]+)\.?\s*,?\s*'?(\d{2,4})$/);
    if (m) {
      const mon = MONTHS[m[1].slice(0, 3)];
      let y = Number(m[2]);
      if (mon === undefined) return null;
      if (y < 100) y += 2000;
      return { m: y * 12 + mon, precise: true };
    }
    m = s.match(/^(\d{1,2})\s*[/.]\s*(\d{4})$/);
    if (m) {
      const mon = Number(m[1]) - 1;
      if (mon < 0 || mon > 11) return null;
      return { m: Number(m[2]) * 12 + mon, precise: true };
    }
    m = s.match(/^(\d{4})$/);
    if (m) return { m: Number(m[1]) * 12 + 5, precise: false }; // year only → assume mid-year
    return null;
  }

  /** Sum of non-overlapping employment date ranges, in years. */
  function yearsFromDateRanges(text, now) {
    const nowM = now.getFullYear() * 12 + now.getMonth();
    const intervals = [];
    const ranges = [];
    RANGE_RE.lastIndex = 0;
    let m;
    while ((m = RANGE_RE.exec(text))) {
      const a = parseMonth(m[1], now);
      const b = parseMonth(m[2], now);
      if (!a || !b) continue;
      const start = a.m;
      const end = Math.min(b.m + (b.precise ? 1 : 0), nowM + 1);
      if (end <= start || end - start > 45 * 12 || start > nowM) continue;
      intervals.push([start, end]);
      ranges.push(m[0]);
    }
    intervals.sort((x, y) => x[0] - y[0]);
    let months = 0, curS = null, curE = null;
    for (const [s, e] of intervals) {
      if (curE === null || s > curE) { if (curE !== null) months += curE - curS; curS = s; curE = e; }
      else curE = Math.max(curE, e);
    }
    if (curE !== null) months += curE - curS;
    return { years: round(months / 12, 1), ranges };
  }

  // ───────────────────────────── Job description parsing ─────────────────────────────
  const JD_HEADERS = [
    ['info', /\b(about us|about the company|about (?!you\b|the\b|this\b)[A-Z][\w&]+$|who we are|benefits|perks|why join|why you'll love|compensation|salary|pay range|equal opportunity|eeo|our culture|what we offer|we offer|life at)\b/i],
    ['preferred', /\b(nice[\s-]to[\s-]haves?|preferred|bonus(?: points)?|pluses|a plus|desired|desirable|good[\s-]to[\s-]have|optional|extra credit|ideal(?:ly)?|would be great)\b/i],
    ['responsibilities', /\b(responsibilit(?:y|ies)|what you(?:'ll| will) do|duties|the role|your role|day[\s-]to[\s-]day|in this role|about the (?:role|job|position)|the opportunity|your impact|what you'll work on)\b/i],
    ['required', /\b(requirements?|qualifications?|must[\s-]haves?|what you(?:'ll| will)? (?:need|bring)|what we(?:'re| are) looking for|who you are|you (?:have|bring|are|should have)|minimum|basic|required|skills|tech(?:nical)? stack|experience|competencies|about you)\b/i],
  ];
  const PREF_CUE = /\b(nice[\s-]to[\s-]have|preferred|preferably|is a plus|a plus|are a plus|plus if|bonus|ideally|desirable|familiarity with|exposure to|good[\s-]to[\s-]have|advantageous|an advantage|not required|optional|would be great|helpful|beneficial)\b/i;
  const STRONG_REQ_CUE = /\b(must|required|requires|mandatory|essential)\b/i;
  const YEARS_RE = /(?<![\d.])(\d{1,2})\s*(?:\+|plus)?\s*(?:(?:-|to|–)\s*(\d{1,2})\s*)?(?:\+\s*)?(?:years?|yrs?)\b/gi;

  function jdHeader(line) {
    if (/^\s*[•*\-]/.test(line)) return null;
    const t = line.replace(/^[#\s]+/, '').replace(/[:\s]+$/, '').trim();
    if (!t || t.length > 60 || /\d/.test(t)) return null;
    const words = t.split(/\s+/).length;
    if (!(/:\s*$/.test(line) || (words <= 6 && !/[.!?,;]$/.test(t)))) return null;
    if (extractSkills(t).size) return null;
    for (const [kind, re] of JD_HEADERS) if (re.test(t)) return kind;
    return null;
  }

  function splitSentences(line) {
    return line.split(/(?<=[.;!?])\s+(?=[A-Z0-9•])/).map((s) => s.trim()).filter(Boolean);
  }

  function parseJD(raw) {
    const text = normalize(raw);
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const titleLine = lines[0] && lines[0].length <= 90 && !jdHeader(lines[0]) && !/[.!?]$/.test(lines[0]) ? lines[0] : '';
    const titleSkills = titleLine ? extractSkills(titleLine) : new Map();
    const skills = new Map();
    const sentences = [];
    let section = null;
    let yearsRequired = null, yearsPreferred = null, yearsSentence = '';
    const eduReq = [], eduPref = [];
    let equivalentOk = false;
    const contentForKeywords = [];

    let seenHeader = false;
    for (const line of lines) {
      let content = line.replace(/^[•*\-–]\s*/, '');
      let lineSection = section;
      const kind = jdHeader(line);
      if (kind) { section = kind; seenHeader = true; continue; }
      // Short lines before the first header are title / company / location: skills yes, keywords no.
      const isMeta = !seenHeader && content.length < 70 && !/[.!?]$/.test(content);
      // "Label: content" on one line (e.g. "Nice to have: Kafka, GraphQL") applies to that line only.
      const inline = content.match(/^([^:]{3,45}):\s+(.+)$/);
      if (inline) {
        const k = jdHeader(inline[1] + ':');
        if (k) { lineSection = k; content = inline[2]; }
      }
      if (lineSection === 'info') continue;
      for (const sentence of splitSentences(content)) {
        let level;
        if (PREF_CUE.test(sentence)) level = 'preferred';
        else if (lineSection === 'preferred') level = STRONG_REQ_CUE.test(sentence) ? 'required' : 'preferred';
        else level = 'required';
        sentences.push({ text: sentence, level, section: lineSection });
        if (!isMeta) contentForKeywords.push(sentence);

        for (const [name, count] of extractSkills(sentence)) {
          const prev = skills.get(name) || { count: 0, level: 'preferred' };
          prev.count += count;
          if (level === 'required') prev.level = 'required';
          skills.set(name, prev);
        }
        YEARS_RE.lastIndex = 0;
        let ym;
        while ((ym = YEARS_RE.exec(sentence))) {
          const after = sentence.slice(ym.index + ym[0].length, ym.index + ym[0].length + 40);
          if (/^\s*(old|ago|in business)/i.test(after)) continue;
          const looksLikeExperience = /experience|background|track record/i.test(sentence) ||
            /^\s*(?:of|in|with|building|developing|working|as|doing|designing|writing|using|shipping|leading|professional|industry|hands)/i.test(after);
          if (!looksLikeExperience) continue;
          const yrs = clamp(Number(ym[1]), 0, 20);
          if (level === 'required') { if (yearsRequired === null || yrs > yearsRequired) { yearsRequired = yrs; yearsSentence = sentence; } }
          else if (yearsPreferred === null || yrs > yearsPreferred) { yearsPreferred = yrs; if (yearsRequired === null) yearsSentence = sentence; }
        }
        const levels = eduLevelsIn(sentence);
        if (levels.length) (level === 'required' ? eduReq : eduPref).push(...levels);
        if (EQUIVALENT_RE.test(sentence)) equivalentOk = true;
      }
    }

    for (const [name, s] of skills) {
      const meta = INDEX.byName.get(name);
      const inTitle = titleSkills.has(name);
      const weight = (meta.soft ? SOFT_SKILL_WEIGHT : 1) * (1 + FREQ_BOOST * Math.min(s.count - 1, 4)) * (inTitle ? TITLE_BOOST : 1);
      Object.assign(s, { name, category: meta.category, soft: meta.soft, difficulty: meta.difficulty, inTitle, weight: round(weight, 3) });
    }

    const years = yearsRequired !== null ? yearsRequired : yearsPreferred;
    const eduPool = eduReq.length ? eduReq : eduPref;
    return {
      title: titleLine,
      skills,
      sentences,
      keywordText: contentForKeywords.join('\n'),
      experience: years === null ? null : { years, preferredOnly: yearsRequired === null, sentence: yearsSentence },
      education: eduPool.length ? { level: Math.min(...eduPool), preferredOnly: !eduReq.length, equivalentOk } : null,
      wordCount: wordCount(text),
    };
  }

  // ───────────────────────────── Resume parsing ─────────────────────────────
  const RESUME_SECTIONS = [
    ['summary', /^(?:professional\s+|career\s+)?(?:summary|profile|objective|about me|overview|career objective|summary of qualifications)$/i],
    ['experience', /^(?:(?:professional|work|relevant|industry|employment)\s+)?(?:experience|employment(?:\s+history)?|work history|career history|internships?|experience\s*(?:&|and)\s*internships?)$/i],
    ['education', /^(?:education|academic background|academics|educational (?:background|qualifications)|education\s*(?:&|and)\s*certifications?)$/i],
    ['skills', /^(?:(?:technical|core|key|relevant|professional)\s+)?(?:skills|competencies|technologies|tech stack|skills\s*(?:&|and)\s*(?:tools|technologies|interests)|toolbox|expertise|areas of expertise)$/i],
    ['projects', /^(?:(?:personal|academic|selected|key|side|notable|technical)\s+)?projects$/i],
    ['certifications', /^(?:certifications?|certificates?|licen[sc]es?(?:\s*(?:&|and)\s*certifications?)?|courses|training)$/i],
    ['awards', /^(?:awards?|honou?rs(?:\s*(?:&|and)\s*awards)?|achievements|accomplishments)$/i],
    ['other', /^(?:publications|volunteer(?:ing)?(?:\s+experience)?|languages|interests|hobbies|activities|leadership(?:\s+experience)?|extracurricular(?:\s+activities)?|references)$/i],
  ];

  function resumeHeader(line) {
    const t = line.replace(/^[#•*\-\s]+/, '').replace(/[:\s]+$/, '').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 45) return null;
    for (const [name, re] of RESUME_SECTIONS) if (re.test(t)) return name;
    return null;
  }

  function splitResume(text) {
    const sections = { header: [] };
    const found = [];
    let cur = 'header';
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      let name = resumeHeader(line);
      let rest = '';
      if (!name && cur !== 'skills') {
        const inline = line.match(/^([^:]{3,40}):\s*(.+)$/);
        if (inline && resumeHeader(inline[1])) { name = resumeHeader(inline[1]); rest = inline[2]; }
      }
      // Inside a skills block, sub-labels like "Languages:" are not new sections.
      if (name === 'other' && cur === 'skills') name = null;
      if (name) {
        cur = name;
        if (!sections[cur]) { sections[cur] = []; found.push(cur); }
        if (rest) sections[cur].push(rest);
        continue;
      }
      sections[cur].push(line);
    }
    const out = {};
    for (const k of Object.keys(sections)) out[k] = sections[k].join('\n');
    return { sections: out, found };
  }

  const ACTION_VERBS = new Set(('accelerated achieved administered advised analyzed architected assessed authored automated boosted built ' +
    'championed coached collaborated conceived configured consolidated constructed contributed converted coordinated created cut ' +
    'debugged decreased defined delivered deployed designed developed devised diagnosed directed documented doubled drove ' +
    'eliminated enabled engineered enhanced established evaluated executed expanded facilitated forecasted formulated founded ' +
    'generated grew guided halved headed identified implemented improved increased influenced initiated innovated instituted ' +
    'integrated introduced investigated launched led leveraged maintained managed maximized mentored migrated minimized modeled ' +
    'modernized monitored negotiated optimized orchestrated organized overhauled owned partnered piloted pioneered planned presented ' +
    'prioritized produced programmed prototyped published raised rebuilt reduced refactored redesigned reengineered resolved ' +
    'restructured revamped saved scaled secured shipped simplified solved spearheaded standardized streamlined strengthened ' +
    'supervised supported surpassed tested trained transformed tripled troubleshot tuned unified upgraded validated won wrote').split(' '));
  const WEAK_PHRASES = /\b(responsible for|worked on|helped (?:with|to)|duties included|tasked with|involved in|assisted (?:with|in))\b/gi;

  function bulletLines(scopeText) {
    const merged = [];
    for (const raw of scopeText.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const isBullet = /^[•*\-–]/.test(line);
      const stripped = line.replace(/^[•*\-–\s]+/, '');
      if (!isBullet && merged.length && /^[a-z(]/.test(stripped)) merged[merged.length - 1] += ' ' + stripped;
      else merged.push(stripped);
    }
    return merged.filter((l) => wordCount(l) >= 6 && !new RegExp(RANGE_RE.source, 'i').test(l));
  }

  function parseResume(raw, now) {
    const text = normalize(raw);
    const { sections, found } = splitResume(text);
    const skills = extractSkills(text);
    const appliedScope = ['summary', 'experience', 'projects'].filter((k) => sections[k]).map((k) => sections[k]).join('\n');
    const applied = appliedScope ? extractSkills(appliedScope) : null;

    const expScope = sections.experience || Object.entries(sections)
      .filter(([k]) => k !== 'education' && k !== 'certifications').map(([, v]) => v).join('\n');
    const fromDates = yearsFromDateRanges(expScope, now);
    const claimMatch = text.match(/(\d{1,2})\s*\+?\s*(?:years|yrs)\s+(?:of\s+)?(?:[\w-]+\s+){0,3}?experience/i);
    const claimed = claimMatch ? Number(claimMatch[1]) : null;
    const years = fromDates.years > 0 ? fromDates.years : (claimed || 0);

    const eduScope = sections.education || text;
    const eduLevels = eduLevelsIn(eduScope);
    return {
      text, sections, found, skills, applied,
      experience: { years, fromDates: fromDates.years, claimed, ranges: fromDates.ranges },
      education: { level: eduLevels.length ? Math.max(...eduLevels) : 0 },
      wordCount: wordCount(text),
    };
  }

  // ───────────────────────────── Component scorers ─────────────────────────────
  function matchSkills(jd, resume) {
    const inferredFrom = new Map();
    for (const r of resume.skills.keys()) for (const p of INDEX.closure.get(r)) if (!inferredFrom.has(p)) inferredFrom.set(p, r);
    const resumeByFamily = new Map();
    for (const r of resume.skills.keys()) for (const f of INDEX.families.get(r) || []) if (!resumeByFamily.has(f)) resumeByFamily.set(f, r);

    const items = [];
    for (const s of jd.skills.values()) {
      let status = 'missing', via = null, family = null;
      if (resume.skills.has(s.name)) status = 'matched';
      else if (inferredFrom.has(s.name)) { status = 'inferred'; via = inferredFrom.get(s.name); }
      else {
        for (const f of INDEX.families.get(s.name) || []) {
          if (resumeByFamily.has(f)) { status = 'related'; via = resumeByFamily.get(f); family = f; break; }
        }
      }
      let evidence = null;
      if (status === 'matched' && resume.applied) evidence = resume.applied.has(s.name) ? 'applied' : 'listed';
      // Soft skills are usually a wording gap, not a learning gap, so they get no learning hours.
      const baseHours = s.soft ? 0 : (Taxonomy.LEARNING_HOURS[s.difficulty] || 50);
      const hours = status === 'missing' ? baseHours : status === 'related' ? round(baseHours * RELATED_HOURS_FACTOR) : 0;
      items.push({
        name: s.name, category: s.category, soft: s.soft, level: s.level, weight: s.weight, mentions: s.count,
        inTitle: s.inTitle, status, credit: CREDIT[status], via, family, evidence, hours, gain: 0,
      });
    }
    const order = { matched: 0, inferred: 1, related: 2, missing: 3 };
    items.sort((a, b) => b.weight - a.weight || order[a.status] - order[b.status] || a.name.localeCompare(b.name));
    const extra = [...resume.skills.keys()].filter((n) => !jd.skills.has(n)).map((n) => INDEX.byName.get(n))
      .sort((a, b) => Number(a.soft) - Number(b.soft) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
      .map((s) => ({ name: s.name, category: s.category }));
    return {
      required: items.filter((i) => i.level === 'required'),
      preferred: items.filter((i) => i.level === 'preferred'),
      extra,
    };
  }

  function coverage(list) {
    const total = list.reduce((a, i) => a + i.weight, 0);
    if (!total) return null;
    return 100 * list.reduce((a, i) => a + i.weight * i.credit, 0) / total;
  }

  const STOPWORDS = new Set(('a about above across after again against all also am among an and any are around as at be because been before being ' +
    'below between both but by can could did do does doing done down during each either else etc ever every few for from further get gets ' +
    'getting given go goes going good got great had has have having he her here hers him his how however i if in into is it its itself just ' +
    'least less like likely made make makes making many may me might more most much must my need needs new no nor not now of off often on ' +
    'once one only or other others our ours out over own per plus rather really same say see seek seeking she should since so some such ' +
    'than that the their them then there these they this those though through thus to too toward under until up upon us use used uses ' +
    'using very via want was way we well were what when where whether which while who whom whose why will with within without would yet ' +
    'you your yours yourself ability able across additional applicant applicants apply area areas based benefit benefits best bring ' +
    'candidate candidates company degree environment equal etc excellent experience experienced familiarity field help ideal including ' +
    'join knowledge level looking opportunity opportunities position preferred proven related relevant required requirement ' +
    'requirements responsibilities responsible role skill skills strong team teams understanding work working world year years ' +
    'qualifications qualification minimum least bonus nice day days job jobs time across employer employment status race color religion ' +
    'gender sexual orientation national origin disability veteran age offer offers include includes provide provides plus ' +
    'demonstrated solid hands deep proficiency proficient familiar expert expertise must-have nice-to-have ' +
    'behind handle handles million millions thousands closely operate run running partner partners own owning ensure ' +
    'drive driving support supporting create creating deliver delivering write writing maintain maintaining build building ' +
    'improve improving develop developing deploy deploying design designing lead leading senior junior remote hybrid onsite ' +
    'full-time part-time contract location based ideally including various multiple key core great fast things lot ' +
    'engineer engineers professional professionals individual people person'
  ).split(/\s+/));
  // Domain / outcome words that recruiters scan for: ranked above incidental words of equal frequency.
  const DOMAIN_TERMS = new Set(('scalable scale scalability reliability reliable availability latency throughput high-throughput ' +
    'performance uptime monitoring alerting observability on-call incident production security compliance privacy architecture ' +
    'event-driven real-time distributed pipeline automation quality analytics dashboard reporting insight forecasting metric ' +
    'customer user stakeholder roadmap strategy migration integration payment e-commerce ecommerce fintech healthcare retail ' +
    'logistic analytic inventory order supply marketplace saas b2b b2c platform backend frontend full-stack infrastructure ownership ' +
    'end-to-end budget revenue growth conversion retention churn experimentation governance audit risk').split(/\s+/));

  function stem(w) {
    if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
    if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) return w.slice(0, -1);
    return w;
  }

  function termCounts(text) {
    const counts = new Map();
    const tokens = stripUrls(text).match(/[A-Za-z][A-Za-z0-9]*(?:['-][A-Za-z0-9]+)*/g) || [];
    tokens.forEach((tok, idx) => {
      const w = tok.toLowerCase();
      if (w.length < 3 || STOPWORDS.has(w) || INDEX.aliasWords.has(w)) return;
      const s = stem(w.replace(/'s$/, ''));
      if (s.length < 3 || STOPWORDS.has(s)) return;
      const e = counts.get(s) || { count: 0, first: idx, forms: new Map(), lower: false };
      e.count++;
      if (/^[a-z]/.test(tok)) e.lower = true;
      e.forms.set(w, (e.forms.get(w) || 0) + 1);
      counts.set(s, e);
    });
    return counts;
  }

  function keywordCoverage(jdText, resumeText) {
    const jdTerms = termCounts(jdText);
    const resumeTerms = termCounts(resumeText);
    const flatResume = resumeText.toLowerCase();
    const rank = (s, e) => e.count + (DOMAIN_TERMS.has(s) ? 1 : 0);
    const top = [...jdTerms.entries()]
      .filter(([, e]) => e.lower) // drop words that only ever appear capitalised (company names, places)
      .sort((a, b) => rank(b[0], b[1]) - rank(a[0], a[1]) || a[1].first - b[1].first)
      .slice(0, TOP_KEYWORDS)
      .map(([s, e]) => {
        const term = [...e.forms.entries()].sort((a, b) => b[1] - a[1])[0][0];
        const found = resumeTerms.has(s) ||
          (term.includes('-') && new RegExp(escapeRe(term).replace(/-/g, '[\\s-]?'), 'i').test(flatResume));
        return { term, count: e.count, found };
      });
    const total = top.reduce((a, t) => a + t.count, 0);
    const score = total ? 100 * top.filter((t) => t.found).reduce((a, t) => a + t.count, 0) / total : null;
    return { score, terms: top };
  }

  function experienceScore(jdExp, resumeExp) {
    if (!jdExp || jdExp.years <= 0) return null;
    const ratio = resumeExp.years / jdExp.years;
    return ratio >= 1 ? 100 : 100 * Math.pow(Math.max(ratio, 0), 1.2);
  }

  function educationScore(jdEdu, resumeEdu) {
    if (!jdEdu) return null;
    const gap = jdEdu.level - resumeEdu.level;
    let s = gap <= 0 ? 100 : gap === 1 ? 60 : 25;
    if (gap > 0 && (jdEdu.equivalentOk || jdEdu.preferredOnly)) s = Math.max(s, 75);
    return s;
  }

  function atsChecks(resume) {
    const { text, sections } = resume;
    const checks = [];
    const add = (id, label, points, max, detail) => checks.push({ id, label, points: round(points, 1), max, passed: points >= max * 0.999, detail });

    add('email', 'Email address', /[\w.+-]+@[\w-]+\.[\w.-]+/.test(text) ? 8 : 0, 8, 'Recruiters and ATS parsers look for an email in the header.');
    const phones = text.match(/\+?\(?\d[\d\s().-]{8,}\d/g) || [];
    const hasPhone = phones.some((p) => { const d = p.replace(/\D/g, '').length; return d >= 10 && d <= 15; });
    add('phone', 'Phone number', hasPhone ? 4 : 0, 4, 'Add a phone number so recruiters can reach you quickly.');
    add('links', 'LinkedIn / GitHub / portfolio link', /linkedin\.com|github\.com|gitlab\.com|behance|dribbble|portfolio|https?:\/\//i.test(text) ? 4 : 0, 4,
      'A LinkedIn or GitHub link lets reviewers verify your work.');
    const has = (k) => resume.found.includes(k);
    add('sec-experience', 'Experience section', has('experience') ? 14 : 0, 14, 'Use a clear "Experience" heading so ATS parsers map your jobs correctly.');
    add('sec-education', 'Education section', has('education') ? 8 : 0, 8, 'Use a clear "Education" heading.');
    add('sec-skills', 'Skills section', has('skills') ? 10 : 0, 10, 'A dedicated "Skills" section is the first place ATS keyword filters look.');

    const scope = [sections.experience, sections.projects].filter(Boolean).join('\n') || text;
    const bullets = bulletLines(scope);
    const n = bullets.length;
    const quantified = bullets.filter((b) => /\d/.test(b.replace(/\b(?:19|20)\d{2}\b/g, ''))).length;
    const qRatio = n ? quantified / n : 0;
    add('quantified', 'Quantified achievements', n ? 22 * Math.min(qRatio / 0.4, 1) : 0, 22,
      n ? `${quantified} of ${n} bullets (${Math.round(qRatio * 100)}%) contain numbers — aim for 40%+ (%, $, users, latency, time saved).`
        : 'No achievement bullets detected. Describe each role with 3–5 results-focused bullets.');
    const verbs = bullets.filter((b) => ACTION_VERBS.has((b.match(/^[A-Za-z]+/) || [''])[0].toLowerCase())).length;
    const vRatio = n ? verbs / n : 0;
    add('verbs', 'Bullets start with action verbs', n ? 12 * Math.min(vRatio / 0.6, 1) : 0, 12,
      n ? `${verbs} of ${n} bullets (${Math.round(vRatio * 100)}%) start with a strong verb like Built, Led, Reduced — aim for 60%+.`
        : 'Start each bullet with a strong action verb.');
    const weak = (text.match(WEAK_PHRASES) || []).length;
    add('weak', 'Avoids weak phrasing', weak === 0 ? 6 : weak <= 2 ? 3 : 0, 6,
      weak ? `Found ${weak} weak phrase(s) like "responsible for" / "worked on". Replace them with what you achieved.` : 'No weak phrases found.');
    const wc = resume.wordCount;
    const lenPts = wc >= 350 && wc <= 1000 ? 8 : (wc >= 200 && wc < 350) || (wc > 1000 && wc <= 1400) ? 4 : 0;
    add('length', 'Length (350–1,000 words)', lenPts, 8, `${wc} words. One page ≈ 400–600 words; two pages ≈ 800–1,000.`);
    const pronouns = (text.match(/\b(?:I|me|my|myself)\b/g) || []).length;
    add('pronouns', 'No first-person pronouns', pronouns <= 2 ? 4 : 0, 4,
      pronouns > 2 ? `Found ${pronouns} uses of I/me/my. Resume bullets read better without them.` : 'Good — bullets are written without first-person pronouns.');
    const score = checks.reduce((a, c) => a + c.points, 0);
    return { score: clamp(score, 0, 100), checks, bullets: n };
  }

  function band(score) {
    if (score >= 85) return { label: 'Excellent match', tone: 'great', advice: 'Your resume lines up very well. Polish the summary for this role and apply.' };
    if (score >= 70) return { label: 'Strong match', tone: 'good', advice: 'Competitive. Close the top gaps below to stand out from other strong applicants.' };
    if (score >= 55) return { label: 'Moderate match', tone: 'ok', advice: 'You meet a good part of the brief. Work through the action plan before applying.' };
    if (score >= 40) return { label: 'Weak match', tone: 'weak', advice: 'Significant gaps. Tailor heavily or treat this as a stretch role.' };
    return { label: 'Low match', tone: 'poor', advice: 'This role asks for a different profile. Use the roadmap to plan the skills you would need.' };
  }

  // ───────────────────────────── Main entry point ─────────────────────────────
  function analyze(resumeText, jdText, options = {}) {
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    if (!String(resumeText || '').trim()) throw new Error('Please add your resume text (paste it or upload a file).');
    if (!String(jdText || '').trim()) throw new Error('Please paste the job description.');
    const now = options.now ? new Date(options.now) : new Date();

    const jd = parseJD(jdText);
    const resume = parseResume(resumeText, now);
    const skills = matchSkills(jd, resume);
    const kw = keywordCoverage(jd.keywordText, resume.text);
    const ats = atsChecks(resume);

    const raw = {
      required: coverage(skills.required),
      preferred: coverage(skills.preferred),
      keywords: kw.score,
      experience: experienceScore(jd.experience, resume.experience),
      education: educationScore(jd.education, resume.education),
      ats: ats.score,
    };
    const applicable = Object.keys(WEIGHTS).filter((k) => raw[k] !== null);
    const totalWeight = applicable.reduce((a, k) => a + WEIGHTS[k], 0);
    const norm = {};
    for (const k of Object.keys(WEIGHTS)) norm[k] = raw[k] === null ? 0 : WEIGHTS[k] / totalWeight;
    const overall = applicable.reduce((a, k) => a + norm[k] * raw[k], 0);

    const components = Object.keys(WEIGHTS).map((k) => ({
      key: k, label: COMPONENT_LABELS[k], weight: WEIGHTS[k],
      effectiveWeight: round(norm[k] * 100, 1),
      score: raw[k] === null ? null : round(raw[k]),
      points: raw[k] === null ? 0 : round(norm[k] * raw[k], 1),
    }));

    // Point gains: how many overall points closing each gap is worth.
    for (const level of ['required', 'preferred']) {
      const list = skills[level];
      const total = list.reduce((a, i) => a + i.weight, 0);
      for (const i of list) i.gain = total ? round(norm[level] * 100 * i.weight * (1 - i.credit) / total, 2) : 0;
    }

    const recs = [];
    const push = (r) => recs.push(Object.assign({ gain: 0 }, r));
    for (const i of [...skills.required, ...skills.preferred]) {
      const lvl = i.level === 'required' ? 'required' : 'preferred';
      if (i.status === 'missing' && i.soft) {
        push({ kind: 'skill-missing', skill: i.name, level: lvl, gain: i.gain, hours: 0,
          title: `Show ${i.name.toLowerCase()} (${lvl})`,
          detail: `The JD asks for ${i.name.toLowerCase()}, but your resume never shows it. Add a bullet that demonstrates it with a concrete outcome rather than just listing the word.` });
      } else if (i.status === 'missing') {
        push({ kind: 'skill-missing', skill: i.name, level: lvl, gain: i.gain, hours: i.hours,
          title: `Add ${i.name} (${lvl})`,
          detail: `If you have used ${i.name}, add it to a bullet with context and results. If not, it is a learning gap — about ${i.hours} h to working proficiency.` });
      } else if (i.status === 'related') {
        push({ kind: 'skill-related', skill: i.name, level: lvl, gain: i.gain, hours: i.hours,
          title: `Bridge ${i.via} → ${i.name}`,
          detail: `You know ${i.via} (same family: ${i.family}). Frame it as transferable experience and get hands-on with ${i.name} — roughly ${i.hours} h of ramp-up.` });
      } else if (i.status === 'inferred') {
        push({ kind: 'skill-inferred', skill: i.name, level: lvl, gain: i.gain, hours: 0,
          title: `Name ${i.name} explicitly`,
          detail: `Your resume implies ${i.name} through ${i.via}, but keyword filters may not make that connection. Mention "${i.name}" by name.` });
      } else if (i.evidence === 'listed' && lvl === 'required' && !i.soft) {
        push({ kind: 'skill-evidence', skill: i.name, level: lvl, gain: 0, hours: 0,
          title: `Show ${i.name} in action`,
          detail: `${i.name} is in your skills list but no experience or project bullet uses it. Add one bullet showing what you built with it.` });
      }
    }
    if (raw.experience !== null && raw.experience < 100) {
      push({ kind: 'experience', gain: round(norm.experience * (100 - raw.experience), 2),
        title: `Experience: ${resume.experience.years} of ${jd.experience.years}+ years`,
        detail: 'Count internships, freelance and substantial open-source work with dates. Lead with your most relevant, highest-impact results.' });
    }
    if (raw.education !== null && raw.education < 100) {
      push({ kind: 'education', gain: round(norm.education * (100 - raw.education), 2),
        title: `Education: ${EDU_LABEL[jd.education.level]} requested`,
        detail: `Detected: ${EDU_LABEL[resume.education.level]}. Spell out your degree clearly${jd.education.equivalentOk ? ', and note that the JD accepts equivalent experience' : ''}. Relevant certifications can help offset the gap.` });
    }
    const missingTerms = kw.terms.filter((t) => !t.found);
    if (raw.keywords !== null && missingTerms.length) {
      push({ kind: 'keywords', gain: round(norm.keywords * (100 - raw.keywords), 2),
        title: `Mirror the JD's language (${missingTerms.length} terms missing)`,
        detail: `Where truthful, work these into your summary and bullets: ${missingTerms.slice(0, 8).map((t) => t.term).join(', ')}.` });
    }
    for (const c of ats.checks) {
      if (c.passed) continue;
      push({ kind: 'ats', check: c.id, gain: round(norm.ats * (c.max - c.points), 2), title: `Resume quality: ${c.label}`, detail: c.detail });
    }
    for (const r of recs) {
      r.gain = round(r.gain, 1);
      r.priority = r.gain >= 3 || (r.kind === 'skill-missing' && r.level === 'required' && r.gain >= 1.5) ? 'high' : r.gain >= 1 ? 'medium' : 'low';
    }
    recs.sort((a, b) => b.gain - a.gain || a.title.localeCompare(b.title));

    const roadmap = [...skills.required, ...skills.preferred]
      .filter((i) => (i.status === 'missing' || i.status === 'related') && !i.soft)
      .map((i) => ({ skill: i.name, level: i.level, status: i.status, via: i.via, hours: i.hours, gain: i.gain,
        pointsPerHour: i.hours ? round(i.gain / i.hours, 3) : 0 }))
      .sort((a, b) => b.pointsPerHour - a.pointsPerHour || b.gain - a.gain);
    const roadmapHours = roadmap.reduce((a, r) => a + r.hours, 0);
    const requiredHours = roadmap.filter((r) => r.level === 'required').reduce((a, r) => a + r.hours, 0);

    const score = round(overall);
    const topGains = recs.slice(0, 5).reduce((a, r) => a + r.gain, 0);
    const count = (list, st) => list.filter((i) => i.status === st).length;
    const t1 = (typeof performance !== 'undefined' ? performance : Date).now();

    return {
      score,
      band: band(score),
      potentialScore: Math.min(100, round(overall + topGains)),
      components,
      weights: Object.assign({}, WEIGHTS),
      skills,
      summary: {
        requiredTotal: skills.required.length,
        requiredMatched: count(skills.required, 'matched'),
        requiredPartial: count(skills.required, 'inferred') + count(skills.required, 'related'),
        requiredMissing: count(skills.required, 'missing'),
        preferredTotal: skills.preferred.length,
        preferredMatched: count(skills.preferred, 'matched'),
        preferredMissing: count(skills.preferred, 'missing'),
      },
      keywords: kw,
      experience: {
        required: jd.experience ? jd.experience.years : null,
        preferredOnly: jd.experience ? jd.experience.preferredOnly : false,
        sentence: jd.experience ? jd.experience.sentence : '',
        resume: resume.experience.years,
        fromDates: resume.experience.fromDates,
        claimed: resume.experience.claimed,
        ranges: resume.experience.ranges,
        score: raw.experience === null ? null : round(raw.experience),
      },
      education: {
        required: jd.education ? EDU_LABEL[jd.education.level] : null,
        requiredLevel: jd.education ? jd.education.level : null,
        equivalentOk: jd.education ? jd.education.equivalentOk : false,
        preferredOnly: jd.education ? jd.education.preferredOnly : false,
        resume: EDU_LABEL[resume.education.level],
        resumeLevel: resume.education.level,
        score: raw.education === null ? null : round(raw.education),
      },
      ats,
      recommendations: recs,
      roadmap: {
        items: roadmap, totalHours: roadmapHours, weeks: Math.ceil(roadmapHours / HOURS_PER_WEEK),
        requiredHours, requiredWeeks: Math.ceil(requiredHours / HOURS_PER_WEEK), hoursPerWeek: HOURS_PER_WEEK,
      },
      meta: {
        jobTitle: jd.title,
        jdWords: jd.wordCount,
        resumeWords: resume.wordCount,
        resumeSections: resume.found,
        elapsedMs: round(t1 - t0, 1),
        analyzedAt: now.toISOString(),
      },
    };
  }

  // ───────────────────────────── Report export ─────────────────────────────
  const STATUS_LABEL = { matched: 'Matched', inferred: 'Inferred', related: 'Related', missing: 'Missing' };

  function toMarkdown(r) {
    const L = [];
    L.push(`# Resume–JD Gap Report${r.meta.jobTitle ? ` — ${r.meta.jobTitle}` : ''}`, '');
    L.push(`**Match score: ${r.score}/100 — ${r.band.label}.** ${r.band.advice}`, '');
    L.push(`Potential score after the top 5 fixes: **${r.potentialScore}/100**.`, '');
    L.push('## Score breakdown', '', '| Component | Weight | Score | Points |', '|---|---:|---:|---:|');
    for (const c of r.components) L.push(`| ${c.label} | ${c.score === null ? 'n/a' : c.effectiveWeight + '%'} | ${c.score === null ? 'n/a' : c.score} | ${c.points} |`);
    for (const level of ['required', 'preferred']) {
      const list = r.skills[level];
      if (!list.length) continue;
      L.push('', `## ${level === 'required' ? 'Required' : 'Preferred'} skills`, '', '| Skill | Status | Notes | Gain |', '|---|---|---|---:|');
      for (const i of list) {
        const note = i.via ? `via ${i.via}` : i.evidence === 'listed' ? 'listed only' : i.evidence === 'applied' ? 'shown in experience' : '';
        L.push(`| ${i.name} | ${STATUS_LABEL[i.status]} | ${note} | ${i.gain ? '+' + i.gain : ''} |`);
      }
    }
    L.push('', '## Action plan', '');
    r.recommendations.forEach((x, n) => L.push(`${n + 1}. **[${x.priority}] ${x.title}**${x.gain ? ` (+${x.gain} pts)` : ''} — ${x.detail}`));
    if (r.roadmap.items.length) {
      L.push('', `## Learning roadmap (~${r.roadmap.totalHours} h, about ${r.roadmap.weeks} weeks at ${r.roadmap.hoursPerWeek} h/week)`, '');
      for (const i of r.roadmap.items) L.push(`- ${i.skill} — ~${i.hours} h, +${i.gain} pts${i.via ? ` (builds on ${i.via})` : ''}`);
    }
    L.push('', '## Experience & education', '');
    L.push(`- Experience: resume shows ~${r.experience.resume} years; JD asks for ${r.experience.required === null ? 'no stated minimum' : r.experience.required + '+ years'}.`);
    L.push(`- Education: resume shows ${r.education.resume}; JD asks for ${r.education.required || 'no stated degree'}.`);
    L.push('', '## Resume quality checks', '');
    for (const c of r.ats.checks) L.push(`- ${c.passed ? '✅' : '⚠️'} ${c.label} (${c.points}/${c.max}) — ${c.detail}`);
    const missing = r.keywords.terms.filter((t) => !t.found).map((t) => t.term);
    if (missing.length) L.push('', '## JD keywords missing from resume', '', missing.join(', '));
    L.push('', `_Generated by Resume–JD Gap Analyzer on ${r.meta.analyzedAt.slice(0, 10)}._`);
    return L.join('\n');
  }

  return {
    analyze, toMarkdown, extractSkills, parseJD, parseResume, normalize, yearsFromDateRanges,
    WEIGHTS, CREDIT, COMPONENT_LABELS, LEARNING_HOURS: Taxonomy.LEARNING_HOURS,
    stats: () => ({
      skills: INDEX.skills.length,
      aliases: INDEX.skills.reduce((a, s) => a + s.aliases.length, 0),
      categories: Taxonomy.CATEGORIES.length,
      families: Object.keys(Taxonomy.FAMILIES).length,
      implications: [...INDEX.implies.values()].reduce((a, p) => a + p.length, 0),
    }),
    _index: INDEX,
  };
});
