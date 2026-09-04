import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';

function cfg() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP;
  if (!user || !pass) throw new Error('email not connected — add GMAIL_USER + GMAIL_APP');
  return { user, pass };
}

export function mailer() {
  const { user, pass } = cfg();
  return nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 587, secure: false,
    auth: { user, pass },
  });
}

export async function sendEmail(to: string, subject: string, body: string): Promise<string> {
  const { user } = cfg();
  const t = mailer();
  const info = await t.sendMail({
    from: `"Noira" <${user}>`,
    to, subject,
    text: body,
    headers: { 'List-Unsubscribe': `<mailto:${user}?subject=baja>` },
  });
  return info.messageId || '';
}

// Read UNSEEN inbox mail (replies). Returns [{from, subject, snippet, date}].
export async function checkInbox(sinceDays = 14): Promise<{ from: string; subject: string; snippet: string; date: number }[]> {
  const { user, pass } = cfg();
  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user, pass }, logger: false });
  await client.connect();
  const out: { from: string; subject: string; snippet: string; date: number }[] = [];
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = new Date(Date.now() - sinceDays * 86400_000);
      for await (const msg of client.fetch({ seen: false, since }, { envelope: true, bodyParts: ['text'] })) {
        const from = msg.envelope?.from?.[0]?.address || '';
        if (from.toLowerCase() === user.toLowerCase()) continue; // our own sent copies
        let snippet = '';
        try {
          const part = msg.bodyParts?.get('text');
          const text = part ? Buffer.from(part as any).toString('utf8') : '';
          snippet = text.replace(/\r?\nOn .*wrote:[\s\S]*$/i, '').replace(/--+\s*$/g, '').trim().slice(0, 500);
        } catch {}
        out.push({ from: from.toLowerCase(), subject: msg.envelope?.subject || '', snippet, date: msg.envelope?.date?.getTime() || Date.now() });
        try { await client.messageFlagsAdd(msg.uid, ['\\Seen']); } catch {}
      }
    } finally { lock.release(); }
  } finally { await client.logout(); }
  return out;
}
