#!/usr/bin/env node
/**
 * TREVIS — Daily Owner Intelligence Report
 *
 * Reads the portfolio through the SAME coverage engine the app uses (so the
 * numbers match the dashboard exactly), builds an email + a WhatsApp summary,
 * and sends the email via Resend. Designed to run on a schedule (GitHub Action),
 * NOT inside the Netlify-deployed app — so iterating on it costs zero deploys.
 *
 * USAGE:
 *   node scripts/daily_owner_report.mjs --dry-run   # build + print, send nothing
 *   node scripts/daily_owner_report.mjs             # build + send the email
 *
 * ENV:
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY   (read portfolio; service key bypasses RLS)
 *   RESEND_API_KEY                       (email; from https://resend.com — free tier)
 *   REPORT_TO_EMAIL                      (owner's email, e.g. tfrsuperfx@gmail.com)
 *   REPORT_FROM_EMAIL                    (verified sender, default onboarding@resend.dev)
 *   OWNER_WHATSAPP                       (optional, e.g. 263771234567 — for the click-to-send link)
 */

import { createClient } from '@supabase/supabase-js';
import { classifyStudent } from '../src/services/statusClassifier.js';
import { buildAttentionList, buildFinanceRecords } from '../src/services/dashboardAttention.js';

const DRY = process.argv.includes('--dry-run');

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) { console.error('ERROR: set SUPABASE_URL and SUPABASE_SERVICE_KEY.'); process.exit(1); }
const supabase = createClient(url, key);

const money = (n) => `$${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US')}`;
const todayLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** Gather all report metrics from the portfolio. Pure-ish (reads DB, no sending). */
async function gatherMetrics() {
  // Coverage rows (same query the app's store uses).
  const { data: students, error } = await supabase
    .from('students')
    .select('id, full_name, status, coverage_start, coverage_end, daily_rate, next_due_date, rooms(rent_per_bed, room_number, properties(name))')
    .neq('status', 'VACATED');
  if (error) throw new Error(`fetch students: ${error.message}`);

  // Beds (occupancy) from rooms.
  const { data: rooms } = await supabase.from('rooms').select('bed_capacity, rent_per_bed');
  const totalBeds = (rooms || []).reduce((a, r) => a + (Number(r.bed_capacity) || 0), 0);

  const active = students.filter((s) => s.status === 'ACTIVE');
  const finance = buildFinanceRecords(students);          // every ACTIVE student, coverage-classified
  const attention = buildAttentionList(students);          // OVERDUE / DUE_TODAY / EXPIRING_SOON

  const overdue = attention.filter((r) => r.coverageStatus === 'OVERDUE' || r.coverageStatus === 'DUE_TODAY')
    .sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
  const expiring = attention.filter((r) => r.coverageStatus === 'EXPIRING_SOON')
    .sort((a, b) => (a.daysRemaining || 0) - (b.daysRemaining || 0));

  const outstanding = finance.reduce((a, r) => a + (r.outstanding || 0), 0);
  // $/day still accruing = sum of daily_rate for currently-overdue students.
  const accruingPerDay = overdue.reduce((a, r) => a + (Number(r.dailyRate) || 0), 0);
  const monthlyExpected = active.reduce((a, s) => a + (Number(s.rooms?.rent_per_bed) || 0), 0);

  return {
    activeCount: active.length,
    occupiedBeds: active.length,
    totalBeds,
    vacantBeds: Math.max(0, totalBeds - active.length),
    monthlyExpected,
    outstanding,
    accruingPerDay,
    overdue,
    expiring,
  };
}

// Emoji as explicit Unicode escapes — encoding-proof across PowerShell -> Node ->
// HTTP -> WhatsApp/email (raw emoji literals were arriving as replacement chars).
const E = {
  house: '\u{1F3E0}', people: '\u{1F465}', bed: '\u{1F6CF}',
  money: '\u{1F4B0}', chart: '\u{1F4C8}', red: '\u{1F534}', orange: '\u{1F7E0}',
  whatsapp: '\u{1F4AC}', bullet: '•',
};

/** Plain-text WhatsApp-style summary (short). */
function buildWhatsAppText(m) {
  const occ = m.totalBeds ? ` (${Math.round((m.occupiedBeds / m.totalBeds) * 100)}%)` : '';
  const lines = [
    `${E.house} *TREVIS Daily Report*`,
    `_${todayLabel}_`,
    '',
    `${E.people} Active: ${m.activeCount}`,
    `${E.bed} Occupancy: ${m.occupiedBeds}/${m.totalBeds}${occ}`,
    '',
    `${E.money} Outstanding: ${money(m.outstanding)}`,
    `${E.chart} Accruing: ${money(m.accruingPerDay)}/day`,
    '',
    `${E.red} Overdue: ${m.overdue.length}`,
    `${E.orange} Expiring <=7d: ${m.expiring.length}`,
  ];
  if (m.overdue.length) {
    lines.push('', '*Top priorities:*');
    m.overdue.slice(0, 5).forEach((r) =>
      lines.push(`${E.bullet} ${r.name} (${money(r.outstanding)}, ${r.daysOverdue}d overdue)`));
  }
  lines.push('', 'Open TREVIS for full details.');
  return lines.join('\n');
}

/** HTML email body. waText = the WhatsApp summary, for the click-to-send button. */
function buildEmailHtml(m, waText) {
  const row = (r, extra) =>
    `<tr><td style="padding:4px 10px">${r.name}</td><td style="padding:4px 10px;color:#666">${r.property} · ${r.room}</td><td style="padding:4px 10px;text-align:right">${extra}</td></tr>`;
  const section = (title, color, rows) =>
    rows.length
      ? `<h3 style="color:${color};margin:18px 0 6px">${title} (${rows.length})</h3>
         <table style="width:100%;border-collapse:collapse;font-size:13px">${rows.map((r) =>
           row(r, r.coverageStatus === 'EXPIRING_SOON'
             ? `${r.daysRemaining}d left · ends ${r.coverageEnd}`
             : `${money(r.outstanding)} · ${r.daysOverdue}d overdue`)).join('')}</table>`
      : '';
  const occPct = m.totalBeds ? Math.round((m.occupiedBeds / m.totalBeds) * 100) : 0;

  // Click-to-send WhatsApp button. Opens WhatsApp with the summary pre-filled to
  // the owner's own number (OWNER_WHATSAPP); without a number, a generic share
  // link that lets you pick any chat. One tap -> WhatsApp opens -> press send.
  const phone = process.env.OWNER_WHATSAPP;
  const waUrl = (phone ? `https://wa.me/${phone}` : 'https://wa.me/') + '?text=' + encodeURIComponent(waText || '');
  const waButton = `
    <div style="margin:18px 0">
      <a href="${waUrl}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;
         font-weight:700;font-size:14px;padding:11px 20px;border-radius:8px">
        ${E.whatsapp} Send this summary on WhatsApp
      </a>
      <div style="color:#aaa;font-size:11px;margin-top:6px">Opens WhatsApp with the summary pre-filled — just press send.</div>
    </div>`;

  return `
  <meta charset="utf-8">
  <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#222">
    <h2 style="margin:0">TREVIS Daily Portfolio Report</h2>
    <div style="color:#888;margin-bottom:16px">${todayLabel}</div>
    ${waButton}

    <h3 style="margin:14px 0 6px">Portfolio Health</h3>
    <table style="font-size:14px">
      <tr><td>Active Students</td><td style="padding-left:24px"><b>${m.activeCount}</b></td></tr>
      <tr><td>Occupancy</td><td style="padding-left:24px"><b>${m.occupiedBeds}/${m.totalBeds}</b> (${occPct}%) · ${m.vacantBeds} vacant</td></tr>
      <tr><td>Monthly Expected</td><td style="padding-left:24px"><b>${money(m.monthlyExpected)}</b></td></tr>
      <tr><td>Outstanding now</td><td style="padding-left:24px;color:#c00"><b>${money(m.outstanding)}</b></td></tr>
      <tr><td>Accruing</td><td style="padding-left:24px"><b>${money(m.accruingPerDay)}/day</b></td></tr>
    </table>

    ${section(`${E.red} Overdue`, '#c00', m.overdue)}
    ${section(`${E.orange} Expiring within 7 days`, '#d98000', m.expiring)}

    <p style="color:#aaa;font-size:11px;margin-top:24px;border-top:1px solid #eee;padding-top:8px">
      Generated automatically by TREVIS · coverage figures match the in-app dashboard.
    </p>
  </div>`;
}

async function sendEmail(html) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_TO_EMAIL;
  const from = process.env.REPORT_FROM_EMAIL || 'TREVIS <onboarding@resend.dev>';
  // Optional CC (delivery canary / backup): set REPORT_CC_EMAIL to also copy
  // someone (e.g. the developer) so a failed primary delivery is still visible.
  const cc = process.env.REPORT_CC_EMAIL;
  if (!apiKey || !to) { console.error('Skip email: set RESEND_API_KEY and REPORT_TO_EMAIL.'); return false; }

  const payload = { from, to: [to], subject: `TREVIS Daily Report — ${todayLabel}`, html };
  if (cc) payload.cc = [cc];

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { console.error('Email failed:', res.status, await res.text()); return false; }
  console.log('✅ Email sent to', to, cc ? `(cc ${cc})` : '');
  return true;
}

async function main() {
  const m = await gatherMetrics();
  const wa = buildWhatsAppText(m);
  const html = buildEmailHtml(m, wa);

  console.log('\n=== WhatsApp summary ===\n' + wa + '\n');
  const phone = process.env.OWNER_WHATSAPP;
  if (phone) console.log('Click-to-send WhatsApp:\n  https://wa.me/' + phone + '?text=' + encodeURIComponent(wa) + '\n');

  if (DRY) { console.log('(--dry-run: email NOT sent)'); return; }
  await sendEmail(html);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
