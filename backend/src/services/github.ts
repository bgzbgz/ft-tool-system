/**
 * GitHub Integration Service
 * Handles pushing generated tools to independent GitHub repository
 * and triggering GitHub Actions for database provisioning
 */

// ========== TYPES ==========

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

export interface ToolDeployment {
  tool_id: string;
  tool_slug: string;
  tool_name: string;
  tool_html: string;
  category: 'b2b_product' | 'b2b_service' | 'b2c_product' | 'b2c_service';
  metadata: ToolMetadata;
}

export interface ToolMetadata {
  decision: string;
  tagline: string;
  estimated_time: string;
  created_at: string;
  qa_score?: number;
  revision_count?: number;
  created_by?: string;
}

export interface DeploymentResult {
  success: boolean;
  commit_sha?: string;
  tool_url?: string;
  error?: string;
}

export interface GitHubFileContent {
  path: string;
  content: string;
  message: string;
}

// ========== CONFIGURATION ==========

function getGitHubConfig(): GitHubConfig {
  return {
    token: process.env.GITHUB_TOKEN || '',
    owner: process.env.GITHUB_TOOLS_OWNER || '',
    repo: process.env.GITHUB_TOOLS_REPO || 'generated-tools',
    branch: process.env.GITHUB_TOOLS_BRANCH || 'main'
  };
}

export function isGitHubConfigured(): boolean {
  const config = getGitHubConfig();
  return !!(config.token && config.owner && config.repo);
}

// ========== API HELPERS ==========

async function githubRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
): Promise<any> {
  const config = getGitHubConfig();

  const response = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// ========== FILE OPERATIONS ==========

/**
 * Get file SHA if it exists (required for updates)
 */
async function getFileSha(path: string): Promise<string | null> {
  const config = getGitHubConfig();

  try {
    const response = await githubRequest(
      `/repos/${config.owner}/${config.repo}/contents/${path}?ref=${config.branch}`
    );
    return response.sha;
  } catch {
    return null; // File doesn't exist
  }
}

/**
 * Create or update a file in the repository
 */
async function createOrUpdateFile(
  path: string,
  content: string,
  message: string
): Promise<{ sha: string; url: string }> {
  const config = getGitHubConfig();

  // Check if file exists
  const existingSha = await getFileSha(path);

  const body: any = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch: config.branch
  };

  if (existingSha) {
    body.sha = existingSha;
  }

  const response = await githubRequest(
    `/repos/${config.owner}/${config.repo}/contents/${path}`,
    'PUT',
    body
  );

  return {
    sha: response.commit.sha,
    url: response.content.html_url
  };
}

/**
 * Create multiple files in a single commit using the Trees API
 */
async function createMultipleFiles(
  files: GitHubFileContent[]
): Promise<{ sha: string }> {
  const config = getGitHubConfig();

  // 1. Get the latest commit SHA for the branch
  const refResponse = await githubRequest(
    `/repos/${config.owner}/${config.repo}/git/refs/heads/${config.branch}`
  );
  const latestCommitSha = refResponse.object.sha;

  // 2. Get the tree SHA for the latest commit
  const commitResponse = await githubRequest(
    `/repos/${config.owner}/${config.repo}/git/commits/${latestCommitSha}`
  );
  const baseTreeSha = commitResponse.tree.sha;

  // 3. Create blobs for each file
  const treeItems = await Promise.all(
    files.map(async (file) => {
      const blobResponse = await githubRequest(
        `/repos/${config.owner}/${config.repo}/git/blobs`,
        'POST',
        {
          content: file.content,
          encoding: 'utf-8'
        }
      );

      return {
        path: file.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blobResponse.sha
      };
    })
  );

  // 4. Create a new tree
  const treeResponse = await githubRequest(
    `/repos/${config.owner}/${config.repo}/git/trees`,
    'POST',
    {
      base_tree: baseTreeSha,
      tree: treeItems
    }
  );

  // 5. Create a new commit
  const newCommitResponse = await githubRequest(
    `/repos/${config.owner}/${config.repo}/git/commits`,
    'POST',
    {
      message: files[0].message,
      tree: treeResponse.sha,
      parents: [latestCommitSha]
    }
  );

  // 6. Update the reference to point to new commit
  await githubRequest(
    `/repos/${config.owner}/${config.repo}/git/refs/heads/${config.branch}`,
    'POST',
    {
      sha: newCommitResponse.sha,
      force: false
    }
  ).catch(() => {
    // Use PATCH if POST fails (ref already exists)
    return githubRequest(
      `/repos/${config.owner}/${config.repo}/git/refs/heads/${config.branch}`,
      'PUT' as any, // GitHub uses PATCH but we'll handle it
      {
        sha: newCommitResponse.sha,
        force: false
      }
    );
  });

  return { sha: newCommitResponse.sha };
}

// ========== TOOL DEPLOYMENT ==========

/**
 * Deploy a tool to the GitHub repository
 * Creates:
 * - tools/{slug}/index.html (the tool)
 * - tools/{slug}/config.json (metadata)
 * - tools/{slug}/database.yml (database config for GitHub Actions)
 */
export async function deployToolToGitHub(
  deployment: ToolDeployment
): Promise<DeploymentResult> {
  if (!isGitHubConfigured()) {
    return {
      success: false,
      error: 'GitHub integration not configured'
    };
  }

  const config = getGitHubConfig();
  const toolPath = `tools/${deployment.tool_slug}`;

  try {
    console.log(`[GitHub] Deploying tool: ${deployment.tool_slug}`);

    // Prepare files
    const files: GitHubFileContent[] = [
      // Main HTML file
      {
        path: `${toolPath}/index.html`,
        content: deployment.tool_html,
        message: `Add tool: ${deployment.tool_name}\n\nCategory: ${deployment.category}\nDecision: ${deployment.metadata.decision}`
      },
      // Config/metadata file
      {
        path: `${toolPath}/config.json`,
        content: JSON.stringify({
          tool_id: deployment.tool_id,
          tool_name: deployment.tool_name,
          tool_slug: deployment.tool_slug,
          category: deployment.category,
          decision: deployment.metadata.decision,
          tagline: deployment.metadata.tagline,
          estimated_time: deployment.metadata.estimated_time,
          created_at: deployment.metadata.created_at,
          qa_score: deployment.metadata.qa_score,
          revision_count: deployment.metadata.revision_count,
          created_by: deployment.metadata.created_by,
          database: {
            enabled: true,
            type: 'sqlite',
            name: `${deployment.tool_slug}.db`
          }
        }, null, 2),
        message: `Add tool config: ${deployment.tool_name}`
      },
      // Database configuration for GitHub Actions
      {
        path: `${toolPath}/database.yml`,
        content: generateDatabaseConfig(deployment),
        message: `Add database config: ${deployment.tool_name}`
      }
    ];

    // Deploy all files in a single commit
    const result = await createMultipleFiles(files);

    const toolUrl = `https://${config.owner}.github.io/${config.repo}/tools/${deployment.tool_slug}/`;

    console.log(`[GitHub] Tool deployed: ${deployment.tool_slug}`);
    console.log(`[GitHub] Commit SHA: ${result.sha}`);
    console.log(`[GitHub] Tool URL: ${toolUrl}`);

    return {
      success: true,
      commit_sha: result.sha,
      tool_url: toolUrl
    };

  } catch (error) {
    console.error('[GitHub] Deployment error:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Generate database configuration YAML for GitHub Actions
 */
function generateDatabaseConfig(deployment: ToolDeployment): string {
  return `# Database configuration for ${deployment.tool_name}
# This file triggers GitHub Actions to provision a database

tool:
  id: ${deployment.tool_id}
  slug: ${deployment.tool_slug}
  name: ${deployment.tool_name}
  category: ${deployment.category}

database:
  type: sqlite
  name: ${deployment.tool_slug}

  # Tables to create
  tables:
    - name: responses
      columns:
        - name: id
          type: INTEGER
          primary_key: true
          auto_increment: true
        - name: session_id
          type: TEXT
          not_null: true
        - name: user_id
          type: TEXT
        - name: inputs
          type: JSON
        - name: score
          type: INTEGER
        - name: verdict
          type: TEXT
        - name: commitment
          type: TEXT
        - name: created_at
          type: TIMESTAMP
          default: CURRENT_TIMESTAMP

    - name: commitments
      columns:
        - name: id
          type: INTEGER
          primary_key: true
          auto_increment: true
        - name: response_id
          type: INTEGER
          references: responses(id)
        - name: commitment_text
          type: TEXT
        - name: deadline
          type: DATE
        - name: accountability_partner
          type: TEXT
        - name: shared_with
          type: JSON
        - name: status
          type: TEXT
          default: "'active'"
        - name: created_at
          type: TIMESTAMP
          default: CURRENT_TIMESTAMP

api:
  # Auto-generate these endpoints
  endpoints:
    - path: /api/responses
      methods: [GET, POST]
      table: responses
    - path: /api/commitments
      methods: [GET, POST, PUT]
      table: commitments

hosting:
  # GitHub Pages or custom domain
  type: github_pages
  custom_domain: null
`;
}

// ========== GITHUB ACTIONS TRIGGER ==========

/**
 * Trigger a GitHub Actions workflow
 */
export async function triggerWorkflow(
  workflowId: string,
  inputs: Record<string, string>
): Promise<{ success: boolean; run_id?: number; error?: string }> {
  const config = getGitHubConfig();

  try {
    const response = await githubRequest(
      `/repos/${config.owner}/${config.repo}/actions/workflows/${workflowId}/dispatches`,
      'POST',
      {
        ref: config.branch,
        inputs
      }
    );

    console.log(`[GitHub] Workflow triggered: ${workflowId}`);
    return { success: true };

  } catch (error) {
    console.error('[GitHub] Workflow trigger error:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

/**
 * Trigger database provisioning workflow
 */
export async function triggerDatabaseProvisioning(
  toolSlug: string,
  toolId: string
): Promise<{ success: boolean; error?: string }> {
  return triggerWorkflow('setup-tool-db.yml', {
    tool_slug: toolSlug,
    tool_id: toolId
  });
}

// ========== REPOSITORY MANAGEMENT ==========

/**
 * Check if repository exists
 */
export async function checkRepositoryExists(): Promise<boolean> {
  const config = getGitHubConfig();

  try {
    await githubRequest(`/repos/${config.owner}/${config.repo}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get list of deployed tools
 */
export async function getDeployedTools(): Promise<string[]> {
  const config = getGitHubConfig();

  try {
    const response = await githubRequest(
      `/repos/${config.owner}/${config.repo}/contents/tools?ref=${config.branch}`
    );

    return response
      .filter((item: any) => item.type === 'dir')
      .map((item: any) => item.name);

  } catch {
    return [];
  }
}

/**
 * Get tool config from repository
 */
export async function getToolConfig(toolSlug: string): Promise<any | null> {
  const config = getGitHubConfig();

  try {
    const response = await githubRequest(
      `/repos/${config.owner}/${config.repo}/contents/tools/${toolSlug}/config.json?ref=${config.branch}`
    );

    const content = Buffer.from(response.content, 'base64').toString('utf-8');
    return JSON.parse(content);

  } catch {
    return null;
  }
}

/**
 * Delete a tool from repository
 */
export async function deleteTool(toolSlug: string): Promise<{ success: boolean; error?: string }> {
  const config = getGitHubConfig();

  try {
    // Get all files in the tool directory
    const response = await githubRequest(
      `/repos/${config.owner}/${config.repo}/contents/tools/${toolSlug}?ref=${config.branch}`
    );

    // Delete each file
    for (const file of response) {
      await githubRequest(
        `/repos/${config.owner}/${config.repo}/contents/${file.path}`,
        'DELETE',
        {
          message: `Delete tool: ${toolSlug}`,
          sha: file.sha,
          branch: config.branch
        }
      );
    }

    console.log(`[GitHub] Tool deleted: ${toolSlug}`);
    return { success: true };

  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}
