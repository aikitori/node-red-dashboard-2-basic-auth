let plugin_name = "node-red-dashboard-2-basic-auth";
module.exports = function (RED) {
  function getUser(headers) {
    const http_user = headers["x-forwarded-user"] || null;
    const http_role = headers["x-forwarded-role"] || null;
    const user = {
      host: headers["host"] || null,
      agent: headers["user-agent"] || null,
      userId: http_user,
      provider: "HTTP Basic Auth",
    };
    if (http_role) {
      user.role = http_role;
    }
    return user;
  }

  RED.plugins.registerPlugin(plugin_name, {
    // Tells Node-RED this is a Node-RED Dashboard 2.0 plugin
    type: "node-red-dashboard-2",

    hooks: {
      /**
       * onAddConnectionCredentials - called when a D2.0 is about to send a message in Node-RED
       * @param {object} conn - SocketIO connection object
       * @param {object} msg - Node-RED msg object
       * @returns {object} - Returns Node-RED msg object
       */
      onAddConnectionCredentials: (conn, msg) => {
        if (!msg._client) {
          RED.log.debug(
            `${plugin_name}: msg._client is not found, not adding user info. This sometimes happens when the editor is refreshed with stale connections to the dashboard.`
          );
          return msg;
        }
        const headers = conn.request.headers;
        const user = getUser(headers);
        if (!user.userId) {
          RED.log.warn(
            `${plugin_name}: Session is not authenticated by Basic Auth; no user detected. See headers: ${JSON.stringify(
              headers
            )}`
          );
        } else {
          RED.log.debug(
            `${plugin_name}: Dashboard interacted with by ${user.userId}${user.role ? ` (${user.role})` : ""}`
          );
        }
        msg._client["user"] = user;
        return msg;
      },

      /**
       * onIsValidConnection - called before a message is sent to a Dashboard client
       * Only send messages that are addressed to a user to that user's connections.
       * @param {object} conn - SocketIO connection object
       * @param {object} msg - Node-RED msg object
       * @returns {boolean} - Whether the msg can be sent to this connection
       */
      onIsValidConnection: (conn, msg) => {
        if (msg._client?.user) {
          return msg._client.user.userId === getUser(conn.request.headers).userId;
        }
        return true;
      },

      /**
       * onCanSaveInStore - called before a message is saved in the Dashboard data store
       * Messages addressed to a user must not be replayed to other users when they connect.
       * @param {object} msg - Node-RED msg object
       * @returns {boolean} - Whether the msg can be saved in the data store
       */
      onCanSaveInStore: (msg) => {
        return !msg._client?.user;
      },
    },
  });
};
