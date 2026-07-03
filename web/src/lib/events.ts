import { prisma } from "./db";
import { Prisma } from "@prisma/client";

/**
 * 埋点落库（PRD 4.3）。埋点失败不应影响主流程，故内部吞掉异常。
 * 事件名沿用 PRD 命名：注册_完成 / 宠物档案_完成 / 问答_发起 / 问答_类型判定 /
 * 高危提示_触发 / 资源地图_检索 / 问答_反馈 / 复访_有效行为
 */
export async function track(
  name: string,
  userId: string | null,
  payload?: Record<string, unknown>
) {
  try {
    await prisma.event.create({
      data: {
        name,
        userId: userId ?? undefined,
        payload: (payload ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (e) {
    console.error("[TRACK ERROR]", name, e);
  }
}
