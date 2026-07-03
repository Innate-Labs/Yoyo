import { redirect } from "next/navigation";
import { getUserId } from "@/lib/session";
import ChatClient from "./ChatClient";

export default async function ChatPage() {
  const uid = await getUserId();
  if (!uid) redirect("/login");
  return <ChatClient />;
}
