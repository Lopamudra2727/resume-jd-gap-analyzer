/*
 * Skill taxonomy for the Resume–JD Gap Analyzer.
 *
 * Entry format:  "Canonical|alias|alias~difficulty"
 *   - Every alias (and the canonical name) is matched case-insensitively on word boundaries.
 *   - Prefix an alias with "=" to match it case-sensitively. Used for ambiguous names such as
 *     C, R, Go, React ("react to"), Excel ("excel at"), Spark ("spark ideas").
 *   - "~N" overrides the category's default difficulty (1 = pick up in days … 5 = long-term).
 *
 * Difficulty maps to an estimated number of focused hours needed to reach
 * "can honestly put it on a resume and talk about it in an interview" (see LEARNING_HOURS).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GapSkills = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Estimated focused hours to working proficiency, by difficulty level.
  const LEARNING_HOURS = { 1: 10, 2: 25, 3: 50, 4: 100, 5: 200 };

  const CATEGORIES = [
    {
      name: 'Programming Languages', difficulty: 4, skills: [
        'Python|python3~3', 'Java', 'JavaScript|js|es6|ecmascript~3', 'TypeScript~2',
        'C++|cpp', 'C#|csharp|c sharp', '=C|c language|c programming|ansi c',
        '=Go|golang|go language', '=Rust|rust lang', 'Ruby~3', 'PHP~3', '=Swift|swift language',
        'Kotlin~3', 'Scala', '=R|r programming|r language|rstudio~3', 'MATLAB~3', 'Perl~3',
        'Dart~2', 'Elixir', 'Haskell~5', 'Lua~2', 'Objective-C|objc|objective c',
        'F#|fsharp', 'VBA|visual basic for applications~2', 'Groovy~2', 'Solidity',
        'COBOL', '=Assembly|assembly language|x86 assembly~5', 'Clojure',
        'Bash|bash scripting|shell scripting|shell scripts|shell script~2', 'PowerShell~2', 'SQL~2',
      ],
    },
    {
      name: 'Frontend', difficulty: 3, skills: [
        '=React|react.js|reactjs|react js', 'Angular|angularjs|angular.js', 'Vue.js|vue|vuejs|vue 3',
        'Svelte|sveltekit~2', 'Next.js|nextjs~2', 'Nuxt.js|nuxt|nuxtjs~2', 'HTML|html5~1', 'CSS|css3~2',
        'Sass|scss~1', 'Tailwind CSS|tailwind|tailwindcss~1', 'Bootstrap~1', 'Material UI|mui|material-ui~1',
        'Redux|redux toolkit~2', 'jQuery~1', 'Webpack~2', 'Vite~1',
        'Responsive Design|responsive web design|mobile-first design|responsive ui|responsive layout~2',
        'Web Accessibility|accessibility|wcag|a11y~2', 'D3.js|d3|d3js', 'Three.js|threejs', 'Storybook~1',
      ],
    },
    {
      name: 'Backend & APIs', difficulty: 3, skills: [
        'Node.js|nodejs|node js|=Node', 'Express.js|expressjs|express js|=Express~2', 'NestJS|nest.js',
        'Django', 'Flask~2', 'FastAPI~2', 'Spring Boot|springboot', 'Spring Framework|spring mvc|=Spring',
        'ASP.NET|asp.net core|asp.net mvc', '.NET|dotnet|.net core|.net framework',
        '=Rails|ruby on rails|ror', 'Laravel',
        'REST APIs|restful|rest api|restful api|rest services|restful services|rest endpoints~2',
        'GraphQL~2', 'gRPC~2', 'WebSockets|websocket|socket.io~2',
        'API Design|api development|api integration~2', 'Microservices|microservice|microservice architecture',
        'Celery~2', 'OAuth|oauth2|oauth 2.0|openid connect|oidc~2', 'JWT|json web tokens~1',
      ],
    },
    {
      name: 'Databases', difficulty: 3, skills: [
        'PostgreSQL|postgres|postgresql|psql', 'MySQL', 'SQL Server|mssql|microsoft sql server|t-sql|tsql',
        'Oracle Database|oracle db|oracle|pl/sql|plsql', 'SQLite~1', 'MariaDB~2', 'MongoDB|mongo|mongoose',
        'Cassandra', 'DynamoDB', 'Redis~2', 'Memcached~1', 'Elasticsearch|elastic search|opensearch',
        'Neo4j|cypher query', 'Couchbase', 'Firebase|firestore~2', 'Supabase~2', 'NoSQL~2',
        'Database Design|data modeling|data modelling|schema design|database modeling',
      ],
    },
    {
      name: 'Cloud & DevOps', difficulty: 3, skills: [
        'AWS|amazon web services', 'Azure|microsoft azure', 'Google Cloud|gcp|google cloud platform',
        'Docker|dockerfile|containerization|containerized~2', 'Kubernetes|k8s|eks|aks|gke~4',
        '=Helm|helm charts~2', 'Terraform', 'CloudFormation', 'Pulumi', 'Ansible',
        'Jenkins~2', 'GitHub Actions~1', 'GitLab CI|gitlab ci/cd|gitlab pipelines~1', 'CircleCI~1',
        'ArgoCD|argo cd', 'CI/CD|ci cd|continuous integration|continuous delivery|continuous deployment~2',
        'Linux|unix|ubuntu|rhel|centos', 'Nginx~2', 'AWS Lambda|lambda functions~2', 'EC2~2', 'S3|amazon s3~1',
        'Serverless|serverless architecture', 'Infrastructure as Code|iac', 'Site Reliability Engineering|sre~4',
        'Prometheus~2', 'Grafana~2', 'Datadog~2', 'Splunk', 'New Relic~2', 'ELK Stack|elk|kibana|logstash',
        'OpenShift', 'DevOps',
      ],
    },
    {
      name: 'Data & Analytics', difficulty: 3, skills: [
        '=Excel|microsoft excel|ms excel|advanced excel|excel spreadsheets|vlookup|pivot tables~1',
        'Tableau~2', 'Power BI|powerbi|power bi desktop~2', 'Looker~2', 'Looker Studio|google data studio|data studio~1',
        'Pandas~2', 'NumPy~2', 'Data Analysis|data analytics|data analyst', 'Data Visualization|data viz|data visualisation~2',
        'Statistics|statistical analysis|statistical modeling|statistical modelling|hypothesis testing',
        'A/B Testing|ab testing|a/b test|a/b tested|split testing|experimentation~2',
        'ETL|elt|etl pipelines', 'Data Pipelines|data pipeline|data ingestion', '=Spark|apache spark|pyspark|spark sql~4',
        'Hadoop~4', '=Hive|apache hive', 'Apache Flink|flink~4', 'Airflow|apache airflow', 'dbt|data build tool~2',
        'Snowflake', 'BigQuery|google bigquery', 'Redshift|amazon redshift', 'Databricks',
        'Kafka|apache kafka|kafka streams', 'RabbitMQ~2', 'Data Warehousing|data warehouse|data warehouses',
        'Data Engineering|data engineer~4', 'Google Analytics|ga4~1', 'SAS', 'SPSS~2',
        'Jupyter|jupyter notebook|jupyter notebooks|jupyterlab~1', 'Matplotlib~1', 'Seaborn~1', 'Plotly~1',
      ],
    },
    {
      name: 'AI & Machine Learning', difficulty: 4, skills: [
        'Machine Learning|ml|machine-learning', 'Deep Learning|deep neural networks',
        'NLP|natural language processing', 'Computer Vision|image recognition|object detection',
        'TensorFlow', 'PyTorch', 'Keras~3', 'scikit-learn|sklearn|scikit learn~3', 'XGBoost|lightgbm|catboost~2',
        'Hugging Face|huggingface|hugging face transformers~3', 'LLMs|llm|large language models|large language model~3',
        'Generative AI|genai|gen ai~3', 'LangChain~2', 'LlamaIndex~2',
        'RAG|retrieval augmented generation|retrieval-augmented generation~3', 'Prompt Engineering~1',
        'MLOps|ml ops', 'MLflow~2', 'OpenCV~3', 'Reinforcement Learning~5',
        'Time Series Analysis|time series|time-series forecasting', 'Feature Engineering~3',
        'Model Deployment|model serving|deploying models', 'Vector Databases|vector database|pinecone|weaviate|faiss|pgvector~2',
        'Neural Networks|neural network|cnn|cnns|rnn|lstm', 'Recommendation Systems|recommender systems|recommendation engine',
        'OpenAI API|openai|gpt-4|chatgpt api~1', 'Fine-tuning|fine tuning|lora|peft~3',
      ],
    },
    {
      name: 'Mobile', difficulty: 4, skills: [
        'Android|android sdk|android development', 'iOS|ios development', 'React Native', 'Flutter',
        'SwiftUI~3', 'Jetpack Compose~3', 'Xamarin', 'Mobile Development|mobile app development|mobile apps',
      ],
    },
    {
      name: 'Testing & QA', difficulty: 2, skills: [
        'Unit Testing|unit tests|unit test', 'Jest~1', 'Mocha~1', 'Pytest|py.test~1', 'JUnit~1',
        'Selenium', 'Cypress', 'Playwright', 'Test Automation|automated testing|automation testing|test automation frameworks',
        'TDD|test-driven development|test driven development', 'Postman~1', 'JMeter|load testing|performance testing',
        'Integration Testing|integration test|end-to-end testing|end-to-end test|e2e testing|e2e test',
        'QA|quality assurance', 'Manual Testing~1',
      ],
    },
    {
      name: 'Security', difficulty: 3, skills: [
        'Cybersecurity|cyber security|information security|infosec', 'Penetration Testing|pentesting|pen testing|ethical hacking~4',
        'OWASP|owasp top 10~2', 'SIEM', 'IAM|identity and access management', 'Network Security',
        'Cryptography|encryption', 'SOC 2|soc2~2', 'ISO 27001~2', 'Vulnerability Management|vulnerability assessment|vulnerability scanning',
        'Zero Trust',
      ],
    },
    {
      name: 'Engineering Practices & Tools', difficulty: 2, skills: [
        'Git|github|gitlab|bitbucket|version control~1', 'Jira~1', 'Confluence~1', 'Agile|agile methodologies|agile methodology~1',
        'Scrum~1', 'Kanban~1', 'System Design|systems design~4', 'Distributed Systems|distributed computing~4',
        'Data Structures & Algorithms|data structures|algorithms|data structures and algorithms|dsa~4',
        'Object-Oriented Programming|oop|object oriented programming|object-oriented design|ood~3',
        'Design Patterns~3', 'Code Review|code reviews|peer reviews~1', 'Debugging|troubleshooting~2',
        'Performance Optimization|performance tuning|query optimization~3', 'SDLC|software development life cycle~1',
        'Technical Documentation|technical writing|documentation~1',
      ],
    },
    {
      name: 'Design & UX', difficulty: 2, skills: [
        'Figma', 'Adobe XD', '=Sketch|sketch app', 'UI/UX|ui design|ux design|user experience|user interface design|ux research~3',
        'Wireframing|wireframes|prototyping~1', 'Adobe Photoshop|photoshop~2', 'Adobe Illustrator|illustrator~2',
      ],
    },
    {
      name: 'Business & Product', difficulty: 2, skills: [
        'Product Management|product manager|product owner~4', 'Project Management|pmp|project manager~3',
        'Stakeholder Management|stakeholder|stakeholder engagement~2', 'Requirements Gathering|business requirements|requirement analysis',
        'Product Roadmap|roadmapping|roadmaps', 'Salesforce~3', '=SAP|sap erp|sap hana~4', 'CRM|crm software~1',
        'SEO|search engine optimization~2', 'Digital Marketing~3', 'Financial Modeling|financial modelling~3',
        'Business Analysis|business analyst~3', 'Market Research~2', 'Six Sigma|lean six sigma~3', 'KPIs|kpi|key performance indicators|okrs~1',
      ],
    },
    {
      name: 'Soft Skills', difficulty: 2, soft: true, skills: [
        'Communication|communication skills|written communication|verbal communication|communicator',
        'Leadership|team leadership|led a team|leading teams|team lead|tech lead',
        'Collaboration|teamwork|cross-functional|cross functional|team player|collaborative|collaborated|collaborating',
        'Problem Solving|problem-solving|problem solver', 'Analytical Skills|analytical thinking|analytical mindset',
        'Mentoring|mentorship|mentored|mentor|coaching', 'Time Management|prioritization|prioritisation',
        'Adaptability|adaptable|fast-paced environment', 'Critical Thinking',
        'Presentation Skills|presentations|public speaking|presenting', 'Attention to Detail|detail-oriented|detail oriented',
        'Customer Focus|customer service|client-facing|customer-facing',
      ],
    },
  ];

  // Families = interchangeable / transferable tools. Knowing one sibling earns partial credit.
  const FAMILIES = {
    'Relational databases': ['PostgreSQL', 'MySQL', 'SQL Server', 'Oracle Database', 'SQLite', 'MariaDB'],
    'NoSQL databases': ['MongoDB', 'Cassandra', 'DynamoDB', 'Couchbase', 'Firebase', 'Neo4j'],
    'Cloud platforms': ['AWS', 'Azure', 'Google Cloud'],
    'Frontend frameworks': ['React', 'Angular', 'Vue.js', 'Svelte'],
    'SSR meta-frameworks': ['Next.js', 'Nuxt.js'],
    'Python web frameworks': ['Django', 'Flask', 'FastAPI'],
    'Node.js frameworks': ['Express.js', 'NestJS'],
    'Server-side MVC frameworks': ['Spring Boot', 'ASP.NET', 'Rails', 'Laravel', 'Django'],
    'JVM languages': ['Java', 'Kotlin', 'Scala', 'Groovy'],
    'Systems languages': ['C++', 'Rust', 'Go', 'C'],
    '.NET languages': ['C#', 'F#'],
    'Statistical tools': ['R', 'SAS', 'SPSS', 'MATLAB'],
    'Container orchestration': ['Kubernetes', 'OpenShift'],
    'CI/CD tools': ['Jenkins', 'GitHub Actions', 'GitLab CI', 'CircleCI', 'ArgoCD'],
    'Infrastructure as Code tools': ['Terraform', 'CloudFormation', 'Pulumi', 'Ansible'],
    'Deep learning frameworks': ['TensorFlow', 'PyTorch', 'Keras'],
    'BI tools': ['Tableau', 'Power BI', 'Looker', 'Looker Studio'],
    'Message brokers': ['Kafka', 'RabbitMQ'],
    'Cross-platform mobile': ['React Native', 'Flutter', 'Xamarin'],
    'Unit test frameworks': ['Jest', 'Mocha', 'Pytest', 'JUnit'],
    'E2E test frameworks': ['Selenium', 'Cypress', 'Playwright'],
    'Big data processing': ['Spark', 'Hadoop', 'Hive', 'Apache Flink'],
    'Cloud data warehouses': ['Snowflake', 'BigQuery', 'Redshift', 'Databricks'],
    'Observability tools': ['Prometheus', 'Grafana', 'Datadog', 'Splunk', 'New Relic', 'ELK Stack'],
    'CSS frameworks': ['Tailwind CSS', 'Bootstrap', 'Material UI'],
    'Agile frameworks': ['Agile', 'Scrum', 'Kanban'],
    'In-memory stores': ['Redis', 'Memcached'],
    'Design tools': ['Figma', 'Adobe XD', 'Sketch'],
    'LLM frameworks': ['LangChain', 'LlamaIndex'],
    'Plotting libraries': ['Matplotlib', 'Seaborn', 'Plotly', 'D3.js'],
    'JS bundlers': ['Webpack', 'Vite'],
    'Native mobile': ['Android', 'iOS'],
    'Gradient boosting & classic ML': ['XGBoost', 'scikit-learn'],
    'Pipeline orchestration': ['Airflow', 'dbt'],
    'API styles': ['REST APIs', 'GraphQL', 'gRPC'],
  };

  // Implications: having the key skill is evidence of the listed skills (partial "inferred" credit).
  // Applied transitively, e.g. Express.js → Node.js → JavaScript.
  const IMPLIES = {
    'Django': ['Python'], 'Flask': ['Python'], 'FastAPI': ['Python'], 'Pandas': ['Python'], 'NumPy': ['Python'],
    'scikit-learn': ['Python', 'Machine Learning'], 'Pytest': ['Python', 'Unit Testing'], 'Celery': ['Python'],
    'PyTorch': ['Deep Learning'], 'TensorFlow': ['Deep Learning'], 'Keras': ['Deep Learning'],
    'Deep Learning': ['Machine Learning'], 'XGBoost': ['Machine Learning'], 'NLP': ['Machine Learning'],
    'Computer Vision': ['Machine Learning'], 'Neural Networks': ['Machine Learning'], 'OpenCV': ['Computer Vision'],
    'LangChain': ['LLMs'], 'LlamaIndex': ['LLMs'], 'RAG': ['LLMs'], 'OpenAI API': ['LLMs'], 'Fine-tuning': ['LLMs'],
    'Hugging Face': ['NLP'], 'LLMs': ['Generative AI'], 'MLflow': ['MLOps'],
    'React': ['JavaScript'], 'Vue.js': ['JavaScript'], 'Svelte': ['JavaScript'], 'Angular': ['TypeScript'],
    'Next.js': ['React'], 'Nuxt.js': ['Vue.js'], 'Redux': ['React'], 'React Native': ['React', 'Mobile Development'],
    'jQuery': ['JavaScript'], 'TypeScript': ['JavaScript'], 'Node.js': ['JavaScript'],
    'Express.js': ['Node.js'], 'NestJS': ['Node.js', 'TypeScript'], 'D3.js': ['JavaScript', 'Data Visualization'],
    'Spring Boot': ['Java', 'Spring Framework'], 'Spring Framework': ['Java'], 'JUnit': ['Java', 'Unit Testing'],
    'ASP.NET': ['.NET'], 'Rails': ['Ruby'], 'Laravel': ['PHP'],
    'SwiftUI': ['Swift', 'iOS'], 'Jetpack Compose': ['Kotlin', 'Android'], 'Flutter': ['Dart', 'Mobile Development'],
    'Android': ['Mobile Development'], 'iOS': ['Mobile Development'],
    'Jest': ['Unit Testing'], 'Mocha': ['Unit Testing'],
    'Selenium': ['Test Automation'], 'Cypress': ['Test Automation'], 'Playwright': ['Test Automation'],
    'Kubernetes': ['Docker'], 'OpenShift': ['Kubernetes'], 'Helm': ['Kubernetes'],
    'EC2': ['AWS'], 'S3': ['AWS'], 'AWS Lambda': ['AWS', 'Serverless'], 'DynamoDB': ['AWS', 'NoSQL'],
    'Redshift': ['AWS', 'Data Warehousing'], 'CloudFormation': ['AWS', 'Infrastructure as Code'],
    'BigQuery': ['Google Cloud', 'Data Warehousing'], 'Snowflake': ['Data Warehousing', 'SQL'],
    'Terraform': ['Infrastructure as Code'], 'Pulumi': ['Infrastructure as Code'], 'Ansible': ['Infrastructure as Code'],
    'Jenkins': ['CI/CD'], 'GitHub Actions': ['CI/CD'], 'GitLab CI': ['CI/CD'], 'CircleCI': ['CI/CD'], 'ArgoCD': ['CI/CD'],
    'Scrum': ['Agile'], 'Kanban': ['Agile'],
    'PostgreSQL': ['SQL'], 'MySQL': ['SQL'], 'SQL Server': ['SQL'], 'SQLite': ['SQL'], 'Oracle Database': ['SQL'], 'MariaDB': ['SQL'],
    'MongoDB': ['NoSQL'], 'Cassandra': ['NoSQL'], 'Couchbase': ['NoSQL'], 'Neo4j': ['NoSQL'],
    'Tableau': ['Data Visualization'], 'Power BI': ['Data Visualization'], 'Looker': ['Data Visualization'],
    'Looker Studio': ['Data Visualization'], 'Matplotlib': ['Data Visualization', 'Python'], 'Seaborn': ['Data Visualization', 'Python'],
    'Plotly': ['Data Visualization'], 'Spark': ['Data Engineering'], 'Airflow': ['Data Pipelines'], 'dbt': ['Data Pipelines', 'SQL'],
    'ETL': ['Data Pipelines'], 'Kafka': ['Data Pipelines'], 'Databricks': ['Spark'],
    'Sass': ['CSS'], 'Tailwind CSS': ['CSS'], 'Bootstrap': ['CSS'], 'Material UI': ['React'],
    'Prometheus': ['DevOps'], 'Grafana': ['DevOps'], 'CI/CD': ['DevOps'], 'Infrastructure as Code': ['DevOps'],
    'Penetration Testing': ['Cybersecurity'], 'OWASP': ['Cybersecurity'], 'SIEM': ['Cybersecurity'],
    'Microservices': ['Distributed Systems'], 'TDD': ['Unit Testing'],
    'REST APIs': ['API Design'], 'GraphQL': ['API Design'], 'gRPC': ['API Design'],
  };

  return { CATEGORIES, FAMILIES, IMPLIES, LEARNING_HOURS };
});
