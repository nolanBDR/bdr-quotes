import { Resend } from "resend";

const FROM = process.env.RESEND_FROM || "BDR Quotes <quotes@bdrint.ca>";

export async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.error("Missing RESEND_API_KEY — email not sent.", { to, subject });
    return { ok: false, error: "missing_resend_key" };
  }
  try {
    // Constructed lazily — `new Resend()` throws immediately on a missing key,
    // and doing that at module load would crash the whole function on import.
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) { console.error("Resend send failed", error); return { ok: false, error }; }
    return { ok: true, id: data?.id };
  } catch (e) {
    console.error("Resend send threw", e);
    return { ok: false, error: e.message };
  }
}

export function actionButton(href, label, color) {
  return `<a href="${href}" style="display:inline-block;padding:12px 28px;margin:6px 8px 6px 0;background:${color};color:#fff;text-decoration:none;border-radius:6px;font-weight:700;font-family:Arial,sans-serif;font-size:15px;">${label}</a>`;
}

export function htmlPage(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{font-family:Arial,sans-serif;background:#F2EFE9;color:#1B232E;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;box-sizing:border-box;}
.card{background:#fff;border:1px solid #e3dccd;border-radius:10px;padding:32px 40px;max-width:480px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.08);}
h1{color:#641833;font-size:22px;margin-top:0;}
p{color:#5c5f66;}
</style></head>
<body><div class="card">${body}</div></body></html>`;
}

export function htmlFormPage(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{font-family:Arial,sans-serif;background:#F2EFE9;color:#1B232E;margin:0;padding:24px;box-sizing:border-box;}
.card{background:#fff;border:1px solid #e3dccd;border-radius:10px;padding:28px 32px;max-width:520px;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,0.08);}
h1{color:#641833;font-size:20px;margin-top:0;}
label{display:block;font-size:13px;font-weight:700;margin:14px 0 4px;}
textarea,input{width:100%;box-sizing:border-box;padding:10px 12px;font-size:14px;border:1px solid #e3dccd;border-radius:6px;font-family:inherit;}
textarea{min-height:100px;resize:vertical;}
button{margin-top:18px;padding:12px 28px;background:#641833;color:#fff;border:none;border-radius:6px;font-weight:700;font-size:15px;cursor:pointer;}
.meta{color:#5c5f66;font-size:13px;margin-bottom:16px;}
</style></head><body><div class="card">${body}</div></body></html>`;
}
