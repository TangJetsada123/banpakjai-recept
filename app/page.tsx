"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PACKAGES, findPackage } from "@/lib/packages";
import { bahtText, money, thaiLongDate, thaiShortDate } from "@/lib/format";

/* ---------- types & defaults ---------- */

type Item = {
  id: string;
  code: string; // "" = รายการอื่น (กำหนดเอง)
  description: string;
  qty: string;
  unitPrice: string;
  isDiscount: boolean;
};

type Receipt = {
  company: {
    nameTh: string;
    nameEn: string;
    taxId: string;
    address1: string;
    address2: string;
    phone: string;
    email: string;
  };
  receiptNo: string;
  issueDate: string;
  cycleFrom: string;
  cycleTo: string;
  customer: { name: string; address: string; room: string };
  items: Item[];
  billDiscount: string;
  vatPercent: string;
  note: string;
  payment: {
    method: "cash" | "transfer";
    bank: string;
    accountNo: string;
    accountName: string;
  };
  payerName: string;
  receiverName: string;
  receiverTitle: string;
  logo: string; // data URL
  signature: string; // URL / data URL, "none" = ไม่แสดงลายเซ็น
};

const STORAGE_KEY = "banpakjai-receipt-v1";
const DEFAULT_SIGNATURE = "/signature.png"; // ลายเซ็น ทิพวรรรณ อรุณประภารัตน์

const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const num = (s: string) => {
  const n = parseFloat(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const isDiscountText = (s: string) => s.trim().startsWith("ส่วนลด");

const defaultReceipt = (): Receipt => ({
  company: {
    nameTh: "บริษัท บ้านพักใจ จำกัด",
    nameEn: "BAN PAK JAI CO., LTD.",
    taxId: "0505565013700",
    address1: "234/60 หมู่บ้านศิริวัฒนานิเวศน์ ตำบลหนองหอย",
    address2: "อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่ 50000",
    phone: "0971257757",
    email: "banpakjaicm@gmail.com",
  },
  receiptNo: "RT2000078",
  issueDate: todayISO(),
  cycleFrom: "",
  cycleTo: "",
  customer: { name: "", address: "", room: "" },
  items: [],
  billDiscount: "",
  vatPercent: "",
  note: "",
  payment: {
    method: "transfer",
    bank: "กสิกรไทย",
    accountNo: "1105-3-932823",
    accountName: "ทิพวัลย์ อรุณประภารัตน์",
  },
  payerName: "",
  receiverName: "ทิพวรรรณ อรุณประภารัตน์",
  receiverTitle: "กรรมการผู้จัดการบ้านพักใจ",
  logo: "",
  signature: DEFAULT_SIGNATURE,
});

const nextReceiptNo = (no: string) =>
  no.replace(/(\d+)(?!.*\d)/, (m) => String(Number(m) + 1).padStart(m.length, "0"));

const itemAmount = (it: Item) => num(it.qty) * num(it.unitPrice);

/* ---------- page ---------- */

export default function Page() {
  const [r, setR] = useState<Receipt>(defaultReceipt);
  const [loaded, setLoaded] = useState(false);
  const [pkgFilter, setPkgFilter] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (!saved.signature) delete saved.signature; // ข้อมูลเก่ายังไม่มีลายเซ็น -> ใช้ค่าเริ่มต้น
        setR({ ...defaultReceipt(), ...saved });
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
    } catch {}
  }, [r, loaded]);

  const totals = useMemo(() => {
    const subtotal = r.items.reduce(
      (s, it) => s + (it.isDiscount ? -1 : 1) * itemAmount(it),
      0,
    );
    const discount = num(r.billDiscount);
    const afterDiscount = subtotal - discount;
    const vat = (afterDiscount * num(r.vatPercent)) / 100;
    return { subtotal, discount, vat, grand: afterDiscount + vat };
  }, [r.items, r.billDiscount, r.vatPercent]);

  /* --- updaters --- */
  const set = <K extends keyof Receipt>(k: K, v: Receipt[K]) =>
    setR((p) => ({ ...p, [k]: v }));
  const setCompany = (k: keyof Receipt["company"], v: string) =>
    setR((p) => ({ ...p, company: { ...p.company, [k]: v } }));
  const setCustomer = (k: keyof Receipt["customer"], v: string) =>
    setR((p) => ({ ...p, customer: { ...p.customer, [k]: v } }));
  const setPayment = <K extends keyof Receipt["payment"]>(k: K, v: Receipt["payment"][K]) =>
    setR((p) => ({ ...p, payment: { ...p.payment, [k]: v } }));

  const updateItem = (id: string, patch: Partial<Item>) =>
    setR((p) => ({
      ...p,
      items: p.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }));
  const removeItem = (id: string) =>
    setR((p) => ({ ...p, items: p.items.filter((it) => it.id !== id) }));
  const moveItem = (id: string, dir: -1 | 1) =>
    setR((p) => {
      const i = p.items.findIndex((it) => it.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.items.length) return p;
      const items = [...p.items];
      [items[i], items[j]] = [items[j], items[i]];
      return { ...p, items };
    });

  const addPackage = (code: string) => {
    const pk = findPackage(code);
    if (!pk) return;
    setR((p) => ({
      ...p,
      items: [
        ...p.items,
        {
          id: uid(),
          code: pk.code,
          description: pk.name,
          qty: "1",
          unitPrice: String(pk.price),
          isDiscount: false,
        },
      ],
    }));
  };
  const addCustom = (isDiscount = false) =>
    setR((p) => ({
      ...p,
      items: [
        ...p.items,
        {
          id: uid(),
          code: "",
          description: isDiscount ? "ส่วนลด" : "",
          qty: "1",
          unitPrice: "",
          isDiscount,
        },
      ],
    }));

  const changeItemCode = (it: Item, code: string) => {
    const pk = findPackage(code);
    if (!pk) return updateItem(it.id, { code: "" });
    updateItem(it.id, {
      code,
      description: pk.name,
      unitPrice: String(pk.price),
      isDiscount: false,
    });
  };

  const readImage = (file: File | undefined, key: "logo" | "signature") => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set(key, String(reader.result));
    reader.readAsDataURL(file);
  };

  const exportPdf = () => {
    const prev = document.title;
    const who = r.customer.name.trim();
    document.title = `ใบเสร็จรับเงิน_${who ? "คุณ" + who : r.receiptNo}`;
    window.print();
    setTimeout(() => (document.title = prev), 500);
  };

  const newReceipt = () => {
    if (!confirm("เริ่มใบเสร็จใหม่? ข้อมูลผู้รับบริการและรายการจะถูกล้าง (ข้อมูลบริษัท/การชำระเงินยังอยู่)")) return;
    setR((p) => ({
      ...defaultReceipt(),
      company: p.company,
      payment: p.payment,
      receiverName: p.receiverName,
      receiverTitle: p.receiverTitle,
      logo: p.logo,
      signature: p.signature,
      receiptNo: nextReceiptNo(p.receiptNo),
    }));
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${r.receiptNo || "receipt"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importRef = useRef<HTMLInputElement>(null);
  const importJson = (file: File | undefined) => {
    if (!file) return;
    file.text().then((t) => {
      try {
        setR({ ...defaultReceipt(), ...JSON.parse(t) });
      } catch {
        alert("ไฟล์ไม่ถูกต้อง");
      }
    });
  };

  const filteredPackages = PACKAGES.filter(
    (p) =>
      !pkgFilter ||
      p.code.toLowerCase().includes(pkgFilter.toLowerCase()) ||
      p.name.includes(pkgFilter),
  );

  return (
    <div className="app">
      {/* ================= FORM ================= */}
      <aside className="form no-print">
        <header className="form-head">
          <h1>ออกใบเสร็จรับเงิน</h1>
          <div className="actions">
            <button className="btn primary" onClick={exportPdf}>
              ⬇ Export PDF
            </button>
            <button className="btn" onClick={newReceipt}>
              ใบใหม่
            </button>
            <button className="btn" onClick={exportJson} title="บันทึกข้อมูลเป็นไฟล์ JSON">
              บันทึก
            </button>
            <button className="btn" onClick={() => importRef.current?.click()} title="เปิดไฟล์ JSON">
              เปิด
            </button>
            <input
              ref={importRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                importJson(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        </header>

        <section className="card">
          <h2>ข้อมูลใบเสร็จ</h2>
          <div className="grid2">
            <label>
              เลขที่
              <input value={r.receiptNo} onChange={(e) => set("receiptNo", e.target.value)} />
            </label>
            <label>
              วันที่ออกบิล
              <input type="date" value={r.issueDate} onChange={(e) => set("issueDate", e.target.value)} />
            </label>
            <label>
              รอบบิล (ตั้งแต่)
              <input type="date" value={r.cycleFrom} onChange={(e) => set("cycleFrom", e.target.value)} />
            </label>
            <label>
              รอบบิล (ถึง)
              <input type="date" value={r.cycleTo} onChange={(e) => set("cycleTo", e.target.value)} />
            </label>
          </div>
        </section>

        <section className="card">
          <h2>ผู้รับบริการ</h2>
          <label>
            ชื่อ - นามสกุล (ไม่ต้องใส่ &quot;คุณ&quot;)
            <input
              value={r.customer.name}
              placeholder="เช่น สุพร การุณพักตร์"
              onChange={(e) => setCustomer("name", e.target.value)}
            />
          </label>
          <label>
            ที่อยู่
            <textarea
              rows={2}
              value={r.customer.address}
              onChange={(e) => setCustomer("address", e.target.value)}
            />
          </label>
          <label>
            ห้องพัก
            <input
              value={r.customer.room}
              placeholder="เช่น บ้าน 1"
              onChange={(e) => setCustomer("room", e.target.value)}
            />
          </label>
        </section>

        <section className="card">
          <h2>รายการสินค้า / บริการ</h2>

          <div className="add-bar">
            <input
              className="pkg-filter"
              placeholder="ค้นหาแพ็กเกจ (รหัส/ชื่อ)"
              value={pkgFilter}
              onChange={(e) => setPkgFilter(e.target.value)}
            />
            <select
              value=""
              onChange={(e) => {
                addPackage(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">+ เพิ่มจากแพ็กเกจ/ค่าบริการ ({filteredPackages.length})</option>
              {filteredPackages.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} · {p.name} — {p.priceLabel ?? (p.price ? p.price.toLocaleString() : "ระบุราคา")}
                </option>
              ))}
            </select>
            <div className="row-btns">
              <button className="btn" onClick={() => addCustom(false)}>
                + เพิ่มรายการอื่น
              </button>
              <button className="btn" onClick={() => addCustom(true)}>
                + เพิ่มส่วนลด
              </button>
            </div>
          </div>

          {r.items.length === 0 && <p className="empty">ยังไม่มีรายการ เลือกแพ็กเกจหรือกด “เพิ่มรายการอื่น”</p>}

          <ol className="items">
            {r.items.map((it, idx) => {
              const pk = findPackage(it.code);
              return (
                <li key={it.id} className={`item ${it.isDiscount ? "discount" : ""}`}>
                  <div className="item-top">
                    <span className="idx">{idx + 1}</span>
                    <select value={it.code} onChange={(e) => changeItemCode(it, e.target.value)}>
                      <option value="">— รายการอื่น (กำหนดเอง) —</option>
                      {PACKAGES.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.code} · {p.name}
                        </option>
                      ))}
                    </select>
                    <button className="icon" title="เลื่อนขึ้น" onClick={() => moveItem(it.id, -1)}>
                      ↑
                    </button>
                    <button className="icon" title="เลื่อนลง" onClick={() => moveItem(it.id, 1)}>
                      ↓
                    </button>
                    <button className="icon danger" title="ลบ" onClick={() => removeItem(it.id)}>
                      ✕
                    </button>
                  </div>
                  <input
                    className="desc"
                    value={it.description}
                    placeholder="รายละเอียด เช่น ค่าบริการพ่นยาวันที่ 7 - 30 ตุลาคม 2569 (รายครั้ง)"
                    onChange={(e) =>
                      updateItem(it.id, {
                        description: e.target.value,
                        isDiscount: it.isDiscount || isDiscountText(e.target.value),
                      })
                    }
                  />
                  <div className="item-nums">
                    <label>
                      หน่วย
                      <input
                        inputMode="decimal"
                        value={it.qty}
                        onChange={(e) => updateItem(it.id, { qty: e.target.value })}
                      />
                    </label>
                    <label>
                      ราคาต่อหน่วย
                      <input
                        inputMode="decimal"
                        value={it.unitPrice}
                        placeholder={pk?.priceLabel}
                        onChange={(e) => updateItem(it.id, { unitPrice: e.target.value })}
                      />
                    </label>
                    <label className="chk">
                      <input
                        type="checkbox"
                        checked={it.isDiscount}
                        onChange={(e) => updateItem(it.id, { isDiscount: e.target.checked })}
                      />
                      ส่วนลด (หักออก)
                    </label>
                    <div className="amt">
                      {it.isDiscount && itemAmount(it) !== 0 ? "-" : ""}
                      {money(itemAmount(it))}
                    </div>
                  </div>
                  {pk?.priceLabel && <div className="hint">ช่วงราคา {pk.priceLabel} บาท</div>}
                </li>
              );
            })}
          </ol>
        </section>

        <section className="card">
          <h2>สรุปยอด</h2>
          <div className="grid2">
            <label>
              ส่วนลดท้ายบิล (บาท)
              <input inputMode="decimal" value={r.billDiscount} onChange={(e) => set("billDiscount", e.target.value)} />
            </label>
            <label>
              ภาษีมูลค่าเพิ่ม (%)
              <input
                inputMode="decimal"
                value={r.vatPercent}
                placeholder="เว้นว่าง = ไม่คิด"
                onChange={(e) => set("vatPercent", e.target.value)}
              />
            </label>
          </div>
          <div className="sum-line">
            <span>จำนวนเงินทั้งสิ้น</span>
            <b>{money(totals.grand)} บาท</b>
          </div>
          <div className="sum-text">({bahtText(totals.grand)})</div>
          <label>
            หมายเหตุ
            <textarea rows={2} value={r.note} onChange={(e) => set("note", e.target.value)} />
          </label>
        </section>

        <section className="card">
          <h2>การชำระเงิน / ลายเซ็น</h2>
          <div className="radio">
            <label>
              <input
                type="radio"
                checked={r.payment.method === "cash"}
                onChange={() => setPayment("method", "cash")}
              />
              เงินสด
            </label>
            <label>
              <input
                type="radio"
                checked={r.payment.method === "transfer"}
                onChange={() => setPayment("method", "transfer")}
              />
              โอนเข้าบัญชีธนาคาร
            </label>
          </div>
          <div className="grid2">
            <label>
              ธนาคาร
              <input value={r.payment.bank} onChange={(e) => setPayment("bank", e.target.value)} />
            </label>
            <label>
              เลขที่บัญชี
              <input value={r.payment.accountNo} onChange={(e) => setPayment("accountNo", e.target.value)} />
            </label>
          </div>
          <label>
            ชื่อบัญชี
            <input value={r.payment.accountName} onChange={(e) => setPayment("accountName", e.target.value)} />
          </label>
          <label>
            ผู้ชำระเงิน (ถ้ามี)
            <input value={r.payerName} onChange={(e) => set("payerName", e.target.value)} />
          </label>
          <div className="grid2">
            <label>
              ผู้รับเงิน
              <input value={r.receiverName} onChange={(e) => set("receiverName", e.target.value)} />
            </label>
            <label>
              ตำแหน่ง
              <input value={r.receiverTitle} onChange={(e) => set("receiverTitle", e.target.value)} />
            </label>
          </div>
          <div className="grid2">
            <label>
              รูปลายเซ็นผู้รับเงิน
              <input type="file" accept="image/*" onChange={(e) => readImage(e.target.files?.[0], "signature")} />
            </label>
            <label>
              โลโก้บริษัท
              <input type="file" accept="image/*" onChange={(e) => readImage(e.target.files?.[0], "logo")} />
            </label>
          </div>
          <div className="row-btns">
            {r.signature !== "none" && (
              <button className="btn" onClick={() => set("signature", "none")}>
                ไม่แสดงลายเซ็น
              </button>
            )}
            {r.signature !== DEFAULT_SIGNATURE && (
              <button className="btn" onClick={() => set("signature", DEFAULT_SIGNATURE)}>
                ใช้ลายเซ็นเริ่มต้น
              </button>
            )}
            {r.logo && (
              <button className="btn" onClick={() => set("logo", "")}>
                ใช้โลโก้เริ่มต้น
              </button>
            )}
          </div>
        </section>

        <details className="card">
          <summary>ข้อมูลบริษัท</summary>
          <label>
            ชื่อบริษัท (ไทย)
            <input value={r.company.nameTh} onChange={(e) => setCompany("nameTh", e.target.value)} />
          </label>
          <label>
            ชื่อบริษัท (อังกฤษ)
            <input value={r.company.nameEn} onChange={(e) => setCompany("nameEn", e.target.value)} />
          </label>
          <label>
            เลขที่เสียภาษี
            <input value={r.company.taxId} onChange={(e) => setCompany("taxId", e.target.value)} />
          </label>
          <label>
            ที่อยู่ บรรทัด 1
            <input value={r.company.address1} onChange={(e) => setCompany("address1", e.target.value)} />
          </label>
          <label>
            ที่อยู่ บรรทัด 2
            <input value={r.company.address2} onChange={(e) => setCompany("address2", e.target.value)} />
          </label>
          <div className="grid2">
            <label>
              โทร
              <input value={r.company.phone} onChange={(e) => setCompany("phone", e.target.value)} />
            </label>
            <label>
              อีเมล์
              <input value={r.company.email} onChange={(e) => setCompany("email", e.target.value)} />
            </label>
          </div>
        </details>
      </aside>

      {/* ================= PREVIEW ================= */}
      <Preview>
        <ReceiptDoc r={r} totals={totals} />
      </Preview>
    </div>
  );
}

/* ---------- preview with zoom (screen only) ---------- */

const PAPER_PX = (210 / 25.4) * 96; // A4 width in CSS px

function Preview({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [fit, setFit] = useState(1);
  const [mode, setMode] = useState<"fit" | number>("fit");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const avail = el.clientWidth - 72; // padding + scrollbar room
      setFit(Math.max(0.3, Math.min(2, avail / PAPER_PX)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoom = mode === "fit" ? fit : mode;
  const step = (d: number) =>
    setMode(Math.round(Math.max(0.3, Math.min(2.5, zoom + d)) * 10) / 10);

  return (
    <main className="preview" ref={ref}>
      <div className="zoom-bar no-print">
        <button className="icon" onClick={() => step(-0.1)} title="ย่อ">
          −
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button className="icon" onClick={() => step(0.1)} title="ขยาย">
          +
        </button>
        <button className={`btn ${mode === "fit" ? "on" : ""}`} onClick={() => setMode("fit")}>
          พอดีจอ
        </button>
        <button className={`btn ${mode === 1 ? "on" : ""}`} onClick={() => setMode(1)}>
          100%
        </button>
      </div>
      <div className="paper-zoom" style={{ zoom }}>
        {/* print frame: @page margin is 0 (so Chrome adds no URL/date header/footer);
            the repeating thead/tfoot spacers give every printed page top/bottom margins */}
        <table className="print-frame">
          <thead>
            <tr>
              <td>
                <div className="page-space" />
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{children}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>
                <div className="page-space" />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </main>
  );
}

/* ---------- printable receipt ---------- */

function Logo() {
  return (
    <svg viewBox="0 0 64 64" width="44" height="44" aria-hidden>
      <circle cx="32" cy="32" r="30" fill="#dbe7f5" stroke="#9db6d6" strokeWidth="2" />
      <path d="M16 31 L32 17 L48 31" fill="none" stroke="#5b7fae" strokeWidth="3" strokeLinejoin="round" />
      <path d="M20 29 V46 H44 V29" fill="none" stroke="#5b7fae" strokeWidth="3" strokeLinejoin="round" />
      <path
        d="M32 42 C24 36 25 30 29 30 C31 30 32 32 32 32 C32 32 33 30 35 30 C39 30 40 36 32 42 Z"
        fill="none"
        stroke="#5b7fae"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReceiptDoc({
  r,
  totals,
}: {
  r: Receipt;
  totals: { subtotal: number; discount: number; vat: number; grand: number };
}) {
  const c = r.company;
  const cycle =
    r.cycleFrom || r.cycleTo ? `${thaiShortDate(r.cycleFrom)} - ${thaiShortDate(r.cycleTo)}` : "";
  return (
    <div className="paper">
      <div className="doc-head">
        <div>
          {r.logo ? <img src={r.logo} alt="" className="logo-img" /> : <Logo />}
          <div className="co-th">{c.nameTh}</div>
          <div className="co-en">{c.nameEn}</div>
        </div>
        <div className="doc-title">ใบเสร็จรับเงิน</div>
      </div>

      <div className="doc-info">
        <table className="kv">
          <tbody>
            <tr>
              <td>ออกโดย</td>
              <td>{c.nameTh}</td>
            </tr>
            <tr>
              <td>เลขที่เสียภาษี</td>
              <td>{c.taxId}</td>
            </tr>
            <tr>
              <td>ที่อยู่</td>
              <td>
                {c.address1}
                <br />
                {c.address2}
              </td>
            </tr>
            <tr>
              <td>โทร</td>
              <td>{c.phone}</td>
            </tr>
            <tr>
              <td>อีเมล์</td>
              <td>{c.email}</td>
            </tr>
          </tbody>
        </table>
        <table className="meta">
          <tbody>
            <tr>
              <td>เลขที่</td>
              <td className="box">{r.receiptNo}</td>
            </tr>
            <tr>
              <td>วันที่ออกบิล</td>
              <td className="box">{thaiLongDate(r.issueDate)}</td>
            </tr>
            <tr>
              <td>รอบบิล</td>
              <td className="box">{cycle}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <hr className="rule" />

      <table className="kv customer">
        <tbody>
          <tr>
            <td>ผู้รับบริการ</td>
            <td className="cust-name">{r.customer.name ? `คุณ ${r.customer.name}` : ""}</td>
          </tr>
          <tr>
            <td>ที่อยู่</td>
            <td>{r.customer.address}</td>
          </tr>
          <tr>
            <td>ห้องพัก</td>
            <td>{r.customer.room}</td>
          </tr>
        </tbody>
      </table>

      <table className="lines">
        <thead>
          <tr>
            <th className="l">สินค้า / บริการ</th>
            <th>หน่วย</th>
            <th className="r">ราคาต่อหน่วย</th>
            <th className="r">จำนวนเงิน (บาท)</th>
          </tr>
        </thead>
        <tbody>
          {r.items.map((it) => (
            <tr key={it.id}>
              <td className="l">{it.description}</td>
              <td className="c">{it.qty}</td>
              <td className="r">{money(num(it.unitPrice))}</td>
              <td className="r">
                {it.isDiscount && itemAmount(it) !== 0 ? "-" : ""}
                {money(itemAmount(it))}
              </td>
            </tr>
          ))}
          {r.items.length === 0 && (
            <tr>
              <td className="l muted" colSpan={4}>
                &nbsp;
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="totals-wrap">
        <table className="totals">
          <tbody>
            <tr>
              <td>ราคาสุทธิ</td>
              <td>{money(totals.subtotal)}</td>
            </tr>
            <tr>
              <td>ส่วนลด</td>
              <td>{totals.discount ? money(totals.discount) : ""}</td>
            </tr>
            <tr>
              <td>ภาษีมูลค่าเพิ่ม</td>
              <td>{num(r.vatPercent) ? money(totals.vat) : ""}</td>
            </tr>
            <tr className="grand">
              <td>จำนวนเงินทั้งสิ้น</td>
              <td>{money(totals.grand)}</td>
            </tr>
          </tbody>
        </table>
        <div className="baht-text">-{bahtText(totals.grand)}-</div>
      </div>

      <div className="pay">
        <div>หมายเหตุ : {r.note}</div>
        <div>ชำระเงินโดย:</div>
        <div>( {r.payment.method === "cash" ? "/" : "  "} ) เงินสด</div>
        <div>
          ( {r.payment.method === "transfer" ? "/" : "  "} ) โอนเข้าบัญชีธนาคาร....
          {r.payment.bank}.... เลขที่บัญชี ....{r.payment.accountNo}... ชื่อบัญชี: {r.payment.accountName}
        </div>
      </div>

      <table className="sign">
        <tbody>
          <tr>
            <td>
              <div className="sign-label">ผู้ชำระเงิน</div>
              <div className="sign-area" />
              {r.payerName && <div className="sign-name">( {r.payerName} )</div>}
            </td>
            <td>
              <div className="sign-label">ผู้รับเงิน</div>
              <div className="sign-area">{r.signature && r.signature !== "none" && <img src={r.signature} alt="ลายเซ็นผู้รับเงิน" />}</div>
              <div className="sign-name">( {r.receiverName} )</div>
              <div className="sign-title">{r.receiverTitle}</div>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="foot">{c.nameTh}</div>
    </div>
  );
}
