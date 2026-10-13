/* MedImpact Global – web admin (vanilla JS, no innerHTML with data → XSS-safe by construction) */
(function () {
  'use strict';

  /* ---------- tiny DOM helper ---------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach((c) => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c)); });
    return el;
  }
  const $root = document.getElementById('root');
  const toastEl = document.getElementById('toast');
  let toastT;
  function toast(msg, bad) {
    toastEl.textContent = msg; toastEl.className = 'show' + (bad ? ' bad' : '');
    clearTimeout(toastT); toastT = setTimeout(() => (toastEl.className = ''), 3200);
  }

  /* ---------- API ---------- */
  async function api(method, url, body) {
    const opt = { method, headers: { 'X-Requested-With': 'fetch' }, credentials: 'same-origin' };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    const res = await fetch('/api/admin' + url, opt);
    const json = await res.json().catch(() => ({}));
    if (res.status === 401 && !url.startsWith('/auth/login')) { showLogin(); throw new Error('Please sign in'); }
    if (!res.ok) throw new Error(json.error || 'Request failed');
    return json;
  }
  async function upload(file) {
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd, headers: { 'X-Requested-With': 'fetch' }, credentials: 'same-origin' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Upload failed');
    return json.url;
  }

  function uploadVideo(file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/admin/upload-video');
      xhr.setRequestHeader('X-Requested-With', 'fetch');
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => {
        let j = {}; try { j = JSON.parse(xhr.responseText); } catch (e) {}
        if (xhr.status >= 200 && xhr.status < 300) resolve(j.url); else reject(new Error(j.error || 'Upload failed'));
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      const fd = new FormData(); fd.append('file', file); xhr.send(fd);
    });
  }

  /* ---------- Field system ----------
   * field = { key, label, type: text|textarea|number|image|select|checkbox|strings|objects, fields?, options?, hint? }
   * makeField(field, value) → { el, get() }                                                          */
  function makeField(f, value) {
    const wrap = h('div', { class: 'field' });
    const lbl = () => h('label', { class: 'lbl mono' }, f.label);
    let get;

    if (f.type === 'checkbox') {
      const cb = h('input', { type: 'checkbox' }); cb.checked = value !== false && value !== undefined ? !!value : f.default !== false;
      wrap.append(h('label', { style: 'display:flex;gap:8px;align-items:center;cursor:pointer' }, cb, f.label));
      get = () => cb.checked;
    } else if (f.type === 'textarea') {
      const t = h('textarea', { rows: f.rows || 4 }); t.value = value || '';
      wrap.append(lbl(), t); get = () => t.value;
    } else if (f.type === 'number') {
      const n = h('input', { type: 'number' }); n.value = value == null ? '' : value;
      wrap.append(lbl(), n); get = () => (n.value === '' ? undefined : Number(n.value));
    } else if (f.type === 'select') {
      const s = h('select', {}, f.options.map((o) => h('option', { value: o }, o))); s.value = value || f.options[0];
      wrap.append(lbl(), s); get = () => s.value;
    } else if (f.type === 'image') {
      const url = h('input', { type: 'text', placeholder: 'https://… or upload a file' }); url.value = value || '';
      const prev = h('img', { class: 'prev', alt: '' });
      const sync = () => { prev.style.visibility = url.value ? 'visible' : 'hidden'; prev.src = url.value || ''; };
      url.addEventListener('input', sync); sync();
      const file = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
      const btn = h('button', { type: 'button', class: 'btn sm', onclick: () => file.click() }, 'Upload image');
      file.addEventListener('change', async () => {
        if (!file.files[0]) return;
        btn.disabled = true; btn.textContent = 'Uploading…';
        try { url.value = await upload(file.files[0]); sync(); toast('Image uploaded'); } catch (e) { toast(e.message, true); }
        btn.disabled = false; btn.textContent = 'Upload image'; file.value = '';
      });
      wrap.append(lbl(), h('div', { class: 'imgf' }, prev, h('div', { class: 'ctl' }, url, h('div', {}, btn, file))));
      get = () => url.value.trim();
    } else if (f.type === 'video') {
      const url = h('input', { type: 'text', placeholder: 'Upload a clip (MP4/WEBM/MOV) or leave empty' }); url.value = value || '';
      const status = h('div', { class: 'hint' });
      const prev = h('video', { controls: true, preload: 'metadata', style: 'width:180px;max-height:110px;border-radius:6px;background:#000;display:none' });
      const sync = () => { prev.style.display = url.value ? 'block' : 'none'; prev.src = url.value || ''; };
      url.addEventListener('input', sync); sync();
      const file = h('input', { type: 'file', accept: 'video/mp4,video/webm,video/quicktime,video/ogg', style: 'display:none' });
      const btn = h('button', { type: 'button', class: 'btn sm', onclick: () => file.click() }, 'Upload video');
      const clear = h('button', { type: 'button', class: 'btn sm danger', onclick: () => { url.value = ''; sync(); status.textContent = ''; } }, 'Remove');
      file.addEventListener('change', async () => {
        if (!file.files[0]) return;
        btn.disabled = true; clear.disabled = true;
        try {
          url.value = await uploadVideo(file.files[0], (n) => { status.textContent = 'Uploading… ' + n + '%'; });
          status.textContent = 'Upload complete'; sync(); toast('Video uploaded');
        } catch (e) { status.textContent = ''; toast(e.message, true); }
        btn.disabled = false; clear.disabled = false; file.value = '';
      });
      wrap.append(lbl(), h('div', { class: 'imgf' }, prev, h('div', { class: 'ctl' }, url, h('div', { style: 'display:flex;gap:6px' }, btn, clear, file), status)));
      get = () => url.value.trim();
    } else if (f.type === 'strings') {
      const list = h('div'); const items = [];
      const add = (v = '') => {
        const inp = h('input', { type: 'text' }); inp.value = v;
        const row = h('div', { class: 'item' }, inp, h('button', { type: 'button', class: 'btn sm danger', onclick: () => { row.remove(); items.splice(items.indexOf(inp), 1); } }, '✕'));
        items.push(inp); list.append(row);
      };
      (value || []).forEach(add);
      wrap.append(lbl(), h('div', { class: 'rep' }, list, h('button', { type: 'button', class: 'btn sm', onclick: () => add() }, '+ Add')));
      get = () => items.map((i) => i.value.trim()).filter(Boolean);
    } else if (f.type === 'objects') {
      const list = h('div'); const rows = [];
      const add = (v = {}) => {
        const subs = f.fields.map((sf) => makeField(sf, v[sf.key]));
        const row = h('div', { class: 'item' }, h('div', {}, subs.map((s) => s.el)),
          h('button', { type: 'button', class: 'btn sm danger', onclick: () => { row.remove(); rows.splice(rows.indexOf(entry), 1); } }, '✕'));
        const entry = { subs };
        rows.push(entry); list.append(row);
      };
      (value || []).forEach(add);
      wrap.append(lbl(), h('div', { class: 'rep' }, list, h('button', { type: 'button', class: 'btn sm', onclick: () => add() }, '+ Add')));
      get = () => rows.map((r) => Object.fromEntries(f.fields.map((sf, i) => [sf.key, r.subs[i].get()])));
    } else {
      const i = h('input', { type: 'text' }); i.value = value || '';
      wrap.append(lbl(), i); get = () => i.value.trim();
    }
    if (f.hint) wrap.append(h('div', { class: 'hint' }, f.hint));
    return { el: wrap, get };
  }

  function makeForm(fields, data) {
    const parts = fields.map((f) => ({ f, ...makeField(f, data[f.key]) }));
    // conditional fields: { showWhen: { key: 'type', in: ['video'] } }
    parts.forEach((p) => {
      if (!p.f.showWhen) return;
      const ctl = parts.find((q) => q.f.key === p.f.showWhen.key);
      const upd = () => { p.el.style.display = p.f.showWhen.in.includes(ctl.get()) ? '' : 'none'; };
      ctl.el.addEventListener('change', upd); upd();
    });
    return {
      el: h('div', {}, parts.map((p) => p.el)),
      get() { const o = {}; parts.forEach((p) => { const v = p.get(); if (v !== undefined) o[p.f.key] = v; }); return o; },
    };
  }

  /* ---------- Collections config ---------- */
  const T = (key, label, extra) => ({ key, label, type: 'text', ...extra });
  const TA = (key, label, extra) => ({ key, label, type: 'textarea', ...extra });
  const IMG = (key, label) => ({ key, label, type: 'image' });
  const COMMON = [{ key: 'order', label: 'Display order (lower = first)', type: 'number' }, { key: 'published', label: 'Published (visible on the website)', type: 'checkbox' }];

  const COLLECTIONS = {
    events: { title: 'Events & Highlights', singular: 'event', cols: ['title', 'type', 'category', 'date'], thumb: 'image',
      fields: [
        T('title', 'Title'),
        { key: 'type', label: 'Event type', type: 'select', options: ['photo', 'video', 'live'], hint: 'photo = one or more photos · video = an uploaded clip or a YouTube/Vimeo/Facebook link · live = a live-stream' },
        T('category', 'Filter category', { hint: 'Events with the same category appear under one filter button.' }),
        IMG('image', 'Cover photo (also the poster for videos / live streams)'),
        { key: 'gallery', label: 'Extra photos (visitors can flip through them when they click the cover)', type: 'objects', fields: [IMG('url', 'Photo')], showWhen: { key: 'type', in: ['photo'] } },
        { key: 'videoFile', label: 'Upload a video clip', type: 'video', showWhen: { key: 'type', in: ['video'] }, hint: 'MP4 recommended (H.264), up to 150 MB. For longer videos paste a YouTube/Vimeo link below instead.' },
        T('videoUrl', '…or paste a video link (YouTube, Vimeo, Facebook)', { showWhen: { key: 'type', in: ['video'] }, hint: 'Used when no clip is uploaded.' }),
        T('liveUrl', 'Live-stream link', { showWhen: { key: 'type', in: ['live'] }, hint: 'Start the stream on YouTube Live, Facebook Live or Vimeo, then paste its link (e.g. https://www.youtube.com/live/xxxx or the Facebook video link). It plays inside the page.' }),
        { key: 'liveStatus', label: 'Live status', type: 'select', options: ['upcoming', 'live', 'ended'], showWhen: { key: 'type', in: ['live'] }, hint: '"live" shows a pulsing LIVE NOW badge and moves the card first. Set to "ended" afterwards to show REPLAY.' },
        T('tag', 'Image tag (e.g. TRAILER 01)'), T('duration', 'Duration badge (e.g. 03:45 MIN)'), T('series', 'Series / programme'), T('date', 'Date label'),
        TA('description', 'Description'), T('ctaLabel', 'Button label', { hint: 'Optional. Defaults to "Watch Video", "Watch Live" or "View Photos".' }), T('ctaUrl', 'Button link URL', { hint: 'Optional. If empty the button opens the photo/video/live player.' }), T('stage', 'Stage / venue label'), ...COMMON] },
    values: { title: 'Core Values', singular: 'value', cols: ['title', 'description'],
      fields: [T('title', 'Title'), TA('description', 'Description'), ...COMMON] },
    services: { title: 'What We Do (Disciplines)', singular: 'discipline', cols: ['title', 'label'],
      fields: [T('title', 'Title'), T('label', 'Label (e.g. 01 // CINEMA & EPISODIC)'), T('icon', 'Icon name', { hint: 'Any Google Material Symbols name, e.g. movie, cardiology, groups_3. Browse fonts.google.com/icons' }), TA('description', 'Description'), T('footerTag', 'Footer tag'), ...COMMON] },
    pillars: { title: 'Key Impact Pillars', singular: 'pillar', cols: ['title', 'icon'],
      fields: [T('title', 'Title'), T('icon', 'Icon name (Material Symbols)'), TA('description', 'Description'), ...COMMON] },
    approach: { title: 'Production Approach (Stages)', singular: 'stage', cols: ['stageLabel', 'title'],
      fields: [T('stageLabel', 'Stage label (e.g. STAGE 01)'), T('title', 'Title'), TA('description', 'Description'), T('footerTag', 'Footer tag'), ...COMMON] },
    why: { title: 'Why Work With Us', singular: 'reason', cols: ['title', 'description'],
      fields: [T('title', 'Title'), TA('description', 'Description'), ...COMMON] },
    team: { title: 'Board of Directors', singular: 'board member', cols: ['name', 'role', 'boardId'], thumb: 'image',
      fields: [T('name', 'Full name'), T('badge', 'Photo badge (e.g. CHAIRPERSON)'), T('role', 'Role / title'), T('profession', 'Profession'), TA('message', 'Leadership message'), T('boardId', 'Board ID (e.g. MIG-BOD-01)'), IMG('image', 'Photo'), ...COMMON] },
    crew: { title: 'Cast & Crew Directory', singular: 'crew member', cols: ['name', 'stageName', 'role', 'memberId'], thumb: 'image',
      fields: [IMG('image', 'Photo'), T('name', 'Full name (e.g. Betty Cynthia Chebet)'), T('profession', 'Profession / credential (e.g. RN)'), T('stageName', 'Stage name (e.g. Cyndy)'), T('role', 'Role (e.g. Scrub Nurse)'), T('memberId', 'Membership No (e.g. MIG/2026/013)'), ...COMMON] },
    media: { title: 'Media Gallery', singular: 'media item', cols: ['caption', 'label', 'type'], thumb: 'image',
      fields: [T('caption', 'Caption'), T('label', 'Label'), { key: 'type', label: 'Type', type: 'select', options: ['image', 'video'] }, IMG('image', 'Image (or video poster)'), T('videoUrl', 'Video embed URL', { hint: 'Only for type "video". Must be an embed link: https://www.youtube.com/embed/… or https://player.vimeo.com/video/…' }), ...COMMON] },
  };

  /* Site-wide text, grouped like the page */
  const S = (label, key, fields) => ({ label, key, fields });
  const SETTINGS = [
    S('Brand', 'brand', [IMG('logo', 'Company logo'), T('name', 'Brand name'), T('tagline', 'Header tagline'), T('footerTagline', 'Footer tagline')]),
    S('SEO', 'seo', [T('title', 'Browser / search title'), TA('description', 'Search description', { rows: 3 })]),
    S('Hero', 'hero', [T('pipelineTag', 'Top pill text'), T('eyebrow', 'Eyebrow line'), T('titleLine1', 'Headline – line 1'), T('titleLine2', 'Headline – line 2 (gradient)'), TA('text', 'Intro paragraph'), T('primaryCta', 'Primary button'), T('secondaryCta', 'Secondary button'), IMG('image', 'Main background image (used if no slideshow photos are added)'),
      { key: 'slides', label: 'Background slideshow photos (fade & zoom animation, in order)', type: 'objects', fields: [IMG('url', 'Photo')] },
      { key: 'stats', label: 'Stat tiles', type: 'objects', fields: [T('label', 'Label'), T('value', 'Value'), T('text', 'Caption')] }]),
    S('Events header', 'events', [T('index', 'Index tag'), T('title', 'Title'), TA('subtitle', 'Subtitle', { rows: 2 })]),
    S('About', 'about', [T('index', 'Index tag'), T('title', 'Title'), T('whoTitle', 'Who we are – title'), TA('whoText', 'Who we are – text'), T('badge', 'Registered badge'), T('visionTitle', 'Vision – title'), TA('visionText', 'Vision – text', { rows: 3 }), T('missionTitle', 'Mission – title'), TA('missionText', 'Mission – text', { rows: 3 }), T('valuesTitle', 'Values heading'), T('valuesIndex', 'Values tag')]),
    S('Disciplines header', 'services', [T('index', 'Index tag'), T('title', 'Title'), TA('subtitle', 'Subtitle', { rows: 2 })]),
    S('Flagship', 'flagship', [T('index', 'Index tag'), T('title', 'Section title'), T('subtitle', 'Subtitle'), T('status', 'Status pill'), T('name', 'Production name'), TA('synopsis', 'Synopsis'), T('primaryCta', 'Primary button'), T('secondaryCta', 'Secondary button'), IMG('image', 'Poster / still'), T('cameraLabel', 'Camera label'), T('pipelineLabel', 'Pipeline badge'), T('pillarsIndex', 'Pillars tag'), T('pillarsTitle', 'Pillars title'), T('approachIndex', 'Approach tag'), T('approachTitle', 'Approach title'), T('whyIndex', 'Why tag'), T('whyTitle', 'Why title')]),
    S('Team headings', 'team', [T('index', 'Index tag'), T('title', 'Title'), TA('subtitle', 'Subtitle', { rows: 2 }), T('crewIndex', 'Crew tag'), T('crewTitle', 'Crew title'), TA('crewSubtitle', 'Crew subtitle', { rows: 2 }), T('crewTotal', 'Crew total label'), T('careersTitle', 'Careers banner – title'), TA('careersText', 'Careers banner – text', { rows: 2 }), T('careersCta', 'Careers button')]),
    S('Media header', 'media', [T('index', 'Index tag'), T('title', 'Title'), TA('subtitle', 'Subtitle', { rows: 2 }), T('badge', 'Badge')]),
    S('Contact & footer', 'contact', [T('index', 'Index tag'), T('title', 'Title'), T('subtitle', 'Subtitle'), T('hqLabel', 'HQ label'), T('hqTitle', 'HQ title'), TA('hqText', 'HQ text', { rows: 2 }), T('email', 'Contact email (shown on the website)'), T('notifyEmail', 'Send contact-form messages to this email', { hint: 'Every submission is emailed here. Needs SMTP settings in the server .env (see README).' }), T('phones', 'Phone numbers'), T('address', 'Address'), T('postal', 'Postal address'),
      T('whatsapp', 'WhatsApp number (digits, with country code)', { hint: 'e.g. 254794090286' }), T('whatsappText', 'WhatsApp pre-filled message'), T('quote', 'Quote'), T('formTitle', 'Form heading'), { key: 'categories', label: 'Form: partnership categories', type: 'strings' }, T('privacyNote', 'Privacy note under the form'),
      { key: 'socials', label: 'Social links (leave URL blank to show as plain text)', type: 'objects', fields: [T('name', 'Network'), T('url', 'URL')] }]),
    S('Footer', 'footer', [TA('copyright', 'Copyright line', { rows: 2 }), T('note', 'Right-hand note'), T('status', 'Status label')]),
  ];

  /* ---------- Views ---------- */
  let navState = { view: 'dashboard' };
  let unread = 0;

  function showLogin(msg) {
    $root.replaceChildren();
    const email = h('input', { type: 'email', required: true, autocomplete: 'username', placeholder: 'admin@example.com' });
    const pw = h('input', { type: 'password', required: true, autocomplete: 'current-password' });
    const err = h('div', { class: 'err', style: 'display:none' });
    const btn = h('button', { class: 'btn primary', style: 'width:100%;justify-content:center;padding:11px' }, 'Sign in');
    const form = h('form', {
      onsubmit: async (e) => {
        e.preventDefault(); btn.disabled = true; err.style.display = 'none';
        try { await api('POST', '/auth/login', { email: email.value, password: pw.value }); boot(); }
        catch (ex) { err.textContent = ex.message; err.style.display = 'block'; btn.disabled = false; }
      },
    }, err, h('div', { class: 'field' }, h('label', { class: 'lbl mono' }, 'Email'), email), h('div', { class: 'field' }, h('label', { class: 'lbl mono' }, 'Password'), pw), btn,
      h('div', { style: 'text-align:center;margin-top:14px' }, h('a', { href: '#', style: 'color:#0284c7;font-size:14px', onclick: (e) => { e.preventDefault(); showForgot(email.value); } }, 'Forgot your password?')));
    $root.append(h('div', { class: 'login' }, h('div', { class: 'box' }, h('div', { class: 'mono', style: 'color:#0284c7' }, '// Admin console'), h('h1', {}, 'MedImpact Global'), h('div', { class: 'sub' }, msg || 'Sign in to manage the website.'), form)));
    email.focus();
  }

  function authBox(title, sub, ...kids) {
    $root.replaceChildren(h('div', { class: 'login' }, h('div', { class: 'box' },
      h('div', { class: 'mono', style: 'color:#0284c7' }, '// Admin console'), h('h1', {}, title), h('div', { class: 'sub' }, sub), ...kids)));
  }

  function showForgot(prefill) {
    const email = h('input', { type: 'email', required: true, autocomplete: 'username', placeholder: 'the email on your admin profile' }); email.value = prefill || '';
    const msg = h('div', { class: 'err', style: 'display:none' });
    const btn = h('button', { class: 'btn primary', style: 'width:100%;justify-content:center;padding:11px' }, 'Email me a reset link');
    const form = h('form', {
      onsubmit: async (e) => {
        e.preventDefault(); btn.disabled = true; msg.style.display = 'none';
        try {
          const r = await api('POST', '/auth/forgot', { email: email.value });
          msg.style.cssText = 'display:block;background:#d1fadf;color:#05603a'; msg.textContent = r.message;
        } catch (ex) { msg.style.cssText = 'display:block'; msg.textContent = ex.message; btn.disabled = false; }
      },
    }, msg, h('div', { class: 'field' }, h('label', { class: 'lbl mono' }, 'Admin email'), email), btn,
      h('div', { style: 'text-align:center;margin-top:14px' }, h('a', { href: '#', style: 'color:#0284c7;font-size:14px', onclick: (e) => { e.preventDefault(); showLogin(); } }, '← Back to sign in')));
    authBox('Reset password', 'We will email a secure link (valid for 1 hour) to the address saved on your admin profile.', form);
    email.focus();
  }

  function showReset(token) {
    const pw = h('input', { type: 'password', required: true, autocomplete: 'new-password' });
    const pw2 = h('input', { type: 'password', required: true, autocomplete: 'new-password' });
    const err = h('div', { class: 'err', style: 'display:none' });
    const btn = h('button', { class: 'btn primary', style: 'width:100%;justify-content:center;padding:11px' }, 'Save new password');
    const form = h('form', {
      onsubmit: async (e) => {
        e.preventDefault(); err.style.display = 'none';
        if (pw.value !== pw2.value) { err.textContent = 'Passwords do not match.'; err.style.display = 'block'; return; }
        btn.disabled = true;
        try {
          await api('POST', '/auth/reset', { token, password: pw.value });
          history.replaceState(null, '', location.pathname);
          showLogin('Password saved. Please sign in.');
        } catch (ex) { err.textContent = ex.message; err.style.display = 'block'; btn.disabled = false; }
      },
    }, err, h('div', { class: 'field' }, h('label', { class: 'lbl mono' }, 'New password (10+ characters)'), pw), h('div', { class: 'field' }, h('label', { class: 'lbl mono' }, 'Repeat new password'), pw2), btn);
    authBox('Choose a password', 'Set the password for your admin account.', form);
    pw.focus();
  }

  function shell(admin) {
    $root.replaceChildren();
    const side = h('aside', { class: 'side', id: 'side' });
    const main = h('main', { class: 'main', id: 'main' });
    const link = (view, label, extra = {}, badge) => h('a', { class: 'nav' + (navState.view === view && (navState.key || '') === (extra.key || '') ? ' on' : ''), onclick: () => { navState = { view, ...extra }; side.classList.remove('open'); render(); } }, h('span', {}, label), badge ? h('span', { class: 'badge' }, badge) : null);

    side.append(
      h('div', { class: 'brand' }, h('b', {}, 'MedImpact'), h('span', { class: 'mono', style: 'color:#76849f' }, 'Admin console')),
      link('dashboard', 'Dashboard'),
      h('div', { class: 'grp mono' }, 'Page text'),
      ...SETTINGS.map((s) => link('settings', s.label, { key: s.key })),
      h('div', { class: 'grp mono' }, 'Content'),
      ...Object.entries(COLLECTIONS).map(([k, c]) => link('collection', c.title, { key: k })),
      h('div', { class: 'grp mono' }, 'Inbox'),
      link('messages', 'Messages', {}, unread || null),
      link('smtp', 'Email (SMTP)'),
      h('div', { class: 'grp mono' }, 'Account'),
      link('profile', 'My profile'),
      link('admins', 'Admin users'),
      link('account', 'Change password'),
      h('a', { class: 'nav', href: '/', target: '_blank', rel: 'noopener' }, 'View website ↗'),
      h('a', { class: 'nav', onclick: async () => { try { await api('POST', '/auth/logout', {}); } catch (e) {} showLogin('You have been signed out.'); } }, 'Sign out (' + admin.email + ')')
    );
    $root.append(h('div', { class: 'app' }, side, main));
    return main;
  }

  let adminInfo = null;
  async function render() {
    const main = shell(adminInfo);
    const menu = h('button', { class: 'btn sm menu-btn', onclick: () => document.getElementById('side').classList.toggle('open') }, '☰ Menu');
    main.append(menu);
    try {
      if (navState.view === 'dashboard') await viewDashboard(main);
      else if (navState.view === 'settings') await viewSettings(main, navState.key);
      else if (navState.view === 'collection') await viewCollection(main, navState.key);
      else if (navState.view === 'messages') await viewMessages(main);
      else if (navState.view === 'account') viewAccount(main);
      else if (navState.view === 'profile') viewProfile(main);
      else if (navState.view === 'admins') await viewAdmins(main);
      else if (navState.view === 'smtp') await viewSmtp(main);
    } catch (e) { main.append(h('div', { class: 'err' }, e.message)); }
  }

  const header = (title, sub, ...actions) => h('div', { class: 'top' }, h('div', {}, h('h2', {}, title), sub ? h('p', {}, sub) : null), h('div', { style: 'display:flex;gap:8px' }, actions));

  async function viewDashboard(main) {
    const s = await api('GET', '/stats');
    unread = s.unread;
    main.append(header('Dashboard', 'Everything on the public website is managed from here.'));
    const tile = (label, n, go) => h('div', { class: 'stat', onclick: () => { navState = go; render(); } }, h('b', {}, n), h('span', { class: 'mono' }, label));
    main.append(h('div', { class: 'grid' },
      tile('Unread messages', s.unread, { view: 'messages' }), tile('Total messages', s.messages, { view: 'messages' }),
      ...Object.entries(COLLECTIONS).map(([k, c]) => tile(c.title, s[k], { view: 'collection', key: k }))));
    main.append(h('div', { class: 'card', style: 'margin-top:18px' }, h('h3', {}, 'Quick guide'),
      h('p', {}, 'Use ', h('b', {}, 'Page text'), ' to edit headings, paragraphs, buttons, contact details and the hero image. Use ', h('b', {}, 'Content'), ' to add, edit, reorder, hide or delete events, team members, gallery items and more. Changes go live instantly – refresh the website to see them.')));
  }

  async function viewSettings(main, key) {
    const sec = SETTINGS.find((s) => s.key === key);
    const all = await api('GET', '/settings');
    const form = makeForm(sec.fields, all[key] || {});
    const mk = () => h('button', { class: 'btn primary', onclick: async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try { all[key] = { ...(all[key] || {}), ...form.get() }; await api('PUT', '/settings', all); toast('Saved – live on the website'); }
      catch (err) { toast(err.message, true); }
      b.disabled = false;
    } }, 'Save changes');
    main.append(header(sec.label, 'Edit the text shown in this part of the page.', mk()), h('div', { class: 'card' }, form.el), h('div', { class: 'foot' }, mk()));
  }

  async function viewCollection(main, key) {
    const cfg = COLLECTIONS[key];
    const rows = await api('GET', '/' + key);
    const add = h('button', { class: 'btn primary', onclick: () => edit({}) }, '+ Add ' + cfg.singular);
    main.append(header(cfg.title, rows.length + ' item' + (rows.length === 1 ? '' : 's'), add));

    const head = h('tr', {}, cfg.thumb ? h('th', {}, '') : null, h('th', {}, '#'), cfg.cols.map((c) => h('th', {}, c)), h('th', {}, 'Status'), h('th', {}, ''));
    const body = rows.map((r) => h('tr', {},
      cfg.thumb ? h('td', {}, r[cfg.thumb] ? h('img', { class: 'thumb', src: r[cfg.thumb], alt: '' }) : h('div', { class: 'thumb' })) : null,
      h('td', {}, r.order),
      cfg.cols.map((c) => h('td', { style: 'max-width:280px' }, String(r[c] == null ? '' : r[c]).slice(0, 90))),
      h('td', {}, h('span', { class: 'pill ' + (r.published ? 'on' : 'off') }, r.published ? 'Live' : 'Hidden')),
      h('td', {}, h('div', { class: 'actions' },
        h('button', { class: 'btn sm', onclick: () => edit(r) }, 'Edit'),
        h('button', { class: 'btn sm danger', onclick: async () => { if (!confirm('Delete this ' + cfg.singular + '? This cannot be undone.')) return; try { await api('DELETE', `/${key}/${r._id}`); toast('Deleted'); render(); } catch (e) { toast(e.message, true); } } }, 'Delete')))));
    main.append(h('div', { class: 'scroll' }, h('table', { class: 'tbl' }, h('thead', {}, head), h('tbody', {}, body.length ? body : h('tr', {}, h('td', { colspan: 9, style: 'text-align:center;color:#666;padding:26px' }, 'Nothing here yet.'))))));

    function edit(rec) {
      const isNew = !rec._id;
      const form = makeForm(cfg.fields, isNew ? { published: true } : rec);
      const close = () => modal.remove();
      const save = h('button', { class: 'btn primary', onclick: async () => {
        save.disabled = true;
        try {
          const data = form.get();
          if (isNew) await api('POST', '/' + key, data); else await api('PUT', `/${key}/${rec._id}`, data);
          toast('Saved'); close(); render();
        } catch (e) { toast(e.message, true); save.disabled = false; }
      } }, 'Save');
      const modal = h('div', { class: 'modal', onmousedown: (e) => { if (e.target === modal) close(); } },
        h('div', { class: 'panel' }, h('h3', {}, (isNew ? 'Add ' : 'Edit ') + cfg.singular), form.el, h('div', { class: 'foot' }, h('button', { class: 'btn', onclick: close }, 'Cancel'), save)));
      document.body.append(modal);
    }
  }

  async function viewMessages(main) {
    const rows = await api('GET', '/messages');
    unread = rows.filter((r) => !r.read).length;
    main.append(header('Messages', rows.length + ' received · ' + unread + ' unread'));
    if (!rows.length) main.append(h('div', { class: 'card' }, 'No messages yet. Submissions from the website contact form appear here.'));
    rows.forEach((m) => main.append(h('div', { class: 'msg' + (m.read ? '' : ' unread') },
      h('div', { style: 'display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap' },
        h('b', {}, m.firstName + ' ' + m.lastName), h('span', { class: 'meta' }, new Date(m.createdAt).toLocaleString())),
      h('div', { class: 'meta' }, m.email + ' · ' + m.phone + (m.category ? ' · ' + m.category : '')),
      h('div', { class: 'meta' }, m.emailed ? '✉ Forwarded to notification email' : '✉ Email not sent' + (m.emailError ? ' (' + m.emailError + ')' : '')),
      h('p', {}, m.message),
      h('div', { class: 'actions', style: 'justify-content:flex-start' },
        h('a', { class: 'btn sm', href: 'mailto:' + m.email }, 'Reply by email'),
        h('button', { class: 'btn sm', onclick: async () => { await api('PATCH', '/messages/' + m._id, { read: !m.read }); render(); } }, m.read ? 'Mark unread' : 'Mark read'),
        h('button', { class: 'btn sm danger', onclick: async () => { if (confirm('Delete this message?')) { await api('DELETE', '/messages/' + m._id); render(); } } }, 'Delete')))));
  }

  function viewAccount(main) {
    const cur = h('input', { type: 'password', autocomplete: 'current-password' });
    const nw = h('input', { type: 'password', autocomplete: 'new-password' });
    const nw2 = h('input', { type: 'password', autocomplete: 'new-password' });
    const btn = h('button', { class: 'btn primary', onclick: async () => {
      if (nw.value !== nw2.value) return toast('New passwords do not match', true);
      btn.disabled = true;
      try { await api('POST', '/auth/change-password', { currentPassword: cur.value, newPassword: nw.value }); toast('Password updated'); cur.value = nw.value = nw2.value = ''; }
      catch (e) { toast(e.message, true); }
      btn.disabled = false;
    } }, 'Update password');
    main.append(header('Change password', 'Use at least 10 characters.'),
      h('div', { class: 'card', style: 'max-width:460px' },
        h('div', { class: 'field' }, h('label', { class: 'lbl mono' }, 'Current password'), cur),
        h('div', { class: 'field' }, h('label', { class: 'lbl mono' }, 'New password'), nw),
        h('div', { class: 'field' }, h('label', { class: 'lbl mono' }, 'Repeat new password'), nw2), btn));
  }

  function viewProfile(main) {
    const name = h('input', { type: 'text' }); name.value = adminInfo.name || '';
    const email = h('input', { type: 'email', autocomplete: 'username' }); email.value = adminInfo.email || '';
    const cur = h('input', { type: 'password', autocomplete: 'current-password' });
    const btn = h('button', { class: 'btn primary', onclick: async () => {
      btn.disabled = true;
      try {
        const r = await api('PUT', '/auth/profile', { name: name.value, email: email.value, currentPassword: cur.value });
        adminInfo = { ...adminInfo, ...r }; cur.value = ''; toast('Profile saved'); render();
      } catch (e) { toast(e.message, true); }
      btn.disabled = false;
    } }, 'Save profile');
    main.append(header('My profile', 'The email below receives your password-reset links.'),
      h('div', { class: 'card', style: 'max-width:520px' },
        h('div', { class: 'field' }, h('label', { class: 'lbl mono' }, 'Name'), name),
        h('div', { class: 'field' }, h('label', { class: 'lbl mono' }, 'Email (used to sign in and to receive reset links)'), email),
        h('div', { class: 'field' }, h('label', { class: 'lbl mono' }, 'Current password'), cur, h('div', { class: 'hint' }, 'Only needed when you change your email address.')), btn));
  }

  async function viewAdmins(main) {
    const rows = await api('GET', '/admins');
    main.append(header('Admin users', rows.length + ' account' + (rows.length === 1 ? '' : 's') + ' can sign in to this console.'));

    // --- create form ---
    const name = h('input', { type: 'text', placeholder: 'Full name' });
    const email = h('input', { type: 'email', placeholder: 'name@example.com' });
    const pw = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Leave blank to email an invitation link' });
    const add = h('button', { class: 'btn primary', onclick: async () => {
      add.disabled = true;
      try {
        const r = await api('POST', '/admins', { name: name.value, email: email.value, password: pw.value });
        if (r.invited && r.emailSent) toast('Invitation emailed to ' + r.email);
        else if (r.invited) toast('Admin created, but the invitation email failed: ' + r.emailError + '. Configure Email (SMTP), then use "Send reset link".', true);
        else toast('Admin created');
        render();
      } catch (e) { toast(e.message, true); add.disabled = false; }
    } }, 'Create admin');
    main.append(h('div', { class: 'card', style: 'max-width:620px' }, h('h3', {}, 'Add a new admin'),
      h('div', { class: 'field' }, h('label', { class: 'lbl mono' }, 'Name'), name),
      h('div', { class: 'field' }, h('label', { class: 'lbl mono' }, 'Email'), email),
      h('div', { class: 'field' }, h('label', { class: 'lbl mono' }, 'Temporary password (optional)'), pw,
        h('div', { class: 'hint' }, 'Blank = they receive an email with a link to choose their own password (valid 48 hours; needs Email (SMTP) set up). Otherwise use 10+ characters and share it securely.')), add));

    // --- list ---
    const body = rows.map((a) => h('tr', {},
      h('td', {}, a.name + (a.isYou ? ' (you)' : '')), h('td', {}, a.email),
      h('td', {}, a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : (a.pendingInvite ? 'Invite pending' : 'Never')),
      h('td', {}, h('div', { class: 'actions' },
        h('button', { class: 'btn sm', onclick: async (e) => {
          const b = e.currentTarget; b.disabled = true;
          try { const r = await api('POST', `/admins/${a._id}/send-reset`, {}); toast('Reset link emailed to ' + r.to); } catch (er) { toast(er.message, true); }
          b.disabled = false;
        } }, 'Send reset link'),
        a.isYou ? null : h('button', { class: 'btn sm danger', onclick: async () => {
          if (!confirm('Delete admin ' + a.email + '? They will no longer be able to sign in.')) return;
          try { await api('DELETE', '/admins/' + a._id); toast('Admin deleted'); render(); } catch (er) { toast(er.message, true); }
        } }, 'Delete')))));
    main.append(h('div', { class: 'scroll' }, h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Email'), h('th', {}, 'Last sign-in'), h('th', {}, ''))), h('tbody', {}, body))));
  }

  const PRESETS = {
    Gmail: { host: 'smtp.gmail.com', port: 587, secure: false, note: 'Username = your Gmail address. Password = a 16-character App Password (Google Account → Security → 2-Step Verification → App passwords).' },
    'Outlook / Microsoft 365': { host: 'smtp.office365.com', port: 587, secure: false, note: 'Username = your full email. SMTP AUTH must be enabled for the mailbox.' },
    'Zoho Mail': { host: 'smtp.zoho.com', port: 465, secure: true, note: 'Username = your Zoho email. Use an app-specific password if 2FA is on.' },
    SendGrid: { host: 'smtp.sendgrid.net', port: 587, secure: false, note: 'Username = apikey (literally). Password = your SendGrid API key. "From" must be a verified sender.' },
    Mailgun: { host: 'smtp.mailgun.org', port: 587, secure: false, note: 'Use the SMTP credentials from your Mailgun domain.' },
  };

  async function viewSmtp(main) {
    const c = await api('GET', '/smtp');
    main.append(header('Email (SMTP)', 'Used for contact-form messages and admin password-reset / invitation emails.'));
    const host = h('input', { type: 'text', placeholder: 'smtp.gmail.com' }); host.value = c.host;
    const port = h('input', { type: 'number' }); port.value = c.port;
    const secure = h('input', { type: 'checkbox' }); secure.checked = c.secure;
    const user = h('input', { type: 'text', autocomplete: 'off' }); user.value = c.user;
    const pass = h('input', { type: 'password', autocomplete: 'new-password', placeholder: c.hasPassword ? '•••••••• saved — leave blank to keep' : 'SMTP password / app password' });
    const from = h('input', { type: 'text', placeholder: 'Defaults to the username; e.g. info@yourdomain.com' }); from.value = c.from;
    const note = h('div', { class: 'hint', style: 'margin-top:8px' });
    const presets = h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px' }, Object.entries(PRESETS).map(([n, p]) =>
      h('button', { type: 'button', class: 'btn sm', onclick: () => { host.value = p.host; port.value = p.port; secure.checked = p.secure; note.textContent = p.note; } }, n)));
    const save = h('button', { class: 'btn primary', onclick: async () => {
      save.disabled = true;
      try {
        await api('PUT', '/smtp', { host: host.value, port: port.value, secure: secure.checked, user: user.value, password: pass.value, from: from.value });
        toast('SMTP settings saved'); render();
      } catch (e) { toast(e.message, true); save.disabled = false; }
    } }, 'Save SMTP settings');

    const to = h('input', { type: 'email' }); to.value = adminInfo.email || '';
    const result = h('div', { class: 'hint', style: 'margin-top:8px;font-size:14px' });
    const test = h('button', { class: 'btn', onclick: async () => {
      test.disabled = true; result.style.color = '#44474d'; result.textContent = 'Sending test email…';
      try { const r = await api('POST', '/smtp/test', { to: to.value }); result.style.color = '#05603a'; result.textContent = '✔ Test email sent to ' + r.to + '. Check the inbox (and spam folder).'; }
      catch (e) { result.style.color = '#93000a'; result.textContent = '✖ ' + e.message; }
      test.disabled = false;
    } }, 'Send test email');

    main.append(
      h('div', { class: 'card', style: 'max-width:720px' }, h('h3', {}, 'SMTP server'),
        c.usingEnv ? h('div', { class: 'hint', style: 'margin-bottom:10px' }, 'Currently using the SMTP_* values from the server .env file. Saving settings here overrides them.') : null,
        h('div', { class: 'lbl mono' }, 'Quick presets'), presets,
        h('div', { class: 'cols' },
          h('div', { class: 'field' }, h('label', { class: 'lbl mono' }, 'SMTP host'), host),
          h('div', { class: 'field' }, h('label', { class: 'lbl mono' }, 'Port'), port)),
        h('div', { class: 'field' }, h('label', { style: 'display:flex;gap:8px;align-items:center;cursor:pointer' }, secure, 'Use SSL/TLS (tick for port 465; leave unticked for 587 STARTTLS)')),
        h('div', { class: 'cols' },
          h('div', { class: 'field' }, h('label', { class: 'lbl mono' }, 'Username'), user),
          h('div', { class: 'field' }, h('label', { class: 'lbl mono' }, 'Password'), pass)),
        h('div', { class: 'field' }, h('label', { class: 'lbl mono' }, 'From address (optional)'), from),
        note, h('div', { class: 'foot' }, save),
        h('div', { class: 'hint' }, 'The password is stored encrypted and is never shown again.')),
      h('div', { class: 'card', style: 'max-width:720px' }, h('h3', {}, 'Send a test email'),
        h('div', { class: 'field' }, h('label', { class: 'lbl mono' }, 'Send test to'), to), test, result,
        h('div', { class: 'hint', style: 'margin-top:12px' }, 'Contact-form messages are delivered to the address set under Page text → Contact & footer → "Send contact-form messages to this email".')));
  }

  /* ---------- Boot ---------- */
  async function boot() {
    const m = /^#reset=([a-f0-9]{20,})$/i.exec(location.hash);
    if (m) return showReset(m[1]);
    try {
      adminInfo = await api('GET', '/auth/me');
      try { unread = (await api('GET', '/stats')).unread; } catch (e) {}
      render();
    } catch (e) { showLogin(); }
  }
  boot();
})();
