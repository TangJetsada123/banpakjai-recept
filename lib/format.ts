export const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export function money(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseISO(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** 2026-11-03 -> "3 พฤศจิกายน 2569" */
export function thaiLongDate(iso: string): string {
  const d = parseISO(iso);
  if (!d) return "";
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/** 2026-11-02 -> "2/11/2569" */
export function thaiShortDate(iso: string): string {
  const d = parseISO(iso);
  if (!d) return "";
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
}

const DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const UNITS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

function readInt(s: string): string {
  s = s.replace(/^0+/, "");
  if (!s) return "";
  if (s.length > 6) {
    const head = s.slice(0, -6);
    const tail = s.slice(-6);
    return readInt(head) + "ล้าน" + readInt(tail);
  }
  let out = "";
  const len = s.length;
  for (let i = 0; i < len; i++) {
    const d = Number(s[i]);
    const pos = len - i - 1;
    if (d === 0) continue;
    if (pos === 1 && d === 1) out += "สิบ";
    else if (pos === 1 && d === 2) out += "ยี่สิบ";
    else if (pos === 0 && d === 1 && len > 1) out += "เอ็ด";
    else out += DIGITS[d] + UNITS[pos];
  }
  return out;
}

/** 1000 -> "หนึ่งพันบาทถ้วน" */
export function bahtText(amount: number): string {
  if (!Number.isFinite(amount)) return "";
  const neg = amount < 0;
  const satangTotal = Math.round(Math.abs(amount) * 100);
  const baht = Math.floor(satangTotal / 100);
  const satang = satangTotal % 100;
  let text = "";
  if (baht === 0 && satang === 0) return "ศูนย์บาทถ้วน";
  if (baht > 0) text += readInt(String(baht)) + "บาท";
  text += satang > 0 ? readInt(String(satang)) + "สตางค์" : "ถ้วน";
  return (neg ? "ลบ" : "") + text;
}
