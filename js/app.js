/* UI wiring for the Resume–JD Gap Analyzer. */
(function () {
  'use strict';
  const GA = window.GapAnalyzer;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 0) => (n == null ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: d }));
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const els = {
    resume: $('resumeText'), jd: $('jdText'), resumeMeta: $('resumeMeta'), jdMeta: $('jdMeta'),
    file: $('resumeFile'), drop: $('dropzone'), dropLabel: $('dropLabel'),
    analyze: $('analyzeBtn'), sample: $('sampleBtn'), clear: $('clearBtn'),
    error: $('error'), results: $('results'),
  };
  const DROP_DEFAULT = els.dropLabel.innerHTML;
  let last = null;

  const words = (s) => (s.trim().match(/\S+/g) || []).length;
  function updateMeta() {
    els.resumeMeta.textContent = `${fmt(words(els.resume.value))} words`;
    els.jdMeta.textContent = `${fmt(words(els.jd.value))} words`;
  }
  function showError(msg) { els.error.textContent = msg; els.error.hidden = false; }
  function hideError() { els.error.hidden = true; }

  // ── File input ──
  async function handleFile(file) {
    if (!file) return;
    hideError();
    els.drop.classList.add('busy');
    els.dropLabel.textContent = `Reading ${file.name}…`;
    try {
      els.resume.value = await window.GapParsers.fileToText(file);
      updateMeta();
      els.dropLabel.innerHTML = `<strong>${esc(file.name)}</strong> loaded. Check the text below and fix anything that didn't come through cleanly.`;
    } catch (e) {
      els.dropLabel.innerHTML = DROP_DEFAULT;
      showError(e.message || String(e));
    } finally {
      els.drop.classList.remove('busy');
      els.file.value = '';
    }
  }
  els.file.addEventListener('change', () => handleFile(els.file.files[0]));
  ['dragenter', 'dragover'].forEach((ev) => els.drop.addEventListener(ev, (e) => { e.preventDefault(); els.drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => els.drop.addEventListener(ev, (e) => { e.preventDefault(); els.drop.classList.remove('drag'); }));
  els.drop.addEventListener('drop', (e) => handleFile(e.dataTransfer && e.dataTransfer.files[0]));

  // ── Actions ──
  function run() {
    hideError();
    try {
      last = GA.analyze(els.resume.value, els.jd.value);
    } catch (e) {
      showError(e.message || String(e));
      return;
    }
    render(last);
    els.results.hidden = false;
    els.results.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }
  els.analyze.addEventListener('click', run);
  els.sample.addEventListener('click', () => {
    els.resume.value = window.GapSamples.resume;
    els.jd.value = window.GapSamples.jd;
    els.dropLabel.innerHTML = DROP_DEFAULT;
    updateMeta();
    run();
  });
  els.clear.addEventListener('click', () => {
    els.resume.value = '';
    els.jd.value = '';
    els.dropLabel.innerHTML = DROP_DEFAULT;
    els.results.hidden = true;
    els.results.innerHTML = '';
    last = null;
    hideError();
    updateMeta();
    els.resume.focus();
  });
  [els.resume, els.jd].forEach((t) => t.addEventListener('input', updateMeta));
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); } });

  // ── Rendering ──
  const STATUS = { matched: 'Matched', inferred: 'Inferred', related: 'Related', missing: 'Missing' };
  const toneVar = (score) => score >= 75 ? 'var(--ok)' : score >= 50 ? 'var(--info)' : score >= 30 ? 'var(--warn)' : 'var(--bad)';

  function stat(v, k) { return `<div class="stat"><div class="v">${v}</div><div class="k">${k}</div></div>`; }

  function skillNote(i) {
    const bits = [];
    if (i.status === 'matched') bits.push(i.evidence === 'applied' ? 'Used in your experience' : i.evidence === 'listed' ? 'Listed in skills only' : 'Found in resume');
    if (i.status === 'inferred') bits.push(`Implied by ${esc(i.via)}`);
    if (i.status === 'related') bits.push(`You know ${esc(i.via)} (${esc(i.family)})`);
    if (i.status === 'missing') bits.push(`~${i.hours} h to learn`);
    if (i.status === 'related') bits.push(`~${i.hours} h ramp-up`);
    if (i.inTitle) bits.push('in job title');
    if (i.mentions > 1) bits.push(`mentioned ×${i.mentions}`);
    return bits.join(' · ');
  }

  function skillTable(list, emptyMsg) {
    if (!list.length) return `<p class="empty">${emptyMsg}</p>`;
    return `<div class="table-wrap"><table>
      <thead><tr><th>Skill</th><th>Status</th><th>Notes</th><th class="num">If fixed</th></tr></thead>
      <tbody>${list.map((i) => `<tr>
        <td><strong>${esc(i.name)}</strong><span class="cat">${esc(i.category)}</span></td>
        <td><span class="pill s-${i.status}">${STATUS[i.status]}</span></td>
        <td class="note">${skillNote(i)}</td>
        <td class="num">${i.gain ? `<span class="gain">+${fmt(i.gain, 1)}</span>` : '<span class="muted">—</span>'}</td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  function render(r) {
    const s = r.summary;
    const C = 2 * Math.PI * 70;
    const comps = r.components.map((c) => {
      const na = c.score === null;
      return `<div class="bar-row${na ? ' na' : ''}">
        <div class="name">${esc(c.label)}<small>${na ? 'Not in this JD — weight shared out' : `${fmt(c.effectiveWeight, 1)}% of score`}</small></div>
        <div class="bar" role="img" aria-label="${esc(c.label)} ${na ? 'not applicable' : c.score + ' out of 100'}"><span style="width:0;background:${na ? 'transparent' : toneVar(c.score)}" data-w="${na ? 0 : c.score}"></span></div>
        <div class="val">${na ? 'n/a' : `<strong>${c.score}</strong>/100`}<small>${na ? '' : `+${fmt(c.points, 1)} pts`}</small></div>
      </div>`;
    }).join('');

    const recs = r.recommendations;
    const plan = recs.length ? recs.map((x, n) => `<li class="${n >= 8 ? 'more' : ''}">
        <div><div class="t">${esc(x.title)}</div><div class="d">${esc(x.detail)}</div></div>
        <div class="right"><span class="prio ${x.priority}">${x.priority}</span>${x.gain ? `<span class="gain">+${fmt(x.gain, 1)} pts</span>` : ''}</div>
      </li>`).join('') : '<li><div><div class="t">Nothing major to fix</div><div class="d">Your resume already covers this JD well.</div></div></li>';

    const exp = r.experience;
    const edu = r.education;
    const expSource = exp.fromDates > 0 ? `from ${exp.ranges.length} date range${exp.ranges.length === 1 ? '' : 's'}` : exp.claimed ? 'from your summary' : 'no dates found';

    const kwChips = r.keywords.terms.map((t) => `<span class="chip ${t.found ? 'found' : 'miss'}">${esc(t.term)}<b>${t.count}</b></span>`).join('');
    const checks = r.ats.checks.map((c) => `<li class="${c.passed ? 'ok' : 'no'}">
        <span class="ico">${c.passed ? '✓' : '!'}</span>
        <span class="lbl">${esc(c.label)}<span class="det">${esc(c.detail)}</span></span>
        <span class="pts">${fmt(c.points, 1)}/${c.max}</span></li>`).join('');

    const road = r.roadmap.items.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Skill</th><th class="num">Est. hours</th><th class="num">Score gain</th><th class="num">Pts / 10 h</th></tr></thead>
        <tbody>${r.roadmap.items.map((i) => `<tr>
          <td><strong>${esc(i.skill)}</strong><span class="cat">${i.level}${i.via ? ` · builds on ${esc(i.via)}` : ''}</span></td>
          <td class="num">${i.hours}</td><td class="num"><span class="gain">+${fmt(i.gain, 1)}</span></td>
          <td class="num">${fmt(i.pointsPerHour * 10, 2)}</td></tr>`).join('')}
          <tr><td><strong>Total</strong></td><td class="num"><strong>${r.roadmap.totalHours}</strong></td><td class="num"><strong>+${fmt(r.roadmap.items.reduce((a, i) => a + i.gain, 0), 1)}</strong></td><td></td></tr>
        </tbody></table></div>
        <p class="muted small" style="margin-top:10px">About ${r.roadmap.weeks} week${r.roadmap.weeks === 1 ? '' : 's'} at ${r.roadmap.hoursPerWeek} h/week. Sorted by score gain per hour, so the best-value skills come first.</p>`
      : '<p class="empty">No skill gaps to learn. Every JD skill is matched or implied.</p>';

    const extra = r.skills.extra.length
      ? `<div class="chips">${r.skills.extra.map((x) => `<span class="chip" title="${esc(x.category)}">${esc(x.name)}</span>`).join('')}</div>`
      : '<p class="empty">Every skill on your resume is also in the JD.</p>';

    els.results.innerHTML = `
      <div class="card hero-card tone-${r.band.tone}">
        <div class="ring">
          <svg width="168" height="168" viewBox="0 0 168 168" aria-hidden="true">
            <circle class="track" cx="84" cy="84" r="70" fill="none" stroke-width="14"/>
            <circle class="value" cx="84" cy="84" r="70" fill="none" stroke="var(--tone)" stroke-width="14" stroke-linecap="round"
              stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}"/>
          </svg>
          <div class="ring-label"><div class="big" id="scoreNum">${reduceMotion ? r.score : 0}</div><div class="of">out of 100</div></div>
        </div>
        <div class="hero-text">
          <span class="band">${esc(r.band.label)}</span>
          <h2>${r.meta.jobTitle ? esc(r.meta.jobTitle) : 'Your match'}</h2>
          <p>${esc(r.band.advice)}</p>
          <div class="stats">
            ${stat(`${s.requiredMatched}/${s.requiredTotal}`, 'required skills fully matched')}
            ${stat(s.requiredMissing, `required skill${s.requiredMissing === 1 ? '' : 's'} missing`)}
            ${stat(r.potentialScore, 'potential score after the top 5 fixes')}
            ${stat(`${r.roadmap.requiredHours} h`, `to close required-skill gaps (~${r.roadmap.requiredWeeks} wk at ${r.roadmap.hoursPerWeek} h/wk)`)}
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Score breakdown</h3>
        <p class="sub">Each component is scored out of 100. Points show how much it adds to your overall score of ${r.score}.</p>
        <div class="bars">${comps}</div>
      </div>

      <div class="card">
        <h3>Action plan</h3>
        <p class="sub">${recs.length} suggestions, ranked by how many points each adds to your score.</p>
        <ol class="plan" id="plan">${plan}</ol>
        ${recs.length > 8 ? `<button class="btn small ghost" id="moreBtn" type="button" style="margin-top:12px">Show all ${recs.length}</button>` : ''}
      </div>

      <div class="card">
        <h3>Required skills <span class="muted small">(${s.requiredMatched} matched · ${s.requiredPartial} partial · ${s.requiredMissing} missing)</span></h3>
        <p class="sub">Sorted by importance in the JD. "If fixed" is how many points closing that gap would add.</p>
        <div class="legend">
          <span class="pill s-matched">Matched · 100%</span><span class="pill s-inferred">Inferred · 75%</span>
          <span class="pill s-related">Related · 50%</span><span class="pill s-missing">Missing · 0%</span>
        </div>
        ${skillTable(r.skills.required, 'No required skills from our taxonomy were found in this JD.')}
      </div>

      <div class="card">
        <h3>Preferred skills <span class="muted small">(${s.preferredMatched}/${s.preferredTotal} matched)</span></h3>
        <p class="sub">Nice-to-haves. They help you stand out but weigh less than required skills.</p>
        ${skillTable(r.skills.preferred, 'This JD lists no separate preferred / nice-to-have skills.')}
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>Experience &amp; education</h3>
          <p class="sub">Years come from merging the date ranges in your Experience section, so overlapping jobs aren't double-counted.</p>
          <div class="facts">
            <div class="fact"><span class="k">JD asks for</span><span class="v">${exp.required === null ? 'No minimum stated' : `${exp.required}+ years${exp.preferredOnly ? ' (preferred)' : ''}`}</span></div>
            <div class="fact"><span class="k">Your resume shows</span><span class="v">~${fmt(exp.resume, 1)} years <span class="muted small">(${expSource})</span></span></div>
            ${exp.sentence ? `<div class="quote">“${esc(exp.sentence)}”</div>` : ''}
            <div class="fact"><span class="k">Degree requested</span><span class="v">${edu.required ? `${esc(edu.required)}${edu.equivalentOk ? ' or equivalent' : ''}${edu.preferredOnly ? ' (preferred)' : ''}` : 'Not stated'}</span></div>
            <div class="fact"><span class="k">Your highest degree</span><span class="v">${esc(edu.resume)}</span></div>
          </div>
        </div>
        <div class="card">
          <h3>JD keyword coverage <span class="muted small">${r.keywords.score === null ? '' : `· ${Math.round(r.keywords.score)}%`}</span></h3>
          <p class="sub">The JD's most frequent terms that aren't skills (numbers show how often each appears). Green ones are in your resume. Use the red ones where they're true for you.</p>
          <div class="chips">${kwChips || '<span class="empty">Not enough text in the JD.</span>'}</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>Resume quality checks <span class="muted small">· ${fmt(r.ats.score)}/100</span></h3>
          <p class="sub">Checks that ATS parsers and recruiters care about.</p>
          <ul class="checks">${checks}</ul>
        </div>
        <div class="card">
          <h3>Learning roadmap</h3>
          <p class="sub">Estimated focused hours to working proficiency for each skill you're missing or only partly cover.</p>
          ${road}
        </div>
      </div>

      <div class="card">
        <h3>Skills you bring beyond the JD</h3>
        <p class="sub">Skills on your resume that this JD doesn't mention. Keep the relevant ones, and trim the rest if space is tight.</p>
        ${extra}
      </div>

      <div class="card export">
        <button class="btn" id="dlMd" type="button">Download report (.md)</button>
        <button class="btn" id="dlJson" type="button">Download data (.json)</button>
        <button class="btn ghost" id="copyBtn" type="button">Copy summary</button>
        <span class="muted small">Analyzed in ${fmt(r.meta.elapsedMs, 1)} ms · ${fmt(r.meta.resumeWords)} resume words · ${fmt(r.meta.jdWords)} JD words</span>
      </div>`;

    const more = $('moreBtn');
    if (more) more.addEventListener('click', () => {
      const plan = $('plan');
      const expanded = plan.classList.toggle('expanded');
      more.textContent = expanded ? 'Show fewer' : `Show all ${recs.length}`;
    });
    $('dlMd').addEventListener('click', () => download(GA.toMarkdown(r), 'resume-gap-report.md', 'text/markdown'));
    $('dlJson').addEventListener('click', () => download(JSON.stringify(r, null, 2), 'resume-gap-report.json', 'application/json'));
    $('copyBtn').addEventListener('click', (e) => copy(summaryText(r), e.currentTarget));

    const settle = () => {
      const ring = els.results.querySelector('.ring .value');
      if (ring) ring.style.strokeDashoffset = String(C * (1 - r.score / 100));
      els.results.querySelectorAll('.bar span[data-w]').forEach((b) => { b.style.width = b.dataset.w + '%'; });
    };
    if (reduceMotion || document.hidden) { settle(); $('scoreNum').textContent = r.score; return; }
    requestAnimationFrame(() => requestAnimationFrame(() => { settle(); countUp($('scoreNum'), r.score, 900); }));
    // Background tabs pause animation frames; make sure the final values always land.
    setTimeout(() => { settle(); const el = $('scoreNum'); if (el) el.textContent = r.score; }, 1100);
  }

  function countUp(el, target, ms) {
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min((t - t0) / ms, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function summaryText(r) {
    const missing = r.skills.required.filter((i) => i.status === 'missing').map((i) => i.name);
    const top = r.recommendations.slice(0, 5).map((x, n) => `${n + 1}. ${x.title}${x.gain ? ` (+${x.gain})` : ''}`);
    return [
      `Match score: ${r.score}/100 (${r.band.label})${r.meta.jobTitle ? ` for ${r.meta.jobTitle}` : ''}`,
      `Required skills matched: ${r.summary.requiredMatched}/${r.summary.requiredTotal}`,
      missing.length ? `Missing required: ${missing.join(', ')}` : 'No missing required skills',
      `Potential after top 5 fixes: ${r.potentialScore}/100`,
      '', 'Top fixes:', ...top,
    ].join('\n');
  }

  function download(content, name, type) {
    const blob = new Blob([content], { type: type + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copy(text, btn) {
    const original = btn.textContent;
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Copied ✓';
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); btn.textContent = 'Copied ✓'; } catch (_) { btn.textContent = 'Copy failed'; }
      ta.remove();
    }
    setTimeout(() => { btn.textContent = original; }, 1600);
  }

  updateMeta();
})();
