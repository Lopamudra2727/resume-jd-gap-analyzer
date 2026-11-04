/* Test suite shared by the Node runner (tests/run-node.js) and the browser runner (tests/index.html). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GapTests = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const fail = (msg) => { throw new Error(msg); };
  const assert = {
    ok: (v, msg) => { if (!v) fail(msg || 'expected truthy value'); },
    equal: (a, b, msg) => { if (a !== b) fail(`${msg ? msg + ': ' : ''}expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
    approx: (a, b, tol, msg) => { if (Math.abs(a - b) > tol) fail(`${msg ? msg + ': ' : ''}expected ${b} ± ${tol}, got ${a}`); },
    has: (set, items, msg) => { for (const i of items) if (!set.has(i)) fail(`${msg ? msg + ': ' : ''}missing "${i}" (got ${JSON.stringify([...set])})`); },
    lacks: (set, items, msg) => { for (const i of items) if (set.has(i)) fail(`${msg ? msg + ': ' : ''}unexpected "${i}" (got ${JSON.stringify([...set])})`); },
    throws: (fn, re) => { try { fn(); } catch (e) { if (re && !re.test(e.message)) fail(`wrong error: ${e.message}`); return; } fail('expected an error'); },
  };

  function register(test, GA, samples) {
    const skillsIn = (t) => new Set(GA.extractSkills(t).keys());
    const NOW = '2026-11-04T12:00:00Z';

    test('taxonomy: builds, 250+ skills, no alias shared by two skills', () => {
      const stats = GA.stats();
      assert.ok(stats.skills >= 250, `only ${stats.skills} skills`);
      const owner = new Map();
      for (const s of GA._index.skills) {
        for (const a of s.aliases) {
          const k = a.toLowerCase();
          if (owner.has(k) && owner.get(k) !== s.name) fail(`alias "${a}" used by "${owner.get(k)}" and "${s.name}"`);
          owner.set(k, s.name);
        }
      }
    });

    test('weights sum to 100', () => {
      assert.equal(Object.values(GA.WEIGHTS).reduce((a, b) => a + b, 0), 100);
    });

    test('extract: common stack', () => {
      assert.has(skillsIn('Built services in Python, Django and PostgreSQL on AWS with Docker.'),
        ['Python', 'Django', 'PostgreSQL', 'AWS', 'Docker']);
    });

    test('extract: aliases and spelling variants', () => {
      const s = skillsIn('Worked with k8s, ReactJS, Postgres, scikit learn, CI-CD and node.js');
      assert.has(s, ['Kubernetes', 'React', 'PostgreSQL', 'scikit-learn', 'CI/CD', 'Node.js']);
    });

    test('extract: ambiguous words are not skills', () => {
      assert.lacks(skillsIn('You will go above and beyond to help the rest of the team.'), ['Go', 'REST APIs']);
      assert.lacks(skillsIn('We are a Series C startup. Engineers react quickly to incidents.'), ['C', 'React']);
      assert.lacks(skillsIn('Excel at communication. Interns join in Spring 2025.'), ['Excel', 'Spring Framework']);
      assert.lacks(skillsIn('Please express interest by email. Help spark innovation.'), ['Express.js', 'Spark']);
    });

    test('extract: short language names in real context', () => {
      assert.has(skillsIn('Strong C/C++ and R skills; services written in Go and Rust.'), ['C', 'C++', 'R', 'Go', 'Rust']);
    });

    test('extract: longest match wins ("React Native" is not "React")', () => {
      const s = skillsIn('Shipped apps with React Native.');
      assert.has(s, ['React Native']);
      assert.lacks(s, ['React']);
      const t = skillsIn('Dashboards in Looker Studio; CI on GitHub Actions.');
      assert.has(t, ['Looker Studio', 'GitHub Actions']);
      assert.lacks(t, ['Looker', 'Git']);
    });

    test('extract: implied sub-terms still count ("AWS" inside "AWS Lambda")', () => {
      assert.has(skillsIn('Deployed on AWS Lambda using Ruby on Rails and SQL Server.'),
        ['AWS Lambda', 'AWS', 'Rails', 'Ruby', 'SQL Server', 'SQL']);
    });

    test('extract: URLs and emails are ignored', () => {
      assert.lacks(skillsIn('github.com/jordan · jordan@react.dev · https://kafka-fan.example.com'), ['Git', 'React', 'Kafka']);
    });

    test('JD: section headers and cues set required vs preferred', () => {
      const jd = GA.parseJD(['Data Platform Engineer', 'Requirements', '- 3+ years of experience with Python and SQL',
        '- Experience with Airflow', '- Exposure to Terraform is a plus', 'Nice to have', '- Snowflake',
        '- Familiarity with dbt', '- You must know Git'].join('\n'));
      const lvl = (n) => jd.skills.get(n) && jd.skills.get(n).level;
      assert.equal(lvl('Python'), 'required', 'Python');
      assert.equal(lvl('SQL'), 'required', 'SQL');
      assert.equal(lvl('Airflow'), 'required', 'Airflow');
      assert.equal(lvl('Terraform'), 'preferred', 'Terraform (cue "is a plus")');
      assert.equal(lvl('Snowflake'), 'preferred', 'Snowflake');
      assert.equal(lvl('dbt'), 'preferred', 'dbt');
      assert.equal(lvl('Git'), 'required', 'Git ("must" overrides section)');
      assert.equal(jd.experience.years, 3);
    });

    test('JD: inline "Label: items" header applies to that line only', () => {
      const jd = GA.parseJD('Nice to have: Kafka, GraphQL\nStrong SQL skills');
      assert.equal(jd.skills.get('Kafka').level, 'preferred');
      assert.equal(jd.skills.get('SQL').level, 'required');
    });

    test('JD: benefits / about-us sections are ignored', () => {
      const jd = GA.parseJD('Requirements\n- Python\nBenefits\n- Free Docker swag and a Kubernetes conference budget');
      assert.ok(jd.skills.has('Python'));
      assert.ok(!jd.skills.has('Docker') && !jd.skills.has('Kubernetes'), 'benefits section leaked skills');
    });

    test('JD: years of experience parsing', () => {
      assert.equal(GA.parseJD('3-5 years of experience building APIs').experience.years, 3);
      assert.equal(GA.parseJD('Requirements\n- 7+ yrs in backend development').experience.years, 7);
      assert.equal(GA.parseJD("You'll grow into a lead within 2 years.").experience, null);
      assert.equal(GA.parseJD('We were founded 12 years ago.').experience, null);
    });

    test('JD: education requirement and "or equivalent"', () => {
      const jd = GA.parseJD("Bachelor's degree in Computer Science or equivalent experience");
      assert.equal(jd.education.level, 2);
      assert.equal(jd.education.equivalentOk, true);
      assert.equal(GA.parseJD('MS or PhD in Statistics').education.level, 3);
    });

    test('resume: merges overlapping date ranges', () => {
      const r = GA.yearsFromDateRanges('Acme  Jan 2020 - Dec 2021\nBeta  Jun 2021 – Present', new Date('2024-06-15'));
      assert.approx(r.years, 4.4, 0.05, 'Jan 2020 → Jun 2024');
      assert.equal(r.ranges.length, 2);
      assert.approx(GA.yearsFromDateRanges('2018 - 2020', new Date('2024-01-01')).years, 2, 0.01, 'year-only');
      assert.approx(GA.yearsFromDateRanges('03/2019 – 06/2020', new Date('2024-01-01')).years, 1.3, 0.05, 'MM/YYYY');
    });

    test('resume: education level detection', () => {
      const lvl = (t) => GA.parseResume('Education\n' + t, new Date(NOW)).education.level;
      assert.equal(lvl('B.Tech in Computer Science, 2022'), 2);
      assert.equal(lvl('M.S. in Data Science'), 3);
      assert.equal(lvl('Ph.D. in Physics'), 4);
      assert.equal(lvl('High school diploma'), 0);
    });

    test('resume: section detection', () => {
      const r = GA.parseResume('Jane Doe\nPROFESSIONAL SUMMARY\nx\nWork Experience\ny\nTechnical Skills:\nPython\nEducation\nz', new Date(NOW));
      assert.has(new Set(r.found), ['summary', 'experience', 'skills', 'education']);
    });

    test('sample: statuses match expectations', () => {
      const r = GA.analyze(samples.resume, samples.jd, { now: NOW });
      const req = new Map(r.skills.required.map((i) => [i.name, i]));
      const pref = new Map(r.skills.preferred.map((i) => [i.name, i]));
      const st = (m, n) => (m.get(n) || {}).status;
      assert.equal(st(req, 'Python'), 'matched', 'Python');
      assert.equal(st(req, 'Django'), 'matched', 'Django');
      assert.equal(st(req, 'PostgreSQL'), 'matched', 'PostgreSQL');
      assert.equal(st(req, 'FastAPI'), 'related', 'FastAPI via Django/Flask');
      assert.equal(st(req, 'Kafka'), 'related', 'Kafka via RabbitMQ');
      assert.equal(st(req, 'CI/CD'), 'inferred', 'CI/CD via GitHub Actions');
      assert.equal(st(req, 'Kubernetes'), 'missing', 'Kubernetes');
      assert.equal(st(req, 'Terraform'), 'missing', 'Terraform');
      assert.equal(st(pref, 'Go'), 'missing', 'Go (preferred)');
      assert.equal(st(pref, 'GraphQL'), 'related', 'GraphQL via REST');
      assert.ok(req.get('Python').inTitle, 'Python should get the job-title boost');
      assert.equal(r.experience.required, 5);
      assert.approx(r.experience.resume, 4.3, 0.1, 'resume years');
      assert.equal(r.education.score, 100);
    });

    test('sample: score is in a sensible range and potential > score', () => {
      const r = GA.analyze(samples.resume, samples.jd, { now: NOW });
      assert.ok(r.score >= 45 && r.score <= 85, `score ${r.score}`);
      assert.ok(r.potentialScore > r.score, 'potential should exceed score');
      assert.ok(r.recommendations.length >= 5, 'expected several recommendations');
      assert.ok(r.roadmap.totalHours > 0, 'expected a learning roadmap');
    });

    test('invariant: score + all recommended gains = 100', () => {
      const r = GA.analyze(samples.resume, samples.jd, { now: NOW });
      const total = r.score + r.recommendations.reduce((a, x) => a + x.gain, 0);
      assert.approx(total, 100, 2, 'score + gains');
    });

    test('perfect skill coverage gives 100 on required skills', () => {
      const jd = 'Requirements\n- Python, Django, PostgreSQL and Docker';
      const resume = 'Experience\nBuilt Django apps in Python on PostgreSQL, shipped with Docker.\nSkills\nPython, Django, PostgreSQL, Docker';
      const r = GA.analyze(resume, jd, { now: NOW });
      assert.equal(r.components.find((c) => c.key === 'required').score, 100);
    });

    test('non-applicable components are dropped and weights renormalised', () => {
      const r = GA.analyze('Skills\nPython', 'Requirements\n- Python', { now: NOW });
      const byKey = Object.fromEntries(r.components.map((c) => [c.key, c]));
      assert.equal(byKey.experience.score, null);
      assert.equal(byKey.education.score, null);
      assert.approx(r.components.reduce((a, c) => a + c.effectiveWeight, 0), 100, 0.2, 'effective weights');
    });

    test('ATS checks: quantified bullets and weak phrasing', () => {
      const resume = ['a@b.co', 'Experience', '• Reduced cloud spend by 30% across 12 services in two quarters',
        '• Was responsible for the deployment process for the whole engineering team'].join('\n');
      const r = GA.analyze(resume, 'Requirements\n- AWS', { now: NOW });
      const q = r.ats.checks.find((c) => c.id === 'quantified');
      const w = r.ats.checks.find((c) => c.id === 'weak');
      assert.ok(q.passed, 'one of two bullets quantified = 50% ≥ 40%');
      assert.ok(!w.passed, '"responsible for" should be flagged');
    });

    test('markdown report contains the score and action plan', () => {
      const r = GA.analyze(samples.resume, samples.jd, { now: NOW });
      const md = GA.toMarkdown(r);
      assert.ok(md.includes(`Match score: ${r.score}/100`), 'score line');
      assert.ok(md.includes('## Action plan'), 'action plan');
    });

    test('empty inputs raise a helpful error', () => {
      assert.throws(() => GA.analyze('', 'jd'), /resume/i);
      assert.throws(() => GA.analyze('resume', '  '), /job description/i);
    });
  }

  return { register, assert };
});
