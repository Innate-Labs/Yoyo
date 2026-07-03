"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, type Pet, type ConvListItem, type Msg } from "@/lib/client";
import { AnswerText } from "@/components/AnswerText";
import { VetMap } from "@/components/VetMap";
import { PetForm, type PetFormValue } from "@/components/PetForm";

const NETWORK_CACHE_KEY = "epa_draft";

export default function ChatClient() {
  const router = useRouter();

  const [pets, setPets] = useState<Pet[]>([]);
  const [activePetId, setActivePetId] = useState<string | null>(null);
  const [convs, setConvs] = useState<ConvListItem[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);

  const [input, setInput] = useState("");
  const [image, setImage] = useState<{ url: string; uploading: boolean } | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [showPetModal, setShowPetModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ---- 初始加载 ----
  useEffect(() => {
    (async () => {
      try {
        const [petData, convData] = await Promise.all([
          api<{ pets: Pet[] }>("/api/pets"),
          api<{ conversations: ConvListItem[] }>("/api/conversations"),
        ]);
        setPets(petData.pets);
        setActivePetId(petData.pets[0]?.id ?? null);
        setConvs(convData.conversations);
      } catch {
        router.push("/login");
      }
    })();
    // 恢复网络中断缓存的输入
    const draft = localStorage.getItem(NETWORK_CACHE_KEY);
    if (draft) setInput(draft);
  }, [router]);

  // 自动滚到底
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streamText]);

  const refreshConvs = useCallback(async () => {
    const data = await api<{ conversations: ConvListItem[] }>("/api/conversations");
    setConvs(data.conversations);
  }, []);

  // ---- 会话操作 ----
  async function openConv(id: string) {
    setError("");
    setConvId(id);
    setSidebarOpen(false);
    const data = await api<{ conversation: { messages: Msg[]; petId: string | null } }>(
      `/api/conversations/${id}`
    );
    setMessages(data.conversation.messages);
    if (data.conversation.petId) setActivePetId(data.conversation.petId);
  }

  function newChat() {
    setConvId(null);
    setMessages([]);
    setStreamText("");
    setError("");
    setSidebarOpen(false);
  }

  async function renameConv(id: string, current: string) {
    const title = prompt("重命名会话", current);
    if (!title) return;
    await api(`/api/conversations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
    refreshConvs();
  }

  async function deleteConv(id: string) {
    if (!confirm("删除该会话？")) return;
    await api(`/api/conversations/${id}`, { method: "DELETE" });
    if (convId === id) newChat();
    refreshConvs();
  }

  // ---- 图片上传 ----
  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("当前格式不支持，请上传 jpg / png / webp 图片");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("图片体积超过 10MB，请压缩后再上传");
      return;
    }
    setError("");
    setImage({ url: "", uploading: true });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const data = await api<{ url: string }>("/api/upload", { method: "POST", body: fd });
      setImage({ url: data.url, uploading: false });
    } catch (err) {
      setError((err as Error).message);
      setImage(null);
    }
  }

  // ---- 发送并流式接收 ----
  async function send() {
    const text = input.trim();
    if ((!text && !image?.url) || streaming) return;
    if (image?.uploading) {
      setError("图片还在上传中，请稍候");
      return;
    }
    setError("");

    // 确保有会话
    let cid = convId;
    if (!cid) {
      const data = await api<{ conversation: { id: string } }>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ petId: activePetId }),
      });
      cid = data.conversation.id;
      setConvId(cid);
    }

    const imageUrl = image?.url || null;
    // 乐观插入用户消息
    setMessages((m) => [
      ...m,
      {
        id: `local-${Date.now()}`,
        role: "USER",
        content: text,
        imageUrl,
        isHighRisk: false,
      },
    ]);
    setInput("");
    setImage(null);
    localStorage.removeItem(NETWORK_CACHE_KEY);
    setStreaming(true);
    setStreamText("");

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: cid, text, imageUrl }),
      });
      if (!resp.ok || !resp.body) throw new Error("分析超时，请稍后重试");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      let final: {
        messageId: string;
        answer: string;
        isHighRisk: boolean;
        questionType: string;
      } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          const ev = parseSse(evt);
          if (!ev) continue;
          if (ev.event === "delta") {
            acc += ev.data.text;
            setStreamText(acc);
          } else if (ev.event === "done") {
            final = ev.data;
          } else if (ev.event === "error") {
            throw new Error(ev.data.message || "分析失败");
          }
        }
      }

      if (final) {
        setMessages((m) => [
          ...m,
          {
            id: final!.messageId,
            role: "ASSISTANT",
            content: final!.answer,
            imageUrl: null,
            isHighRisk: final!.isHighRisk,
            questionType: final!.questionType,
          },
        ]);
        if (final.isHighRisk) setShowMap(true);
      }
      refreshConvs();
    } catch (err) {
      setError((err as Error).message || "分析超时，请稍后重试");
      // 缓存输入以便重试
      if (text) localStorage.setItem(NETWORK_CACHE_KEY, text);
      setInput(text);
    } finally {
      setStreaming(false);
      setStreamText("");
    }
  }

  // ---- 反馈 ----
  async function feedback(msgId: string, kind: "UP" | "DOWN") {
    setMessages((m) =>
      m.map((x) => {
        if (x.id !== msgId) return x;
        const cur = x.feedbacks?.[0]?.kind;
        const next = cur === kind ? undefined : kind;
        return { ...x, feedbacks: next ? [{ kind: next }] : [] };
      })
    );
    const cur = messages.find((x) => x.id === msgId)?.feedbacks?.[0]?.kind;
    await api(`/api/messages/${msgId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ kind: cur === kind ? null : kind }),
    }).catch(() => {});
  }

  // ---- 宠物管理 ----
  async function addPet(v: PetFormValue) {
    const data = await api<{ pet: Pet }>("/api/pets", {
      method: "POST",
      body: JSON.stringify(v),
    });
    setPets((p) => [...p, data.pet]);
    setActivePetId(data.pet.id);
    setShowPetModal(false);
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const activePet = pets.find((p) => p.id === activePetId);

  return (
    <div className="flex h-screen bg-white">
      {/* 侧边栏 */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r bg-gray-50 transition-transform sm:static sm:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="p-3">
            <button
              onClick={newChat}
              className="w-full rounded-lg bg-brand py-2.5 text-sm font-medium text-white"
            >
              + 新对话
            </button>
          </div>

          {/* 宠物选择 */}
          <div className="px-3 pb-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-gray-400">当前宠物</span>
              <button
                className="text-xs text-brand"
                onClick={() => setShowPetModal(true)}
              >
                + 添加
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {pets.length === 0 && (
                <span className="text-xs text-gray-400">未添加宠物</span>
              )}
              {pets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActivePetId(p.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    activePetId === p.id
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-gray-200 text-gray-600"
                  }`}
                >
                  {p.name}·{p.species}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 flex-1 overflow-y-auto px-2">
            <p className="px-2 py-1 text-xs text-gray-400">历史对话</p>
            {convs.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center justify-between rounded-lg px-2 py-2 text-sm ${
                  convId === c.id ? "bg-brand-soft" : "hover:bg-gray-100"
                }`}
              >
                <button
                  className="flex-1 truncate text-left"
                  onClick={() => openConv(c.id)}
                  title={c.title}
                >
                  {c.title}
                </button>
                <span className="ml-1 hidden gap-1 group-hover:flex">
                  <button
                    className="text-xs text-gray-400"
                    onClick={() => renameConv(c.id, c.title)}
                  >
                    改
                  </button>
                  <button
                    className="text-xs text-gray-400"
                    onClick={() => deleteConv(c.id)}
                  >
                    删
                  </button>
                </span>
              </div>
            ))}
          </div>

          <div className="border-t p-3">
            <button className="text-xs text-gray-400" onClick={logout}>
              退出登录
            </button>
          </div>
        </div>
      </aside>

      {/* 主区 */}
      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <button
            className="text-gray-500 sm:hidden"
            onClick={() => setSidebarOpen((s) => !s)}
          >
            ☰
          </button>
          <div className="text-sm text-gray-500">
            异宠AI问答
            {activePet && (
              <span className="ml-2 text-xs text-gray-400">
                · 当前：{activePet.name}（{activePet.species}）
              </span>
            )}
          </div>
          <button
            className="text-xs text-brand"
            onClick={() => setShowMap(true)}
          >
            资源地图
          </button>
        </header>

        {/* 消息列表 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-2xl space-y-5">
            {messages.length === 0 && !streaming && (
              <div className="mt-10 text-center text-sm text-gray-400">
                <p className="text-base font-medium text-gray-600">
                  你好，我是你的异宠养护助手 🦦
                </p>
                <p className="mt-2">
                  可以问我喂食、环境、行为，或描述它最近的异常。
                </p>
                <p className="mt-1 text-xs">
                  AI 辅助参考，不替代执业兽医诊断。
                </p>
              </div>
            )}

            {messages.map((m) => (
              <MessageBubble key={m.id} msg={m} onFeedback={feedback} />
            ))}

            {streaming && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3">
                  {streamText ? (
                    <AnswerText text={streamText} />
                  ) : (
                    <span className="text-sm text-gray-400">正在分析…</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 输入区 */}
        <div className="border-t px-4 py-3">
          <div className="mx-auto max-w-2xl">
            {error && (
              <div className="mb-2 flex items-center justify-between rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
                <span>{error}</span>
                <button onClick={send} className="underline">
                  重试
                </button>
              </div>
            )}
            {image && (
              <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
                {image.uploading ? (
                  "图片上传中…"
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.url} alt="上传预览" className="h-12 w-12 rounded object-cover" />
                    <button className="text-danger" onClick={() => setImage(null)}>
                      移除
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="flex items-end gap-2">
              <button
                className="rounded-lg border border-gray-200 px-3 py-2 text-gray-500"
                onClick={() => fileRef.current?.click()}
                title="上传图片"
              >
                📷
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onPickFile}
              />
              <textarea
                className="max-h-40 flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-brand"
                rows={1}
                placeholder="描述你的问题，如：我家貂最近老掉毛，精神有点亢奋…"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (e.target.value) localStorage.setItem(NETWORK_CACHE_KEY, e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button
                className="rounded-lg bg-brand px-4 py-2 font-medium text-white disabled:opacity-40"
                onClick={send}
                disabled={streaming || (!input.trim() && !image?.url)}
              >
                发送
              </button>
            </div>
          </div>
        </div>
      </main>

      {showMap && <VetMap onClose={() => setShowMap(false)} />}

      {showPetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h3 className="mb-4 font-semibold">添加宠物</h3>
            <PetForm
              submitLabel="添加"
              onSubmit={addPet}
              onCancel={() => setShowPetModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  msg,
  onFeedback,
}: {
  msg: Msg;
  onFeedback: (id: string, kind: "UP" | "DOWN") => void;
}) {
  const isUser = msg.role === "USER";
  const fb = msg.feedbacks?.[0]?.kind;
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? "rounded-tr-sm bg-brand text-white"
            : "rounded-tl-sm bg-gray-100 text-gray-900"
        }`}
      >
        {msg.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={msg.imageUrl}
            alt="用户上传"
            className="mb-2 max-h-48 rounded-lg object-cover"
          />
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <>
            <AnswerText text={msg.content} />
            {!msg.id.startsWith("local-") && (
              <div className="mt-2 flex gap-3 text-xs text-gray-400">
                <button
                  className={fb === "UP" ? "text-brand" : ""}
                  onClick={() => onFeedback(msg.id, "UP")}
                >
                  👍 有用
                </button>
                <button
                  className={fb === "DOWN" ? "text-danger" : ""}
                  onClick={() => onFeedback(msg.id, "DOWN")}
                >
                  👎 没帮助
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// 解析单个 SSE 事件块
function parseSse(block: string): { event: string; data: any } | null {
  const lines = block.split("\n");
  let event = "message";
  let data = "";
  for (const l of lines) {
    if (l.startsWith("event:")) event = l.slice(6).trim();
    else if (l.startsWith("data:")) data += l.slice(5).trim();
  }
  if (!data) return null;
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return null;
  }
}
