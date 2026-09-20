// scripts/fetch-jobs.js
//
// Pulls live job postings from public, free, no-API-key-required sources,
// filters them down to IT/tech-relevant roles specifically, and writes the
// result to docs/jobs.json, which the frontend (docs/index.html) loads with
// a plain fetch(). Meant to be run on a schedule by
// .github/workflows/fetch-jobs.yml.
//
// Requires Node 18+ (for global fetch). GitHub Actions runners have this.

const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.join(__dirname, '..', 'docs', 'jobs.json');
const MAX_JOBS = 300; // keep the JSON file small and fast to load

// ---------- IT/tech relevance filter ----------
// Applied to every source below so the whole feed stays scoped to IT/tech,
// rather than a broad mix of unrelated categories (marketing, sales, etc.).
const IT_KEYWORDS = [
  'developer', 'engineer', 'engineering', 'software', 'programmer', 'coder',
  'devops', 'sysadmin', 'system administrator', 'systems administrator',
  'network admin', 'network engineer',
  // cybersecurity — expanded, since this is a specific priority
  'cybersecurity', 'cyber security', 'security engineer', 'security analyst',
  'security architect', 'security consultant', 'security specialist',
  'infosec', 'information security', 'network security', 'cloud security',
  'application security', 'appsec', 'penetration tester', 'pentest',
  'pen tester', 'ethical hacker', 'red team', 'blue team', 'purple team',
  'devsecops', 'soc analyst', 'security operations', 'threat intelligence',
  'threat hunter', 'vulnerability management', 'vulnerability analyst',
  'incident response', 'incident responder', 'forensics analyst',
  'grc analyst', 'governance risk compliance', 'ciso', 'siem', 'firewall',
  'identity and access management', 'iam engineer', 'malware analyst',
  'security compliance', 'risk analyst',
  // qa / data / cloud / general IT
  'qa', 'quality assurance', 'test automation', 'sdet',
  'data scientist', 'data engineer', 'data analyst', 'database administrator',
  'dba', 'cloud engineer', 'cloud architect', 'aws', 'azure', 'gcp',
  'frontend', 'front-end', 'backend', 'back-end', 'full stack', 'full-stack',
  'web developer', 'mobile developer', 'ios developer', 'android developer',
  'sre', 'site reliability', 'it support', 'help desk', 'helpdesk',
  'technical support', 'sql', 'python', 'java', 'javascript', 'node.js',
  'react', 'php developer', 'machine learning', 'ml engineer', 'ai engineer',
  'platform engineer', 'infrastructure engineer', 'solutions architect',
  'systems engineer', 'it technician', 'information technology', 'cto',
  'tech lead'
];

function isITJob(title, extraText){
  const hay = ((title || '') + ' ' + (extraText || '')).toLowerCase();
  return IT_KEYWORDS.some(function(k){ return hay.indexOf(k) !== -1; });
}

// ---------- RemoteOK ----------
// Public API, no key needed. Docs (informal): https://remoteok.com/api
async function fetchRemoteOK() {
  try {
    const res = await fetch('https://remoteok.com/api', {
      headers: {
        // RemoteOK blocks requests with no user-agent
        'User-Agent': 'AriaJobFetcher/1.0 (personal project; contact via GitHub repo)'
      }
    });
    if (!res.ok) throw new Error('RemoteOK responded with status ' + res.status);
    const data = await res.json();

    // The first array element is usually a legal/notice object, not a job —
    // filter to only entries that look like real postings, and to IT roles.
    return data
      .filter((item) => item && item.id && item.position)
      .filter((item) => isITJob(item.position, (item.tags || []).join(' ')))
      .map((item) => ({
        id: 'remoteok-' + item.id,
        title: item.position,
        company: item.company || 'Unknown company',
        source: 'RemoteOK',
        url: item.url || item.apply_url || ('https://remoteok.com/remote-jobs/' + item.id),
        setup: 'wfh',
        location: 'Remote — check the listing for PH eligibility',
        salaryMin: typeof item.salary_min === 'number' ? item.salary_min : null,
        salaryMax: typeof item.salary_max === 'number' ? item.salary_max : null,
        salaryCurrency: 'USD', // RemoteOK salaries are USD, unlike the PHP figures elsewhere in this app
        postedAt: item.date ? new Date(item.date).getTime() : Date.now()
      }));
  } catch (err) {
    console.error('RemoteOK fetch failed:', err.message);
    return [];
  }
}

// ---------- Remotive ----------
// Public API, no key needed. Docs: https://remotive.com/api-documentation
async function fetchRemotive() {
  try {
    const res = await fetch('https://remotive.com/api/remote-jobs?limit=150');
    if (!res.ok) throw new Error('Remotive responded with status ' + res.status);
    const data = await res.json();
    const list = Array.isArray(data.jobs) ? data.jobs : [];

    return list
      .filter((item) => isITJob(item.title, item.category))
      .map((item) => ({
        id: 'remotive-' + item.id,
        title: item.title,
        company: item.company_name || 'Unknown company',
        source: 'Remotive',
        url: item.url,
        setup: 'wfh',
        location:
          item.candidate_required_location && item.candidate_required_location !== 'Anywhere'
            ? item.candidate_required_location
            : 'Remote — check the listing for PH eligibility',
        // Remotive gives salary as loose free text ("$50k - $70k", "Competitive", etc.)
        // rather than clean numbers, so we keep it as text and leave min/max null.
        // The frontend already treats null salary as "not disclosed."
        salaryMin: null,
        salaryMax: null,
        salaryText: item.salary || null,
        category: item.category || null,
        postedAt: item.publication_date ? new Date(item.publication_date).getTime() : Date.now()
      }));
  } catch (err) {
    console.error('Remotive fetch failed:', err.message);
    return [];
  }
}

// ---------- Jobicy ----------
// Public API, no key needed. Docs: https://jobicy.com/jobs-rss-feed (API endpoint below).
// NOTE: field names below are best-effort from Jobicy's documented response shape.
// This could not be tested live from this environment (network-restricted sandbox) —
// check the GitHub Actions log after the first run to confirm it's parsing correctly.
async function fetchJobicy() {
  try {
    const res = await fetch('https://jobicy.com/api/v2/remote-jobs?count=100');
    if (!res.ok) throw new Error('Jobicy responded with status ' + res.status);
    const data = await res.json();
    const list = Array.isArray(data.jobs) ? data.jobs : [];

    return list
      .filter((item) => isITJob(item.jobTitle, (item.jobIndustry || []).join(' ') + ' ' + (item.jobType || [])))
      .map((item) => ({
        id: 'jobicy-' + (item.id || item.url),
        title: item.jobTitle,
        company: item.companyName || 'Unknown company',
        source: 'Jobicy',
        url: item.url,
        setup: 'wfh',
        location: item.jobGeo && item.jobGeo !== 'Worldwide'
          ? item.jobGeo
          : 'Remote — check the listing for PH eligibility',
        salaryMin: typeof item.annualSalaryMin === 'number' ? item.annualSalaryMin : null,
        salaryMax: typeof item.annualSalaryMax === 'number' ? item.annualSalaryMax : null,
        salaryCurrency: item.salaryCurrency || 'USD',
        postedAt: item.pubDate ? new Date(item.pubDate).getTime() : Date.now()
      }));
  } catch (err) {
    console.error('Jobicy fetch failed:', err.message);
    return [];
  }
}

// ---------- Arbeitnow ----------
// Public API, no key needed. Docs: https://www.arbeitnow.com/api/job-board-api
// NOTE: same caveat as Jobicy above — best-effort field mapping, not tested live here.
async function fetchArbeitnow() {
  try {
    const res = await fetch('https://www.arbeitnow.com/api/job-board-api');
    if (!res.ok) throw new Error('Arbeitnow responded with status ' + res.status);
    const data = await res.json();
    const list = Array.isArray(data.data) ? data.data : [];

    return list
      .filter((item) => item.remote === true) // keep this to remote-only, consistent with the rest
      .filter((item) => isITJob(item.title, (item.tags || []).join(' ')))
      .map((item) => ({
        id: 'arbeitnow-' + item.slug,
        title: item.title,
        company: item.company_name || 'Unknown company',
        source: 'Arbeitnow',
        url: item.url,
        setup: 'wfh',
        location: 'Remote — check the listing for PH eligibility',
        salaryMin: null,
        salaryMax: null,
        postedAt: item.created_at ? item.created_at * 1000 : Date.now() // Arbeitnow uses unix seconds
      }));
  } catch (err) {
    console.error('Arbeitnow fetch failed:', err.message);
    return [];
  }
}

async function main() {
  const [remoteok, remotive, jobicy, arbeitnow] = await Promise.all([
    fetchRemoteOK(),
    fetchRemotive(),
    fetchJobicy(),
    fetchArbeitnow()
  ]);

  const all = [...remoteok, ...remotive, ...jobicy, ...arbeitnow]
    .filter((j) => j.title && j.company)
    .sort((a, b) => b.postedAt - a.postedAt)
    .slice(0, MAX_JOBS);

  const payload = {
    generatedAt: new Date().toISOString(),
    scope: 'IT/tech roles only, filtered by title+tags keyword match',
    sources: {
      remoteok: remoteok.length,
      remotive: remotive.length,
      jobicy: jobicy.length,
      arbeitnow: arbeitnow.length
    },
    count: all.length,
    jobs: all
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));
  console.log('Wrote ' + all.length + ' IT/tech jobs to ' + OUTPUT_PATH);
  console.log(
    '  RemoteOK: ' + remoteok.length +
    ', Remotive: ' + remotive.length +
    ', Jobicy: ' + jobicy.length +
    ', Arbeitnow: ' + arbeitnow.length
  );
}

main().catch((err) => {
  console.error('Fatal error in fetch-jobs.js:', err);
  process.exit(1);
});

