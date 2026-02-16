# Constant Contact Integration Challenge

A Next.js application that integrates with the Constant Contact V3 API to manage contacts. This project provides a full-stack solution with a REST API backend and a React frontend for creating, viewing, and managing contacts.

## Demo

Try the live demo: [https://anedot-cc-challenge.vercel.app/](https://anedot-cc-challenge.vercel.app/)

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **API**: Constant Contact V3 API
- **Runtime**: Node.js 20+

## Features

- **Create Contacts** - Full form with all Constant Contact contact fields
- **View Contacts** - List all contacts with search and filter capabilities
- **View Contact Details** - Modal view with all contact sub-resources
- **Auto Token Refresh** - Automatic OAuth token refresh on 401 errors

## Prerequisites

Before you begin, ensure you have:

1. **Node.js 20+** installed
2. A **Constant Contact Developer Account** with API access
3. **API Credentials** from the [Constant Contact Developer Portal](https://developer.constantcontact.com/)

## Environment Setup

### 1. Clone the repository

```bash
git clone https://github.com/hayshj/anedot-cc-challenge
cd anedot-cc-challenge
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create environment file

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your Constant Contact API credentials:

```env
CC_BASE_URL=https://api.cc.email/v3
CC_CLIENT_ID=your_client_id_here
CC_ACCESS_TOKEN=your_access_token_here
CC_REFRESH_TOKEN=your_refresh_token_here
```

### 4. Obtaining Constant Contact Credentials

#### Create a Developer Account and App

1. Go to the [Constant Contact Developer Portal](https://developer.constantcontact.com/login/index.html) and create an account
   - You'll need access to an email inbox to complete verification
2. After verifying your developer account, create a new application named `developer_test`
3. When configuring the app:
   - Click **Device** (grant type / auth flow)
   - Enable or select **Long-Lived Tokens**
4. Copy the generated Client ID to your `.env.local` file as `CC_CLIENT_ID`

#### Get Access and Refresh Tokens (Device Flow)

**Step 1: Request a device code**

```bash
curl --location --request POST \
  "https://authz.constantcontact.com/oauth2/default/v1/device/authorize" \
  --header "Content-Type: application/x-www-form-urlencoded" \
  --header "Accept: application/json" \
  --data-urlencode "client_id=YOUR_CLIENT_ID_HERE" \
  --data-urlencode "scope=contact_data offline_access"
```

You'll receive a response like:

```json
{
  "device_code": "abc123",
  "user_code": "WXYZ-9999",
  "verification_uri_complete": "https://authz.constantcontact.com/activate?user_code=WXYZ-9999",
  "expires_in": 600
}
```

**Step 2: Authorize in browser**

Open the `verification_uri_complete` URL in your browser, log in, and approve the app.

**Step 3: Exchange device code for tokens**

```bash
curl --location --request POST \
  "https://authz.constantcontact.com/oauth2/default/v1/token" \
  --header "Content-Type: application/x-www-form-urlencoded" \
  --header "Accept: application/json" \
  --data-urlencode "client_id=YOUR_CLIENT_ID_HERE" \
  --data-urlencode "device_code=DEVICE_CODE_FROM_STEP_1" \
  --data-urlencode "grant_type=urn:ietf:params:oauth:grant-type:device_code"
```

You'll receive your tokens:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "def456...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

**Step 4: Update .env.local**

Add the tokens to your `.env.local` file:

```env
CC_BASE_URL=https://api.cc.email/v3
CC_CLIENT_ID=your_client_id
CC_ACCESS_TOKEN=eyJhbGciOiJIUzI1NiIs...
CC_REFRESH_TOKEN=def456...
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Endpoints

### Contacts Collection

#### `GET /api/contacts`

Fetch a list of contacts with optional filters.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer (1-500) | Results per page (default: 50) |
| `status` | string | Filter by status: `all`, `active`, `deleted`, `not_set`, `pending_confirmation`, `temp_hold`, `unsubscribed` |
| `email` | string | Search by specific email address |
| `lists` | string | Comma-separated list IDs (max 25) |
| `tags` | string | Comma-separated tag IDs (max 50) |
| `segment_id` | string | Single segment ID |
| `sms_status` | string | Filter by SMS status: `all`, `explicit`, `unsubscribed`, `pending_confirmation`, `not_set` |
| `include` | string | Include sub-resources: `custom_fields`, `list_memberships`, `phone_numbers`, `street_addresses`, `taggings`, `notes` |
| `include_count` | boolean | Include total count in response |
| `created_after` | string | ISO-8601 date filter |
| `created_before` | string | ISO-8601 date filter |
| `updated_after` | string | ISO-8601 date filter |
| `updated_before` | string | ISO-8601 date filter |

**Example:**

```bash
curl "http://localhost:3000/api/contacts?limit=10&status=active&include_count=true"
```

#### `POST /api/contacts`

Create a new contact.

**Required Fields:**
- `create_source`: `"Account"` or `"Contact"`
- At least one of: `first_name`, `last_name`, `email_address`, or `sms_channel`

**Example Request:**

```bash
curl -X POST "http://localhost:3000/api/contacts" \
  -H "Content-Type: application/json" \
  -d '{
    "create_source": "Account",
    "email_address": {
      "address": "john@example.com",
      "permission_to_send": "explicit"
    },
    "first_name": "John",
    "last_name": "Doe",
    "company_name": "Acme Inc.",
    "job_title": "Developer",
    "birthday_month": 6,
    "birthday_day": 15
  }'
```

### Single Contact

#### `GET /api/contacts/:id`

Fetch a single contact by ID.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `include` | string | Include sub-resources (same as collection endpoint) |

**Example:**

```bash
curl "http://localhost:3000/api/contacts/04fe9a-a579-43c5-bb1a-58ed29bf0a6a?include=phone_numbers,street_addresses"
```

## Frontend Pages

### Home Page (`/`)

Displays a list of all contacts with:
- Contact name and email
- Company name
- Click to view detailed modal

### Create Contact (`/contacts/new`)

Full-featured form with all Constant Contact fields:

| Field | Type | Notes |
|-------|------|-------|
| Email address | email | If provided, permission must be `explicit` |
| Permission to send | select | `implicit` or `explicit` |
| First name | text | Max 50 characters |
| Last name | text | Max 50 characters |
| Job title | text | Max 50 characters |
| Company name | text | Max 50 characters |
| Create source | select | `Account` or `Contact` |
| Birthday month | number | 1-12 |
| Birthday day | number | 1-31 |
| Anniversary | date | Various formats accepted |
| SMS full address | text | Phone number (e.g., `12025551234`) |
| SMS channel consents | JSON | Required if SMS is provided |
| List memberships | text | Comma-separated list IDs |
| Taggings | text | Comma-separated tag IDs |
| Custom fields | JSON | Array of custom field objects |
| Phone numbers | JSON | Array (max 3) |
| Street addresses | JSON | Array (max 3) |
| Notes | JSON | Array (max 150) |

## SMS Channel Configuration

When adding SMS to a contact, the `sms_channel_consents` field requires:

```json
[{"sms_consent_permission": "explicit", "consent_type": "promotional_sms"}]
```

**Valid `consent_type` values:**
- `promotional_sms` - Marketing/promotional messages

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── contacts/
│   │       ├── route.ts          # GET (list) & POST (create)
│   │       └── [id]/
│   │           └── route.ts      # GET (single) & DELETE
│   ├── contacts/
│   │   └── new/
│   │       └── page.tsx          # Create contact form
│   ├── page.tsx                  # Contacts list page
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
├── lib/
│   └── constantContact.ts        # CC API client with token refresh
└── types/
    └── constantContact.ts        # TypeScript types
```

## API Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 202 | Accepted (async processing, retry for results) |
| 204 | No Content (successful delete) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (duplicate contact) |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

## Validation Rules

The API enforces Constant Contact's validation rules:

- **Email**: If provided, `permission_to_send` must be `explicit`
- **Birthday**: Both `birthday_month` and `birthday_day` must be provided together
- **SMS**: If `sms_channel` is provided, `sms_channel_consents` must be a non-empty array
- **Arrays**:
  - `phone_numbers`: max 3 items
  - `street_addresses`: max 3 items
  - `custom_fields`: max 25 items
  - `notes`: max 150 items
  - `list_memberships`: max 50 items
  - `taggings`: max 50 items

## Scripts

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Token Refresh

The application automatically handles OAuth token refresh:

1. On 401 response, the app uses `CC_REFRESH_TOKEN` to get a new access token
2. The new token is cached in memory for subsequent requests
3. No manual intervention required during normal operation

## Troubleshooting

### "Missing environment variable" error

Ensure all required variables are set in `.env.local`:
- `CC_BASE_URL`
- `CC_CLIENT_ID`
- `CC_ACCESS_TOKEN`
- `CC_REFRESH_TOKEN`

### "Invalid phone number" error

Ensure the phone number:
- Is in E.164 format (e.g., `12025551234`)
- Uses a valid area code (not `555` which is reserved for fiction)

### "consent_type does not have a valid value" error

Use `promotional_sms` as the `consent_type` value:

```json
[{"sms_consent_permission": "explicit", "consent_type": "promotional_sms"}]
```

### Token refresh fails

1. Verify `CC_REFRESH_TOKEN` is correct
2. Check if the refresh token has expired
3. Re-authenticate to obtain new tokens

## License

This project is for demonstration purposes as part of a coding challenge.