# Node-RED Dashboard with HTTP Basic Authentication

## Requirements
 - A Webserver with activated HTTP Basic auth 

## Configuration

Configure your Webserver, that the http user is added to the request header key "X-Forwarded-User"
See [here](https://docs.nginx.com/nginx/admin-guide/security-controls/configuring-http-basic-authentication/) how to cofigure nginx for example

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