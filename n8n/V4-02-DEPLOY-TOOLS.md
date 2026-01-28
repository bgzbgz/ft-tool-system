# V4 Workflow 2: Deploy Tools

> **Webhook URL**: `https://your-n8n.com/webhook/deploy-tools`
> **Method**: POST
> **Purpose**: Deploy approved tools to GitHub + Create MongoDB collection

---

## Workflow Overview

```
Webhook (Boss Approval)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 1: VALIDATION                                        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ Validate     │ →  │ Fetch Tool   │ →  │ Verify HTML  │   │
│  │ Approval     │    │ from MongoDB │    │ Integrity    │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 2: GITHUB DEPLOYMENT                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ Push HTML    │ →  │ Push Config  │ →  │ Trigger      │   │
│  │ to /tools/   │    │ JSON         │    │ GitHub Action│   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 3: MONGODB COLLECTION SETUP                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ GitHub Action runs and:                              │   │
│  │ 1. Creates collection: tool_{slug}                   │   │
│  │ 2. Sets up indexes                                   │   │
│  │ 3. Inserts tool metadata                             │   │
│  │ 4. Reports back via webhook                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 4: FINALIZATION                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ Update Tool  │ →  │ Generate     │ →  │ Callback to  │   │
│  │ Status       │    │ Live URL     │    │ Boss Office  │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  OUTPUT                                                     │
│  • Tool live at: https://bgzbgz.github.io/ft-tool-system/   │
│                  tools/{tool_slug}/index.html               │
│  • MongoDB collection: ft_tools_db.tool_{tool_slug}         │
│  • Boss receives URL popup                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Node-by-Node Configuration

### Node 1: Deploy Webhook (Trigger)

```json
{
  "name": "Deploy Tools Webhook",
  "type": "n8n-nodes-base.webhook",
  "parameters": {
    "httpMethod": "POST",
    "path": "deploy-tools",
    "responseMode": "responseNode",
    "options": {}
  }
}
```

**Expected Payload**:
```json
{
  "job_id": "job_abc123",
  "boss_id": "boss_001",
  "action": "approve",
  "tool_slug": "marketing-agency-fit-checker",
  "callback_url": "https://backend.com/api/deploy/callback"
}
```

---

### Node 2: Validate Approval (Code)

```javascript
// Validate the approval request
const input = $input.first().json;

// Validate required fields
if (!input.job_id) throw new Error('Missing job_id');
if (!input.tool_slug) throw new Error('Missing tool_slug');
if (input.action !== 'approve') {
  throw new Error(`Invalid action: ${input.action}. Expected 'approve'`);
}

// Sanitize slug (prevent path traversal)
const safeSlug = input.tool_slug
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, '')
  .substring(0, 50);

if (safeSlug !== input.tool_slug) {
  throw new Error('Invalid tool_slug format');
}

return [{
  json: {
    job_id: input.job_id,
    boss_id: input.boss_id,
    tool_slug: safeSlug,
    callback_url: input.callback_url,
    deployment_started: new Date().toISOString()
  }
}];
```

---

### Node 3: Fetch Tool from MongoDB

```json
{
  "operation": "findOne",
  "collection": "generated_tools",
  "query": {
    "job_id": "={{ $json.job_id }}",
    "tool_slug": "={{ $json.tool_slug }}",
    "status": "pending_approval"
  }
}
```

---

### Node 4: Verify Tool Exists (If)

```json
{
  "conditions": {
    "boolean": [
      {
        "value1": "={{ $json._id }}",
        "operation": "isNotEmpty"
      }
    ]
  }
}
```

- **True** → Continue to GitHub Push
- **False** → Error: Tool not found

---

### Node 5: Prepare Deployment Data (Code)

```javascript
// Prepare data for GitHub deployment
const tool = $input.first().json;

// Ensure HTML has proper doctype and meta tags
let html = tool.html_content;

// Add MongoDB collection reference to the HTML (for data storage)
const collectionName = `tool_${tool.tool_slug.replace(/-/g, '_')}`;

// Inject collection name as data attribute in HTML
html = html.replace(
  '<body',
  `<body data-mongo-collection="${collectionName}" data-tool-id="${tool.job_id}"`
);

// Create config.json content
const config = {
  tool_id: tool.job_id,
  tool_name: tool.tool_name,
  tool_slug: tool.tool_slug,
  category: tool.category,
  mongo_collection: collectionName,
  qa_score: tool.qa_score,
  revision_count: tool.revision_count,
  created_at: tool.created_at,
  deployed_at: new Date().toISOString(),
  version: '4.0'
};

return [{
  json: {
    ...tool,
    html_final: html,
    config_json: JSON.stringify(config, null, 2),
    collection_name: collectionName,
    github_path_html: `tools/${tool.tool_slug}/index.html`,
    github_path_config: `tools/${tool.tool_slug}/config.json`
  }
}];
```

---

### Node 6: GitHub - Push HTML (HTTP Request)

```json
{
  "method": "PUT",
  "url": "=https://api.github.com/repos/{{ $env.GITHUB_OWNER }}/{{ $env.GITHUB_REPO }}/contents/{{ $json.github_path_html }}",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Accept",
        "value": "application/vnd.github.v3+json"
      },
      {
        "name": "X-GitHub-Api-Version",
        "value": "2022-11-28"
      }
    ]
  },
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={\n  \"message\": \"Deploy tool: {{ $json.tool_name }}\",\n  \"content\": \"{{ Buffer.from($json.html_final).toString('base64') }}\",\n  \"branch\": \"main\"\n}"
}
```

**Credentials**: HTTP Header Auth
- Header Name: `Authorization`
- Header Value: `Bearer YOUR_GITHUB_TOKEN`

---

### Node 7: GitHub - Push Config (HTTP Request)

```json
{
  "method": "PUT",
  "url": "=https://api.github.com/repos/{{ $env.GITHUB_OWNER }}/{{ $env.GITHUB_REPO }}/contents/{{ $json.github_path_config }}",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Accept",
        "value": "application/vnd.github.v3+json"
      }
    ]
  },
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={\n  \"message\": \"Add config: {{ $json.tool_name }}\",\n  \"content\": \"{{ Buffer.from($json.config_json).toString('base64') }}\",\n  \"branch\": \"main\"\n}"
}
```

---

### Node 8: Trigger GitHub Action (HTTP Request)

This triggers the GitHub Action that creates the MongoDB collection.

```json
{
  "method": "POST",
  "url": "=https://api.github.com/repos/{{ $env.GITHUB_OWNER }}/{{ $env.GITHUB_REPO }}/dispatches",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Accept",
        "value": "application/vnd.github.v3+json"
      }
    ]
  },
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={\n  \"event_type\": \"create_tool_collection\",\n  \"client_payload\": {\n    \"tool_slug\": \"{{ $json.tool_slug }}\",\n    \"collection_name\": \"{{ $json.collection_name }}\",\n    \"tool_id\": \"{{ $json.job_id }}\",\n    \"tool_name\": \"{{ $json.tool_name }}\",\n    \"category\": \"{{ $json.category }}\",\n    \"callback_url\": \"{{ $env.N8N_WEBHOOK_URL }}/webhook/mongodb-setup-complete\"\n  }\n}"
}
```

---

### Node 9: Wait for MongoDB Setup (Wait)

```json
{
  "resume": "webhook",
  "webhookSuffix": "={{ $json.job_id }}-mongodb"
}
```

This pauses the workflow until the GitHub Action completes and calls back.

---

### Node 10: Update Tool Status (MongoDB)

```json
{
  "operation": "updateOne",
  "collection": "generated_tools",
  "query": {
    "job_id": "={{ $json.job_id }}"
  },
  "update": {
    "$set": {
      "status": "deployed",
      "deployed_at": "={{ new Date().toISOString() }}",
      "live_url": "=https://{{ $env.GITHUB_OWNER }}.github.io/{{ $env.GITHUB_REPO }}/tools/{{ $json.tool_slug }}/",
      "mongo_collection": "={{ $json.collection_name }}"
    }
  }
}
```

---

### Node 11: Generate Live URL (Code)

```javascript
// Generate the final live URL
const input = $input.first().json;

const liveUrl = `https://${process.env.GITHUB_OWNER}.github.io/${process.env.GITHUB_REPO}/tools/${input.tool_slug}/`;

// Alternative if using Netlify
// const liveUrl = `https://ft-tools.netlify.app/tools/${input.tool_slug}/`;

return [{
  json: {
    ...input,
    live_url: liveUrl,
    embed_code: `<iframe src="${liveUrl}" width="100%" height="800" frameborder="0"></iframe>`,
    learnworlds_button_url: liveUrl
  }
}];
```

---

### Node 12: Callback to Boss Office (HTTP Request)

```json
{
  "method": "POST",
  "url": "={{ $json.callback_url }}",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": {
    "job_id": "={{ $json.job_id }}",
    "status": "deployed",
    "tool_name": "={{ $json.tool_name }}",
    "tool_slug": "={{ $json.tool_slug }}",
    "live_url": "={{ $json.live_url }}",
    "mongo_collection": "={{ $json.collection_name }}",
    "embed_code": "={{ $json.embed_code }}",
    "message": "Tool deployed successfully! Copy the URL below."
  }
}
```

---

### Node 13: Respond to Webhook

```json
{
  "respondWith": "json",
  "responseBody": {
    "success": true,
    "job_id": "={{ $json.job_id }}",
    "tool_slug": "={{ $json.tool_slug }}",
    "live_url": "={{ $json.live_url }}",
    "mongo_collection": "={{ $json.collection_name }}",
    "message": "Deployment complete"
  },
  "options": {
    "responseCode": 200
  }
}
```

---

## Secondary Webhook: MongoDB Setup Complete

This webhook receives the callback from GitHub Actions when MongoDB collection creation is done.

### Node: MongoDB Setup Complete Webhook

```json
{
  "name": "MongoDB Setup Complete",
  "type": "n8n-nodes-base.webhook",
  "parameters": {
    "httpMethod": "POST",
    "path": "mongodb-setup-complete",
    "responseMode": "lastNode"
  }
}
```

**Expected Payload from GitHub Action**:
```json
{
  "job_id": "job_abc123",
  "collection_name": "tool_marketing_agency_fit_checker",
  "status": "success",
  "indexes_created": ["user_id", "created_at", "verdict"],
  "message": "MongoDB collection created successfully"
}
```

This webhook resumes the waiting Deploy Tools workflow.

---

## File Structure After Deployment

```
ft-tool-system/
├── tools/
│   └── marketing-agency-fit-checker/
│       ├── index.html          # The tool itself
│       └── config.json         # Tool metadata
└── .github/
    └── workflows/
        └── create-mongo-collection.yml  # GitHub Action
```

---

## MongoDB Collection Structure

Each tool gets its own collection: `tool_{slug}`

**Collection Schema**:
```javascript
{
  // Document: User response
  _id: ObjectId,
  tool_id: "job_abc123",
  user_id: "learnworlds_user_123",  // From LearnWorlds SSO
  user_email: "user@example.com",

  // Response data (varies by tool)
  responses: {
    question_1: { value: 5, label: "Budget Alignment" },
    question_2: { value: 3, label: "Industry Expertise" },
    // ... more responses
  },

  // Calculated results
  total_score: 72,
  max_score: 100,
  percentage: 72,
  verdict: "HIRE",
  verdict_details: "Strong fit with minor concerns",

  // Commitment (if captured)
  commitment: {
    text: "I will schedule a call by Friday",
    captured_at: ISODate
  },

  // Metadata
  created_at: ISODate,
  updated_at: ISODate,
  completed: true,
  time_spent_seconds: 180
}
```

**Indexes Created by GitHub Action**:
- `user_id` - For user lookup
- `created_at` - For time-based queries
- `verdict` - For analytics
- `tool_id` - For tool reference

---

## Error Handling

### GitHub Push Fails

```javascript
// Error handler for GitHub push
const error = $input.first().json;

if (error.message?.includes('sha')) {
  // File already exists, need to update
  // Fetch current SHA and retry with update
  return [{
    json: {
      action: 'update_existing',
      needs_sha: true
    }
  }];
}

// Log error
return [{
  json: {
    status: 'error',
    error: error.message,
    retry_possible: false
  }
}];
```

### MongoDB Setup Timeout

Add a timeout node after the Wait node:
- Timeout: 5 minutes
- On timeout: Mark deployment as partial success (GitHub done, MongoDB pending)

---

## Testing

Test payload:
```json
{
  "job_id": "test_deploy_001",
  "boss_id": "boss_test",
  "action": "approve",
  "tool_slug": "test-deployment-tool",
  "callback_url": "https://webhook.site/your-test-url"
}
```
