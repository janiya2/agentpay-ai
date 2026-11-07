// AgentPay AI - Autonomous GitHub Code Ingestion & Resilience Engine
// Seamlessly extracts repository file trees, package manifests, and source code samples
// for Gemini 2.5 Flash Autonomous Audits and Interactive Chat Inspector.

export interface GitHubFileContent {
  path: string;
  content: string;
}

export interface GitHubIngestResult {
  isVerifiable: boolean;
  isPlaceholder: boolean;
  owner?: string;
  repo?: string;
  branch?: string;
  repoUrl: string;
  files: GitHubFileContent[];
  fileTreeSummary: string[];
  readmeContent?: string;
  packageJsonContent?: string;
  techStack: string[];
  error?: string;
}

export function parseGitHubUrl(rawUrl: string): { owner?: string; repo?: string; branch?: string; isPlaceholder: boolean } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isPlaceholder: true };
  }

  const clean = rawUrl.trim();

  // Flag known placeholders or dummy links
  if (
    clean === 'https://git.com' ||
    clean === 'http://git.com' ||
    clean === 'git.com' ||
    clean.includes('example.com') ||
    clean.includes('localhost') ||
    clean.length < 10 ||
    !clean.toLowerCase().includes('github.com')
  ) {
    return { isPlaceholder: true };
  }

  // Regex for GitHub formats:
  // https://github.com/owner/repo
  // https://github.com/owner/repo.git
  // https://github.com/owner/repo/tree/branch-name
  // https://github.com/owner/repo/blob/branch-name/path
  const match = clean.match(/github\.com\/([^/]+)\/([^/]+)(?:\/(?:tree|blob)\/([^/]+))?/i);
  if (!match) {
    return { isPlaceholder: true };
  }

  const owner = match[1];
  let repo = match[2].replace(/\.git$/i, '').trim();
  const branch = match[3] || undefined;

  // Additional sanity check on repo name
  if (!owner || !repo || repo === '..' || repo === '.') {
    return { isPlaceholder: true };
  }

  return { owner, repo, branch, isPlaceholder: false };
}

export async function fetchGitHubRepoDetails(repoUrl: string): Promise<GitHubIngestResult> {
  const parsed = parseGitHubUrl(repoUrl);

  if (parsed.isPlaceholder || !parsed.owner || !parsed.repo) {
    return {
      isVerifiable: false,
      isPlaceholder: true,
      repoUrl,
      files: [],
      fileTreeSummary: [],
      techStack: [],
      error: 'The provided URL is a placeholder or not a verifiable GitHub repository.'
    };
  }

  const { owner, repo } = parsed;
  let activeBranch = parsed.branch || 'main';

  const headers: Record<string, string> = {
    'User-Agent': 'AgentPay-AI-CodeAuditor/2.0',
    'Accept': 'application/vnd.github.v3+json'
  };

  // If a GitHub PAT or token is available in environment, use it to bypass unauthenticated rate limits
  const ghToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.NEXT_PUBLIC_GITHUB_TOKEN;
  if (ghToken) {
    headers['Authorization'] = `Bearer ${ghToken}`;
  }

  const files: GitHubFileContent[] = [];
  let fileTreeSummary: string[] = [];
  let readmeContent: string | undefined;
  let packageJsonContent: string | undefined;
  const techStack: Set<string> = new Set();

  try {
    // 1. Try to fetch repository tree via GitHub API
    let treeData: any = null;
    const branchesToTry = parsed.branch ? [parsed.branch, 'main', 'master'] : ['main', 'master', 'develop'];

    for (const b of branchesToTry) {
      try {
        const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${b}?recursive=1`, { 
          headers,
          next: { revalidate: 60 } 
        });
        if (treeRes.ok) {
          const json = await treeRes.json();
          if (json && Array.isArray(json.tree) && json.tree.length > 0) {
            treeData = json;
            activeBranch = b;
            break;
          }
        }
      } catch (err) {
        // try next branch
      }
    }

    if (treeData && Array.isArray(treeData.tree)) {
      const allPaths: string[] = treeData.tree.map((f: any) => f.path).filter((p: string) => typeof p === 'string');
      fileTreeSummary = allPaths.slice(0, 45);

      // Prioritized files to inspect
      const prioritized = [
        allPaths.find(p => p.toLowerCase() === 'package.json'),
        allPaths.find(p => p.toLowerCase() === 'readme.md'),
        allPaths.find(p => p.toLowerCase().includes('page.tsx') || p.toLowerCase().includes('app.tsx') || p.toLowerCase().includes('index.tsx')),
        allPaths.find(p => p.toLowerCase().endsWith('.sol') || p.toLowerCase().endsWith('.py')),
        allPaths.find(p => p.toLowerCase().includes('router') || p.toLowerCase().includes('api') || p.toLowerCase().includes('agent')),
        allPaths.find(p => p.toLowerCase().endsWith('.ts') && !p.toLowerCase().endsWith('.d.ts'))
      ].filter((p): p is string => Boolean(p));

      // Deduplicate targets
      const targets = Array.from(new Set(prioritized)).slice(0, 7);

      for (const targetPath of targets) {
        try {
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${activeBranch}/${targetPath}`;
          const rawRes = await fetch(rawUrl, { next: { revalidate: 60 } });
          if (rawRes.ok) {
            const text = await rawRes.text();
            if (text && text.trim().length > 0) {
              const truncated = text.length > 5000 ? text.substring(0, 5000) + '\n...[truncated for AI context]' : text;
              files.push({ path: targetPath, content: truncated });

              if (targetPath.toLowerCase() === 'readme.md') readmeContent = truncated;
              if (targetPath.toLowerCase() === 'package.json') {
                packageJsonContent = truncated;
                try {
                  const pkg = JSON.parse(text);
                  const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
                  if (allDeps['next']) techStack.add('Next.js');
                  if (allDeps['react']) techStack.add('React');
                  if (allDeps['typescript']) techStack.add('TypeScript');
                  if (allDeps['tailwindcss']) techStack.add('Tailwind CSS');
                  if (allDeps['@paypal/checkout-server-sdk'] || allDeps['@paypal/paypal-js']) techStack.add('PayPal SDK');
                  if (allDeps['@google/generative-ai']) techStack.add('Google Gemini AI');
                  if (allDeps['firebase']) techStack.add('Firebase');
                  if (allDeps['express']) techStack.add('Express.js');
                  if (allDeps['ethers'] || allDeps['web3']) techStack.add('Web3 / Solidity');
                } catch {}
              }
            }
          }
        } catch {
          // continue
        }
      }
    } else {
      // 2. FALLBACK: Direct Raw File Discovery
      // When GitHub API tree is rate-limited (403) or inaccessible, raw.githubusercontent.com is NOT restricted by 60 req/hr limit!
      const fallbackCandidates = [
        'package.json',
        'README.md',
        'src/App.tsx',
        'src/app/page.tsx',
        'src/index.ts',
        'index.js',
        'main.py',
        'app.py',
        'requirements.txt'
      ];

      for (const fallbackPath of fallbackCandidates) {
        for (const b of ['main', 'master', activeBranch]) {
          try {
            const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${b}/${fallbackPath}`;
            const rawRes = await fetch(rawUrl, { next: { revalidate: 60 } });
            if (rawRes.ok) {
              const text = await rawRes.text();
              if (text && text.trim().length > 0) {
                const truncated = text.length > 5000 ? text.substring(0, 5000) + '\n...[truncated for AI context]' : text;
                files.push({ path: fallbackPath, content: truncated });
                fileTreeSummary.push(fallbackPath);

                if (fallbackPath.toLowerCase() === 'readme.md') readmeContent = truncated;
                if (fallbackPath.toLowerCase() === 'package.json') {
                  packageJsonContent = truncated;
                  try {
                    const pkg = JSON.parse(text);
                    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
                    if (allDeps['next']) techStack.add('Next.js');
                    if (allDeps['react']) techStack.add('React');
                    if (allDeps['typescript']) techStack.add('TypeScript');
                    if (allDeps['tailwindcss']) techStack.add('Tailwind CSS');
                    if (allDeps['@google/generative-ai']) techStack.add('Google Gemini AI');
                    if (allDeps['firebase']) techStack.add('Firebase');
                  } catch {}
                }
                break; // Found file in branch b, proceed to next candidate
              }
            }
          } catch {
            // continue
          }
        }
      }
    }

    const isVerifiable = files.length > 0;

    return {
      isVerifiable,
      isPlaceholder: false,
      owner,
      repo,
      branch: activeBranch,
      repoUrl,
      files,
      fileTreeSummary,
      readmeContent,
      packageJsonContent,
      techStack: Array.from(techStack),
      error: isVerifiable ? undefined : 'Repository exists but source files could not be extracted (may be an empty repository or private).'
    };
  } catch (err: any) {
    return {
      isVerifiable: false,
      isPlaceholder: false,
      owner,
      repo,
      branch: activeBranch,
      repoUrl,
      files: [],
      fileTreeSummary: [],
      techStack: [],
      error: err.message || 'GitHub extraction error'
    };
  }
}

