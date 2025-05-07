# **Product Requirements Document: Caido "Drop" Collaboration Plugin**

Version: 1.3  
Date: 2025-04-28

## **1\. Introduction**

This document outlines the requirements for "Drop", a Caido plugin designed to facilitate secure collaboration among security researchers. Drop allows users to share specific Caido objects (like Replay Tabs, Filters, etc.) with their peers directly within the Caido environment using PGP encryption and a dedicated API server.

## **2\. Goals**

* **Enable Secure Sharing:** Provide a secure mechanism for researchers to share specific Caido work artifacts.  
* **Streamline Collaboration:** Integrate sharing and receiving workflows directly into the Caido UI to avoid context switching.  
* **Maintain Privacy:** Ensure end-to-end encryption of shared data using PGP.  
* **User-Friendly Setup:** Simplify the PGP key setup and connection management process for users.  
* **Support Key Caido Objects:** Allow sharing of commonly used Caido objects relevant to security research workflows.

## **3\. Target Audience**

* Security Researchers  
* Penetration Testers  
* Bug Bounty Hunters  
* Security Teams using Caido for collaborative assessments.

## **4\. Features**

### **4.1. PGP Key Management**

* **Onboarding & Configuration:**  
  * Upon first installation or in settings, guide the user through configuring their PGP identity.  
  * Require the user to provide a **Username** for identification within the Drop network.  
  * Provide options to either:  
    * **Generate a new PGP key pair:** Use RSA 3072-bit keys with no expiration date (0 expiry).  
    * **Import/Upload an existing PGP public/private key pair.**  
  * Inform the user that their public key needs to be available on keys.openpgp.org for others to send messages to them.  
  * **Keyserver Upload:** The plugin **should attempt** to upload the user's public key to keys.openpgp.org via the VKS API /upload endpoint after key generation or import. (*Note: VKS upload often requires email verification, feasibility from a client-side plugin needs confirmation.*) Provide clear feedback on the upload status.  
* **Storage:** Securely store the user's PGP private key (unencrypted) and public key pair, along with their chosen Username, within Caido's standard plugin storage mechanism.  
* **Key Change:** If a user needs to change their configured PGP key or Username, they **must uninstall and then reinstall** the plugin. This should be documented for the user.  
* **Display:** Show the user's configured PGP key fingerprint and Username in the plugin settings.

### **4.2. Connection Management ("Friends")**

* **Connection Identifier (Share Token):** For sharing connection details *outside* the plugin, users can share a token like: {pgp\_fingerprint}-{username}. The plugin primarily uses the fingerprint internally.  
* **Adding Connections:**  
  * Provide a UI section in the Settings page to add new connections ("Friends").  
  * Users will input the PGP fingerprint and a user-defined Alias/Name for the connection.  
  * **Verification:** Upon adding, the plugin must attempt to retrieve the public key associated with the provided fingerprint from keys.openpgp.org.  
    * If successful, cache the public key locally for encryption purposes.  
    * If unsuccessful (key not found), inform the user via Toast notification that the connection cannot be added until the key is available on the keyserver. Handle retrieval errors by logging them to the browser console.  
  * Store the connection details (Alias/Name provided by user, Fingerprint, cached Public Key) in Caido's plugin storage.  
  * Allow adding a connection directly from a received message (see 4.4). The user will need to provide an Alias/Name to associate with the sender's fingerprint from the message.  
* **Listing Connections:** Display a list of saved connections in the Settings page, showing the Alias/Name and Fingerprint.  
* **Removing Connections:** Allow users to remove saved connections manually. Connections **must also be automatically removed** if the plugin receives an error from the API server during a /send attempt indicating the recipient's key is revoked (e.g., 409 Conflict). The user should be notified via Toast when a connection is auto-removed due to revocation.  
* **Key Validity:** The plugin relies on the initial check during connection adding and the server's check during /send or /poll for key validity/revocation status. No periodic re-verification by the plugin is required.

### **4.3. Sharing Objects**

* **Initiation:**  
  * **Right-Click Menus:** Add a "Share via Drop" option to the right-click context menu for:  
    * Replay Tabs  
    * Replay Collections  
  * **UI Buttons:** Add a "Share via Drop" button to the UI panels/views for:  
    * Filters  
    * Scopes  
    * Workflows  
  * **Keyboard Shortcut:** Implement a configurable keyboard shortcut to share the current clipboard content as an HTTPQL query. The plugin must validate that the clipboard content is valid HTTPQL before proceeding.  
* **Recipient Selection:** When initiating a share, present the user with a list of their saved connections (by Alias/Name) to choose **exactly one** recipient. (Multi-recipient sharing is not supported in v1).  
* **Payload Creation:**  
  * Generate a unique UUID for the message (id).  
  * Serialize the selected Caido object using the Caido SDK into its standard JSON representation. Wrap this JSON in a new object:  
    {  
      "type": "ObjectType", // e.g., "ReplayTab", "Filter", "Scope", etc.  
      "value": SDK\_JSON\_OBJECT  
    }

  * Place this wrapper object inside the objects array.  
  * Include an empty notes field (support for notes is deferred).  
  * Calculate the SHA256 hash of the canonical JSON representation of id, objects, and notes.  
  * Construct the final pre-encryption JSON payload:  
    {  
      "id": "GENERATED\_UUID",  
      "objects": \[  
        {  
          "type": "ObjectType",  
          "value": SDK\_JSON\_OBJECT  
        }  
      \],  
      "notes": "",  
      "sha256": "CALCULATED\_SHA256"  
    }

* **Encryption & Signing:**  
  * Retrieve the cached public PGP key for the selected recipient based on their fingerprint.  
  * Encrypt the JSON payload using the recipient's public PGP key. The resulting encrypted\_data (Base64 encoded) must not exceed 1MB.  
  * Generate a detached PGP signature using the sender's private key. The signature must cover the concatenated string: to\_public\_key\_fingerprint \+ "|" \+ encrypted\_data \+ "|" \+ timestamp.  
  * Handle client-side PGP encryption/signing errors via generic Toast notification and log details to the console.  
* **API Call (POST /api/v1/send):**  
  * Send the request to the API server.  
  * Request Body:  
    {  
      "to\_public\_key": "RECIPIENT\_PGP\_PUBLIC\_KEY\_FINGERPRINT",  
      "encrypted\_data": "BASE64\_ENCODED\_PGP\_ENCRYPTED\_PAYLOAD",  
      "timestamp": CURRENT\_UNIX\_TIMESTAMP,  
      "signature": "BASE64\_ENCODED\_SIGNATURE"  
    }

  * The server will validate the sender's signature, the timestamp (+/- 15s), and check the recipient's public key fingerprint against keys.openpgp.org for existence and revocation status.  
  * Handle API responses, including errors (see Section 4.6). If a 409 Conflict (Revoked Key) error is received for the recipient, trigger the connection removal logic (Section 4.2).

### **4.4. Receiving & Claiming Objects**

* **Polling:**  
  * Use setInterval to automatically poll the /api/v1/poll endpoint **every 5 seconds** while Caido is running and the plugin is enabled.  
  * Provide a manual "Refresh" button in the receiving UI.  
* **API Call (POST /api/v1/poll):**  
  * Generate a detached PGP signature using the user's private key. The signature must cover the timestamp value (as a string).  
  * Send the request to the API server.  
  * Request Body:  
    {  
      "timestamp": CURRENT\_UNIX\_TIMESTAMP,  
      "signature": "BASE64\_ENCODED\_SIGNATURE"  
    }

  * The server will validate the signature (identifying the polling user), the timestamp (+/- 15s), and check the user's public key fingerprint against keys.openpgp.org.  
* **Processing Received Messages:**  
  * Handle API responses, including errors (see Section 4.6).  
  * On success (200 OK), process the returned JSON array of messages:  
    \[  
      {  
        "id": "\<Database Row ID\>", // Server's DB ID  
        "from\_public\_key": "\<PGP Public Key Fingerprint of Sender\>",  
        "encrypted\_data": "\<Base64 Encoded PGP Encrypted Payload\>",  
        "created\_at": "\<ISO 8601 Timestamp\>"  
      },  
      // ... more messages  
    \]

* **Decryption & Verification:**  
  * For each message, decrypt the encrypted\_data using the user's private PGP key.  
  * Verify the SHA256 hash within the decrypted payload against a recalculated hash of the id (UUID), objects, and notes fields from the decrypted payload.  
  * Handle decryption/verification errors gracefully (report via Toast notification, log details to console).  
* **Deduplication:** Maintain an in-memory array (local variable) of processed message UUIDs (id from the decrypted payload). This cache persists only for the **current Caido session**. **Silently ignore** any received messages whose UUID is already in this array. Add the UUID to the array after successful processing/claiming/deletion.  
* **New Message Notification:** Upon successful decryption and verification of a *new* (non-duplicate) message, trigger a **Caido Toast notification** indicating a new item has been received.  
* **Receiving UI (Table Page):**  
  * Display received, decrypted, verified, and non-duplicate messages in a table.  
  * Table Columns:  
    * Type: Type of Caido object shared (read from objects\[0\].type).  
    * From: Sender's PGP key fingerprint. If the fingerprint matches a saved connection, display the Alias/Name. Provide an "Add Connection" option if not recognized.  
    * Details: A brief summary or preview of the object.  
    * Received: Timestamp when the message was created (created\_at from API response).  
    * Actions: Buttons for "Claim" / "Claim To..." and "Delete".  
* **Claiming Objects:**  
  * **Simple Claim:** For Filters, Scopes, Workflows, Replay Collections:  
    * Clicking "Claim" triggers the corresponding objectConstructionUtils function, passing the objects\[0\].value (the SDK JSON object), to add the object to the user's Caido instance.  
  * **Claim To...:** For objects requiring context:  
    * **Replay Tab:** The "Claim" button becomes "Claim To...". Clicking it reveals a dropdown/selector listing the user's **existing** Replay Collections. The user selects a target collection, and the Replay Tab (objects\[0\].value) is added there.  
    * **HTTPQL Query:** The "Claim" button becomes "Claim To...". Clicking it reveals options: "**Add to Search**" and "**Add to HTTP History**". The user selects the destination, and the query (objects\[0\].value) is added there.  
  * **Post-Claim:** Once claimed successfully, remove the message from the incoming table and add its UUID to the processed cache.  
  * **Claiming Failure:** If the objectConstructionUtils function fails (e.g., Caido SDK error), report the error via Toast notification and **leave the message in the received list** for a potential retry by the user. Do not add the UUID to the processed cache in this case.  
* **Deleting Objects:** Clicking "Delete" removes the message from the table without adding the object to Caido. Add its UUID to the processed cache.  
* **Object Propagation:** Implement functions (grouped in objectConstructionUtils.ts) for each supported object type.

### **4.5. UI/UX**

* **Frameworks:** Use Vue.js and Tailwind CSS for all plugin UI components.  
* **Pages:**  
  * **Settings Page:** Contains PGP Key Management (Username, Key generation/import/upload status), Connection Management sections.  
  * **Received Messages Page:** Displays the table of incoming shared objects.  
* **Integration:** Seamlessly integrate share actions via right-click menus, buttons, and keyboard shortcuts.  
* **Feedback:** Provide clear visual feedback for actions (sending, receiving, claiming, deleting) and error states using **Caido SDK Toast Notifications**. Use Toasts also for new message arrival and connection auto-removal notifications.  
* **UI Design:** No specific mockups or wireframes provided; implement a clean and intuitive interface consistent with Caido's design language.

### **4.6. API Interaction & Error Handling**

* Implement robust handling for all API interactions (/send, /poll).  
* Expect standard HTTP error codes (400, 401, 404, 409, 429, 500, 503\) and a JSON error body format: {"error": "Descriptive error message"} from the server.  
* **Specific Errors to Handle:**  
  * 400 Bad Request: Invalid input format, payload size exceeded (1MB limit for /send), invalid PGP key/signature format.  
  * 401 Unauthorized: Signature verification failed or timestamp outside \+/- 15s window.  
  * 404 Not Found: Relevant key not found on keys.openpgp.org.  
  * 409 Conflict: Relevant key is revoked according to keys.openpgp.org. (Trigger connection removal if it's the recipient key during /send).  
  * 429 Too Many Requests: Server rate limited by keyserver.  
  * 500 Internal Server Error: Server-side database, crypto, or unexpected error.  
  * 503 Service Unavailable: Server could not communicate with keys.openpgp.org.  
* Display user-friendly error messages for API errors, client-side PGP errors (encryption/signing/decryption), SHA256 mismatch, and key retrieval failures using **Caido SDK Toast Notifications**. Log detailed error information to the browser console.  
* **Offline/Network Handling:** The plugin requires an active internet connection. **No offline functionality, queuing, or retry mechanism is required.** If an API call fails due to network issues or server unavailability (e.g., 503), report the error immediately via a Toast notification.

## **5\. Non-Goals**

* **Real-time Chat.**  
* **API Server Implementation.**  
* **Sharing Arbitrary Files.**  
* **Advanced PGP Key Management by the plugin** (e.g., password protection, subkeys, periodic revocation checks).  
* **Sharing Notes.**  
* **Multi-Recipient Sharing in v1.**  
* **Offline Operation / Queuing.**

## **6\. Technical Requirements**

* **Language:** TypeScript  
* **UI Framework:** Vue.js  
* **Styling:** Tailwind CSS  
* **Environment:** Caido Plugin Environment  
* **SDK:** Caido SDK (including Toast Notifications, Plugin Storage)  
* **Cryptography:** A reliable PGP library (e.g., OpenPGP.js) capable of encryption, decryption, generating/importing RSA 3072 keys (unencrypted), generating/verifying detached signatures, and potentially interacting with VKS API for key upload.  
* **API Specification:** Adhere strictly to the defined API endpoint definitions.  
* **Payload Size Limit:** Ensure encrypted payload (encrypted\_data) sent via /send does not exceed 1MB.  
* **Key Handling:** Implement public key retrieval from keys.openpgp.org via fingerprint and local caching. Attempt public key upload via VKS API.

## **7\. Security Considerations**

* **End-to-End Encryption.**  
* **Key Security:** Private keys stored unencrypted in Caido plugin storage; user accepts this risk. Avoid unnecessary exposure.  
* **API Security:** Correct signature implementation, HTTPS, server cert validation.  
* **Input Validation.**  
* **Dependency Security.**  
* **Data Integrity:** SHA256 hash verification.  
* **Key Verification:** Initial check on adding connections; react to server revocation errors.

## **8\. Future Considerations**

* Support for sharing annotations or notes.  
* Sharing additional Caido object types.  
* Group sharing / Multi-recipient sharing.  
* More advanced connection verification/management.  
* UI improvements (e.g., visual badge for new messages).  
* Configurable polling interval.  
* Optional offline queuing.  
* Password protection for imported/generated private keys.

## **9\. Open Questions**

*(All previous open questions have been addressed in this version.)*