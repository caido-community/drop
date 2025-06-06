# Drop API Server

A secure, ephemeral message broker for the Caido plugin that facilitates end-to-end encrypted collaboration between security researchers.

**It is possible to use this repo to stand up your own ephemeral message broker for drop if you would not like to use the production service at https://drop.cai.do**. 

## Features

- End-to-end encryption using PGP
- Sender verification using cryptographic signatures
- Timestamp validation to prevent replay attacks
- Ephemeral message storage (7-day retention)
- Public key validation using keys.openpgp.org
- Automatic cleanup of old messages
- Health check endpoint for monitoring
- Docker support for easy deployment

## Technology Stack

- Node.js 20 with TypeScript
- Express.js for the API server
- SQLite for message storage and key caching
- OpenPGP.js for cryptographic operations
- Docker for containerization
- Pino for structured logging

## Prerequisites

- Node.js 20 or later
- Docker and Docker Compose (for containerized deployment)
- npm or yarn package manager

## Setup

### Local Development

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Run the development server:
   ```bash
   pnpm dev
   ```
3. The server will be available at `http://localhost:8787`
   
### Docker Deployment

1. Build and start the containers:
   ```bash
   docker build . -f ./packages/server/Dockerfile -t drop:latest
   docker run drop:latest
   ```

2. The server will be available at `http://localhost:8787`

## API Endpoints

### POST /api/v1/send

Send an encrypted message to a recipient.

Request body:
```json
{
  "to_public_key": "PGP_PUBLIC_KEY_FINGERPRINT",
  "encrypted_data": "BASE64_ENCODED_PGP_ENCRYPTED_PAYLOAD",
  "timestamp": 1234567890,
  "signature": "BASE64_ENCODED_SIGNATURE"
}
```

The signature must cover the concatenated string: `to_public_key|encrypted_data|timestamp`

### POST /api/v1/poll

Retrieve pending encrypted messages.

Request body:
```json
{
  "timestamp": 1234567890,
  "signature": "BASE64_ENCODED_SIGNATURE"
}
```

The signature must cover the timestamp value.

### GET /health

Health check endpoint that verifies database connectivity.

Response:
```json
{
  "status": "healthy"
}
```

## Error Responses

The API uses standard HTTP status codes and returns error messages in the following format:
```json
{
  "error": "Error message description"
}
```

Common error codes:
- 400: Bad Request (missing fields, invalid format)
- 401: Unauthorized (invalid signature or timestamp)
- 404: Not Found (public key not found)
- 409: Conflict (public key revoked)
- 429: Too Many Requests (rate limit exceeded)
- 500: Internal Server Error
- 503: Service Unavailable (keyserver unavailable)

## Security Features

- All user data is end-to-end encrypted using PGP
- Sender authenticity is verified using cryptographic signatures
- Timestamp validation prevents replay attacks (±15 seconds window)
- Public keys are validated against keys.openpgp.org
- Key validation results are cached for 10 minutes
- Messages are automatically deleted after 7 days
- Retrieved messages are immediately deleted from the server
- Maximum encrypted payload size of 1MB

## Message Structure

When decrypted, messages contain the following structure:
```json
{
  "id": 1,                    // For logistics purposes
  "objects": [],             // Set of objects in the message
  "notes": "",              // Notes sent along with the objects (not currently supported)
  "sha256": ""             // SHA256 hash of the objects array
}
```

Supported object types:
- Replay Tabs
- Replay Collections
- Filters
- HTTPQL Queries
- Scopes
- Workflows
- Notes

## Database Schema

The server uses SQLite with two main tables:

1. Messages table:
```sql
id INTEGER PRIMARY KEY,
from_public_key TEXT NOT NULL,
to_public_key TEXT NOT NULL,
encrypted_data TEXT NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

2. Key cache table:
```sql
fingerprint TEXT PRIMARY KEY,
status TEXT NOT NULL,
validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
key TEXT NOT NULL
```

## License

MIT
