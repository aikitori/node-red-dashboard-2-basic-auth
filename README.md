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

Configure your webserver to
 - require HTTP Basic auth,
 - set the request header "X-Forwarded-User" to the authenticated user,
 - optionally set the request header "X-Forwarded-Role" to a role of the user,
 - and proxy WebSocket connections to Node-RED.

**The webserver must always set or remove both headers.** A header that the webserver does not set is passed through from the browser, so a logged in user could send `X-Forwarded-Role: admin` themselves.
Node-RED must only be reachable through the webserver, e.g. with `uiHost: "127.0.0.1"` in the Node-RED `settings.js`. Otherwise anybody can connect directly and send any user.

See the [examples](#examples) for nginx, Apache, Caddy and Traefik.

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

## Examples

All examples were tested with Node-RED 4.1 and FlowFuse Dashboard 1.33: the user `alice` gets the role `admin`, all other users get no role.
They also remove the `Authorization` header, so the password does not reach Node-RED.
Replace `localhost:1880` with the address of your Node-RED.

### nginx

Create the password file with `htpasswd -c /etc/nginx/htpasswd alice`.

```nginx
# Optional role per user (in the http block)
map $remote_user $dashboard_role {
  alice   admin;
  default "";
}

server {
  listen 80;
  location / {
    auth_basic "Node-RED Dashboard";
    auth_basic_user_file /etc/nginx/htpasswd;

    # User and role from Basic Auth, never from the browser
    proxy_set_header X-Forwarded-User $remote_user;
    proxy_set_header X-Forwarded-Role $dashboard_role;
    # Node-RED does not need the password
    proxy_set_header Authorization "";

    proxy_pass http://localhost:1880;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

### Apache

Requires Apache 2.4.47 or newer and the modules `auth_basic`, `authn_file`, `authz_user`, `headers`, `proxy` and `proxy_http`.
Create the password file with `htpasswd -c -B /etc/apache2/htpasswd alice`.

```apache
<VirtualHost *:80>
    <Location "/">
        AuthType Basic
        AuthName "Node-RED Dashboard"
        AuthUserFile "/etc/apache2/htpasswd"
        Require valid-user

        # User and role from Basic Auth, never from the browser
        RequestHeader set X-Forwarded-User "expr=%{REMOTE_USER}"
        RequestHeader unset X-Forwarded-Role
        RequestHeader set X-Forwarded-Role "admin" "expr=%{REMOTE_USER} == 'alice'"
        # Node-RED does not need the password
        RequestHeader unset Authorization
    </Location>

    ProxyPass "/" "http://localhost:1880/" upgrade=websocket
    ProxyPassReverse "/" "http://localhost:1880/"
</VirtualHost>
```

Note: an `<If>` block does not work for the role, it is evaluated before the user is authenticated.

### Caddy

Create the password hash with `caddy hash-password`. Caddy proxies WebSockets automatically.

```caddy
dashboard.example.com {
	basic_auth {
		alice $2a$14$...
		bob $2a$14$...
	}

	# Optional role per user
	map {http.auth.user.id} {dashboard_role} {
		alice   admin
		default ""
	}

	reverse_proxy localhost:1880 {
		# User and role from Basic Auth, never from the browser
		header_up X-Forwarded-User {http.auth.user.id}
		header_up X-Forwarded-Role {dashboard_role}
		# Node-RED does not need the password
		header_up -Authorization
	}
}
```

### Traefik

Traefik sets the user header itself with `headerField`. Create the users with `htpasswd -nB alice`. Traefik proxies WebSockets automatically.
Traefik cannot map users to roles, so this example only removes a role sent by the browser.

Dynamic configuration (file provider):

```yaml
http:
  routers:
    node-red:
      rule: "Host(`dashboard.example.com`)"
      middlewares: [node-red-auth, node-red-headers]
      service: node-red
  middlewares:
    node-red-auth:
      basicAuth:
        users:
          - "alice:$2y$05$..."
          - "bob:$2y$05$..."
        # User from Basic Auth, never from the browser
        headerField: X-Forwarded-User
        # Node-RED does not need the password
        removeHeader: true
    node-red-headers:
      headers:
        customRequestHeaders:
          # Remove a role sent by the browser
          X-Forwarded-Role: ""
  services:
    node-red:
      loadBalancer:
        servers:
          - url: "http://localhost:1880"
```

The same options are available as Docker labels, e.g. `traefik.http.middlewares.node-red-auth.basicauth.headerfield=X-Forwarded-User`.
