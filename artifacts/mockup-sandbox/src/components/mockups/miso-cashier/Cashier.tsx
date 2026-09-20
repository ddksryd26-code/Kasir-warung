import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleAlert,
  Clock3,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  ShoppingCart,
  Store,
  Trash2,
  Utensils,
  WalletCards,
  X,
} from "lucide-react";

type Category = "Semua" | "Donburi" | "Ramen" | "Sampingan" | "Minuman";
type OrderType = "Dine-in" | "Takeaway";

type MenuItem = {
  id: number;
  name: string;
  description: string;
  price: number;
  category: Exclude<Category, "Semua">;
  accent: string;
  detail: string;
};

type CartLine = MenuItem & { quantity: number };

const menuItems: MenuItem[] = [
  {
    id: 1,
    name: "Miso Ramen",
    description: "Kaldu miso, chashu ayam, jagung & telur",
    price: 48000,
    category: "Ramen",
    accent: "from-[#f2c59e] to-[#dc8a62]",
    detail: "Favorit pelanggan",
  },
  {
    id: 2,
    name: "Tori Paitan Ramen",
    description: "Kaldu ayam creamy, ayam panggang & nori",
    price: 52000,
    category: "Ramen",
    accent: "from-[#d9c6a9] to-[#a88967]",
    detail: "Kaldu 12 jam",
  },
  {
    id: 3,
    name: "Chicken Katsu Don",
    description: "Katsu renyah, telur lembut & nasi pulen",
    price: 44000,
    category: "Donburi",
    accent: "from-[#e9c17c] to-[#bd7044]",
    detail: "Pilihan hemat",
  },
  {
    id: 4,
    name: "Salmon Teriyaki Don",
    description: "Salmon panggang, saus teriyaki & acar",
    price: 62000,
    category: "Donburi",
    accent: "from-[#e8a29a] to-[#c65e55]",
    detail: "Limited today",
  },
  {
    id: 5,
    name: "Gyoza Panggang",
    description: "6 pcs, kulit tipis dengan saus ponzu",
    price: 28000,
    category: "Sampingan",
    accent: "from-[#d8b783] to-[#aa7547]",
    detail: "6 pcs",
  },
  {
    id: 6,
    name: "Edamame Garam Laut",
    description: "Edamame hangat dengan garam laut",
    price: 18000,
    category: "Sampingan",
    accent: "from-[#bad3a4] to-[#709372]",
    detail: "Ringan",
  },
  {
    id: 7,
    name: "Matcha Latte",
    description: "Matcha Uji, susu segar & sedikit manis",
    price: 26000,
    category: "Minuman",
    accent: "from-[#b9c6a0] to-[#6f8661]",
    detail: "Dingin / hangat",
  },
  {
    id: 8,
    name: "Hojicha Latte",
    description: "Teh hojicha panggang dengan susu segar",
    price: 24000,
    category: "Minuman",
    accent: "from-[#cfaf8e] to-[#87644c]",
    detail: "Best seller",
  },
];

const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace("Rp", "Rp ");

function MenuIllustration({ item }: { item: MenuItem }) {
  return (
    <div
      className={`relative h-[116px] overflow-hidden rounded-[18px] bg-gradient-to-br ${item.accent}`}
    >
      <div className="absolute -right-5 -top-8 h-28 w-28 rounded-full border-[10px] border-white/20" />
      <div className="absolute -bottom-9 left-3 h-24 w-24 rounded-full border-[8px] border-[#5f3f2f]/15" />
      <div className="absolute bottom-0 left-1/2 h-20 w-20 -translate-x-1/2 rounded-t-full border-[7px] border-[#f7e2c5]/70 bg-[#f8e8cf]/30" />
      <div className="absolute bottom-4 left-1/2 h-9 w-9 -translate-x-1/2 rounded-full bg-[#674637]/45 shadow-[0_4px_0_#ffffff33]" />
      <div className="absolute left-4 top-3 rounded-full bg-white/25 px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-[#fff9ef]">
        {item.detail}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  tone = "neutral",
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition active:scale-95 ${
        tone === "danger"
          ? "text-[#b56a62] hover:bg-[#f8e6e1]"
          : "text-[#8b7568] hover:bg-[#f7eee5]"
      }`}
    >
      {children}
    </button>
  );
}

export function Cashier() {
  const [activeCategory, setActiveCategory] = useState<Category>("Semua");
  const [query, setQuery] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("Dine-in");
  const [cart, setCart] = useState<CartLine[]>([
    { ...menuItems[0], quantity: 1 },
    { ...menuItems[4], quantity: 1 },
    { ...menuItems[6], quantity: 1 },
  ]);
  const [isPaid, setIsPaid] = useState(false);
  const [showNote, setShowNote] = useState(false);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();
    return menuItems.filter((item) => {
      const matchesCategory =
        activeCategory === "Semua" || item.category === activeCategory;
      const matchesQuery =
        !normalizedQuery ||
        `${item.name} ${item.description}`.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, query]);

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const serviceCharge = Math.round(subtotal * 0.05);
  const total = subtotal + serviceCharge;

  const addToCart = (item: MenuItem) => {
    setIsPaid(false);
    setCart((current) => {
      const existing = current.find((line) => line.id === item.id);
      if (existing) {
        return current.map((line) =>
          line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { ...item, quantity: 1 }];
    });
  };

  const changeQuantity = (id: number, delta: number) => {
    setIsPaid(false);
    setCart((current) =>
      current
        .map((line) =>
          line.id === id
            ? { ...line, quantity: Math.max(0, line.quantity + delta) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  };

  const removeLine = (id: number) => {
    setIsPaid(false);
    setCart((current) => current.filter((line) => line.id !== id));
  };

  const clearOrder = () => {
    setIsPaid(false);
    setCart([]);
  };

  return (
    <main className="min-h-[100dvh] bg-[#f4eee7] p-3 font-['DM_Sans'] text-[#43362f] sm:p-5">
      <div className="mx-auto flex min-h-[calc(100dvh-40px)] max-w-[1500px] flex-col overflow-hidden rounded-[26px] border border-[#dfd3c7] bg-[#fbf8f3] shadow-[0_20px_70px_rgba(81,56,39,0.12)] lg:h-[calc(100dvh-40px)] lg:min-h-0">
        <header className="flex min-h-[76px] items-center justify-between border-b border-[#eadfd5] bg-[#fffdf9] px-5 sm:px-7">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5d4035] text-[#f9e5c8] shadow-[inset_0_-3px_0_rgba(29,18,13,0.15)]">
              <span className="font-['Playfair_Display'] text-2xl font-semibold">味</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-['Playfair_Display'] text-[25px] font-semibold tracking-[-0.03em] text-[#49352c]">
                  Miso
                </h1>
                <span className="rounded-full bg-[#edf2e9] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#72856a]">
                  Counter 01
                </span>
              </div>
              <p className="text-[11px] text-[#9a887b]">
                Kedai comfort food Jepang · Jakarta Selatan
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            <div className="flex items-center gap-2 text-xs text-[#927f72]">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f6eee4] text-[#96735b]">
                <Clock3 size={14} />
              </span>
              <span>
                <span className="block font-semibold text-[#5f4d43]">Selasa, 18 Juni 2024</span>
                <span className="block text-[11px]">Jam sibuk · 12:42 WIB</span>
              </span>
            </div>
            <div className="flex items-center gap-2 border-l border-[#e8ddd3] pl-8">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dbc6b1] text-xs font-bold text-[#684d3c]">
                AR
              </div>
              <div className="text-xs">
                <span className="block font-semibold text-[#5f4d43]">Ari Rahman</span>
                <span className="block text-[11px] text-[#9a887b]">Kasir aktif</span>
              </div>
              <ChevronDown size={14} className="ml-2 text-[#a68e7e]" />
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_390px]">
          <section className="min-w-0 overflow-y-auto bg-[#f9f5ef] p-5 sm:p-7">
            <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a58771]">
                  <Store size={13} />
                  <span>Pesanan baru</span>
                  <span className="h-1 w-1 rounded-full bg-[#c9a68a]" />
                  <span>Meja bebas</span>
                </div>
                <h2 className="font-['Playfair_Display'] text-[31px] font-semibold tracking-[-0.04em] text-[#4b372d]">
                  Pilih menu untuk mulai
                </h2>
                <p className="mt-1 text-sm text-[#9a887b]">
                  Sentuh menu untuk menambahkannya ke pesanan.
                </p>
              </div>
              <label className="flex h-11 w-full max-w-[280px] items-center gap-3 rounded-xl border border-[#e2d6ca] bg-[#fffdf9] px-3.5 shadow-[0_2px_6px_rgba(91,65,47,0.03)] focus-within:border-[#b9906e] focus-within:ring-4 focus-within:ring-[#c49a7820]">
                <Search size={17} className="text-[#b59b89]" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari menu..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-[#5f4d43] outline-none placeholder:text-[#b5a296]"
                />
                <span className="rounded-md bg-[#f5eee6] px-1.5 py-1 text-[10px] font-semibold text-[#b09b8a]">⌘ K</span>
              </label>
            </div>

            <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1">
              {(["Semua", "Ramen", "Donburi", "Sampingan", "Minuman"] as Category[]).map(
                (category) => (
                  <button
                    type="button"
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition ${
                      activeCategory === category
                        ? "bg-[#624238] text-[#fff7ec] shadow-[0_4px_10px_rgba(83,53,39,0.16)]"
                        : "border border-[#e5d9cd] bg-[#fffdf9] text-[#927e70] hover:border-[#c7a890] hover:text-[#67483a]"
                    }`}
                  >
                    {category}
                  </button>
                ),
              )}
              <span className="ml-auto hidden items-center gap-1 text-[11px] text-[#ad998b] sm:flex">
                <ShoppingBag size={13} />
                {menuItems.length} menu tersedia
              </span>
            </div>

            {filteredItems.length ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredItems.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="group rounded-[19px] border border-[#e8ddd2] bg-[#fffdf9] p-2.5 text-left shadow-[0_3px_10px_rgba(95,65,44,0.025)] transition hover:-translate-y-0.5 hover:border-[#caa78d] hover:shadow-[0_10px_24px_rgba(95,65,44,0.10)] active:translate-y-0"
                  >
                    <MenuIllustration item={item} />
                    <div className="px-1.5 pb-1 pt-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-[14px] font-bold text-[#544037]">{item.name}</h3>
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f7ede2] text-[#a27354] opacity-0 transition group-hover:opacity-100">
                          <Plus size={14} />
                        </span>
                      </div>
                      <p className="mt-1 min-h-[32px] text-[11px] leading-[1.4] text-[#a08c7e]">
                        {item.description}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[13px] font-bold text-[#81533d]">{formatRupiah(item.price)}</span>
                        <span className="text-[10px] font-medium text-[#b29c8d]">{item.category}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[330px] flex-col items-center justify-center rounded-[22px] border border-dashed border-[#ddcfc2] bg-[#fffdf9] text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f3e7da] text-[#a98269]">
                  <Search size={21} />
                </div>
                <p className="font-semibold text-[#644b3d]">Menu tidak ditemukan</p>
                <p className="mt-1 max-w-[230px] text-xs leading-relaxed text-[#a18e80]">
                  Coba kata kunci lain atau pilih kategori Semua.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setActiveCategory("Semua");
                  }}
                  className="mt-4 text-xs font-bold text-[#9d684b] underline underline-offset-4"
                >
                  Reset pencarian
                </button>
              </div>
            )}
          </section>

          <aside className="flex min-h-0 flex-col border-t border-[#e6dbd0] bg-[#fffdf9] lg:border-l lg:border-t-0">
            <div className="border-b border-[#ece1d7] px-5 pb-4 pt-6 sm:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold tracking-[-0.02em] text-[#503a30]">Pesanan saat ini</h2>
                    <span className="rounded-md bg-[#f4e8db] px-1.5 py-0.5 text-[10px] font-bold text-[#9f7255]">
                      {itemCount} item
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#a38f82]">Order #MISO-0247 · baru saja dibuat</p>
                </div>
                <button
                  type="button"
                  onClick={clearOrder}
                  disabled={!cart.length}
                  className="text-[11px] font-semibold text-[#b3836b] transition hover:text-[#9f5e4c] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Kosongkan
                </button>
              </div>
              <div className="mt-5 grid grid-cols-2 rounded-xl bg-[#f5eee7] p-1">
                {(["Dine-in", "Takeaway"] as OrderType[]).map((type) => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => setOrderType(type)}
                    className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition ${
                      orderType === type
                        ? "bg-[#fffdf9] text-[#68483a] shadow-[0_2px_7px_rgba(93,64,53,0.10)]"
                        : "text-[#aa9688] hover:text-[#795b4a]"
                    }`}
                  >
                    {type === "Dine-in" ? <Utensils size={14} /> : <ShoppingBag size={14} />}
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              {cart.length ? (
                <div className="space-y-1">
                  {cart.map((line) => (
                    <div key={line.id} className="group flex gap-3 border-b border-[#f0e8df] py-3.5 first:pt-1">
                      <div className={`h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br ${line.accent} opacity-90`}>
                        <div className="flex h-full items-center justify-center text-[10px] font-bold text-white/80">
                          {line.category === "Ramen" ? "RAM" : line.category === "Donburi" ? "DON" : line.category === "Minuman" ? "DRK" : "SIDE"}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="truncate text-[13px] font-bold text-[#60493e]">{line.name}</p>
                            <p className="mt-0.5 text-[11px] text-[#a18d7f]">{formatRupiah(line.price)}</p>
                          </div>
                          <p className="text-[13px] font-bold text-[#75503f]">{formatRupiah(line.price * line.quantity)}</p>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center rounded-lg border border-[#e9ded3] bg-[#fffdf9]">
                            <IconButton label={`Kurangi ${line.name}`} onClick={() => changeQuantity(line.id, -1)}>
                              <Minus size={13} />
                            </IconButton>
                            <span className="w-5 text-center text-xs font-bold text-[#654b3e]">{line.quantity}</span>
                            <IconButton label={`Tambah ${line.name}`} onClick={() => changeQuantity(line.id, 1)}>
                              <Plus size={13} />
                            </IconButton>
                          </div>
                          <IconButton label={`Hapus ${line.name}`} onClick={() => removeLine(line.id)} tone="danger">
                            <Trash2 size={14} />
                          </IconButton>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[245px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#dfd1c4] bg-[#fdfaf6] px-5 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f1e3d5] text-[#aa8065]">
                    <ShoppingCart size={20} />
                  </div>
                  <p className="text-sm font-bold text-[#654b3e]">Pesanan masih kosong</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#a18d7f]">Pilih menu di sebelah kiri untuk mulai.</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowNote((current) => !current)}
                className="mt-3 flex w-full items-center justify-between rounded-xl border border-dashed border-[#dac8b7] px-3 py-2.5 text-left text-[11px] font-semibold text-[#a17d66] transition hover:bg-[#fdf7f0]"
              >
                <span className="flex items-center gap-2">
                  <ReceiptText size={14} />
                  {showNote ? "Catatan: tanpa daun bawang" : "Tambah catatan pesanan"}
                </span>
                {showNote ? <Check size={14} className="text-[#82936e]" /> : <Plus size={14} />}
              </button>
            </div>

            <div className="border-t border-[#ece1d7] bg-[#fffaf5] px-5 pb-5 pt-4 sm:px-6">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-[#9e8a7c]">
                  <span>Subtotal</span>
                  <span className="font-semibold text-[#72584a]">{formatRupiah(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[#9e8a7c]">
                  <span>Pajak & layanan <span className="text-[10px]">(5%)</span></span>
                  <span className="font-semibold text-[#72584a]">{formatRupiah(serviceCharge)}</span>
                </div>
              </div>
              <div className="my-4 h-px border-t border-dashed border-[#ddcdbf]" />
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a38e7e]">Total bayar</span>
                  <span className="mt-1 block text-[25px] font-bold tracking-[-0.04em] text-[#50372c]">{formatRupiah(total)}</span>
                </div>
                <WalletCards size={24} className="mb-1 text-[#c29a7a]" />
              </div>
              <button
                type="button"
                disabled={!cart.length || isPaid}
                onClick={() => setIsPaid(true)}
                className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition active:scale-[0.99] ${
                  isPaid
                    ? "bg-[#81936e] text-white"
                    : "bg-[#9a5d43] text-[#fff9f1] shadow-[0_8px_18px_rgba(137,82,57,0.20)] hover:bg-[#874d38] disabled:cursor-not-allowed disabled:bg-[#d5c4b7] disabled:shadow-none"
                }`}
              >
                {isPaid ? <Check size={17} /> : <WalletCards size={17} />}
                {isPaid ? "Pembayaran diterima" : "Lanjut ke pembayaran"}
                {!isPaid && <ArrowRight size={16} />}
              </button>
              {isPaid && (
                <button
                  type="button"
                  onClick={() => {
                    setIsPaid(false);
                    setCart([]);
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 text-[11px] font-bold text-[#9d765f] hover:text-[#795341]"
                >
                  <X size={13} />
                  Mulai pesanan baru
                </button>
              )}
              <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-[#b09b8c]">
                <CircleAlert size={12} />
                <span>Pastikan jenis pesanan sudah sesuai</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}