import { ok, handleError } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { track } from "@/lib/events";

export const dynamic = "force-dynamic";

// 资源地图：高危场景下查询附近宠物医院。
// MVP：高德只搜"宠物医院/动物医院"，不做异宠白名单，前端附"请致电确认是否能看异宠"。
// 无 Key / 无结果时降级为 mock 数据 + 手动检索提示（PRD 兜底）。

interface Vet {
  name: string;
  address: string;
  tel?: string;
  distanceMeters?: number;
  location?: { lng: number; lat: number };
}

const MOCK_VETS: Vet[] = [
  { name: "（示例）宠物医院·中心店", address: "示例市示例区示例路 1 号", tel: "010-00000000", distanceMeters: 800 },
  { name: "（示例）24 小时动物急诊", address: "示例市示例区示例大道 88 号", tel: "010-11111111", distanceMeters: 2300 },
  { name: "（示例）异宠特色宠物诊所", address: "示例市示例区示例街 5 号", tel: "010-22222222", distanceMeters: 3600 },
];

export async function GET(req: Request) {
  try {
    const uid = await requireUserId();
    const { searchParams } = new URL(req.url);
    const lng = searchParams.get("lng");
    const lat = searchParams.get("lat");
    const city = searchParams.get("city") || "";
    const keyword = searchParams.get("keyword") || "宠物医院";
    const triggerSource = searchParams.get("source") || "high_risk";

    await track("资源地图_检索", uid, { triggerSource, hasLocation: !!(lng && lat) });

    const key = process.env.AMAP_WEB_SERVICE_KEY;
    if (!key) {
      return ok({ vets: MOCK_VETS, mock: true, note: "未配置高德 Key，展示示例数据" });
    }

    // 高德地点搜索 v5（周边 around 或 关键字 text）
    let url: string;
    if (lng && lat) {
      url =
        `https://restapi.amap.com/v5/place/around?key=${key}` +
        `&location=${encodeURIComponent(`${lng},${lat}`)}` +
        `&keywords=${encodeURIComponent(keyword)}&radius=10000&sortrule=distance&page_size=20`;
    } else {
      url =
        `https://restapi.amap.com/v5/place/text?key=${key}` +
        `&keywords=${encodeURIComponent(keyword)}` +
        (city ? `&region=${encodeURIComponent(city)}&city_limit=true` : "") +
        `&page_size=20`;
    }

    const resp = await fetch(url, { cache: "no-store" });
    const json = await resp.json();

    if (json.status !== "1" || !Array.isArray(json.pois) || json.pois.length === 0) {
      return ok({
        vets: [],
        mock: false,
        note: "未找到附近点位，可手动输入城市或关键词检索",
      });
    }

    const vets: Vet[] = json.pois.map((p: Record<string, unknown>) => {
      const [plng, plat] = String(p.location ?? "").split(",").map(Number);
      return {
        name: String(p.name ?? ""),
        address: String(p.address ?? p.pname ?? ""),
        tel: (p.tel as string) || undefined,
        distanceMeters: p.distance ? Number(p.distance) : undefined,
        location: plng && plat ? { lng: plng, lat: plat } : undefined,
      };
    });

    return ok({ vets, mock: false });
  } catch (e) {
    return handleError(e);
  }
}
