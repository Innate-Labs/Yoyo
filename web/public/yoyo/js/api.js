/**
 * Yoyo API boundary.
 *
 * Backend work should be concentrated in this file. The UI controller in
 * app.js should not know framework-specific routing, tokens, or base URLs.
 */
window.YoyoAPI = (() => {
  const config = window.__YOYO_CONFIG__ || {};

  const SPECIES = ["雪貂", "龙猫", "兔兔", "蜜袋鼯", "其他"];
  const SUGGEST = [
    "一天喂几次？",
    "笼子和垫材怎么选？",
    "最近老掉毛，还爱咬东西",
    "突然抽搐，叫不醒",
  ];
  const VETS = [];

  function answerFor() {
    throw new Error("Yoyo 后端集成层尚未加载");
  }

  async function request(pathname, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      config.requestTimeoutMs || 15000
    );

    try {
      const response = await fetch(`${config.apiBaseUrl || ""}${pathname}`, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
        ...options,
        signal: controller.signal,
      });

      if (response.status === 204) return null;
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        throw new Error(
          payload.error || payload.message || `Request failed: ${response.status}`
        );
      }
      return payload.ok === true ? payload.data : payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function upload(pathname, file, fieldName = "file") {
    const form = new FormData();
    form.append(fieldName, file);

    const response = await fetch(`${config.apiBaseUrl || ""}${pathname}`, {
      method: "POST",
      credentials: "include",
      body: form,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(
        payload.error || payload.message || `Upload failed: ${response.status}`
      );
    }
    return payload.ok === true ? payload.data : payload;
  }

  async function streamChat(payload, handlers = {}) {
    const response = await fetch(`${config.apiBaseUrl || ""}/api/chat`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error || "分析失败，请稍后重试");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";
      for (const block of blocks) {
        const lines = block.split("\n");
        let event = "message";
        let data = "";
        for (const line of lines) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (!data) continue;
        const parsed = JSON.parse(data);
        if (event === "delta") handlers.onDelta?.(parsed.text || "");
        if (event === "done") handlers.onDone?.(parsed);
        if (event === "error") {
          throw new Error(parsed.message || "分析失败，请稍后重试");
        }
      }
    }
  }

  const services = {
    auth: {
      sendCode(phone) {
        return request("/api/auth/send-code", {
          method: "POST",
          body: JSON.stringify({ phone }),
        });
      },
      login(phone, code) {
        return request("/api/auth/verify", {
          method: "POST",
          body: JSON.stringify({ phone, code }),
        });
      },
      logout() {
        return request("/api/auth/logout", { method: "POST" });
      },
    },
    me: {
      get() {
        return request("/api/auth/me");
      },
      update(payload) {
        return request("/api/auth/me", {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      },
    },
    pets: {
      list() {
        return request("/api/pets");
      },
      create(payload) {
        return request("/api/pets", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      },
      update(petId, payload) {
        return request(`/api/pets/${encodeURIComponent(petId)}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      },
      remove(petId) {
        return request(`/api/pets/${encodeURIComponent(petId)}`, {
          method: "DELETE",
        });
      },
    },
    uploads: {
      petPhoto(file) {
        return upload("/api/upload", file, "file");
      },
      chatImage(file) {
        return upload("/api/upload", file, "file");
      },
    },
    conversations: {
      list() {
        return request("/api/conversations");
      },
      create(payload = {}) {
        return request("/api/conversations", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      },
      get(conversationId) {
        return request(
          `/api/conversations/${encodeURIComponent(conversationId)}`
        );
      },
      sendMessage(conversationId, payload) {
        return streamChat({ conversationId, ...payload }, payload.handlers);
      },
      remove(conversationId) {
        return request(
          `/api/conversations/${encodeURIComponent(conversationId)}`,
          { method: "DELETE" }
        );
      },
    },
    vets: {
      nearby(params) {
        const query = new URLSearchParams(params).toString();
        return request(`/api/vets?${query}`);
      },
    },
  };

  return {
    config,
    request,
    upload,
    streamChat,
    services,
    mock: { SPECIES, SUGGEST, VETS, answerFor },
  };
})();
