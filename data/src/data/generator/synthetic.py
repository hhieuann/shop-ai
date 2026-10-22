"""
Sinh dữ liệu giả lập cho shop-ai (sản phẩm, người dùng, đơn hàng, giỏ hàng, sự kiện). Bản v3.

Chỉ dùng thư viện chuẩn của Python (không cần pip install gì).

Chạy với danh mục sản phẩm tự chế (mặc định, dùng khi chưa có file thật), từ thư mục data/:
    uv run data --out generated --seed 42

Chạy với danh mục sản phẩm THẬT của shop (ví dụ ../services/api/seed/catalog/products.json):
    uv run data --out generated --seed 42 --products ../services/api/seed/catalog/products.json

QUAN TRỌNG — vì sao có --products:
  Danh mục sản phẩm (tên category) do admin quyết định và có thể đổi theo thời gian
  (admin có thể thêm category mới sau này). Vì vậy script KHÔNG gõ cứng một danh sách
  category cố định khi dùng --products: nó đọc category trực tiếp từ file. Việc "học"
  category mới hoàn toàn thuộc về bước baseline/Personalize (tính luật từ dữ liệu thật),
  không thuộc về script sinh dữ liệu này — script này chỉ tạo dữ liệu giả lập để thử.

  Để persona và luật mua kèm (vốn viết bằng các tên category "chuẩn" như gpu, ssd,
  cooler...) vẫn hoạt động được trên danh mục thật dù Hoàng đặt tên khác, có một bảng
  CATEGORY_ALIASES bên dưới ánh xạ tên chuẩn -> tên thật. Category nào không khớp được
  tên chuẩn lẫn alias thì bị bỏ qua khỏi persona/luật mua kèm (có in cảnh báo), nhưng
  vẫn được dùng làm nguồn cho giỏ hàng "nhiễu" (noise) và cho baseline học sau này.

Quy luật được cài vào dữ liệu khi KHÔNG dùng --products (dữ liệu tự chế, xem bên dưới
để biết chi tiết — không đổi so với bản v2). Khi DÙNG --products, các quy luật tương tự
vẫn được áp dụng nhưng chỉ cho các category thật sự có ánh xạ tới danh mục đã nạp.

Đầu ra (thư mục --out): products.csv, users.csv, orders.csv, order_items.csv,
cart_items.csv, interactions_train.csv, interactions_test.csv — không đổi so với v2.

Quy tắc khi dùng đầu ra:
  - Luật mua kèm và baseline chỉ được đếm đơn có STATUS = confirmed.
  - Không đưa users.csv (có PERSONA), cột IS_NOISE, FROM_CART vào dữ liệu train của AI.
  - USER_ID ở đây là mã giả. Khi đưa vào pipeline thật, ẩn danh bằng HMAC ở bước riêng.
"""
from __future__ import annotations

import argparse
import csv
import json
import random
import sys
from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path

# --------------------------------------------------------------------------
# Cấu hình quy luật
# --------------------------------------------------------------------------
NOISE_RATE = 0.30
CANCEL_RATE = 0.04
STRAY_ADD_RATE = 0.15
PARK_RATE = 0.20
PARK_BOUGHT_LATER = 0.50
PARK_TIER_W = {"low": 0.1, "mid": 0.3, "high": 0.6}

# (món kích hoạt, món kèm, xác suất kèm) — viết bằng TÊN CHUẨN, xem CATEGORY_ALIASES
COMPANION_RULES = [
    ("gpu", "psu", 0.40),
    ("laptop", "mouse", 0.50),
    ("laptop", "laptop_bag", 0.40),
    ("cpu", "mainboard", 0.60),
    ("cpu", "cooler", 0.35),
    ("mainboard", "ram", 0.50),
]

# Tên chuẩn -> tên thật có thể gặp trong danh mục của Hoàng (danh sách thường gặp).
# Chỉnh lại danh sách này nếu Hoàng dùng tên khác — đây là CHỖ DUY NHẤT cần sửa.
CATEGORY_ALIASES = {
    "ssd": ["ssd", "storage"],
    "cooler": ["cooler", "cooling"],
    "laptop_bag": ["laptop_bag", "accessory"],
    "webcam": ["webcam", "accessory"],
    "microphone": ["microphone", "accessory"],
    "case": ["case"],
}

TIERS = ["low", "mid", "high"]

# Danh mục TỰ CHẾ, chỉ dùng khi KHÔNG có --products (giữ nguyên từ bản v2)
@dataclass(frozen=True)
class CategorySpec:
    n: int
    label: str
    brands: list[str]
    price: tuple[int, int]


BUILTIN_CATEGORIES: dict[str, CategorySpec] = {
    "cpu": CategorySpec(n=8, label="CPU", brands=["Intel", "AMD"], price=(2_500_000, 14_000_000)),
    "gpu": CategorySpec(n=10, label="GPU", brands=["Asus", "MSI", "Gigabyte", "Zotac"], price=(5_000_000, 38_000_000)),
    "mainboard": CategorySpec(n=8, label="Mainboard", brands=["Asus", "MSI", "Gigabyte", "ASRock"], price=(2_000_000, 9_000_000)),
    "ram": CategorySpec(n=6, label="RAM", brands=["Kingston", "Corsair", "G.Skill"], price=(700_000, 4_500_000)),
    "ssd": CategorySpec(n=7, label="SSD", brands=["Samsung", "WD", "Kingston", "Crucial"], price=(800_000, 5_000_000)),
    "psu": CategorySpec(n=7, label="PSU", brands=["Corsair", "Cooler Master", "Seasonic", "Deepcool"], price=(900_000, 4_500_000)),
    "case": CategorySpec(n=6, label="Case", brands=["NZXT", "Cooler Master", "Deepcool", "Xigmatek"], price=(800_000, 4_000_000)),
    "cooler": CategorySpec(n=5, label="Cooler", brands=["Deepcool", "Noctua", "Cooler Master"], price=(400_000, 2_800_000)),
    "monitor": CategorySpec(n=8, label="Monitor", brands=["LG", "Dell", "Samsung", "AOC"], price=(3_000_000, 18_000_000)),
    "laptop": CategorySpec(n=10, label="Laptop", brands=["Asus", "Acer", "Lenovo", "Dell", "HP"], price=(12_000_000, 50_000_000)),
    "mouse": CategorySpec(n=8, label="Mouse", brands=["Logitech", "Razer", "Corsair", "Fuhlen"], price=(200_000, 3_000_000)),
    "keyboard": CategorySpec(n=6, label="Keyboard", brands=["Logitech", "Keychron", "Akko"], price=(400_000, 3_500_000)),
    "laptop_bag": CategorySpec(n=4, label="Laptop Bag", brands=["Targus", "Tomtoc", "Mikkor"], price=(250_000, 1_200_000)),
    "headset": CategorySpec(n=5, label="Headset", brands=["HyperX", "Logitech", "Razer"], price=(500_000, 4_000_000)),
    "webcam": CategorySpec(n=3, label="Webcam", brands=["Logitech", "Razer"], price=(700_000, 3_500_000)),
    "microphone": CategorySpec(n=3, label="Microphone", brands=["HyperX", "Razer", "Fifine"], price=(800_000, 4_000_000)),
}


@dataclass(frozen=True)
class Persona:
    name: str
    share: float
    primary: dict  # TÊN CHUẨN -> trọng số
    extra_rate: float
    tier_w: dict


PERSONAS = [
    Persona(
        "gamer", 0.30,
        {"gpu": .30, "monitor": .15, "cpu": .10, "ssd": .08, "ram": .07,
         "mouse": .10, "keyboard": .10, "headset": .10},
        0.45, {"low": .2, "mid": .4, "high": .4},
    ),
    Persona(
        "student_office", 0.30,
        {"laptop": .45, "mouse": .15, "laptop_bag": .10, "keyboard": .08,
         "ssd": .10, "ram": .06, "monitor": .06},
        0.35, {"low": .5, "mid": .4, "high": .1},
    ),
    Persona(
        "pc_builder", 0.20,
        {"cpu": .25, "mainboard": .15, "gpu": .15, "ram": .12,
         "ssd": .12, "case": .08, "psu": .05, "cooler": .08},
        0.55, {"low": .2, "mid": .4, "high": .4},
    ),
    Persona(
        "creator", 0.20,
        {"monitor": .25, "webcam": .15, "microphone": .15, "headset": .10,
         "laptop": .15, "ssd": .10, "keyboard": .05, "mouse": .05},
        0.40, {"low": .2, "mid": .5, "high": .3},
    ),
]


@dataclass
class Item:
    item_id: str
    category: str  # tên THẬT (không phải tên chuẩn)
    tier: str
    name: str
    price: int
    pop: float


@dataclass
class Order:
    order_id: str
    user_id: str
    ts: datetime
    items: list
    is_noise: bool
    persona: str = field(default="")
    status: str = "confirmed"
    from_cart: bool = False


# --------------------------------------------------------------------------
# Nạp danh mục: tự chế hoặc từ file thật
# --------------------------------------------------------------------------
def make_builtin_catalog(rng: random.Random) -> dict[str, list[Item]]:
    catalog: dict[str, list[Item]] = {}
    for cat, spec in BUILTIN_CATEGORIES.items():
        n, (lo, hi) = spec.n, spec.price
        items = []
        for i in range(n):
            tier_idx = min(2, i * 3 // n)
            tier = TIERS[tier_idx]
            frac = (tier_idx + rng.random()) / 3
            price = int(round((lo + (hi - lo) * frac) / 10_000) * 10_000)
            brand = rng.choice(spec.brands)
            code = f"{tier[0].upper()}{100 + i * 10}"
            items.append(Item(
                item_id=f"{cat}-{i + 1:03d}", category=cat, tier=tier,
                name=f"{brand} {spec.label} {code}", price=price,
                pop=rng.lognormvariate(0, 0.8),
            ))
        catalog[cat] = items
    return catalog


def load_real_catalog(rng: random.Random, path: Path) -> dict[str, list[Item]]:
    """Đọc products.json thật, trả về catalog theo TÊN CATEGORY THẬT. In báo cáo kiểm tra hợp đồng."""
    raw = json.loads(path.read_text(encoding="utf-8-sig"))
    products = raw.get("products", raw if isinstance(raw, list) else [])
    if not products:
        sys.exit(f"Lỗi: không tìm thấy sản phẩm nào trong {path} (mong đợi khoá 'products' hoặc một mảng)")

    kept: list[dict] = []
    n_dropped = 0
    drop_reasons: Counter = Counter()
    for row in products:
        pid = row.get("productId") or row.get("item_id") or row.get("ITEM_ID")
        cat = row.get("category") or row.get("CATEGORY")
        name = row.get("name") or row.get("NAME")
        price = row.get("price", row.get("PRICE_VND"))
        if not pid:
            n_dropped += 1; drop_reasons["thiếu productId"] += 1; continue
        if not cat or not str(cat).strip():
            n_dropped += 1; drop_reasons["thiếu category"] += 1; continue
        if not name:
            n_dropped += 1; drop_reasons["thiếu name"] += 1; continue
        try:
            price = int(price)
        except (TypeError, ValueError):
            n_dropped += 1; drop_reasons["price không phải số"] += 1; continue
        if price <= 0:
            n_dropped += 1; drop_reasons["price <= 0"] += 1; continue
        status = str(row.get("status", "ACTIVE")).upper()
        if status not in ("ACTIVE",) and "is_active" not in row and "IS_ACTIVE" not in row:
            # không rõ trạng thái -> coi như còn bán, chỉ cảnh báo nếu status rõ ràng là inactive
            pass
        is_active = row.get("is_active", row.get("IS_ACTIVE"))
        if is_active is None:
            is_active = status == "ACTIVE"
        if not is_active:
            n_dropped += 1; drop_reasons["is_active = false"] += 1; continue
        kept.append({"item_id": str(pid), "category": str(cat).strip(), "name": name,
                     "price": price, "brand": row.get("brand", "")})

    if n_dropped:
        print(f"[kiểm tra hợp đồng] Bỏ qua {n_dropped} dòng không hợp lệ:", dict(drop_reasons), file=sys.stderr)

    # gán tier theo phân vị giá TRONG TỪNG category thật
    by_cat: dict[str, list[dict]] = {}
    for row in kept:
        by_cat.setdefault(row["category"], []).append(row)

    catalog: dict[str, list[Item]] = {}
    thin_categories = []
    for cat, rows in by_cat.items():
        rows.sort(key=lambda r: r["price"])
        n = len(rows)
        distinct_prices = len({r["price"] for r in rows})
        if distinct_prices < 3:
            thin_categories.append((cat, distinct_prices))
        items = []
        for i, r in enumerate(rows):
            tier = TIERS[min(2, i * 3 // max(1, n))]
            items.append(Item(
                item_id=r["item_id"], category=cat, tier=tier, name=r["name"],
                price=r["price"], pop=rng.lognormvariate(0, 0.8),
            ))
        catalog[cat] = items

    if thin_categories:
        print(f"[kiểm tra hợp đồng] Cảnh báo: category có dưới 3 mức giá khác nhau "
              f"(lọc theo ngân sách sẽ kém chính xác): {thin_categories}", file=sys.stderr)

    print(f"[kiểm tra hợp đồng] Nạp {len(kept)} sản phẩm, {len(catalog)} category thật: "
          f"{sorted(catalog.keys())}", file=sys.stderr)
    return catalog


def resolve_category(canonical: str, catalog_keys: set) -> str | None:
    """Trả về tên category THẬT khớp với tên chuẩn, hoặc None nếu không có trong danh mục đã nạp."""
    if canonical in catalog_keys:
        return canonical
    for alias in CATEGORY_ALIASES.get(canonical, []):
        if alias in catalog_keys:
            return alias
    return None


def remap_personas_and_rules(catalog: dict[str, list[Item]]):
    """Ánh xạ persona.primary và COMPANION_RULES từ tên chuẩn sang tên category thật
    đang có trong catalog. Trả về (personas đã remap, rules đã remap)."""
    keys = set(catalog.keys())
    unresolved_persona = set()
    new_personas = []
    for p in PERSONAS:
        remapped: dict[str, float] = {}
        for canon, w in p.primary.items():
            real = resolve_category(canon, keys)
            if real is None:
                unresolved_persona.add(canon)
                continue
            remapped[real] = remapped.get(real, 0) + w  # gộp nếu 2 tên chuẩn trỏ cùng 1 category thật
        if not remapped:
            sys.exit(f"Lỗi: persona '{p.name}' không còn category nào khớp với danh mục đã nạp — "
                      f"không sinh được dữ liệu cho persona này. Kiểm tra lại CATEGORY_ALIASES.")
        total = sum(remapped.values())
        remapped = {k: v / total for k, v in remapped.items()}  # chuẩn hoá lại tổng = 1
        new_personas.append(Persona(p.name, p.share, remapped, p.extra_rate, p.tier_w))

    new_rules = []
    unresolved_rules = []
    for a, b, prob in COMPANION_RULES:
        ra, rb = resolve_category(a, keys), resolve_category(b, keys)
        if ra and rb and ra != rb:
            new_rules.append((ra, rb, prob))
        else:
            unresolved_rules.append((a, b))

    if unresolved_persona:
        print(f"[kiểm tra hợp đồng] Category chuẩn không khớp danh mục, đã bỏ khỏi persona "
              f"(trọng số dồn sang category khác của cùng persona): {sorted(unresolved_persona)}",
              file=sys.stderr)
    if unresolved_rules:
        print(f"[kiểm tra hợp đồng] Luật mua kèm bị bỏ qua vì thiếu category: {unresolved_rules}",
              file=sys.stderr)
    if not new_rules:
        print("[kiểm tra hợp đồng] CẢNH BÁO: không còn luật mua kèm nào hoạt động được "
              "trên danh mục này.", file=sys.stderr)
    return new_personas, new_rules


def pick_item(rng, catalog, cat, tier_w=None, tier=None) -> Item:
    cands = catalog[cat]
    if tier is not None:
        same = [it for it in cands if it.tier == tier]
        cands = same or cands
    weights = [it.pop * (tier_w[it.tier] if tier_w else 1.0) for it in cands]
    return rng.choices(cands, weights)[0]


# --------------------------------------------------------------------------
# Sinh giỏ hàng (đơn)
# --------------------------------------------------------------------------
def apply_companions(rng, catalog, chosen: dict, companion_rules) -> None:
    queue = list(chosen.values())
    while queue:
        trigger = queue.pop(0)
        for a, b, p in companion_rules:
            if trigger.category == a and b not in chosen and rng.random() < p:
                same_tier = trigger.tier if rng.random() < 0.7 else None
                it = pick_item(rng, catalog, b, tier=same_tier)
                chosen[b] = it
                queue.append(it)


def build_basket(rng, catalog, persona: Persona, companion_rules):
    chosen: dict[str, Item] = {}
    is_noise = rng.random() < NOISE_RATE
    if is_noise:
        for cat in rng.sample(list(catalog), k=min(len(catalog), rng.choice([1, 1, 2]))):
            chosen[cat] = pick_item(rng, catalog, cat)
    else:
        cats, weights = zip(*persona.primary.items())
        primary = rng.choices(cats, weights)[0]
        chosen[primary] = pick_item(rng, catalog, primary, persona.tier_w)
        if rng.random() < persona.extra_rate:
            rest = [(c, w) for c, w in persona.primary.items() if c not in chosen]
            if rest:
                c2 = rng.choices([c for c, _ in rest], [w for _, w in rest])[0]
                chosen[c2] = pick_item(rng, catalog, c2, persona.tier_w)
    apply_companions(rng, catalog, chosen, companion_rules)
    return list(chosen.values()), is_noise


def make_users(rng, n_users: int, personas):
    shares = [p.share for p in personas]
    return [(f"u{i + 1:04d}", rng.choices(personas, shares)[0]) for i in range(n_users)]


def make_orders(rng, catalog, users, start, end, companion_rules):
    span = (end - start).total_seconds()
    orders = []
    for user_id, persona in users:
        n_orders = 1 + min(7, int(rng.expovariate(1 / 1.2)))
        times = sorted(start + timedelta(seconds=rng.random() * span) for _ in range(n_orders))
        for ts in times:
            items, is_noise = build_basket(rng, catalog, persona, companion_rules)
            status = "cancelled" if rng.random() < CANCEL_RATE else "confirmed"
            orders.append(Order("", user_id, ts, items, is_noise, persona.name, status))
    return orders


def pick_untouched(rng, catalog, persona, touched, tier_w):
    cats = list(persona.primary)
    weights = list(persona.primary.values())
    for _ in range(6):
        cat = rng.choices(cats, weights)[0]
        it = pick_item(rng, catalog, cat, tier_w)
        if it.item_id not in touched:
            return it
    return None


def make_cart_behaviour(rng, catalog, orders, personas, end):
    extra_orders = []
    events = []
    cart = {}
    counts = Counter()
    touched = {}
    for o in orders:
        touched.setdefault(o.user_id, set()).update(it.item_id for it in o.items)

    for o in orders:
        persona = personas[o.persona]
        seen = touched[o.user_id]

        if rng.random() < STRAY_ADD_RATE:
            it = pick_untouched(rng, catalog, persona, seen, persona.tier_w)
            if it:
                seen.add(it.item_id)
                add_ts = o.ts - timedelta(seconds=rng.randint(600, 3000))
                events.append((add_ts - timedelta(seconds=rng.randint(30, 300)), o.user_id, it.item_id, "view"))
                events.append((add_ts, o.user_id, it.item_id, "add_to_cart"))
                events.append((add_ts + timedelta(seconds=rng.randint(60, 600)),
                               o.user_id, it.item_id, "remove_from_cart"))
                counts["stray_add_removed"] += 1

        if rng.random() < PARK_RATE:
            it = pick_untouched(rng, catalog, persona, seen, PARK_TIER_W)
            if it:
                seen.add(it.item_id)
                add_ts = o.ts - timedelta(seconds=rng.randint(30, 600))
                events.append((add_ts - timedelta(seconds=rng.randint(600, 5400)), o.user_id, it.item_id, "view"))
                events.append((add_ts, o.user_id, it.item_id, "add_to_cart"))
                counts["parked"] += 1
                cart[(o.user_id, it.item_id)] = (it, add_ts)
                if rng.random() < PARK_BOUGHT_LATER:
                    buy_ts = add_ts + timedelta(days=rng.uniform(2, 30))
                    if buy_ts < end:
                        extra_orders.append(Order("", o.user_id, buy_ts, [it], False, o.persona,
                                                  "confirmed", True))
                        del cart[(o.user_id, it.item_id)]
                        counts["parked_bought_later"] += 1
    return extra_orders, events, cart, counts


def make_order_events(rng, catalog, orders, personas):
    events = []
    for o in orders:
        persona = personas[o.persona]
        if o.from_cart:
            for it in o.items:
                events.append((o.ts, o.user_id, it.item_id, "purchase"))
            continue
        for it in o.items:
            events.append((o.ts - timedelta(seconds=rng.randint(600, 5400)), o.user_id, it.item_id, "view"))
            events.append((o.ts - timedelta(seconds=rng.randint(30, 300)), o.user_id, it.item_id, "add_to_cart"))
            if o.status == "confirmed":
                events.append((o.ts, o.user_id, it.item_id, "purchase"))
            else:
                events.append((o.ts + timedelta(seconds=rng.randint(120, 1200)),
                               o.user_id, it.item_id, "remove_from_cart"))
        for _ in range(rng.randint(0, 4)):
            cat = rng.choices(list(persona.primary), list(persona.primary.values()))[0]
            it = pick_item(rng, catalog, cat, persona.tier_w)
            events.append((o.ts - timedelta(seconds=rng.randint(600, 5400)), o.user_id, it.item_id, "view"))
    return events


def write_csv(path: Path, header, rows) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def main(argv: list[str] | None = None) -> dict:
    """Điểm vào chính. Trả về dict thống kê (tiện cho test), đồng thời in ra và ghi file."""
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="generated")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--users", type=int, default=600)
    ap.add_argument("--start", default="2025-10-01")
    ap.add_argument("--end", default="2026-09-30")
    ap.add_argument("--train-frac", type=float, default=0.8)
    ap.add_argument("--products", default=None,
                     help="Đường dẫn products.json thật (vd services/api/seed/catalog/products.json). "
                          "Bỏ trống thì dùng danh mục tự chế có sẵn.")
    args = ap.parse_args(argv)

    rng = random.Random(args.seed)
    utc = UTC
    start = datetime.fromisoformat(args.start).replace(tzinfo=utc)
    end = datetime.fromisoformat(args.end).replace(tzinfo=utc) + timedelta(days=1)
    cutoff = start + (end - start) * args.train_frac

    if args.products:
        catalog = load_real_catalog(rng, Path(args.products))
        personas, companion_rules = remap_personas_and_rules(catalog)
    else:
        catalog = make_builtin_catalog(rng)
        personas, companion_rules = PERSONAS, COMPANION_RULES

    personas_by_name = {p.name: p for p in personas}
    users = make_users(rng, args.users, personas)

    base_orders = make_orders(rng, catalog, users, start, end, companion_rules)
    extra_orders, cart_events, cart_final, cart_counts = make_cart_behaviour(
        rng, catalog, base_orders, personas_by_name, end)

    orders = sorted(base_orders + extra_orders, key=lambda o: o.ts)
    for i, o in enumerate(orders, 1):
        o.order_id = f"o{i:06d}"

    events = make_order_events(rng, catalog, orders, personas_by_name) + cart_events
    events.sort(key=lambda e: e[0])

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    all_items = [it for items in catalog.values() for it in items]
    write_csv(out / "products.csv", ["ITEM_ID", "CATEGORY", "TIER", "NAME", "PRICE_VND"],
              [(i.item_id, i.category, i.tier, i.name, i.price) for i in all_items])
    write_csv(out / "users.csv", ["USER_ID", "PERSONA"], [(u, p.name) for u, p in users])
    write_csv(out / "orders.csv",
              ["ORDER_ID", "USER_ID", "TS_ISO", "STATUS", "SPLIT", "N_ITEMS", "IS_NOISE", "FROM_CART"],
              [(o.order_id, o.user_id, o.ts.isoformat(), o.status, "train" if o.ts < cutoff else "test",
                len(o.items), int(o.is_noise), int(o.from_cart)) for o in orders])
    write_csv(out / "order_items.csv", ["ORDER_ID", "ITEM_ID", "UNIT_PRICE_VND"],
              [(o.order_id, it.item_id, it.price) for o in orders for it in o.items])
    write_csv(out / "cart_items.csv", ["USER_ID", "ITEM_ID", "ADDED_AT_ISO"],
              [(u, it.item_id, ts.isoformat()) for (u, _), (it, ts) in sorted(cart_final.items())])

    hdr = ["USER_ID", "ITEM_ID", "TIMESTAMP", "EVENT_TYPE"]
    train = [(u, i, int(t.timestamp()), e) for t, u, i, e in events if t < cutoff]
    test = [(u, i, int(t.timestamp()), e) for t, u, i, e in events if t >= cutoff]
    write_csv(out / "interactions_train.csv", hdr, train)
    write_csv(out / "interactions_test.csv", hdr, test)

    confirmed = [o for o in orders if o.status == "confirmed"]

    def rate(a, b):
        with_a = [o for o in confirmed if any(i.category == a for i in o.items)]
        if not with_a:
            return [0.0, 0]
        hit = sum(any(i.category == b for i in o.items) for o in with_a)
        return [round(hit / len(with_a), 3), len(with_a)]

    stats = {
        "mode": "real --products" if args.products else "builtin catalog",
        "seed": args.seed,
        "cutoff": cutoff.isoformat(),
        "users": len(users),
        "products": len(all_items),
        "categories": sorted(catalog.keys()),
        "companion_rules_active": companion_rules,
        "orders": {"total": len(orders), "confirmed": len(confirmed),
                   "cancelled": len(orders) - len(confirmed),
                   "mua_tu_gio_de_danh": sum(o.from_cart for o in orders)},
        "interactions": {"train": len(train), "test": len(test)},
        "gio_hang": dict(cart_counts) | {"con_trong_gio_cuoi_ky": len(cart_final)},
        "vi_du_ti_le_mua_kem": {f"{a}->{b}": rate(a, b) for a, b, _ in companion_rules[:5]},
    }
    print(json.dumps(stats, ensure_ascii=False, indent=2))
    print(f"\nĐã ghi file vào: {out.resolve()}")
    return stats


if __name__ == "__main__":
    main()