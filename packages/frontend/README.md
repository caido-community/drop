# Drop Plugin for Caido

A secure collaboration plugin for Caido that allows users to share specific Caido objects (like Replay Tabs, Filters, etc.) with their peers using PGP encryption.

## Features

- **PGP Key Management**
  - Generate new PGP key pairs
  - Import existing PGP keys
  - Automatic key upload to keys.openpgp.org

- **Connection Management**
  - Add and remove connections
  - Manage connection aliases
  - Automatic connection removal on key revocation

- **Secure Sharing**
  - End-to-end encryption using PGP
  - Support for sharing various Caido objects
  - Automatic message polling

- **User Interface**
  - Settings page for key and connection management
  - Received messages page for viewing and claiming shared objects
  - Toast notifications for new messages

## Installation

1. Install the plugin in Caido
2. Configure your PGP identity in the Settings page
3. Add connections using PGP fingerprints
4. Start sharing and receiving objects!

## Usage

### Sharing Objects

1. Right-click on a Caido object (Replay Tab, Filter, etc.)
2. Select "Share via Drop"
3. Choose a recipient from your connections
4. The object will be encrypted and sent securely

### Receiving Objects

1. New messages appear automatically in the Received Messages page
2. Click "Claim" to add the object to your Caido instance
3. For objects requiring context (like Replay Tabs), use "Claim To..." to specify the destination

## Security

- All shared data is encrypted using PGP
- Private keys are stored unencrypted in Caido's plugin storage
- Automatic key verification and revocation handling
- SHA256 hash verification for message integrity

## Development

### Prerequisites

- Node.js
- pnpm
- Caido development environment

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Start the development server:
   ```bash
   pnpm dev
   ```

### Building

```bash
pnpm build
```

## License

MIT 