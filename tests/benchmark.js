/*
 * Skill-extraction benchmark: hand-labelled sentences (resume and JD style), including traps
 * such as "go above and beyond", "Series C", "react quickly", "express interest".
 * Labels list every taxonomy skill a careful human reader would tag in the sentence.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GapBenchmark = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CASES = [
    ['Built REST APIs with Node.js and Express, backed by MongoDB and Redis.', ['REST APIs', 'Node.js', 'Express.js', 'MongoDB', 'Redis']],
    ['Experience with C/C++ and embedded Linux is required.', ['C', 'C++', 'Linux']],
    ["You'll go above and beyond to help the rest of the team ship features.", []],
    ['Proficient in R and Python for statistical analysis; Tableau for dashboards.', ['R', 'Python', 'Statistics', 'Tableau']],
    ['Our Series C startup is looking for engineers who react quickly to change.', []],
    ['Deployed containerized services to Kubernetes (EKS) with Helm and Terraform.', ['Docker', 'Kubernetes', 'Helm', 'Terraform']],
    ['Developed mobile apps in React Native and Swift; familiar with Jetpack Compose.', ['Mobile Development', 'React Native', 'Swift', 'Jetpack Compose']],
    ['Spring 2023 intern: wrote Java microservices using Spring Boot and JUnit.', ['Java', 'Microservices', 'Spring Boot', 'Spring Framework', 'JUnit']],
    ['Excel at stakeholder communication; advanced Excel and Power BI reporting.', ['Stakeholder Management', 'Communication', 'Excel', 'Power BI']],
    ['Trained PyTorch models for NLP and computer vision; tracked experiments in MLflow.', ['PyTorch', 'NLP', 'Computer Vision', 'MLflow']],
    ['Set up CI/CD with GitHub Actions and Jenkins; monitoring via Prometheus and Grafana.', ['CI/CD', 'GitHub Actions', 'Jenkins', 'Prometheus', 'Grafana']],
    ['Data pipelines in Airflow and dbt load Snowflake; Spark jobs run on Databricks.', ['Data Pipelines', 'Airflow', 'dbt', 'Snowflake', 'Spark', 'Databricks']],
    ['Please express interest by emailing careers@nimbus.example with your CV.', []],
    ['Strong knowledge of data structures, algorithms, and object-oriented design.', ['Data Structures & Algorithms', 'Object-Oriented Programming']],
    ['Built LLM features with LangChain, RAG over a pgvector store, and the OpenAI API.', ['LLMs', 'LangChain', 'RAG', 'Vector Databases', 'OpenAI API']],
    ['Go and Rust services behind gRPC, deployed on Google Cloud.', ['Go', 'Rust', 'gRPC', 'Google Cloud']],
    ['Led a team of 5 and mentored interns; strong problem-solving and attention to detail.', ['Leadership', 'Mentoring', 'Problem Solving', 'Attention to Detail']],
    ['Familiar with Vue, Tailwind, TypeScript and Vite.', ['Vue.js', 'Tailwind CSS', 'TypeScript', 'Vite']],
    ['Wrote SQL against PostgreSQL and SQL Server; tuned slow queries.', ['SQL', 'PostgreSQL', 'SQL Server']],
    ['Penetration testing against the OWASP Top 10; SOC 2 audit prep.', ['Penetration Testing', 'OWASP', 'SOC 2']],
    ['Analyzed churn with Pandas and NumPy in Jupyter, then A/B tested pricing pages.', ['Pandas', 'NumPy', 'Jupyter', 'A/B Testing']],
    ['Managed sprints in Jira, documented runbooks in Confluence, and ran Scrum ceremonies.', ['Jira', 'Confluence', 'Scrum']],
    ['Designed responsive UIs in Figma and built them with React, Redux and Sass.', ['Figma', 'React', 'Redux', 'Sass', 'Responsive Design']],
    ['Handled 2M events/day through Kafka into BigQuery and Looker dashboards.', ['Kafka', 'BigQuery', 'Looker']],
    ['Wrote unit tests with Jest and end-to-end tests with Cypress and Playwright.', ['Unit Testing', 'Jest', 'Integration Testing', 'Cypress', 'Playwright']],
  ];

  // Held-out set: written and labelled after development, never used to tune aliases or guards.
  const HOLDOUT = [
    ['Migrated legacy PHP and jQuery pages to a Next.js app with TypeScript.', ['PHP', 'jQuery', 'Next.js', 'TypeScript']],
    ['Own our Azure infrastructure: AKS clusters, Terraform modules and GitLab CI pipelines.', ['Azure', 'Kubernetes', 'Terraform', 'GitLab CI']],
    ['Comfortable with ambiguity and able to juggle multiple priorities in a fast-paced environment.', ['Adaptability', 'Time Management']],
    ['Built ETL jobs in Python that move data from MySQL into Redshift, orchestrated by Airflow.', ['ETL', 'Python', 'MySQL', 'Redshift', 'Airflow']],
    ['Experience with Kotlin or Java on Android is a must.', ['Kotlin', 'Java', 'Android']],
    ['Our clients range from Series A startups to Fortune 500 companies.', []],
    ['Developed a recommendation engine with XGBoost and served it via FastAPI on GCP.', ['Recommendation Systems', 'XGBoost', 'FastAPI', 'Google Cloud']],
    ['Hands-on with Power BI, DAX and advanced Excel for financial modeling.', ['Power BI', 'Excel', 'Financial Modeling']],
    ['Wrote Bash and PowerShell scripts to automate Windows and Linux server maintenance.', ['Bash', 'PowerShell', 'Linux']],
    ['Ran usability tests and created wireframes and high-fidelity prototypes in Figma.', ['UI/UX', 'Wireframing', 'Figma']],
    ['Implemented OAuth 2.0 login and JWT-based sessions for a Ruby on Rails API.', ['OAuth', 'JWT', 'Rails', 'Ruby']],
    ['Go-to-market strategy experience with B2B SaaS companies.', []],
    ['Knowledge of Elasticsearch, Cassandra and DynamoDB at scale.', ['Elasticsearch', 'Cassandra', 'DynamoDB']],
    ['Coordinated releases with QA and wrote Selenium regression suites in Java.', ['QA', 'Selenium', 'Java', 'Test Automation']],
    ['Presented findings to executives using Tableau and Looker dashboards.', ['Presentation Skills', 'Tableau', 'Looker']],
  ];

  function run(GA, cases) {
    cases = cases || CASES;
    let tp = 0, fp = 0, fn = 0;
    const errors = [];
    for (const [text, expected] of cases) {
      const got = new Set(GA.extractSkills(text).keys());
      const want = new Set(expected);
      const extra = [...got].filter((s) => !want.has(s));
      const missed = [...want].filter((s) => !got.has(s));
      tp += [...got].filter((s) => want.has(s)).length;
      fp += extra.length;
      fn += missed.length;
      if (extra.length || missed.length) errors.push({ text, extra, missed });
    }
    const precision = tp / (tp + fp || 1);
    const recall = tp / (tp + fn || 1);
    const f1 = 2 * precision * recall / (precision + recall || 1);
    return { cases: cases.length, labels: cases.reduce((a, c) => a + c[1].length, 0), tp, fp, fn, precision, recall, f1, errors };
  }

  function timing(GA, samples, runs) {
    runs = runs || 50;
    const now = typeof performance !== 'undefined' ? () => performance.now() : () => Date.now();
    GA.analyze(samples.resume, samples.jd); // warm-up
    const t0 = now();
    for (let i = 0; i < runs; i++) GA.analyze(samples.resume, samples.jd);
    return { runs, avgMs: (now() - t0) / runs };
  }

  return { CASES, HOLDOUT, run, timing };
});
