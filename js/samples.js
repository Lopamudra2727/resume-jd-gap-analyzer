/* Sample inputs (fictional person and company) used by the "Load sample" button and the tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GapSamples = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const resume = `Jordan Rivera
Backend Software Engineer
jordan.rivera@example.com | +1 (555) 012-3456 | linkedin.com/in/jordan-rivera-dev | github.com/jordanrivera-dev

SUMMARY
Backend engineer with 4+ years of experience building Python services and REST APIs for e-commerce and logistics products. Comfortable owning features end to end, from schema design to production monitoring.

EXPERIENCE
Software Engineer II — ParcelPoint Logistics
Jan 2024 – Present
• Built a shipment-tracking platform in Django and PostgreSQL serving 1.2M requests/day with 99.95% uptime.
• Reduced p95 API latency from 420 ms to 140 ms by adding Redis caching and rewriting N+1 ORM queries.
• Designed an event pipeline on RabbitMQ and Celery that processes 300K carrier updates per hour.
• Migrated 14 services to Docker containers on AWS (ECS, S3, RDS), cutting infrastructure cost by 22%.
• Set up GitHub Actions pipelines with automated tests, raising unit-test coverage from 48% to 85%.
• Mentored 3 junior engineers and led weekly code reviews.

Software Engineer — CartNest
Aug 2022 – Dec 2023
• Developed checkout and inventory microservices with Flask and MySQL for 40K daily active users.
• Was responsible for the payments integration with Stripe; shipped refunds and partial captures.
• Wrote pytest suites and contract tests that caught 30+ regressions before release.
• Collaborated with product and design in two-week Scrum sprints.

PROJECTS
Job Radar — side project
• Built an async scraper in Python with aiohttp that indexes 50K job posts per week into Elasticsearch.

EDUCATION
B.Tech in Computer Science — State Technical University, 2018 – 2022

SKILLS
Languages: Python, SQL, JavaScript
Frameworks: Django, Flask, Celery
Data & infra: PostgreSQL, MySQL, Redis, RabbitMQ, Elasticsearch, Docker, AWS, Linux, Git
Practices: REST APIs, unit testing, Agile/Scrum, code review`;

  const jd = `Senior Backend Engineer (Python)
Nimbus Retail Tech — Remote (US)

About the role
You will design and scale the services behind our order management platform, which handles millions of orders for retail brands. You will own services end to end and partner closely with product, data and platform teams.

What you'll do
• Design, build and operate high-throughput Python services and REST APIs.
• Build event-driven systems on Kafka for order and inventory events.
• Deploy and run services on Kubernetes in AWS using Terraform.
• Improve reliability with monitoring, alerting and on-call ownership.
• Mentor engineers and lead design reviews.

Requirements
• 5+ years of professional software engineering experience.
• Strong Python skills and production experience with FastAPI or Django.
• Solid SQL and PostgreSQL experience, including query optimization.
• Experience with Docker, Kubernetes and CI/CD pipelines.
• Experience designing distributed systems and microservices.
• Bachelor's degree in Computer Science or equivalent experience.
• Excellent communication and collaboration skills.

Nice to have
• Experience with Go.
• GraphQL API design.
• Familiarity with Datadog or Prometheus.
• Exposure to Snowflake or other cloud data warehouses.

Benefits
Competitive salary, equity, remote-first culture, and a $1,500 annual learning budget.`;

  return { resume, jd };
});
