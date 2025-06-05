/**
 * Разбирает cookie вида _ga или _ga_G-XXXX и возвращает именованный объект
 * @param {string} cookieValue – строковое содержимое cookie
 * @returns {{
*   cookie_content: string,
*   session_id?: string,
*   session_number?: string,
*   session_engaged?: string,
*   user_id_hash?: string,
*   timestamp?: string,
*   duration?: number
* }}
*/
function parseGaCookie(cookieValue = "") {
 const res = { cookie_content: String(cookieValue) };

 const onlyVal = part => (part && part.length > 1 ? part.slice(1) : undefined);
 const nowSec = Math.round(Date.now() / 1000);

 if (cookieValue.startsWith("GS2.1")) {
   // формат GA4 (GS2.1.*)
   const info = (cookieValue.split(".")[2] || "");
   const parts = info.split("$");

   const pick = prefix => onlyVal(parts.find(p => p.startsWith(prefix)));

   const ts = pick("t");
   Object.assign(res, {
     session_id:      pick("s"),
     session_number:  pick("o"),
     session_engaged: pick("g"),
     user_id_hash:    pick("h"),
     timestamp:       ts,
     duration:        ts ? nowSec - Number(ts) : undefined
   });

 } else {
   // старый Universal Analytics формат
   const parts = cookieValue.split(".");
   const ts = parts[5];

   Object.assign(res, {
     session_id:     parts[2],
     session_number: parts[3],
     timestamp:      ts,
     duration:       ts ? nowSec - Number(ts) : undefined
   });
 }

 return res;
}
