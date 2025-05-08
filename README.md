<div align="center">
  <img width="1000" alt="image" src="https://github.com/caido-community/.github/blob/main/content/banner.png?raw=true">

  <br />
  <br />
  <a href="https://github.com/caido-community" target="_blank">Github</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://developer.caido.io/" target="_blank">Documentation</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://links.caido.io/www-discord" target="_blank">Discord</a>
  <br />
  <hr />
</div>

# Drop

Easy collaboration within Caido.

![image](https://github.com/user-attachments/assets/e3eaa8a7-792d-4a27-8c21-f8b4666c5aba)

Once installed from the Caido Community Plugin Store, add a friend's sharecode, and look for the below "Drop to..." box on any of the following objects:
* Replay Tabs
* Match & Replace Rules
* Scopes
* Filters
* Workflows (COMING SOON)
* Files (COMING SOON)
* Findings (COMING SOON)
* HTTPQL Searches (COMING SOON)

**Drop is complete E2EE using PGP.** See below for information on the server component.

This ensures we never hold unencrypted data.

## Server

To work, `Drop` requires a centralized server. The data that flows through the server is completely end-to-end encrypted using the target user's PGP public key, which is shared via the sharecode. 

The code for the server is public, so you can host your own instance or use any of the public servers below.

The API Server code can be found [here](packages/server). Our database schema is as follows:
```
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_public_key TEXT NOT NULL,
    to_public_key TEXT NOT NULL,
    encrypted_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
```
No unencrypted userdata is ever placed into the DB.

### Public servers

| Domain        | Owner             |
| ------------- | ----------------- |
| `drop.cai.do` | `Caido Labs Inc.` |
