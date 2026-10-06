const plugin_name = "node-red-dashboard-2-basic-auth";
const plugin = require('../node-red-dashboard-2-basic-auth'); // Update with the correct path to your module

describe('Node-RED Dashboard 2.0 Basic Auth Plugin', () => {
  let RED;
  let hooks;

  beforeEach(() => {
    RED = {
      plugins: {
        registerPlugin: jest.fn(),
      },
      log: {
        debug: jest.fn(),
        warn: jest.fn(),
      },
    };

    // Initialize the plugin with the RED object
    plugin(RED);
    hooks = RED.plugins.registerPlugin.mock.calls[0][1].hooks;
  });

  it('should register the plugin with the correct type and name', () => {
    expect(RED.plugins.registerPlugin).toHaveBeenCalledWith(
      plugin_name,
      expect.objectContaining({
        type: "node-red-dashboard-2",
      })
    );
  });

  describe('onAddConnectionCredentials hook', () => {
    it('should log a debug message if msg._client is not found', () => {
      const conn = { request: { headers: {} } };
      const msg = {};

      expect(hooks.onAddConnectionCredentials(conn, msg)).toEqual({});

      expect(RED.log.debug).toHaveBeenCalledWith(
        `${plugin_name}: msg._client is not found, not adding user info. This sometimes happens when the editor is refreshed with stale connections to the dashboard.`
      );
    });

    it('should log a warning and add an empty user if no user header is found', () => {
      const conn = { request: { headers: {} } };
      const msg = { _client: {} };

      hooks.onAddConnectionCredentials(conn, msg);

      expect(RED.log.warn).toHaveBeenCalledWith(
        `${plugin_name}: Session is not authenticated by Basic Auth; no user detected. See headers: ${JSON.stringify(conn.request.headers)}`
      );
      expect(msg._client.user.userId).toBeNull();
    });

    it('should add user and role to msg._client if headers are found', () => {
      const headers = {
        "x-forwarded-user": "test-user",
        "x-forwarded-role": "admin",
        "host": "test-host",
        "user-agent": "test-agent"
      };
      const conn = { request: { headers } };
      const msg = { _client: {} };

      hooks.onAddConnectionCredentials(conn, msg);

      expect(msg._client.user).toEqual({
        host: "test-host",
        agent: "test-agent",
        userId: "test-user",
        role: "admin",
        provider: "HTTP Basic Auth"
      });
      expect(RED.log.debug).toHaveBeenCalledWith(
        `${plugin_name}: Dashboard interacted with by test-user (admin)`
      );
    });

    it('should not add a role if no role header is found', () => {
      const conn = { request: { headers: { "x-forwarded-user": "test-user" } } };
      const msg = { _client: {} };

      hooks.onAddConnectionCredentials(conn, msg);

      expect(msg._client.user.userId).toBe("test-user");
      expect(msg._client.user).not.toHaveProperty("role");
    });
  });

  describe('onIsValidConnection hook', () => {
    const conn = { request: { headers: { "x-forwarded-user": "alice" } } };

    it('should allow messages without user', () => {
      expect(hooks.onIsValidConnection(conn, {})).toBe(true);
      expect(hooks.onIsValidConnection(conn, { _client: { socketId: "abc" } })).toBe(true);
    });

    it('should allow messages for the connected user', () => {
      expect(hooks.onIsValidConnection(conn, { _client: { user: { userId: "alice" } } })).toBe(true);
    });

    it('should block messages for another user', () => {
      expect(hooks.onIsValidConnection(conn, { _client: { user: { userId: "bob" } } })).toBe(false);
    });
  });

  describe('onCanSaveInStore hook', () => {
    it('should allow storing messages without user', () => {
      expect(hooks.onCanSaveInStore({ payload: 1 })).toBe(true);
    });

    it('should not store messages for a user', () => {
      expect(hooks.onCanSaveInStore({ _client: { user: { userId: "alice" } } })).toBe(false);
    });
  });
});
