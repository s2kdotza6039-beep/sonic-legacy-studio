// Shared PayFast helpers
const MERCHANT_ID = Deno.env.get("PAYFAST_MERCHANT_ID")!;
const MERCHANT_KEY = Deno.env.get("PAYFAST_MERCHANT_KEY")!;
const PASSPHRASE = Deno.env.get("PAYFAST_PASSPHRASE") ?? "";
const MODE = (Deno.env.get("PAYFAST_MODE") ?? "sandbox").toLowerCase();

export const PAYFAST_HOST =
  MODE === "live" ? "https://www.payfast.co.za" : "https://sandbox.payfast.co.za";

export const PAYFAST_CHECKOUT = `${PAYFAST_HOST}/eng/process`;
export const PAYFAST_VALIDATE = `${PAYFAST_HOST}/eng/query/validate`;

// PayFast uses PHP urlencode (spaces -> '+', uppercase hex). encodeURIComponent uses %20 + lowercase hex.
function pfEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/%20/g, "+")
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A")
    .replace(/%[0-9a-f]{2}/g, (m) => m.toUpperCase());
}

async function md5Hex(input: string): Promise<string> {
  // MD5 via Web Crypto isn't supported; ship a tiny pure-JS MD5.
  return md5(input);
}

// --- Minimal MD5 (public domain, Blueimp-derived) -----------------------
function md5(str: string): string {
  function rh(n: number) {
    let s = "", j;
    for (j = 0; j <= 3; j++)
      s += ((n >> (j * 8 + 4)) & 0x0f).toString(16) + ((n >> (j * 8)) & 0x0f).toString(16);
    return s;
  }
  function add(x: number, y: number) {
    const l = (x & 0xffff) + (y & 0xffff);
    return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xffff);
  }
  function rol(n: number, c: number) { return (n << c) | (n >>> (32 - c)); }
  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    return add(rol(add(add(a, q), add(x, t)), s), b);
  }
  function ff(a:number,b:number,c:number,d:number,x:number,s:number,t:number){return cmn((b&c)|((~b)&d),a,b,x,s,t);}
  function gg(a:number,b:number,c:number,d:number,x:number,s:number,t:number){return cmn((b&d)|(c&(~d)),a,b,x,s,t);}
  function hh(a:number,b:number,c:number,d:number,x:number,s:number,t:number){return cmn(b^c^d,a,b,x,s,t);}
  function ii(a:number,b:number,c:number,d:number,x:number,s:number,t:number){return cmn(c^(b|(~d)),a,b,x,s,t);}
  function utf8(s: string) { return unescape(encodeURIComponent(s)); }
  function s2b(s: string) {
    const n = ((s.length + 8) >> 6) + 1, b = new Array(n * 16).fill(0);
    for (let i = 0; i < s.length; i++) b[i >> 2] |= s.charCodeAt(i) << ((i % 4) * 8);
    b[s.length >> 2] |= 0x80 << ((s.length % 4) * 8);
    b[n * 16 - 2] = s.length * 8;
    return b;
  }
  const x = s2b(utf8(str));
  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  for (let i = 0; i < x.length; i += 16) {
    const oa=a,ob=b,oc=c,od=d;
    a=ff(a,b,c,d,x[i+0],7,-680876936);d=ff(d,a,b,c,x[i+1],12,-389564586);c=ff(c,d,a,b,x[i+2],17,606105819);b=ff(b,c,d,a,x[i+3],22,-1044525330);
    a=ff(a,b,c,d,x[i+4],7,-176418897);d=ff(d,a,b,c,x[i+5],12,1200080426);c=ff(c,d,a,b,x[i+6],17,-1473231341);b=ff(b,c,d,a,x[i+7],22,-45705983);
    a=ff(a,b,c,d,x[i+8],7,1770035416);d=ff(d,a,b,c,x[i+9],12,-1958414417);c=ff(c,d,a,b,x[i+10],17,-42063);b=ff(b,c,d,a,x[i+11],22,-1990404162);
    a=ff(a,b,c,d,x[i+12],7,1804603682);d=ff(d,a,b,c,x[i+13],12,-40341101);c=ff(c,d,a,b,x[i+14],17,-1502002290);b=ff(b,c,d,a,x[i+15],22,1236535329);
    a=gg(a,b,c,d,x[i+1],5,-165796510);d=gg(d,a,b,c,x[i+6],9,-1069501632);c=gg(c,d,a,b,x[i+11],14,643717713);b=gg(b,c,d,a,x[i+0],20,-373897302);
    a=gg(a,b,c,d,x[i+5],5,-701558691);d=gg(d,a,b,c,x[i+10],9,38016083);c=gg(c,d,a,b,x[i+15],14,-660478335);b=gg(b,c,d,a,x[i+4],20,-405537848);
    a=gg(a,b,c,d,x[i+9],5,568446438);d=gg(d,a,b,c,x[i+14],9,-1019803690);c=gg(c,d,a,b,x[i+3],14,-187363961);b=gg(b,c,d,a,x[i+8],20,1163531501);
    a=gg(a,b,c,d,x[i+13],5,-1444681467);d=gg(d,a,b,c,x[i+2],9,-51403784);c=gg(c,d,a,b,x[i+7],14,1735328473);b=gg(b,c,d,a,x[i+12],20,-1926607734);
    a=hh(a,b,c,d,x[i+5],4,-378558);d=hh(d,a,b,c,x[i+8],11,-2022574463);c=hh(c,d,a,b,x[i+11],16,1839030562);b=hh(b,c,d,a,x[i+14],23,-35309556);
    a=hh(a,b,c,d,x[i+1],4,-1530992060);d=hh(d,a,b,c,x[i+4],11,1272893353);c=hh(c,d,a,b,x[i+7],16,-155497632);b=hh(b,c,d,a,x[i+10],23,-1094730640);
    a=hh(a,b,c,d,x[i+13],4,681279174);d=hh(d,a,b,c,x[i+0],11,-358537222);c=hh(c,d,a,b,x[i+3],16,-722521979);b=hh(b,c,d,a,x[i+6],23,76029189);
    a=hh(a,b,c,d,x[i+9],4,-640364487);d=hh(d,a,b,c,x[i+12],11,-421815835);c=hh(c,d,a,b,x[i+15],16,530742520);b=hh(b,c,d,a,x[i+2],23,-995338651);
    a=ii(a,b,c,d,x[i+0],6,-198630844);d=ii(d,a,b,c,x[i+7],10,1126891415);c=ii(c,d,a,b,x[i+14],15,-1416354905);b=ii(b,c,d,a,x[i+5],21,-57434055);
    a=ii(a,b,c,d,x[i+12],6,1700485571);d=ii(d,a,b,c,x[i+3],10,-1894986606);c=ii(c,d,a,b,x[i+10],15,-1051523);b=ii(b,c,d,a,x[i+1],21,-2054922799);
    a=ii(a,b,c,d,x[i+8],6,1873313359);d=ii(d,a,b,c,x[i+15],10,-30611744);c=ii(c,d,a,b,x[i+6],15,-1560198380);b=ii(b,c,d,a,x[i+13],21,1309151649);
    a=ii(a,b,c,d,x[i+4],6,-145523070);d=ii(d,a,b,c,x[i+11],10,-1120210379);c=ii(c,d,a,b,x[i+2],15,718787259);b=ii(b,c,d,a,x[i+9],21,-343485551);
    a=add(a,oa);b=add(b,ob);c=add(c,oc);d=add(d,od);
  }
  return rh(a) + rh(b) + rh(c) + rh(d);
}

export function buildSignature(fields: Record<string, string>, passphrase = PASSPHRASE): string {
  // PayFast: sign in the order the fields are submitted, skip blanks, append passphrase if set.
  const parts: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === "") continue;
    if (k === "signature") continue;
    parts.push(`${k}=${pfEncode(String(v))}`);
  }
  let s = parts.join("&");
  if (passphrase) s += `&passphrase=${pfEncode(passphrase)}`;
  return md5(s);
}

export function buildCheckoutFields(args: {
  amountCents: number;
  itemName: string;
  itemDescription?: string;
  mPaymentId: string;
  email?: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  customStr1?: string;
}) {
  const amount = (args.amountCents / 100).toFixed(2);
  const fields: Record<string, string> = {
    merchant_id: MERCHANT_ID,
    merchant_key: MERCHANT_KEY,
    return_url: args.returnUrl,
    cancel_url: args.cancelUrl,
    notify_url: args.notifyUrl,
    ...(args.email ? { email_address: args.email } : {}),
    m_payment_id: args.mPaymentId,
    amount,
    item_name: args.itemName,
    ...(args.itemDescription ? { item_description: args.itemDescription } : {}),
    ...(args.customStr1 ? { custom_str1: args.customStr1 } : {}),
  };
  fields.signature = buildSignature(fields);
  return fields;
}

export async function verifyItn(
  rawBody: string,
  payload: Record<string, string>,
): Promise<{ ok: boolean; reason?: string }> {
  // 1. Signature
  const provided = payload.signature;
  const recomputed = buildSignature(payload);
  if (!provided || provided.toLowerCase() !== recomputed.toLowerCase()) {
    return { ok: false, reason: "bad-signature" };
  }
  // 2. Server-to-server validation
  try {
    const res = await fetch(PAYFAST_VALIDATE, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: rawBody,
    });
    const text = (await res.text()).trim();
    if (text !== "VALID") return { ok: false, reason: `validate:${text}` };
  } catch (e) {
    return { ok: false, reason: `validate-err:${(e as Error).message}` };
  }
  return { ok: true };
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}
