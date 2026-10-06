[![Node.js CI](https://github.com/aikitori/node-red-dashboard-2-basic-auth/actions/workflows/node.js.yml/badge.svg)](https://github.com/aikitori/node-red-dashboard-2-basic-auth/actions/workflows/node.js.yml)
# Node-RED Dashboard with HTTP Basic Authentication

## Requirements
 - Node-RED 3.1 or newer
 - FlowFuse Dashboard (`@flowfuse/node-red-dashboard`) 1.10 or newer
 - A Webserver with activated HTTP Basic auth

## Installation

Install the plugin in your Node-RED user directory (usually `~/.node-red`) or via "Manage palette" in the editor:

```
npm install @aikitori/node-red-dashboard-2-basic-auth
```

Restart Node-RED. Then open the Dashboard 2.0 sidebar in the editor, go to "Client Data" and enable "HTTP Basic".

## Configuration

Configure your Webserver, that the http user is added to the request header key "X-Forwarded-User".
See [here](https://docs.nginx.com/nginx/admin-guide/security-controls/configuring-http-basic-authentication/) how to configure nginx for example.
Optionally, your Webserver can send a role in the request header key "X-Forwarded-Role".

The user info is added to `msg._client.user`:

```json
{
  "host": "dashboard.example.com",
  "agent": "Mozilla/5.0 ...",
  "userId": "alice",
  "role": "admin",
  "provider": "HTTP Basic Auth"
}
```

If no user header is present, `userId` is `null`.

## Sending messages to a single user

Nodes with "Accept Client Constraints" enabled in the "Client Data" tab only send a message to the connections of the user in `msg._client.user`.
To send a message to all browser tabs of a user, keep `msg._client.user` and remove `socketId` and `clientId`:

```js
msg._client = { user: msg._client.user };
return msg;
```

Such messages are not stored in the Dashboard data store, so they are not shown to other users when they connect later.

## Example

### nginx

```
server {
  listen 80;
  location / {

    auth_basic "Node-RED Dashboard";
    auth_basic_user_file /etc/nginx/htpasswd;
    proxy_set_header X-Forwarded-User $remote_user;

    proxy_pass http://localhost:1880;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```
