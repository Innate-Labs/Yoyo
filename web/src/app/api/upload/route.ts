import { ok, fail, handleError } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: Request) {
  try {
    await requireUserId();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("未收到文件", 400);

    if (!ALLOWED.has(file.type)) {
      return fail("当前格式不支持，请上传 jpg / png / webp 图片", 415);
    }
    if (file.size > MAX_BYTES) {
      return fail("图片体积超过 10MB，请压缩后再上传", 413);
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const name = `${crypto.randomUUID()}.${EXT[file.type]}`;
    await writeFile(path.join(dir, name), buf);

    return ok({ url: `/uploads/${name}` });
  } catch (e) {
    return handleError(e);
  }
}
