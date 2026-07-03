import { ok, handleError } from "@/lib/api";
import { clearSession } from "@/lib/session";

export async function POST() {
  try {
    clearSession();
    return ok({ loggedOut: true });
  } catch (e) {
    return handleError(e);
  }
}
