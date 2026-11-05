// Simple page logic for "Pagos de la academia": runs in the browser, no server. FAKE DATA ONLY. All money is integer cents.
var DemoLib = (() => {
  const MONTHS = ['2026-10', '2026-11', '2026-12', '2027-01'], MONTH_NAME = { '2026-10': 'octubre', '2026-11': 'noviembre', '2026-12': 'diciembre', '2027-01': 'enero' }, MONTH_CAP = { '2026-10': 'Octubre', '2026-11': 'Noviembre', '2026-12': 'Diciembre', '2027-01': 'Enero' };
  // Dad trains Tuesday, Thursday and Saturday (Flavio, 2026-11-05). One class = monthly fee / 12 (3 a week x 4 weeks); Dad can change an ajuste.
  const CLASS_DAYS = [2, 4, 6], CLASSES_PER_MONTH = 12, SHORT_MONTH = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const KEY = 'pagos-academia-simple-v1', DUE_DAY = 5, DEMO_TODAY = '2026-11-04';
  const split = c => { const s = String(c).padStart(3, '0'); return [s.slice(0, -2), s.slice(-2)]; };
  const money = c => { const [w, r] = split(c); return '$' + w.replace(/\B(?=(\d{3})+$)/g, ',') + (r === '00' ? '' : '.' + r); };
  const centsToInput = c => { const [w, r] = split(c); return w + (r === '00' ? '' : '.' + r); };
  const decimal = c => { if (!Number.isSafeInteger(c) || c < 0) throw Error('Monto no válido.'); const [w, r] = split(c); return w + '.' + r; }; // for spreadsheet numbers
  function toCents(text) {
    const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(String(text).trim().replace(',', '.'));
    if (!m) return null;
    const c = Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0') || 0);
    return c > 0 && c <= 999999999 ? c : null;
  }
  const NAMES = [['Leo','Sol'],['Mía','Sol'],['Nico','Luna'],['Alma','Luna'],['Teo','Pino'],['Lía','Pino'],['Gael','Río'],['Vera','Río'],['Ian','Nube'],['Noa','Nube'],['Luca','Roble'],['Eva','Roble'],['Hugo','Mar'],['Ada','Mar'],['Enzo','Valle'],['Inés','Valle'],['Elio','Brisa'],['Maia','Brisa'],['Dani','Prado'],['Lola','Prado'],['Axel','Monte'],['Iris','Monte'],['Bruno','Alba'],['Cleo','Alba'],['Alex','Faro'],['Sara','Faro']];
  const TEMPLATES = {
    before: 'Hola, familia {familia}. Les recordamos con cariño el pago de {mes}: {hijos}. En total son {total}. Pueden pagar por Zelle o efectivo. Si ya pagaron, ¡gracias!',
    after: 'Hola, familia {familia}. Les recordamos que el pago de {mes} todavía está pendiente: {hijos}. En total quedan {total}. Pueden pagar por Zelle o efectivo. Si ya pagaron, muchas gracias.',
  };
  function seed() {
    const kids = NAMES.map(([name, family], i) => ({ id: 'k' + (i + 1), name, family }));
    const payments = []; let n = 0;
    kids.forEach((k, i) => {
      if (i < 24) payments.push({ id: 'p' + (++n), kid: k.id, month: '2026-10', cents: 6000, method: i % 4 === 0 ? 'efectivo' : 'Zelle', date: i === 23 ? '2026-10-19' : '2026-10-0' + (i % 5 + 1) });
      if (i < 16) payments.push({ id: 'p' + (++n), kid: k.id, month: '2026-11', cents: 6000, method: i % 4 === 0 ? 'efectivo' : 'Zelle', date: '2026-11-0' + (i % 3 + 1) });
    });
    payments.push({ id: 'p' + (++n), kid: 'k17', month: '2026-11', cents: 2000, method: 'efectivo', date: '2026-11-02' });
    kids.push({ id: 'k27', name: 'Tomás', family: 'Cielo', start: '2026-11-20' }); // Dad's example: joins Nov 20 and pays the month that day
    payments.push({ id: 'p' + (++n), kid: 'k27', month: '2026-11', cents: 6000, method: 'Zelle', date: '2026-11-20' });
    return { v: 3, kids, fee: { '2026-10': 6000, '2026-11': 6000, '2026-12': 6000, '2027-01': 6000 }, payments, undone: [], next: n + 1 };
  }
  const active = (s, m, kid) => s.payments.filter(p => p.month === m && p.kid === kid);
  const paid = (s, m, kid) => active(s, m, kid).reduce((n, p) => n + p.cents, 0);
  const bounds = m => { const [y, mm] = m.split('-').map(Number); return { min: m + '-01', max: m + '-' + String(new Date(y, mm, 0).getDate()).padStart(2, '0') }; };
  const realDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d;
  const kidOf = (s, id) => s.kids.find(k => k.id === id);
  const nextMonth = m => { const [y, mm] = m.split('-').map(Number); return mm === 12 ? (y + 1) + '-01' : y + '-' + String(mm + 1).padStart(2, '0'); };
  const shortDate = d => Number(d.slice(8)) + ' ' + SHORT_MONTH[Number(d.slice(5, 7)) - 1];
  const enrolled = (s, m, id) => { const k = kidOf(s, id); return !!k && (!k.start || m >= k.start.slice(0, 7)); };
  const perClass = (s, m) => Math.round(s.fee[m] / CLASSES_PER_MONTH);
  // A kid who joins mid-month pays a full month from that day; the NEXT month they pay only the classes from that day to the month's end, so from then on everyone pays together.
  function ajuste(s, m, id) {
    const k = kidOf(s, id); if (!k || !k.start || k.start.slice(8) === '01' || m !== nextMonth(k.start.slice(0, 7))) return null;
    const b = bounds(m), day = Number(k.start.slice(8)), last = Number(b.max.slice(8)), dates = [];
    for (let d = day; d <= last; d++) { const iso = m + '-' + String(d).padStart(2, '0'); if (CLASS_DAYS.includes(new Date(iso + 'T12:00:00Z').getUTCDay())) dates.push(iso); }
    const from = day <= last ? m + '-' + String(day).padStart(2, '0') : null, counted = dates.length * perClass(s, m);
    return { from, to: b.max, dates, perClass: perClass(s, m), counted, cents: Number.isSafeInteger(k.adjust) ? k.adjust : counted, changed: Number.isSafeInteger(k.adjust) };
  }
  const feeFor = (s, m, id) => { if (!enrolled(s, m, id)) return 0; const a = ajuste(s, m, id); return a ? a.cents : s.fee[m]; };
  const balance = (s, m, kid) => { const b = feeFor(s, m, kid) - paid(s, m, kid); return b > 0 ? b : 0; };
  const kidsIn = (s, m) => s.kids.filter(k => enrolled(s, m, k.id));
  // One status for page, filters and Excel: 'none' = nothing to pay this month (a $0 ajuste), never shown as «Pagó».
  const status = (s, m, id) => feeFor(s, m, id) === 0 ? 'none' : balance(s, m, id) === 0 ? 'paid' : paid(s, m, id) > 0 ? 'partial' : 'pending';
  const STATUS_TEXT = { none: 'Nada que pagar', paid: 'Pagó', partial: 'Parcial', pending: 'Falta' };
  function summary(s, m) {
    const list = kidsIn(s, m), paidKids = list.filter(k => status(s, m, k.id) === 'paid').length, noDue = list.filter(k => status(s, m, k.id) === 'none').length;
    return { kids: list.length, paidKids, noDue, pendingKids: list.length - paidKids - noDue, collected: s.payments.filter(p => p.month === m).reduce((n, p) => n + p.cents, 0), outstanding: list.reduce((n, k) => n + balance(s, m, k.id), 0) };
  }
  const cleanName = t => String(t == null ? '' : t).trim().replace(/\s+/g, ' ');
  function addKid(s, name, family, start) {
    name = cleanName(name); family = cleanName(family).replace(/^familia\s+/i, '');
    if (!name || name.length > 40) throw Error('Escribe el nombre del alumno.');
    if (!family || family.length > 40) throw Error('Escribe el apellido de la familia.');
    if (!realDate(start) || start < bounds(MONTHS[0]).min || start > bounds(MONTHS[MONTHS.length - 1]).max) throw Error('Elige la fecha en que empezó (entre octubre y enero).');
    let n = s.kids.length + 1; while (s.kids.some(k => k.id === 'k' + n)) n++;
    const k = { id: 'k' + n, name, family, start }; s.kids.push(k); return k;
  }
  function setAjuste(s, id, cents) {
    const k = kidOf(s, id), m = k && k.start ? nextMonth(k.start.slice(0, 7)) : null, a = m && MONTHS.includes(m) ? ajuste(s, m, id) : null;
    if (!a) throw Error('Este alumno no tiene ajuste.');
    const p = paid(s, m, id), want = cents === null ? a.counted : cents;
    if (!Number.isSafeInteger(want) || want < 0 || want > s.fee[m]) throw Error('El ajuste debe ser entre $0 y la cuota (' + money(s.fee[m]) + ').');
    if (want < p) throw Error('Ya pagó ' + money(p) + ' de este ajuste; no puede ser menos.');
    if (cents === null) delete k.adjust; else k.adjust = cents; return k;
  }
  function pay(s, m, kid, cents, method, date) {
    if (!MONTHS.includes(m) || !s.kids.some(k => k.id === kid)) throw Error('Revisa el pago.');
    if (!enrolled(s, m, kid)) throw Error('En ' + MONTH_NAME[m] + ' todavía no estaba en la academia.');
    const st = kidOf(s, kid).start; if (st && st.slice(0, 7) === m && date < st) throw Error('Empezó el ' + shortDate(st) + '; la fecha del pago no puede ser antes.');
    if (method !== 'Zelle' && method !== 'efectivo') throw Error('Elige cómo te pagaron: Zelle o efectivo.');
    const b = bounds(m); if (!realDate(date) || date < b.min || date > b.max) throw Error('La fecha debe estar dentro de ' + MONTH_NAME[m] + '.');
    if (!Number.isInteger(cents) || cents <= 0) throw Error('Escribe un monto mayor que cero, por ejemplo 30 o 12.50.');
    if (cents > balance(s, m, kid)) throw Error('El monto es más de lo que falta (' + money(balance(s, m, kid)) + ').');
    const used = new Set([...s.payments, ...s.undone].map(q => q.id)); let n = Math.max(s.next, 1); while (used.has('p' + n)) n++;
    if (!Number.isSafeInteger(n + 1)) throw Error('No se pudo guardar el pago. Toca «Empezar de nuevo».'); // arithmetic safety only; unreachable in practice, and it refuses BEFORE changing anything
    s.next = n + 1;
    const p = { id: 'p' + n, kid, month: m, cents, method, date }; s.payments.push(p); return p;
  }
  function undo(s, id, reason, expect) {
    const i = s.payments.findIndex(p => p.id === id && (!expect || (p.kid === expect.kid && p.month === expect.month))); if (i < 0) throw Error('No se encontró ese pago.');
    reason = String(reason == null ? '' : reason).trim(); if (!reason || reason.length > 100) throw Error('Di por qué lo quitas.');
    const [p] = s.payments.splice(i, 1); s.undone.push({ ...p, reason, at: DEMO_TODAY }); return p;
  }
  // Each kid's own due date: the start date in the first month, the ajuste's first day the month after, otherwise the academy's day.
  const dueFor = (s, m, id) => { const k = kidOf(s, id); if (k && k.start && k.start.slice(0, 7) === m) return k.start; const a = ajuste(s, m, id); return a && a.from ? a.from : dueDate(m); };
  function groupDebtors(s, m) {
    const out = [];
    s.kids.forEach(k => { const b = balance(s, m, k.id); if (!b) return; let g = out.find(o => o.family === k.family); if (!g) { g = { family: k.family, kids: [], total: 0 }; out.push(g); } g.kids.push({ id: k.id, name: k.name, balance: b, due: dueFor(s, m, k.id) }); g.total += b; });
    return out;
  }
  const kidsText = (g, today = DEMO_TODAY) => { const t = g.kids.map(k => k.name + ' (' + money(k.balance) + (k.due ? (k.due < today ? ', venció el ' : ', vence el ') + shortDate(k.due) : '') + ')'); return t.length > 1 ? t.slice(0, -1).join(', ') + ' y ' + t[t.length - 1] : t[0]; };
  function fill(tpl, g, m, today = DEMO_TODAY, dueDay = DUE_DAY) { const v = { familia: g.family, mes: MONTH_NAME[m], dia: String(dueDay), hijos: kidsText(g, today), total: money(g.total) }; return tpl.replace(/\{(\w+)\}/g, (all, k) => (k in v ? v[k] : all)); }
  const familyGroup = (s, m, family) => groupDebtors(s, m).find(g => g.family === family) || null;
  const dueDate = m => m + '-' + String(DUE_DAY).padStart(2, '0');
  const pickTemplate = (s, m, today, g) => (g ? (g.kids.some(k => (k.due || dueDate(m)) >= today) ? TEMPLATES.before : TEMPLATES.after) : today <= dueDate(m) ? TEMPLATES.before : TEMPLATES.after);
  const whatsapp = text => 'https://wa.me/?text=' + encodeURIComponent(text);
  // ---- XLSX (standard package: shared strings, styles, docProps; STORE zip). Opens in Excel, Numbers and iOS Quick Look. ----
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zipStore(files) {
    const enc = new TextEncoder(), parts = [], cd = []; let off = 0;
    const u16 = n => [n & 255, (n >>> 8) & 255], u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
    for (const [name, text] of files) {
      const nb = enc.encode(name), data = enc.encode(text), crc = crc32(data);
      const lh = [0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nb.length), ...u16(0)];
      parts.push(Uint8Array.from(lh), nb, data);
      cd.push(Uint8Array.from([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nb.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nb);
      off += lh.length + nb.length + data.length;
    }
    const cdLen = cd.reduce((n, x) => n + x.length, 0);
    const end = Uint8Array.from([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdLen), ...u32(off), ...u16(0)]);
    const all = [...parts, ...cd, end], out = new Uint8Array(all.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of all) { out.set(x, p); p += x.length; } return out;
  }
  const esc = t => String(t).replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const colName = i => String.fromCharCode(65 + i);
  const serial = d => { const [y, m, dd] = d.split('-').map(Number); return String(Math.round((Date.UTC(y, m - 1, dd) - Date.UTC(1899, 11, 30)) / 86400000)); };
  // cell kinds: {t:'s',v:text,s:style} | {t:'n',v:'60.00',s:2} | {t:'d',v:'2026-11-02'}
  function buildXlsx(sheets) {
    const sst = [], sidx = new Map(), si = t => { if (!sidx.has(t)) { sidx.set(t, sst.length); sst.push(t); } return sidx.get(t); };
    const sheetXml = sh => {
      const rows = sh.rows.map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((c, ci) => { const ref = colName(ci) + (ri + 1);
        if (c.t === 'n') return '<c r="' + ref + '" s="' + (c.s || 0) + '"><v>' + c.v + '</v></c>';
        if (c.t === 'd') return '<c r="' + ref + '" s="3"><v>' + serial(c.v) + '</v></c>';
        return '<c r="' + ref + '" t="s"' + (c.s ? ' s="' + c.s + '"' : '') + '><v>' + si(c.v) + '</v></c>'; }).join('') + '</row>').join('');
      return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"' + (sh === sheets[0] ? ' tabSelected="1"' : '') + '><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>' + sh.widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols><sheetData>' + rows + '</sheetData></worksheet>';
    };
    const sheetFiles = sheets.map((sh, i) => ['xl/worksheets/sheet' + (i + 1) + '.xml', sheetXml(sh)]);
    const sstXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' + sst.length + '" uniqueCount="' + sst.length + '">' + sst.map(t => '<si><t xml:space="preserve">' + esc(t) + '</t></si>').join('') + '</sst>';
    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/><numFmt numFmtId="165" formatCode="d\\ mmm\\ yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF214D3D"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    const ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' + sheets.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>';
    const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>';
    const wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="20000" windowHeight="12000"/></bookViews><sheets>' + sheets.map((sh, i) => '<sheet name="' + esc(sh.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>';
    const wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId' + (sheets.length + 2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>';
    const core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Pagos de la academia (ejemplo)</dc:title><dc:creator>Mi academia</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">2026-11-04T00:00:00Z</dcterms:created></cp:coreProperties>';
    const app = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Excel</Application></Properties>';
    return zipStore([['[Content_Types].xml', ct], ['_rels/.rels', rels], ['docProps/core.xml', core], ['docProps/app.xml', app], ['xl/workbook.xml', wb], ['xl/_rels/workbook.xml.rels', wbRels], ['xl/styles.xml', styles], ...sheetFiles, ['xl/sharedStrings.xml', sstXml]]);
  }
  // One line that explains a first month or an ajuste (page and Excel use the same words).
  function note(s, m, id) {
    const k = kidOf(s, id); if (!k || !k.start) return '';
    if (k.start.slice(0, 7) === m) { if (k.start.slice(8) === '01') return 'Empezó el ' + shortDate(k.start); const nm = nextMonth(m), d = Math.min(Number(k.start.slice(8)), Number(bounds(nm).max.slice(8)) + 1) - 1; return 'Empezó el ' + shortDate(k.start) + ' · mes completo hasta el ' + (d >= 1 ? shortDate(nm + '-' + String(d).padStart(2, '0')) : 'fin de ' + MONTH_NAME[m]); }
    const a = ajuste(s, m, id); if (!a) return '';
    const base = a.dates.length ? 'Ajuste: ' + a.dates.length + (a.dates.length === 1 ? ' clase' : ' clases') + ' del ' + shortDate(a.from) + ' al ' + shortDate(a.to) + ' × ' + money(a.perClass) : 'Ajuste: no quedan clases este mes';
    return base + (a.changed ? ' · cambiado a ' + money(a.cents) : '') + ' · desde ' + MONTH_NAME[nextMonth(m)] + ' paga con todos';
  }
  const H = t => ({ t: 's', v: t, s: 1 }), T = t => ({ t: 's', v: t }), N = c => ({ t: 'n', v: decimal(c), s: 2 }), D = d => ({ t: 'd', v: d });
  function exportXlsx(s) {
    const resumen = [['Alumno', 'Familia', 'Mes', 'Cuota', 'Pagado', 'Falta', 'Estado', 'Nota'].map(H)];
    for (const m of MONTHS) for (const k of kidsIn(s, m)) { const p = paid(s, m, k.id), b = balance(s, m, k.id); resumen.push([T(k.name), T('Familia ' + k.family), T(MONTH_CAP[m]), N(feeFor(s, m, k.id)), N(p), N(b), T(STATUS_TEXT[status(s, m, k.id)]), T(note(s, m, k.id))]); }
    const pagos = [['Fecha', 'Alumno', 'Familia', 'Mes', 'Monto', 'Forma de pago'].map(H)];
    [...s.payments].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id, undefined, { numeric: true })).forEach(p => { const k = s.kids.find(x => x.id === p.kid); pagos.push([D(p.date), T(k.name), T('Familia ' + k.family), T(MONTH_CAP[p.month]), N(p.cents), T(p.method === 'efectivo' ? 'Efectivo' : 'Zelle')]); });
    const quitados = [['Fecha', 'Alumno', 'Mes', 'Monto', 'Forma de pago', 'Por qué se quitó'].map(H)];
    s.undone.forEach(p => { const k = s.kids.find(x => x.id === p.kid); quitados.push([D(p.date), T(k.name), T(MONTH_CAP[p.month]), N(p.cents), T(p.method === 'efectivo' ? 'Efectivo' : 'Zelle'), T(p.reason)]); });
    return buildXlsx([{ name: 'Resumen', rows: resumen, widths: [14, 18, 14, 12, 12, 12, 12, 44] }, { name: 'Pagos', rows: pagos, widths: [14, 14, 18, 14, 12, 16] }, { name: 'Pagos quitados', rows: quitados, widths: [14, 14, 14, 12, 16, 30] }]);
  }
  const ID = /^p\d+$/, isDate = (d, m) => realDate(d) && d >= bounds(m).min && d <= bounds(m).max;
  const payOk = (p, ids, o) => p && typeof p === 'object' && typeof p.id === 'string' && ID.test(p.id) && Number.isSafeInteger(Number(p.id.slice(1))) && !ids.has(p.id) && o.kids.some(k => k.id === p.kid) && MONTHS.includes(p.month) && Number.isSafeInteger(p.cents) && p.cents > 0 && p.cents <= o.fee[p.month] && enrolled(o, p.month, p.kid) && (!kidOf(o, p.kid).start || kidOf(o, p.kid).start.slice(0, 7) !== p.month || p.date >= kidOf(o, p.kid).start) && (p.method === 'Zelle' || p.method === 'efectivo') && typeof p.date === 'string' && isDate(p.date, p.month);
  // One strict validator for the whole saved object; any mismatch means «use the seed».
  function valid(s) {
    try {
      const o = seed(); if (!s || typeof s !== 'object' || s.v !== 3 || !Array.isArray(s.kids) || s.kids.length < o.kids.length) return false;
      const seen = new Set();
      for (let i = 0; i < s.kids.length; i++) {
        const k = s.kids[i], base = o.kids[i]; if (!k || typeof k !== 'object' || Array.isArray(k)) return false;
        const keys = Object.keys(k).filter(x => x !== 'adjust').sort().join();
        if (base) { if (JSON.stringify({ ...k, adjust: undefined }) !== JSON.stringify({ ...base, adjust: undefined })) return false; }
        else if (keys !== 'family,id,name,start' || !/^k\d+$/.test(k.id) || !Number.isSafeInteger(Number(k.id.slice(1))) || typeof k.name !== 'string' || k.name !== cleanName(k.name) || !k.name || k.name.length > 40 || typeof k.family !== 'string' || k.family !== cleanName(k.family) || !k.family || k.family.length > 40 || typeof k.start !== 'string' || !realDate(k.start) || k.start < bounds(MONTHS[0]).min || k.start > bounds(MONTHS[MONTHS.length - 1]).max) return false;
        if (seen.has(k.id)) return false; seen.add(k.id);
        if ('adjust' in k) { const m = k.start ? nextMonth(k.start.slice(0, 7)) : null; if (!m || !MONTHS.includes(m) || !ajuste({ ...o, kids: [{ ...k, adjust: undefined }] }, m, k.id) || !Number.isSafeInteger(k.adjust) || k.adjust < 0 || k.adjust > o.fee[m]) return false; }
      }
      o.kids = s.kids; // payments are checked against the saved kid list (start dates, ajustes)
      if (!s.fee || !MONTHS.every(m => s.fee[m] === o.fee[m]) || Object.keys(s.fee).length !== MONTHS.length) return false; // no fee editor in the demo
      if (!Array.isArray(s.payments) || !Array.isArray(s.undone)) return false;
      const ids = new Set();
      for (const p of s.payments) { if (!payOk(p, ids, o)) return false; ids.add(p.id); }
      for (const p of s.undone) { if (!payOk(p, ids, o) || typeof p.reason !== 'string' || !p.reason.trim() || p.reason !== p.reason.trim() || p.reason.length > 100 || typeof p.at !== 'string' || !realDate(p.at)) return false; ids.add(p.id); }
      for (const m of MONTHS) for (const k of s.kids) if (paid(s, m, k.id) > feeFor(s, m, k.id)) return false;
      const top = Math.max(0, ...[...ids].map(i => Number(i.slice(1))));
      return Number.isSafeInteger(s.next) && s.next > top;
    } catch { return false; }
  }
  // Saved copies from the first published version (v2: Oct–Nov, no Tomás) are carried over, never dropped.
  function migrateV2(old) {
    if (!old || typeof old !== 'object' || old.v !== 2 || !Array.isArray(old.kids) || !Array.isArray(old.payments) || !Array.isArray(old.undone)) return null;
    const o = seed(), base = o.kids.filter(k => !k.start);
    if (JSON.stringify(old.kids) !== JSON.stringify(base) || JSON.stringify(old.fee) !== JSON.stringify({ '2026-10': 6000, '2026-11': 6000 })) return null;
    if (![...old.payments, ...old.undone].every(p => p && typeof p === 'object' && typeof p.id === 'string' && (p.month === '2026-10' || p.month === '2026-11'))) return null;
    const ids = new Set([...old.payments, ...old.undone].map(p => p.id)); let n = Number.isSafeInteger(old.next) ? old.next : 1; while (ids.has('p' + n)) n++;
    const ex = o.payments.find(p => p.kid === 'k27');
    return { v: 3, kids: o.kids, fee: o.fee, payments: [...old.payments, { ...ex, id: 'p' + n }], undone: old.undone, next: n + 1 };
  }
  // status: 'empty' (nothing saved) | 'ok' | 'migrated' | 'unreadable' (raw is returned so the page can keep it aside).
  function restore(raw) {
    if (raw == null) return { status: 'empty', state: seed() };
    let s; try { s = JSON.parse(raw); } catch { return { status: 'unreadable', raw, state: seed() }; }
    if (valid(s)) return { status: 'ok', state: s };
    let m = null; try { m = migrateV2(s); } catch { m = null; }
    if (m && valid(m)) return { status: 'migrated', state: m };
    return { status: 'unreadable', raw, state: seed() };
  }
  const demoToday = (real = new Date()) => { const d = real.getFullYear() + '-' + String(real.getMonth() + 1).padStart(2, '0') + '-' + String(real.getDate()).padStart(2, '0'); return d >= '2026-11-01' && d <= '2026-11-30' ? d : DEMO_TODAY; };
  return { restore, status, STATUS_TEXT, dueFor, CLASS_DAYS, perClass, ajuste, feeFor, enrolled, kidsIn, addKid, setAjuste, note, shortDate, nextMonth, familyGroup, dueDate, pickTemplate, MONTHS, MONTH_NAME, MONTH_CAP, KEY, DUE_DAY, DEMO_TODAY, TEMPLATES, money, centsToInput, toCents, seed, balance, paid, active, summary, bounds, pay, undo, groupDebtors, fill, whatsapp, exportXlsx, buildXlsx, valid, demoToday, zipStore, crc32, kidsText };
})();
if (typeof module !== 'undefined') module.exports = DemoLib;
