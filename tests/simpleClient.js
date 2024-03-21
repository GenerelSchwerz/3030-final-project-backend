/**
 * @type {import('node-fetch').default}
 */
let fetch;

try {
  fetch = require("node-fetch");
} catch (err) {
  // If require fails, use dynamic import for ESM compatibility
  let resolvedImport = null;
  fetch = async (...args) => {
    if (resolvedImport != null) return resolvedImport(...args);
    resolvedImport = (await import("node-fetch")).default;
    return resolvedImport(...args);
  };
}

const ws = require('ws');
const http = require("http");
const { CookieJar } = require("tough-cookie");

class Client {
  #email;
  #username;
  #password;

  /**
   *
   * @param {string} token
   * @param {import('http').Agent} agent
   */
  constructor(token = null, agent = null) {
    /**
     * @type {string | null} id
     */
    this.id = null;

    /**
     * @type {string | null} token
     */
    this.token = token;

    /**
     * @type {string | null} email
     */
    this.#email = null;

    /**
     * @type {string | null} username
     */
    this.#username = null;

    /**
     * @type {import('http').Agent}
     */
    this.agent = agent ?? new http.Agent({ keepAlive: true });

    /**
     * @type {import('tough-cookie').CookieJar}
     */
    this.cookieJar = new CookieJar();

    /**
     * @type {Map<string, number>} knownChannels
     */
    this.knownChannels = new Map();

    /**
     * @type {import('ws').WebSocket | null}
     */
    this._ws = null;
  }



  /**
   *
   * @param {string} url
   * @param {import('node-fetch').RequestInit} options
   * @returns
   */
  async #updateOptions(url, options = {}) {
    options.headers ??= {};
    options.headers["cookie"] ??= await this.cookieJar.getCookieString(url);
    options["agent"] ??= this.agent;
    return options;
  }

  async #get(url, options = {}) {
    options = await this.#updateOptions(url, options);
    const response = await fetch(url, options);

    if (response.status >= 300) {
      console.error(response.headers, await response.text());
      throw new Error("Failed to get");
    }

    const cookie = response.headers.get("set-cookie");
    if (cookie != null) {
      await this.cookieJar.setCookie(cookie, response.url);
    }

    return response;
  }

  async #post(url, body, options = {}) {
    options = await this.#updateOptions(url, options);

    const response = await fetch(url, {
      method: "POST",
      ...options,
      body,

    });

    if (response.status >= 300) {
      console.error(options, response.headers, await response.text());
      throw new Error("Failed to post");
    }

    const cookie = response.headers.get("set-cookie");
    if (cookie != null) {
      await this.cookieJar.setCookie(cookie, response.url);
    }

    return response;
  }

  async #postJSON(url, body, options = {}) {
    options.headers ??= {};
    options.headers["content-type"] = "application/json";
    body = JSON.stringify(body);
    return this.#post(url, body, options);

  }

  async login(data) {
    if (data.username == null && data.email == null) {
      throw new Error("Username or email is required");
    }

    if (data.password == null) {
      throw new Error("Password is required");
    }

    const response = await this.#postJSON("http://localhost:3000/api/v1/login", data);

    const respJson = await response.json();

    // if not null, assume id is not null.
    if (respJson.token == null) {
      throw new Error("Data was json, no token!");
    }

   
    this.#loginWS(data);
    this.id = respJson.id;
    this.token = respJson.token;
    return respJson;
  }

  async #loginWS(data) {
    this._ws = new ws.WebSocket("ws://localhost:3000/api/v1/ws", {
      agent: this.agent,
    });

    this._ws.on("open", () => {
      console.log("WS open");
      this._ws.send(JSON.stringify(data));
    });

    this._ws.on("message", (data) => {
      console.log("WS message", data);
    });

    this._ws.on("close", () => {
      console.log("WS close");
    });

    this._ws.on("error", (err) => {
      console.error("WS error", err);
    });
  }

 
  async getMe() {
    const response = await this.#get("http://localhost:3000/api/v1/@me");
    const data = await response.json();

    if (data.id == null) {
      throw new Error("Invalid response");
    }

    this.id = data.id;
    this.#email = data.email;
    this.#username = data.username;
    return data;
  }

  async getMyListings() {
    const response = await this.#get("http://localhost:3000/api/v1/@me/listings");
    const data = await response.json();

    if (data.length == null) {
      throw new Error("Invalid response");
    }

    return data;
  }


  async getUser(username) {
    const response = await this.#get(`http://localhost:3000/api/v1/user/${username}`);
    const data = await response.json();

    if (data.id == null) {
      throw new Error("Invalid response");
    }

    return data;
  }

  async getUserListings(userid) {
    const response = await this.#get(`http://localhost:3000/api/v1/user/${userid}/listings`);
    const data = await response.json();

    if (data.length == null) {
      throw new Error("Invalid response");
    }

    return data;
  }

  async createListing(data) {
    const response = await this.#postJSON("http://localhost:3000/api/v1/listing", data);
    const listing = await response.json();

    if (listing.id == null) {
      throw new Error("Invalid response");
    }

    return listing;
  }


  #getHashedChannel(...userids) {
    return userids.join("-");
  }

  async messageUsers(msg, ...userids) {
    const hash = this.#getHashedChannel(...userids);

    if (this.knownChannels.has(hash)) {
      const channelid = this.knownChannels.get(hash);
      return await this.messageChannel(channelid, msg);
    } else {
      const initMsg = {
        targetids: userids,
        message: msg,
      }
      const response = await this.#postJSON("http://localhost:3000/api/v1/initMessage", initMsg);
      const respJson = await response.json();

      if (respJson.channelid == null) {
        throw new Error("Invalid response");
      }

      this.knownChannels.set(hash, respJson.channelid);
      return {id: respJson.messageid};
    }
  }

  async messageChannel(channelid, msg) {
    const response = await this.#postJSON(`http://localhost:3000/api/v1/channel/${channelid}/message`, msg);
    const message = await response.json();

    if (message.id == null) {
      throw new Error("Invalid response");
    }

    return message;
  }

  getChannelFor(...userids) {
    const hash = this.#getHashedChannel(...userids);
    return this.knownChannels.get(hash);
  }
}

const test = async () => {
  const client = new Client();
  await client.login({ username: "123", password: "123" });
  const me = await client.getMe();

  console.log(me);

  const mylistings = await client.getMyListings();
  console.log(mylistings);

  const user = await client.getUser("1234");
  console.log(user);

  const listings = await client.getUserListings(user.id);
  console.log(listings);


  const newListing = await client.createListing({
    title: "Test Listing",
    description: "This is a test listing",
    price: 100,
  });

  console.log('newListing', newListing);

  let message = await client.messageUsers({
    content: "Hello, how are you?",
  }, user.id);

  console.log('message (uncached channel)', message);

  message = await client.messageUsers({
    content: "Hello, how are you?",
  }, user.id);

  console.log('message (cached channel)', message);

  const channel = client.getChannelFor(user.id);

  message = await client.messageChannel(channel, {
    content: "Hello, how are you?",
  });

  console.log('channel for user dm\'d', channel)
  console.log('message (cached channel via channel message)', message);

};

test();
