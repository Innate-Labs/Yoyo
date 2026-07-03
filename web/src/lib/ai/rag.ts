// RAG 检索——保留接口，当前为空实现（架构已改为场景 Skill，不走向量检索）。
// 调用方（chat 路由）无需改动；未来若重启 RAG：在此填入向量检索逻辑、并给 rag_chunks
// 加回 embedding 列 + pgvector 扩展即可。
//
// 保留签名与原一致：retrieveChunks(query, species?, k?) => string[]

export async function retrieveChunks(
  _query: string,
  _species?: string,
  _k = 4
): Promise<string[]> {
  return [];
}
