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

**Demo Video**

<a target=_blank href="https://www.loom.com/share/439e735dc8aa40ffa6e38474931714fe">
<img style="max-width:300px;" src="https://cdn.loom.com/sessions/thumbnails/439e735dc8aa40ffa6e38474931714fe-2f81f3f7ecd2470a-full-play.gif">
</a>

### About Drop

![image](https://github.com/user-attachments/assets/e3eaa8a7-792d-4a27-8c21-f8b4666c5aba)

Drop enables easy collaboration with other Caido users over a fully E2EE channel. Immediately after install, Drop allows you to share the following objects with 1 click:
* Replay Tabs
* Match & Replace Rules
* Scopes
* Filters
* Workflows (COMING SOON)
* Files (COMING SOON)
* Findings (COMING SOON)
* HTTPQL Searches (COMING SOON)

Drop's encryption is done via PGP. We get the target user's PGP fingerprint when you add them as a friend (via share code), then we use the fingerprint to grab the full public key from a key server. All transferred data is encrypted using those public keys before hitting any public server. 

**NOTE: All messages will be stored on the server for a maximum of 7 days. Drop is not a storage mechanism, and all messages should be assumed to be ephemeral.**

### How To Use Drop

**Sender**
1. Install Drop via the Caido Plugin Store
2. Navigate to Settings and add your friend's share code
3. Navigate to any of the aforementioned supported objects' page, and select your friend's name from the dropdown

**Receiver** 
1. Install Drop from the Caido Plugin Store
2. Give your friend your share code
3. Claim the object sent by your friend either via the notification at the top right, or via the `Received Messages` tab in the Drop plugin interface.



## Server

To work, `Drop` requires a centralized server. The data that flows through the server is completely end-to-end encrypted using the target user's PGP public key, which is shared via the share code. 

The code for the server is public, so you can host your own instance or use any of the public servers below. **We have a super easy to use docker image for hosting your own server**. Please see [here](packages/server/README.md) for more info. 

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

### How to change your server in Drop

From the Settings page in the Drop plugin, select `Show Advanced Options` and modify the `API Server URL` setting:
![image](https://github.com/user-attachments/assets/4b3570f5-836d-4861-82af-715a89002249)



## Disclosures
Per the Caido Developer Policy, we are required to inform you that, for this plugin:
* External services are required for full access.

### External services
Drop requires a server to relay information from one user to another. The above public server is hosted by Caido Labs Inc. The default configuration for the plugin utilizes this service. No data is retained longer than 7 days. All data is E2EE with PGP. 
