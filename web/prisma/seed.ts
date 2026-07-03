import { PrismaClient } from "@prisma/client";

// 架构已改为场景 Skill（见 skills/），不再依赖 RAG 语料。
// 本 seed 目前为占位：rag_chunks 表保留为空实现接口，无需预置数据。
// 未来若重启 RAG，可在此写入语料并配合向量化脚本。
const prisma = new PrismaClient();

async function main() {
  const chunkCount = await prisma.ragChunk.count();
  console.log(`seed 完成。当前 rag_chunks 行数：${chunkCount}（RAG 为空实现，属正常）。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
