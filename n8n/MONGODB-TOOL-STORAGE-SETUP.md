# MongoDB Tool Storage Setup Guide

This guide explains how to set up MongoDB storage for generated tools, so each tool gets its own database collection to store:
- **Default Data**: Tool content, questions, scoring configuration
- **Client Data**: User responses with LearnWorlds authentication (name, company, answers)

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Tool HTML      │────▶│  n8n Workflow   │────▶│    MongoDB      │
│  (Form Submit)  │     │  (LearnWorlds   │     │  (Per-Tool      │
│                 │     │   Auth + Store) │     │   Collections)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  LearnWorlds    │
                        │  (User Auth)    │
                        └─────────────────┘
```

## Flow

1. **Tool Deployment** (GitHub Actions)
   - Tool HTML pushed to repository
   - GitHub Action triggers MongoDB collection provisioning
   - Collection created with tool metadata and questions parsed from HTML

2. **User Fills Tool** (Browser)
   - User logs in via LearnWorlds SSO
   - User fills out tool form
   - Form submits to n8n webhook

3. **Response Storage** (n8n → MongoDB)
   - n8n validates LearnWorlds token
   - Extracts user info (name, email, role)
   - Calculates verdict (GO/NO_GO/MAYBE)
   - Stores in tool's MongoDB collection

## Setup Steps

### Step 1: Configure MongoDB

Add your MongoDB connection string to GitHub Secrets:

1. Go to your repository → Settings → Secrets and variables → Actions
2. Add new secret: `MONGODB_URI`
3. Value: `mongodb+srv://username:password@cluster.mongodb.net/?appName=YourApp`

### Step 2: Configure Environment Variables

Add to your `.env` file (or server environment):

```bash
# MongoDB Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?appName=YourApp
MONGODB_TOOL_DB=fast_track_tools

# LearnWorlds (for user authentication)
LEARNWORLDS_SCHOOL_ID=your-school
LEARNWORLDS_CLIENT_ID=your-client-id
LEARNWORLDS_CLIENT_SECRET=your-client-secret
LEARNWORLDS_SSO_SECRET=your-sso-secret
LEARNWORLDS_API_KEY=your-api-key
```

### Step 3: Set Up n8n Workflow

1. **Create MongoDB Credentials in n8n**
   - Go to n8n → Settings → Credentials
   - Add new credential: MongoDB
   - Connection String: Your MongoDB URI
   - Database: `fast_track_tools`

2. **Import the Workflow Nodes**
   - See `mongodb-tool-storage-nodes.json` for the node configuration
   - Create a new workflow with these nodes:
     - Webhook (receives tool submissions)
     - HTTP Request (validates LearnWorlds token)
     - Code (calculates verdict, builds document)
     - MongoDB (inserts response)

3. **Configure LearnWorlds HTTP Node**
   ```
   Method: GET
   URL: https://{{LEARNWORLDS_SCHOOL_ID}}.learnworlds.com/api/v2/users/me
   Headers:
     - Authorization: Bearer {{lw_token from webhook}}
     - Lw-Client: {{LEARNWORLDS_CLIENT_ID}}
   ```

### Step 4: Update Tool HTML

Add this JavaScript to your generated tools to submit responses:

```javascript
// Configuration
const TOOL_SLUG = 'your-tool-slug';
const N8N_WEBHOOK_URL = 'https://your-n8n.com/webhook/tool-response';

// Get LearnWorlds token from cookie
function getLWToken() {
  return document.cookie.split('; ')
    .find(row => row.startsWith('lw_sso_token='))
    ?.split('=')[1];
}

// Generate session ID
function getSessionId() {
  let sessionId = sessionStorage.getItem('ft_session_id');
  if (!sessionId) {
    sessionId = 'sess_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    sessionStorage.setItem('ft_session_id', sessionId);
  }
  return sessionId;
}

// Submit response
async function submitToolResponse(formData, calculatedScore) {
  const lwToken = getLWToken();

  if (!lwToken) {
    // Redirect to login
    window.location.href = '/api/auth/sso-link?return_url=' + encodeURIComponent(window.location.href);
    return;
  }

  const payload = {
    tool_slug: TOOL_SLUG,
    session_id: getSessionId(),
    lw_token: lwToken,
    client_info: {
      name: formData.get('name'),
      company: formData.get('company'),
      email: formData.get('email'),
      job_title: formData.get('job_title')
    },
    inputs: Object.fromEntries(formData),
    score: calculatedScore,
    started_at: window.sessionStartTime?.toISOString(),
    context: {
      user_agent: navigator.userAgent,
      referrer: document.referrer,
      utm_source: new URLSearchParams(window.location.search).get('utm_source'),
      utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign')
    }
  };

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.success) {
      // Show verdict to user
      showVerdict(result.verdict, result.verdict_message);
      // Store response_id for commitment tracking
      sessionStorage.setItem('ft_response_id', result.response_id);
    } else {
      console.error('Submission failed:', result.error);
    }

    return result;
  } catch (error) {
    console.error('Network error:', error);
    throw error;
  }
}

// Track session start time
window.sessionStartTime = new Date();
```

## MongoDB Collection Structure

Each tool gets its own collection named `tool_{tool_slug}`:

### Metadata Document (1 per collection)
```json
{
  "_type": "metadata",
  "tool_id": "tool_abc123",
  "tool_slug": "should-i-buy-this",
  "tool_name": "Should I Buy This?",
  "category": "b2c_product",
  "decision": "Whether to purchase this product",
  "questions": [
    {
      "field_name": "budget",
      "label": "What's your budget?",
      "field_type": "number",
      "required": true
    }
  ],
  "scoring": {
    "pass_threshold": 70,
    "max_score": 100
  },
  "deployed_at": "2024-01-15T10:00:00Z",
  "tool_url": "https://yoursite.github.io/tools/should-i-buy-this/"
}
```

### Response Document (1 per user submission)
```json
{
  "_type": "response",
  "response_id": "resp_abc123_xyz789",
  "session_id": "sess_def456",
  "user": {
    "user_id": "lw_user_123",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "student",
    "school_id": "your-school"
  },
  "client_info": {
    "name": "John Doe",
    "company": "Acme Corp",
    "email": "john@example.com",
    "job_title": "Manager"
  },
  "inputs": {
    "budget": "5000",
    "need_urgency": "high",
    "alternatives": "yes"
  },
  "score": 75,
  "verdict": "GO",
  "verdict_message": "Score 75/100 (75%) meets the threshold. Proceed with confidence.",
  "commitment": {
    "text": "I will make a decision by Friday",
    "deadline": "2024-01-20",
    "accountability_partner": "jane@example.com",
    "status": "active"
  },
  "started_at": "2024-01-15T10:00:00Z",
  "completed_at": "2024-01-15T10:05:30Z",
  "time_spent_seconds": 330,
  "context": {
    "user_agent": "Mozilla/5.0...",
    "referrer": "https://learnworlds.com/course/123",
    "utm_source": "email",
    "utm_campaign": "january-promo"
  }
}
```

## API Endpoints

The backend exposes these endpoints for tool responses:

### Submit Response
```
POST /api/tools/:tool_slug/responses
Authorization: Bearer <lw_token>

Body: {
  session_id, client_info, inputs, score, started_at, context
}

Response: {
  success: true,
  response_id: "resp_...",
  verdict: "GO",
  score: 75
}
```

### Get User's Responses
```
GET /api/tools/:tool_slug/responses
Authorization: Bearer <lw_token>

Response: {
  success: true,
  responses: [...]
}
```

### Get User's History (All Tools)
```
GET /api/tools/user/history
Authorization: Bearer <lw_token>

Response: {
  success: true,
  history: [
    { tool_slug: "...", response_count: 3, latest_response: {...} }
  ]
}
```

### Get Tool Analytics (Admin)
```
GET /api/tools/:tool_slug/analytics
Authorization: Bearer <admin_lw_token>

Response: {
  success: true,
  analytics: {
    total_responses: 150,
    unique_users: 89,
    avg_score: 72.5,
    verdict_distribution: { GO: 80, NO_GO: 45, MAYBE: 25 }
  }
}
```

## n8n Workflow Diagram

```
┌──────────────────┐
│  Webhook         │ ─── POST /tool-response
│  (Tool Response) │     { tool_slug, lw_token, inputs, score, ... }
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  HTTP Request    │ ─── GET learnworlds.com/api/v2/users/me
│  (Validate LW)   │     Authorization: Bearer {lw_token}
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│  IF Node         │────▶│  Auth Failed     │ ─── 401 Response
│  (Auth Valid?)   │ No  │  Response        │
└────────┬─────────┘     └──────────────────┘
         │ Yes
         ▼
┌──────────────────┐
│  Code Node       │ ─── Calculate verdict, generate response_id
│  (Build Doc)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  MongoDB         │ ─── Insert into tool_{slug} collection
│  (Insert)        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Respond         │ ─── 201 { success, response_id, verdict }
│  (Success)       │
└──────────────────┘
```

## Troubleshooting

### "Authentication required" error
- User needs to log in to LearnWorlds first
- Check that `lw_sso_token` cookie is present
- Verify LearnWorlds SSO is configured correctly

### "Collection not found" error
- Tool may not have been deployed with MongoDB provisioning
- Run the GitHub Action manually: Actions → Setup MongoDB Tool Collection → Run workflow

### "MongoDB connection failed" error
- Check `MONGODB_URI` is correct
- Ensure IP whitelist includes your server/GitHub Actions
- Verify database user has read/write permissions

### Questions not being parsed
- Ensure form inputs have `<label>` elements with `for` attribute
- Or add `data-question` attribute to inputs
- Check HTML structure matches expected patterns

## Security Considerations

1. **Never expose MongoDB URI in client code** - always use server-side or n8n
2. **Always validate LearnWorlds tokens** before storing data
3. **Use HTTPS** for all webhook endpoints
4. **Whitelist IPs** in MongoDB Atlas if possible
5. **Set appropriate CORS headers** for tool domains only

## Quick Reference

| Component | Location |
|-----------|----------|
| MongoDB Service | `backend/src/services/toolDatabase.ts` |
| Collection Model | `backend/src/models/toolCollection.ts` |
| API Routes | `backend/src/routes/toolResponses.ts` |
| GitHub Workflow | `.github/workflows/setup-mongodb-collection.yml` |
| n8n Nodes Config | `n8n/mongodb-tool-storage-nodes.json` |
