# V4 GitHub Actions: MongoDB Collection Setup

> **Purpose**: Automatically create MongoDB collection when a tool is deployed
> **Trigger**: Repository dispatch from n8n Deploy Tools workflow
> **Location**: `.github/workflows/create-mongo-collection.yml`

---

## Overview

When a tool is deployed via the Deploy Tools workflow, a GitHub Action is triggered that:

1. Receives the tool metadata (slug, name, category, etc.)
2. Connects to MongoDB Atlas
3. Creates a dedicated collection for the tool: `tool_{slug}`
4. Sets up indexes for efficient queries
5. Inserts initial metadata document
6. Callbacks to n8n to confirm completion

```
n8n Deploy Tools
    │
    │ repository_dispatch
    │ event: create_tool_collection
    ▼
┌─────────────────────────────────────────────────────────────┐
│  GitHub Action: create-mongo-collection                     │
│                                                             │
│  1. Parse payload (tool_slug, collection_name, etc.)        │
│  2. Connect to MongoDB Atlas                                │
│  3. Create collection if not exists                         │
│  4. Create indexes (user_id, created_at, verdict)           │
│  5. Insert metadata document                                │
│  6. POST callback to n8n webhook                            │
└─────────────────────────────────────────────────────────────┘
    │
    │ Callback: mongodb-setup-complete
    ▼
n8n Deploy Tools (continues)
```

---

## Workflow File

Create this file at `.github/workflows/create-mongo-collection.yml`:

```yaml
name: Create MongoDB Collection for Tool

on:
  repository_dispatch:
    types: [create_tool_collection]

jobs:
  create-collection:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install MongoDB driver
        run: npm install mongodb

      - name: Create MongoDB Collection
        env:
          MONGODB_URI: ${{ secrets.MONGODB_URI }}
          MONGODB_DATABASE: ${{ secrets.MONGODB_DATABASE }}
        run: |
          node << 'EOF'
          const { MongoClient } = require('mongodb');

          async function createToolCollection() {
            const payload = ${{ toJson(github.event.client_payload) }};

            console.log('Received payload:', JSON.stringify(payload, null, 2));

            const {
              tool_slug,
              collection_name,
              tool_id,
              tool_name,
              category,
              callback_url
            } = payload;

            if (!collection_name || !tool_id) {
              throw new Error('Missing required fields: collection_name or tool_id');
            }

            const client = new MongoClient(process.env.MONGODB_URI);

            try {
              await client.connect();
              console.log('Connected to MongoDB');

              const db = client.db(process.env.MONGODB_DATABASE);

              // Check if collection already exists
              const collections = await db.listCollections({ name: collection_name }).toArray();

              if (collections.length > 0) {
                console.log(`Collection ${collection_name} already exists, updating metadata...`);
              } else {
                console.log(`Creating collection: ${collection_name}`);
                await db.createCollection(collection_name);
              }

              const collection = db.collection(collection_name);

              // Create indexes
              console.log('Creating indexes...');

              await collection.createIndex({ user_id: 1 }, { name: 'idx_user_id' });
              await collection.createIndex({ created_at: -1 }, { name: 'idx_created_at' });
              await collection.createIndex({ verdict: 1 }, { name: 'idx_verdict' });
              await collection.createIndex({ tool_id: 1 }, { name: 'idx_tool_id' });
              await collection.createIndex(
                { user_id: 1, created_at: -1 },
                { name: 'idx_user_recent' }
              );

              console.log('Indexes created');

              // Insert or update metadata document
              const metadata = {
                _id: 'tool_metadata',
                tool_id: tool_id,
                tool_name: tool_name,
                tool_slug: tool_slug,
                category: category,
                collection_created_at: new Date(),
                collection_updated_at: new Date(),
                schema_version: '4.0',
                indexes: ['user_id', 'created_at', 'verdict', 'tool_id', 'user_recent']
              };

              await collection.updateOne(
                { _id: 'tool_metadata' },
                { $set: metadata },
                { upsert: true }
              );

              console.log('Metadata document inserted/updated');

              // Get collection stats
              const stats = await db.command({ collStats: collection_name });
              console.log(`Collection stats: ${stats.count} documents, ${stats.size} bytes`);

              // Callback to n8n
              if (callback_url) {
                console.log(`Sending callback to: ${callback_url}`);

                const callbackPayload = {
                  job_id: tool_id,
                  collection_name: collection_name,
                  status: 'success',
                  indexes_created: ['user_id', 'created_at', 'verdict', 'tool_id', 'user_recent'],
                  document_count: stats.count,
                  message: 'MongoDB collection created successfully'
                };

                const response = await fetch(callback_url, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(callbackPayload)
                });

                if (response.ok) {
                  console.log('Callback successful');
                } else {
                  console.log('Callback failed:', response.status, await response.text());
                }
              }

              console.log('MongoDB setup complete!');

            } catch (error) {
              console.error('Error:', error);

              // Send error callback
              if (payload.callback_url) {
                await fetch(payload.callback_url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    job_id: payload.tool_id,
                    collection_name: payload.collection_name,
                    status: 'error',
                    error: error.message
                  })
                });
              }

              throw error;

            } finally {
              await client.close();
            }
          }

          createToolCollection().catch(console.error);
          EOF

      - name: Report Status
        if: always()
        run: |
          echo "MongoDB collection setup completed"
          echo "Tool: ${{ github.event.client_payload.tool_name }}"
          echo "Collection: ${{ github.event.client_payload.collection_name }}"
```

---

## Required GitHub Secrets

Set these in your repository: Settings → Secrets and variables → Actions

| Secret | Description | Example |
|--------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/` |
| `MONGODB_DATABASE` | Database name | `ft_tools_db` |

---

## Payload Structure

The n8n Deploy Tools workflow sends this payload:

```json
{
  "event_type": "create_tool_collection",
  "client_payload": {
    "tool_slug": "marketing-agency-fit-checker",
    "collection_name": "tool_marketing_agency_fit_checker",
    "tool_id": "job_abc123",
    "tool_name": "Marketing Agency Fit Checker",
    "category": "b2b_service",
    "callback_url": "https://your-n8n.com/webhook/mongodb-setup-complete"
  }
}
```

---

## Collection Schema

Each tool collection has this structure:

### Metadata Document (always exists)

```javascript
{
  _id: "tool_metadata",
  tool_id: "job_abc123",
  tool_name: "Marketing Agency Fit Checker",
  tool_slug: "marketing-agency-fit-checker",
  category: "b2b_service",
  collection_created_at: ISODate("2026-01-28T12:00:00Z"),
  collection_updated_at: ISODate("2026-01-28T12:00:00Z"),
  schema_version: "4.0",
  indexes: ["user_id", "created_at", "verdict", "tool_id", "user_recent"]
}
```

### User Response Documents

```javascript
{
  _id: ObjectId("..."),
  tool_id: "job_abc123",

  // User identification (from LearnWorlds SSO)
  user_id: "learnworlds_user_456",
  user_email: "student@example.com",
  user_name: "John Doe",

  // Response data (varies by tool)
  responses: {
    budget_alignment: {
      question: "How well does their pricing align with your budget?",
      value: 4,
      max_value: 5,
      weight: 1.2
    },
    industry_expertise: {
      question: "Rate their expertise in your industry",
      value: 3,
      max_value: 5,
      weight: 1.5
    },
    communication_style: {
      question: "How do you rate their communication?",
      value: 5,
      max_value: 5,
      weight: 1.0
    },
    past_results: {
      question: "How impressive are their case studies?",
      value: 4,
      max_value: 5,
      weight: 1.3
    }
  },

  // Calculated results
  raw_score: 16,
  max_possible_score: 20,
  weighted_score: 18.4,
  max_weighted_score: 25,
  percentage: 73.6,

  // Verdict
  verdict: "HIRE",
  verdict_confidence: "medium",
  verdict_details: "Good fit overall with minor concerns about industry expertise",

  // Red flags detected (for b2b_service)
  red_flags: [],
  yellow_flags: ["Industry expertise slightly below threshold"],

  // Negotiation priorities (for HIRE verdict)
  negotiation_priorities: [
    "Request industry-specific case studies",
    "Include performance guarantees in contract"
  ],

  // Commitment (captured at end)
  commitment: {
    text: "I will schedule a discovery call by Friday",
    captured_at: ISODate("2026-01-28T12:15:00Z")
  },

  // Session metadata
  started_at: ISODate("2026-01-28T12:10:00Z"),
  completed_at: ISODate("2026-01-28T12:15:00Z"),
  time_spent_seconds: 300,
  completed: true,

  // Tracking
  source: "learnworlds_course",
  course_id: "sprint-5-agency-selection",
  session_id: "sess_xyz789"
}
```

---

## Indexes Created

| Index | Fields | Purpose |
|-------|--------|---------|
| `idx_user_id` | `user_id: 1` | Find all responses by user |
| `idx_created_at` | `created_at: -1` | Recent responses first |
| `idx_verdict` | `verdict: 1` | Analytics by verdict |
| `idx_tool_id` | `tool_id: 1` | All responses for tool |
| `idx_user_recent` | `user_id: 1, created_at: -1` | User's recent responses |

---

## Alternative: Cleanup Workflow

Optional workflow to clean up unused collections:

`.github/workflows/cleanup-mongo-collection.yml`:

```yaml
name: Cleanup MongoDB Collection

on:
  repository_dispatch:
    types: [delete_tool_collection]

jobs:
  cleanup:
    runs-on: ubuntu-latest

    steps:
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install MongoDB driver
        run: npm install mongodb

      - name: Delete Collection
        env:
          MONGODB_URI: ${{ secrets.MONGODB_URI }}
          MONGODB_DATABASE: ${{ secrets.MONGODB_DATABASE }}
        run: |
          node << 'EOF'
          const { MongoClient } = require('mongodb');

          async function deleteCollection() {
            const { collection_name, confirm_delete } = ${{ toJson(github.event.client_payload) }};

            if (confirm_delete !== 'YES_DELETE_PERMANENTLY') {
              throw new Error('Deletion not confirmed. Set confirm_delete to YES_DELETE_PERMANENTLY');
            }

            const client = new MongoClient(process.env.MONGODB_URI);

            try {
              await client.connect();
              const db = client.db(process.env.MONGODB_DATABASE);

              // Backup metadata before deletion
              const collection = db.collection(collection_name);
              const metadata = await collection.findOne({ _id: 'tool_metadata' });
              console.log('Backing up metadata:', JSON.stringify(metadata));

              // Drop collection
              await collection.drop();
              console.log(`Collection ${collection_name} deleted`);

            } finally {
              await client.close();
            }
          }

          deleteCollection().catch(console.error);
          EOF
```

---

## Testing the Action

### Manual Trigger

You can manually trigger the action from GitHub CLI:

```bash
gh api repos/bgzbgz/ft-tool-system/dispatches \
  -f event_type='create_tool_collection' \
  -f 'client_payload[tool_slug]=test-tool' \
  -f 'client_payload[collection_name]=tool_test_tool' \
  -f 'client_payload[tool_id]=test_001' \
  -f 'client_payload[tool_name]=Test Tool' \
  -f 'client_payload[category]=b2b_service' \
  -f 'client_payload[callback_url]=https://webhook.site/your-test-url'
```

### Verify in MongoDB

```javascript
// In MongoDB shell or Compass
use ft_tools_db

// List all tool collections
db.getCollectionNames().filter(name => name.startsWith('tool_'))

// Check indexes on a collection
db.tool_test_tool.getIndexes()

// View metadata
db.tool_test_tool.findOne({ _id: 'tool_metadata' })
```

---

## Troubleshooting

### Action Fails to Connect

1. Check `MONGODB_URI` secret is set correctly
2. Ensure IP `0.0.0.0/0` is whitelisted in MongoDB Atlas (for GitHub Actions)
3. Check database user has `readWrite` permissions

### Callback Not Received

1. Verify `callback_url` is correct and accessible
2. Check n8n webhook is active and waiting
3. Look at GitHub Actions logs for callback response

### Collection Already Exists

The action handles this gracefully - it updates the metadata and ensures indexes exist.

---

## Security Notes

1. **MongoDB URI**: Stored as GitHub secret, never logged
2. **IP Whitelisting**: Consider using MongoDB Atlas private endpoints for production
3. **Least Privilege**: Create a dedicated MongoDB user with only `readWrite` on `ft_tools_db`
4. **Callback Authentication**: Consider adding HMAC signature to callback for verification
