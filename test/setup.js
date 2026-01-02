/**
 * Test Setup
 * 
 * Mock Cloudflare Workers APIs for testing
 */

import { beforeEach, vi } from 'vitest';

// Mock Cloudflare Workers global objects
global.Request = class Request {
  constructor(input, init = {}) {
    this.url = typeof input === 'string' ? input : input.url;
    this.method = init.method || 'GET';
    this.headers = new Headers(init.headers || {});
    this.cf = init.cf || {};
    this.body = init.body || null;
  }

  clone() {
    return new Request(this.url, {
      method: this.method,
      headers: new Headers(this.headers),
      cf: this.cf,
      body: this.body,
    });
  }
};

global.Response = class Response {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || 'OK';
    this.headers = new Headers(init.headers || {});
  }

  clone() {
    return new Response(this.body, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
    });
  }
};

global.Headers = class Headers {
  constructor(init = {}) {
    this._headers = new Map();
    if (init instanceof Headers) {
      init.forEach((value, key) => {
        this._headers.set(key.toLowerCase(), value);
      });
    } else if (Array.isArray(init)) {
      init.forEach(([key, value]) => {
        this._headers.set(key.toLowerCase(), value);
      });
    } else if (typeof init === 'object') {
      Object.entries(init).forEach(([key, value]) => {
        this._headers.set(key.toLowerCase(), value);
      });
    }
  }

  get(name) {
    return this._headers.get(name.toLowerCase()) || null;
  }

  set(name, value) {
    this._headers.set(name.toLowerCase(), value);
  }

  has(name) {
    return this._headers.has(name.toLowerCase());
  }

  delete(name) {
    this._headers.delete(name.toLowerCase());
  }

  append(name, value) {
    const existing = this.get(name);
    if (existing) {
      this.set(name, `${existing}, ${value}`);
    } else {
      this.set(name, value);
    }
  }

  forEach(callback) {
    this._headers.forEach((value, key) => {
      callback(value, key, this);
    });
  }

  entries() {
    return this._headers.entries();
  }

  keys() {
    return this._headers.keys();
  }

  values() {
    return this._headers.values();
  }
};

// Use native URL if available, otherwise create a simple implementation
if (typeof global.URL === 'undefined') {
  global.URL = class URL {
    constructor(url, base) {
      if (base) {
        this._url = new (globalThis.URL || require('url').URL)(url, base);
      } else {
        this._url = new (globalThis.URL || require('url').URL)(url);
      }
    }

    get href() {
      return this._url.href;
    }

    get origin() {
      return this._url.origin;
    }

    get pathname() {
      return this._url.pathname;
    }

    get search() {
      return this._url.search;
    }

    get searchParams() {
      return this._url.searchParams;
    }
  };
}

// Mock caches API
global.caches = {
  default: {
    match: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
};

// Mock fetch API
global.fetch = vi.fn();

