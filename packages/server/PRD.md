# **Product Requirements Document: Drop API Server**

Version: 1.9  
Date: 2025-04-28

## **1\. Introduction**

Drop is a Caido plugin designed to facilitate secure, end-to-end encrypted collaboration between security researchers ("hackers") by allowing them to share various Caido objects (Replay Tabs, Collections, Filters, etc.).

This document outlines the requirements for the backend API server that powers the Drop plugin. The server acts as a secure, ephemeral message broker, relaying encrypted data packets between users identified by their PGP public key fingerprints.

## **2\. Goals**

* Provide a simple, secure API for sending encrypted data packets between users.  
* Provide an API for users to poll for and retrieve encrypted data packets addressed to them.  
* Ensure end-to-end encryption (E2EE) using PGP; the server must never have access to unencrypted user data.  
* Implement sender verification using cryptographic signatures and timestamp validation.  
* Ensure messages are ephemeral, automatically deleting them after a defined period if not retrieved.  
* Validate the format, existence, and revocation status of PGP public keys (identified by their fingerprints) using the keys.openpgp.org VKS API, with optional caching.

## **3\. User Roles**

* **Caido Plugin User:** Interacts with the Drop plugin within Caido, which in turn communicates with this API server to send and receive shared data. Users are identified by their PGP public key fingerprint.

## **4\. Functional Requirements**

### **4.1. API Endpoints**

The server shall expose two primary HTTPS endpoints under a versioned path:

* POST /api/v1/send: Allows an authenticated user to send an encrypted data packet to another user.  
* POST /api/v1/poll: Allows an authenticated user to retrieve encrypted data packets addressed to them.

### **4.2. Data Handling**

* **Encryption:** All user-shared data (objects, notes, etc.) must be received by the server in a pre-encrypted PGP format (encrypted_data). The server **must not** decrypt this data.  
* **Storage:** Received messages are stored temporarily in a SQLite database (messages.db) with the schema: id (Primary Key), from_public_key (TEXT - Fingerprint), to_public_key (TEXT - Fingerprint), encrypted_data (TEXT), created_at (TIMESTAMP).  
* **Ephemeral Storage:** Messages stored in the database are automatically deleted 7 days after their created_at timestamp if they have not been successfully retrieved via the /poll endpoint.  
* **Retrieval Deletion:** Messages successfully returned to a user via the /poll endpoint are immediately deleted from the database using a SQLite DELETE operation.  
* **Data Size Limit:** The encrypted_data payload size for the /send endpoint is limited to 1MB.  
* **Message Structure:** When decrypted, messages contain the following structure:
  ```json
  {
    "id": number,           // For logistics purposes
    "objects": array,       // Set of objects in the message
    "notes": string,        // Notes sent along with the objects (not currently supported)
    "sha256": string       // SHA256 hash of the objects array
  }
  ```
  The objects array can contain various Caido objects such as:
  * Replay Tabs
  * Replay Collections
  * Filters
  * HTTPQL Queries
  * Scopes
  * Workflows
  * Notes

### **4.3. Authentication & Authorization (Signature Verification)**

* **Sender Identity:** The identity of the user making a request (from_public_key) must be derived and verified from a cryptographic signature provided in the request. The identity is represented by the PGP key fingerprint.  
* **Mechanism:** The server must verify the provided signature against the public key associated with the fingerprint extracted from the signature. This confirms the sender possesses the corresponding private key. The specific data covered by the signature for each endpoint is defined in Section 6\. openpgp.js is the recommended library for handling PGP operations.  
* **Public Key Extraction:** The server must be able to extract the sender's public key fingerprint from the provided signature using openpgp.js.  
* **Timestamp Validation:** Requests for both endpoints include a Unix timestamp which must be signed. The server must validate that this timestamp is within \+/- 15 seconds of the server's current time upon receipt to prevent replay attacks. The server's current time for comparison should be calculated as Math.floor(Date.now() / 1000\).

### **4.4. Public Key Validation**

* **Format:** The server validates that any provided PGP public key fingerprints (to_public_key in /send, extracted fingerprint in /poll) conform to the standard format (e.g., 40-character uppercase hex string). Fingerprints are formatted (uppercase, no 0x prefix) before being used in keyserver lookups.  
* **Registry Check (keys.openpgp.org VKS API):**  
  * **Endpoint:** Uses GET https://keys.openpgp.org/vks/v1/by-fingerprint/\<FINGERPRINT\> to check for key existence.  
  * **Verification Process:**  
    1. Checks SQLite key_cache table for existing validation result.  
    2. Formats fingerprint (uppercase, no 0x).  
    3. Performs fetch call to the VKS endpoint.  
    4. Handles HTTP status codes:  
       * 200 OK: Key potentially exists. Proceeds to parse.  
       * 404 Not Found: Key does not exist. Caches status and returns 404 to client.  
       * 429 Too Many Requests: Logs server-side, returns 503 to client.  
       * 5xx: Keyserver error. Returns 503 to client.  
       * Other: Returns 500 to client.  
    5. If 200 OK, parses the response body using openpgp.js (openpgp.readKey). Handles parsing errors (returns 500).  
    6. Checks the parsed key object for revocation status using openpgp.js methods.  
    7. Updates key_cache table with the final status (valid, revoked, not_found) and the key data.  
    8. Returns result: Continues processing if valid, returns 409 if revoked, or the relevant error code if not found/error.  
  * **Failure:** If the keyserver is unavailable (5xx or fetch error) and no valid cache entry exists, the API request fails (503 Service Unavailable).  
* **Caching (SQLite):**  
  * **Purpose:** Improves performance and reduces load on keys.openpgp.org.  
  * **Mechanism:** Uses a SQLite table named key_cache.  
  * **Schema:**  
    * fingerprint: TEXT PRIMARY KEY  
    * key: TEXT NOT NULL (stores the actual PGP key)  
    * status: TEXT NOT NULL (valid, revoked, not_found)  
    * validated_at: DATETIME DEFAULT CURRENT_TIMESTAMP  
  * **TTL:** Cache entries are considered valid for 10 minutes (600 seconds).  
  * **Flow:** Checks key_cache before calling the VKS API. Updates key_cache after successfully determining the status from the VKS API.

### **4.5. Background Deletion Job**

* **Purpose:** To enforce the 7-day ephemeral storage limit (Section 4.2).  
* **Implementation:** The deletion process is implemented as part of the main application logic:  
  * Uses SQLite's built-in timestamp functions to identify messages older than 7 days.  
  * Deletes messages in batches using SQLite's DELETE operation.  
  * Includes logging and error handling for the deletion process.  
  * Messages are also deleted immediately upon successful retrieval via the /poll endpoint.

## **5\. Non-Functional Requirements**

* **Technology Stack:** The backend API is implemented using a Node.js Express server with TypeScript.  
  * **Compute:** Express.js server handles API request logic, authentication, validation, and external API calls. The implementation language is TypeScript.  
  * **Database:** SQLite database (via better-sqlite3) is used for temporary message storage. The database is named messages.db.  
  * **Caching:** Key validation results are cached in a SQLite table named key_cache with a TTL of 10 minutes.  
  * **Build/Deploy:** npm/yarn is used for dependency management and building.  
* **Security:**  
  * End-to-end encryption is maintained using openpgp.js.  
  * Sender authenticity is verified via PGP signatures.  
  * Timestamp validation prevents replay attacks (15-second window).  
  * Communication with the API must be over HTTPS.  
  * Revoked keys are not allowed for sending or polling.  
  * Base64 encoding/decoding uses standard functions with error handling.  
* **Reliability:** The server provides clear error codes for different failure scenarios (see Section 6). Error handling is implemented for database, keyserver, crypto operations, and caching. If the keyserver is down, the service is effectively down unless valid cache entries exist.  
* **Scalability:** No specific rate limiting is implemented for V1. The system handles a moderate load typical for a collaboration tool add-on. Rate limits imposed by keys.openpgp.org are respected (caching helps).  
* **Data Retention:** Data is strictly ephemeral as defined in section 4.2.

## **6\. API Specification**

### **6.1.** POST /api/v1/send

* **Description:** Sends an encrypted message to a recipient user identified by their PGP key fingerprint.  
* **Request Body:** JSON object  
  {  
    "to_public_key": "\<PGP Public Key Fingerprint of Recipient\>",  
    "encrypted_data": "\<Base64 Encoded PGP Encrypted Payload\>",  
    "timestamp": "\<Unix Timestamp (seconds since epoch)\>",  
    "signature": "\<Base64 Encoded Signature\>"  
  }

* **Validation:**  
  * The server must validate that the timestamp value is within \+/- 15 seconds of the server's current time (Math.floor(Date.now() / 1000\)) upon receipt.  
* **Signature Scope:**  
  * The signature must be a valid PGP signature created by the sender's private key.  
  * It must cover the concatenated string: to_public_key \+ "|" \+ encrypted_data \+ "|" \+ timestamp. The string should be converted to a Uint8Array (e.g., via TextEncoder) before verification.  
  * The server will extract the from_public_key (fingerprint) from this signature using openpgp.js.  
* **Success Response:**  
  * **Code:** 201 Created  
  * **Body:** Empty  
* **Error Responses:**  
  * **Code:** 400 Bad Request  
    * **Reason:** Invalid JSON format, missing fields, encrypted_data exceeds 1MB limit, invalid PGP key fingerprint format for to_public_key, invalid signature format, invalid timestamp format, invalid Base64 encoding.  
    * **Body:** {"error": "Descriptive error message"}  
  * **Code:** 401 Unauthorized  
    * **Reason:** Signature verification failed OR timestamp is outside the allowed 15-second window.  
    * **Body:** {"error": "Invalid signature or timestamp"}  
  * **Code:** 404 Not Found  
    * **Reason:** Sender's public key (fingerprint from signature) or recipient's to_public_key not found on keys.openpgp.org (and not found in cache, if used).  
    * **Body:** {"error": "Public key not found in registry"}  
  * **Code:** 409 Conflict (or similar)  
    * **Reason:** Sender's or Recipient's public key is revoked (based on keyserver check or cache).  
    * **Body:** {"error": "Public key revoked"}  
  * **Code:** 429 Too Many Requests  
    * **Reason:** Internal rate limit exceeded when querying keyserver (should be rare with caching).  
    * **Body:** {"error": "Service temporarily unavailable due to rate limiting"} (or similar generic message)  
  * **Code:** 500 Internal Server Error  
    * **Reason:** Database error (D1), unexpected server issue, crypto library error, cache interaction error.  
    * **Body:** {"error": "Internal server error"}  
  * **Code:** 503 Service Unavailable  
    * **Reason:** Failure communicating with keys.openpgp.org (and cache miss/error, if used).  
    * **Body:** {"error": "Keyserver unavailable"}

### **6.2.** POST /api/v1/poll

* **Description:** Retrieves pending encrypted messages for the requesting user (identified by the fingerprint extracted from the signature).  
* **Request Body:** JSON object  
  {  
    "timestamp": "\<Unix Timestamp (seconds since epoch)\>",  
    "signature": "\<Base64 Encoded Signature\>"  
  }

* **Validation:**  
  * The server must validate that the timestamp value is within \+/- 15 seconds of the server's current time (Math.floor(Date.now() / 1000\)) upon receipt.  
* **Signature Scope:**  
  * The signature must be a valid PGP signature created by the user's private key.  
  * It must cover the timestamp value provided in the request body (convert timestamp number to string then Uint8Array before verification).  
  * The server extracts the polling user's public key fingerprint (to_public_key in the DB context) from this signature using openpgp.js.  
* **Success Response:**  
  * **Code:** 200 OK  
  * **Body:** JSON array of message objects. The array is empty if no messages are pending.  
    \[  
      {  
        "id": "\<Database Row ID\>",  
        "from_public_key": "\<PGP Public Key Fingerprint of Sender\>",  
        "encrypted_data": "\<Base64 Encoded PGP Encrypted Payload\>",  
        "created_at": "\<ISO 8601 Timestamp\>"  
      },  
      // ... more messages  
    \]

* **Error Responses:**  
  * **Code:** 400 Bad Request  
    * **Reason:** Invalid JSON format, missing fields, invalid signature format, invalid timestamp format, invalid Base64 encoding.  
    * **Body:** {"error": "Descriptive error message"}  
  * **Code:** 401 Unauthorized  
    * **Reason:** Signature verification failed OR timestamp is outside the allowed 15-second window.  
    * **Body:** {"error": "Invalid signature or timestamp"}  
  * **Code:** 404 Not Found  
    * **Reason:** Polling user's public key (fingerprint from signature) not found on keys.openpgp.org (and not found in cache, if used).  
    * **Body:** {"error": "Public key not found in registry"}  
  * **Code:** 409 Conflict (or similar)  
    * **Reason:** Polling user's public key is revoked (based on keyserver check or cache).  
    * **Body:** {"error": "Public key revoked"}  
  * **Code:** 429 Too Many Requests  
    * **Reason:** Internal rate limit exceeded when querying keyserver (should be rare with caching).  
    * **Body:** {"error": "Service temporarily unavailable due to rate limiting"} (or similar generic message)  
  * **Code:** 500 Internal Server Error  
    * **Reason:** Database error (D1), unexpected server issue, crypto library error, cache interaction error.  
    * **Body:** {"error": "Internal server error"}  
  * **Code:** 503 Service Unavailable  
    * **Reason:** Failure communicating with keys.openpgp.org (and cache miss/error, if used).  
    * **Body:** {"error": "Keyserver unavailable"}

## **7\. Database Schema**

* **Database:** SQLite (messages.db)  
* **Tables:**  
  * **messages**  
    * id: INTEGER PRIMARY KEY AUTOINCREMENT  
    * from_public_key: TEXT NOT NULL (Stores PGP key fingerprint)  
    * to_public_key: TEXT NOT NULL (Stores PGP key fingerprint)  
    * encrypted_data: TEXT NOT NULL (Store Base64 encoded string)  
    * created_at: TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ', 'now')) (Store ISO 8601 timestamp)  
    * Index: CREATE INDEX idx_messages_recipient_time ON messages (to_public_key, created_at)  
  * **key_cache**  
    * fingerprint: TEXT PRIMARY KEY  
    * key: TEXT NOT NULL  
    * status: TEXT NOT NULL  
    * validated_at: DATETIME DEFAULT CURRENT_TIMESTAMP  
* **Note:** The database uses SQLite syntax. created_at uses TEXT with a default SQLite function for timestamp generation.

## **8\. Out of Scope**

* PGP Key Management (generation, storage, backup for users).  
* Client-side implementation within the Caido plugin (encryption, decryption, signature generation, UI).  
* Public key discovery mechanisms beyond checking keys.openpgp.org.  
* Handling the internal structure of the decrypted data (e.g., validating the sha256 hash).  
* User registration or management beyond PGP key identification.