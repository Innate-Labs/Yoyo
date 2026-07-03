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
  const EMERGENCY = [
    "抽搐",
    "痉挛",
    "出血",
    "呼吸困难",
    "昏迷",
    "瘫痪",
    "中毒",
    "持续呕吐",
    "休克",
  ];
  const ANOMALY = [
    "掉毛",
    "脱毛",
    "变瘦",
    "亢奋",
    "爱咬",
    "嗜睡",
    "发抖",
    "无力",
  ];
  const VETS = [
    ["毛球动物医院 · 中心店", "0.8 km", "示例市元气路 18 号", "010-00000000"],
    ["24H 小动物急诊", "2.3 km", "示例市月光大道 66 号", "010-11111111"],
    ["奇妙异宠诊所", "3.6 km", "示例市森林街 5 号", "010-22222222"],
  ];

  function answerFor(text) {
    if (EMERGENCY.some((keyword) => text.includes(keyword))) {
      return {
        high: true,
        text:
          "**请立即就医**\n" +
          "你描述的情况可能属于紧急状况，请尽快带它前往能接诊异宠的宠物医院。\n\n" +
          "出发前保持安静和温暖，不要强行喂食或自行用药；如果方便，记录症状开始时间并拍下短视频。\n\n" +
          "本回答为 AI 辅助参考，不替代执业兽医诊断。",
      };
    }

    if (ANOMALY.some((keyword) => text.includes(keyword))) {
      return {
        high: false,
        text:
          "这些变化值得留意。掉毛与异常亢奋可能和季节换毛、压力或潜在健康问题有关，不能只凭一条描述判断。\n\n" +
          "建议记录掉毛位置、持续时间、食欲和体重变化；若持续加重，请预约能看异宠的兽医。",
      };
    }

    return {
      high: false,
      text:
        "可以先从饮食、环境温湿度和近期活动量三个方面检查。\n\n" +
        "你可以继续补充具体表现，我会帮你把建议缩小到更实用的范围。",
    };
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

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.message || `Request failed: ${response.status}`);
      }

      if (response.status === 204) return null;
      return response.json();
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

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.message || `Upload failed: ${response.status}`);
    }

    return response.json();
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
        return request("/api/auth/login", {
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
        return request("/api/me");
      },
      update(payload) {
        return request("/api/me", {
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
        return upload("/api/uploads/pet-photo", file, "photo");
      },
      chatImage(file) {
        return upload("/api/uploads/chat-image", file, "image");
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
        return request(
          `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );
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
        return request(`/api/vets/nearby?${query}`);
      },
    },
  };

  return {
    config,
    request,
    upload,
    services,
    mock: { SPECIES, SUGGEST, VETS, answerFor },
  };
})();
