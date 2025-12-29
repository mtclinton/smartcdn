export default {
  async fetch(request, env, ctx) {
    try {
      // Extract request information
      const url = new URL(request.url);
      const method = request.method;
      const headers = Object.fromEntries(request.headers.entries());

      // Log basic request information
      console.log(`[${new Date().toISOString()}] ${method} ${url.pathname}`);
      console.log('Request URL:', url.href);
      console.log('Request Method:', method);
      console.log('Request Headers:', JSON.stringify(headers, null, 2));

      // Handle different request methods
      switch (method) {
        case 'GET':
          return new Response("Hello from SmartCDN - GET request", {
            status: 200,
            headers: { 
              "Content-Type": "text/plain",
              "X-Request-Method": method,
            },
          });

        case 'POST':
          // Try to read request body if present
          let body = null;
          try {
            body = await request.text();
            if (body) {
              console.log('Request Body:', body);
            }
          } catch (e) {
            console.warn('Could not read request body:', e.message);
          }

          return new Response("Hello from SmartCDN - POST request received", {
            status: 201,
            headers: { 
              "Content-Type": "text/plain",
              "X-Request-Method": method,
            },
          });

        case 'PUT':
          return new Response("Hello from SmartCDN - PUT request received", {
            status: 200,
            headers: { 
              "Content-Type": "text/plain",
              "X-Request-Method": method,
            },
          });

        case 'DELETE':
          return new Response("Hello from SmartCDN - DELETE request received", {
            status: 200,
            headers: { 
              "Content-Type": "text/plain",
              "X-Request-Method": method,
            },
          });

        case 'PATCH':
          return new Response("Hello from SmartCDN - PATCH request received", {
            status: 200,
            headers: { 
              "Content-Type": "text/plain",
              "X-Request-Method": method,
            },
          });

        case 'OPTIONS':
          // Handle CORS preflight requests
          return new Response(null, {
            status: 204,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
            },
          });

        case 'HEAD':
          return new Response(null, {
            status: 200,
            headers: { 
              "Content-Type": "text/plain",
              "X-Request-Method": method,
            },
          });

        default:
          return new Response(`Method ${method} not allowed`, {
            status: 405,
            headers: { 
              "Content-Type": "text/plain",
              "Allow": "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
            },
          });
      }
    } catch (error) {
      // Error handling
      console.error('Error processing request:', error);
      console.error('Error stack:', error.stack);

      return new Response(`Internal Server Error: ${error.message}`, {
        status: 500,
        headers: { 
          "Content-Type": "text/plain",
        },
      });
    }
  },
};

