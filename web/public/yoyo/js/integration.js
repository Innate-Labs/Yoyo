/**
 * Yoyo 与现有 Next.js 后端的集成层。
 * 视觉与 DOM 由 app.js 维护；这里只替换数据、鉴权、上传与流式对话行为。
 */
(() => {
  const services = window.YoyoAPI.services;
  const rawOpenPet = App.openPet.bind(App);
  const rawRenderPreview = App.renderPreview.bind(App);

  const sexToUi = { MALE: "公", FEMALE: "母", UNKNOWN: "未知" };
  const sexToApi = { 公: "MALE", 母: "FEMALE", 未知: "UNKNOWN" };

  function ageLabel(months) {
    if (months == null) return "年龄未知";
    if (months < 12) return `${months} 个月`;
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return rest ? `${years} 岁 ${rest} 个月` : `${years} 岁`;
  }

  function ageMonths(value) {
    const text = String(value || "").trim();
    if (!text || text === "年龄未知") return null;
    if (/^\d+$/.test(text)) return Number(text);
    const years = Number(text.match(/(\d+)\s*岁/)?.[1] || 0);
    const months = Number(text.match(/(\d+)\s*个?月/)?.[1] || 0);
    return years * 12 + months;
  }

  function mapPet(pet) {
    return {
      id: pet.id,
      name: pet.name,
      species: pet.species,
      ageMonths: pet.ageMonths,
      age: ageLabel(pet.ageMonths),
      sex: sexToUi[pet.sex] || "未知",
      photo: pet.photoUrl || null,
    };
  }

  function mapMessage(message) {
    const isUser = message.role === "USER";
    return {
      id: message.id,
      role: isUser ? "user" : "ai",
      text: message.content || "",
      image: message.imageUrl || null,
      context: "",
      high: Boolean(message.isHighRisk),
    };
  }

  function setBusy(button, busy, busyText) {
    if (!button) return;
    if (busy) button.dataset.label = button.textContent;
    button.disabled = busy;
    button.textContent = busy ? busyText : button.dataset.label || button.textContent;
  }

  async function loadPets() {
    const data = await services.pets.list();
    state.pets = (data.pets || []).map(mapPet);
    if (state.selected >= state.pets.length) state.selected = 0;
  }

  async function loadConversations() {
    const data = await services.conversations.list();
    state.chats = (data.conversations || []).map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      petId: conversation.pet?.id || null,
      messages: [],
      loaded: false,
    }));
    if (state.active && !state.chats.some((chat) => chat.id === state.active)) {
      state.active = null;
    }
  }

  async function loadSession(showApp = true) {
    const data = await services.me.get();
    if (!data.user) return false;
    state.user = {
      name: data.user.name || "异宠用户",
      phone: data.user.phone || "",
    };
    await Promise.all([loadPets(), loadConversations()]);
    if (showApp) App.show("#inside");
    App.renderAll();
    return true;
  }

  App.init = async function init() {
    try {
      const loggedIn = await loadSession(false);
      if (loggedIn) this.show("#inside");
      else this.show("#landing");
    } catch {
      this.show("#landing");
    }
    this.renderSuggestions();
  };

  App.openAuth = function openAuth() {
    $("#modalMount").innerHTML = `
      <div class="mask" onclick="if(event.target===this)App.closeModal()">
        <div class="modal">
          <div class="modal-head">
            <h2 class="display">登录 Yoyo</h2>
            <button class="close" onclick="App.closeModal()">×</button>
          </div>
          <div class="modal-body">
            <p class="lead">登录后即可保存宠物档案和历史对话。</p>
            <div class="field">
              <label>手机号</label>
              <input id="phone" class="input" maxlength="11" inputmode="numeric">
            </div>
            <div class="field">
              <label>验证码</label>
              <div class="row">
                <input id="codeInput" class="input" placeholder="输入 6 位验证码" maxlength="6" inputmode="numeric">
                <button class="code" onclick="App.sendCode(this)">获取验证码</button>
              </div>
            </div>
            <div id="authHint" class="hint hidden"></div>
            <div id="authError" class="error hidden"></div>
            <button id="loginButton" class="btn btn-primary submit" onclick="App.login()">进入 Yoyo&nbsp; ↗</button>
          </div>
        </div>
      </div>`;
    setTimeout(() => $("#phone")?.focus(), 60);
  };

  App.sendCode = async function sendCode(button) {
    const phone = $("#phone")?.value.trim() || "";
    const error = $("#authError");
    error.classList.add("hidden");
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      error.textContent = "请输入有效手机号";
      error.classList.remove("hidden");
      return;
    }
    setBusy(button, true, "发送中…");
    try {
      const result = await services.auth.sendCode(phone);
      const hint = $("#authHint");
      hint.textContent = result.hint || "验证码已发送";
      hint.classList.remove("hidden");
      let seconds = 60;
      const timer = setInterval(() => {
        seconds -= 1;
        button.textContent = seconds > 0 ? `已发送 · ${seconds}s` : "重新发送";
        if (seconds <= 0) {
          clearInterval(timer);
          button.disabled = false;
        }
      }, 1000);
    } catch (errorValue) {
      setBusy(button, false);
      error.textContent = errorValue.message;
      error.classList.remove("hidden");
    }
  };

  App.login = async function login() {
    const phone = $("#phone")?.value.trim() || "";
    const code = $("#codeInput")?.value.trim() || "";
    const error = $("#authError");
    const button = $("#loginButton");
    error.classList.add("hidden");
    if (!/^1[3-9]\d{9}$/.test(phone) || !/^\d{6}$/.test(code)) {
      error.textContent = "请输入有效手机号和 6 位验证码";
      error.classList.remove("hidden");
      return;
    }
    setBusy(button, true, "登录中…");
    try {
      await services.auth.login(phone, code);
      await loadSession(false);
      this.closeModal();
      this.show("#inside");
      this.renderAll();
      if (state.pets.length === 0) {
        setTimeout(() => this.openPet(true), 220);
      }
    } catch (errorValue) {
      setBusy(button, false);
      error.textContent = errorValue.message;
      error.classList.remove("hidden");
    }
  };

  App.logout = async function logout() {
    try {
      await services.auth.logout();
    } finally {
      state.pets = [];
      state.chats = [];
      state.active = null;
      this.closeProfile();
      this.show("#landing");
      this.toast("已退出登录");
    }
  };

  App.openPet = function openPet(first = false, editIndex = null) {
    state.petDraftFile = null;
    rawOpenPet(first, editIndex);
  };

  App.pickPetPhoto = function pickPetPhoto() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        this.toast("请上传 JPG、PNG 或 WebP 图片");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        this.toast("图片不能超过 10MB");
        return;
      }
      state.petDraftFile = file;
      state.petDraftPhoto = URL.createObjectURL(file);
      this.renderPetPhoto();
    };
    input.click();
  };

  App.savePet = async function savePet() {
    const name = $("#petName")?.value.trim() || "";
    const error = $("#petError");
    if (!name) {
      error.textContent = "请先填写宠物昵称";
      error.classList.remove("hidden");
      return;
    }
    const button = error.parentElement.querySelector(".submit");
    setBusy(button, true, "保存中…");
    try {
      let photoUrl = state.petDraftPhoto || null;
      if (state.petDraftFile) {
        const upload = await services.uploads.petPhoto(state.petDraftFile);
        photoUrl = upload.url;
      }
      const payload = {
        name,
        species: $("#species .on").dataset.name,
        ageMonths: ageMonths($("#petAge").value),
        sex: sexToApi[$("#sex .on").dataset.value] || "UNKNOWN",
        photoUrl,
      };
      const editing = state.editingPet !== null;
      const result = editing
        ? await services.pets.update(state.pets[state.editingPet].id, payload)
        : await services.pets.create(payload);
      const saved = mapPet(result.pet);
      if (editing) {
        state.pets[state.editingPet] = saved;
      } else {
        state.pets.push(saved);
        state.selected = state.pets.length - 1;
      }
      state.editingPet = null;
      state.petDraftFile = null;
      this.closeModal();
      this.renderPets();
      this.toast(editing ? `${name} 的档案已更新` : `${name} 的档案保存好了`);
    } catch (errorValue) {
      setBusy(button, false);
      error.textContent = errorValue.message;
      error.classList.remove("hidden");
    }
  };

  App.selectPet = function selectPet(index) {
    const nextPet = state.pets[index];
    const chat = this.current();
    if (chat?.messages.length && chat.petId && chat.petId !== nextPet.id) {
      state.active = null;
      state.pendingImage = null;
    }
    state.selected = index;
    this.renderAll();
    const input = this.current()?.messages.length ? $("#chatInput") : $("#heroInput");
    input.placeholder = `问问关于 ${nextPet.name}（${nextPet.species}）的问题…`;
    input.focus();
  };

  App.askPet = function askPet(index) {
    const pet = state.pets[index];
    const chat = this.current();
    if (chat?.messages.length && chat.petId !== pet.id) state.active = null;
    state.selected = index;
    this.renderAll();
    const input = this.current()?.messages.length ? $("#chatInput") : $("#heroInput");
    input.placeholder = `问问关于 ${pet.name}（${pet.species}）的问题…`;
    input.focus();
  };

  App.newChat = function newChat() {
    state.active = null;
    state.pendingImage = null;
    state.pendingImageFile = null;
    this.renderAll();
    rawRenderPreview();
    this.closeSidebar();
    $("#heroInput").value = "";
  };

  App.openChat = async function openChat(id) {
    state.active = id;
    const chat = this.current();
    this.closeSidebar();
    if (!chat.loaded) {
      try {
        const data = await services.conversations.get(id);
        chat.messages = (data.conversation.messages || []).map(mapMessage);
        chat.petId = data.conversation.petId;
        chat.loaded = true;
        const petIndex = state.pets.findIndex((pet) => pet.id === chat.petId);
        if (petIndex >= 0) state.selected = petIndex;
      } catch (errorValue) {
        this.toast(errorValue.message);
      }
    }
    this.renderAll();
  };

  App.pickChatImage = function pickChatImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        this.toast("请上传 JPG、PNG 或 WebP 图片");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        this.toast("图片不能超过 10MB");
        return;
      }
      state.pendingImageFile = file;
      state.pendingImage = URL.createObjectURL(file);
      rawRenderPreview();
      this.toast("图片已添加");
    };
    input.click();
  };

  App.clearImage = function clearImage() {
    state.pendingImage = null;
    state.pendingImageFile = null;
    rawRenderPreview();
  };

  App.send = async function send(where, preset) {
    if (state.streaming) return;
    const input = where === "hero" ? $("#heroInput") : $("#chatInput");
    const text = String(preset ?? input.value).trim();
    if (!text && !state.pendingImageFile) return;

    const pet = state.pets[state.selected] || null;
    let chat = this.current();
    try {
      if (!chat) {
        const data = await services.conversations.create({ petId: pet?.id || null });
        chat = {
          id: data.conversation.id,
          title: text.slice(0, 22) || "图片提问",
          petId: pet?.id || null,
          messages: [],
          loaded: true,
        };
        state.chats.unshift(chat);
        state.active = chat.id;
      }

      let imageUrl = null;
      if (state.pendingImageFile) {
        const upload = await services.uploads.chatImage(state.pendingImageFile);
        imageUrl = upload.url;
      }

      const visibleText = text || "请帮我看看这张图片";
      const context = pet
        ? `[${pet.name} · ${pet.species} · ${pet.age} · ${pet.sex}] `
        : "";
      chat.messages.push({
        role: "user",
        text: visibleText,
        context,
        image: imageUrl || state.pendingImage,
      });
      const answer = { role: "ai", text: "", high: false };
      chat.messages.push(answer);
      input.value = "";
      state.pendingImage = null;
      state.pendingImageFile = null;
      rawRenderPreview();
      state.streaming = true;
      this.renderHistory();
      this.updateView();
      this.renderMessages();

      await window.YoyoAPI.streamChat(
        {
          conversationId: chat.id,
          text: visibleText,
          imageUrl,
        },
        {
          onDelta: (delta) => {
            answer.text += delta;
            this.renderMessages();
          },
          onDone: (result) => {
            answer.id = result.messageId;
            answer.text = result.answer || answer.text;
            answer.high = Boolean(result.isHighRisk);
            this.renderMessages();
          },
        }
      );
      await loadConversations();
      state.active = chat.id;
      const refreshed = this.current();
      if (refreshed) {
        refreshed.messages = chat.messages;
        refreshed.loaded = true;
        refreshed.petId = chat.petId;
      }
      this.renderHistory();
    } catch (errorValue) {
      const last = chat?.messages.at(-1);
      if (last?.role === "ai" && !last.text) {
        last.text = `这次没有成功生成回答：${errorValue.message}`;
      }
      this.toast(errorValue.message);
      this.renderMessages();
      if (text) input.value = text;
    } finally {
      state.streaming = false;
      this.renderMessages();
    }
  };

  App.openProfile = function openProfile() {
    this.closeSidebar();
    $("#profileName").value = state.user.name;
    $("#profilePhone").value = state.user.phone;
    $("#profilePhone").readOnly = true;
    $("#profilePage").classList.remove("hidden");
  };

  App.saveProfile = async function saveProfile() {
    const name = $("#profileName")?.value.trim() || "";
    if (!name) {
      this.toast("请填写昵称");
      return;
    }
    try {
      const data = await services.me.update({ name });
      state.user.name = data.user.name;
      this.renderUser();
      this.toast("个人信息已更新");
    } catch (errorValue) {
      this.toast(errorValue.message);
    }
  };

  function renderVets(source, vets, note) {
    const items = vets.length
      ? vets
          .map((vet) => {
            const distance =
              vet.distanceMeters == null
                ? ""
                : vet.distanceMeters < 1000
                  ? `${vet.distanceMeters} m`
                  : `${(vet.distanceMeters / 1000).toFixed(1)} km`;
            const tel = String(vet.tel || "").split(";")[0];
            return `
              <div class="vet">
                <div class="vet-name"><span>${esc(vet.name)}</span><span>${esc(distance)}</span></div>
                <p>${esc(vet.address)}</p>
                ${tel ? `<a href="tel:${esc(tel)}">致电 ${esc(tel)} ↗</a>` : ""}
              </div>`;
          })
          .join("")
      : `<p class="lead">${esc(note || "暂未找到附近医院")}</p>`;
    $("#modalMount").innerHTML = `
      <div class="mask" onclick="if(event.target===this)App.closeModal()">
        <div class="modal">
          <div class="modal-head">
            <h2 class="display">附近医院</h2>
            <button class="close" onclick="App.closeModal()">×</button>
          </div>
          <div class="modal-body">
            ${
              source === "high"
                ? `<div class="risk-note"><b>检测到高危描述</b><br>请优先联系医院并尽快出发。</div>`
                : ""
            }
            <p class="lead" style="margin-top:12px">出发前请电话确认能否接诊异宠。</p>
            ${items}
          </div>
        </div>
      </div>`;
  }

  App.openMap = async function openMap(source) {
    $("#modalMount").innerHTML = `
      <div class="mask"><div class="modal"><div class="modal-body">
        <p class="lead">正在查找附近宠物医院…</p>
      </div></div></div>`;
    const params = { source };
    if ("geolocation" in navigator) {
      try {
        const position = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 8000,
          })
        );
        params.lng = String(position.coords.longitude);
        params.lat = String(position.coords.latitude);
      } catch {
        // 定位失败时由后端执行无定位降级。
      }
    }
    try {
      const data = await services.vets.nearby(params);
      renderVets(source, data.vets || [], data.note);
    } catch (errorValue) {
      renderVets(source, [], errorValue.message);
    }
  };

  window.addEventListener("load", () => App.init());
})();
