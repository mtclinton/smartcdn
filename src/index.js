export default {
  async fetch(request, env, ctx) {
    return new Response("Hello from SmartCDN", {
      headers: { "Content-Type": "text/plain" },
    });
  },
};

