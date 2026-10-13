/* MedImpact Global – public site renderer. All content comes from /api/site (MongoDB). */
(function () {
  'use strict';

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Only allow http(s), mailto, tel, root-relative and #anchor links (blocks javascript: URLs)
  const safeUrl = (u) => (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(String(u || '').trim()) ? esc(String(u).trim()) : '');
  const img = (u) => safeUrl(u) || '';
  // For social links: accept "facebook.com/page" and add https://
  const socialUrl = (u) => {
    u = String(u || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return esc(u);
    if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(u)) return esc('https://' + u);
    return '';
  };
  const $ = (s, r = document) => r.querySelector(s);

  const idx = (t) => `<div class="font-label-code text-label-code text-on-tertiary-container mb-1 tracking-wider uppercase">${esc(t)}</div>`;
  const h2 = (t) => `<h2 class="font-display-hero text-headline-lg text-secondary font-bold tracking-tight">${esc(t)}</h2>`;
  const wrap = 'max-w-7xl mx-auto px-margin-mobile md:px-margin';

  /* ---------------- Sections ---------------- */
  function heroSlides(d) {
    const h = (d.site && d.site.hero) || {};
    let list = (h.slides || []).map((x) => (x && x.url) || '').filter(Boolean);
    if (!list.length) list = [h.image, ...(d.media || []).slice(0, 4).map((m) => m.image)].filter(Boolean);
    return [...new Set(list)];
  }

  function hero(d) {
    const s = d.site;
    const h = s.hero || {};
    const slides = heroSlides(d);
    const slideHtml = slides.map((u, i) => `<div class="hero-slide${i === 0 ? ' active' : ''}" style="background-image:url('${img(u).replace(/'/g, '%27')}')"></div>`).join('');
    const dots = slides.length > 1 ? `<div class="hero-dots" role="tablist" aria-label="Background photos">${slides.map((_, i) => `<button type="button" role="tab" aria-label="Photo ${i + 1}" data-i="${i}" class="${i === 0 ? 'on' : ''}"></button>`).join('')}</div>` : '';
    const stats = (h.stats || []).map((x) => `
      <div class="p-4 rounded-lg bg-surface-container-lowest/5 border border-outline/20 backdrop-blur-sm">
        <p class="font-label-code text-label-badge text-on-tertiary-container uppercase tracking-wider">${esc(x.label)}</p>
        <p class="font-headline-lg text-headline-md md:text-headline-lg text-white font-bold">${esc(x.value)}</p>
        <p class="font-body-sm text-body-sm text-inverse-on-surface/70">${esc(x.text)}</p>
      </div>`).join('');
    return `
    <section id="hero" class="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-primary-container text-on-primary border-b border-outline-variant/30">
      <div class="absolute inset-0 z-0">
        <div class="hero-slides">${slideHtml}</div>
        <div class="absolute inset-0 bg-gradient-to-t from-primary-container via-primary-container/80 to-transparent"></div>
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-on-tertiary-container/10 via-transparent to-primary-container"></div>
      </div>
      <div class="relative z-10 ${wrap} py-space-xl flex flex-col items-start gap-space-lg w-full">
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-tertiary-container/80 border border-on-tertiary-container/30 backdrop-blur-md">
          <span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
          <span class="font-label-code text-label-badge text-tertiary-fixed tracking-widest uppercase">${esc(h.pipelineTag)}</span>
        </div>
        <div class="max-w-4xl space-y-4">
          <p class="font-label-code text-label-code text-secondary tracking-widest uppercase">${esc(h.eyebrow)}</p>
          <h1 class="font-display-hero text-headline-lg-mobile md:text-display-hero text-on-primary tracking-tight font-bold leading-tight">
            ${esc(h.titleLine1)} <br class="hidden md:inline">
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-white via-surface-container-high to-on-tertiary-container">${esc(h.titleLine2)}</span>
          </h1>
          <p class="font-body-lg text-body-lg text-inverse-on-surface/90 max-w-3xl leading-relaxed">${esc(h.text)}</p>
        </div>
        <div class="flex flex-wrap items-center gap-4 pt-2">
          <a href="#contact" class="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg bg-secondary text-white font-headline-sm text-body-md hover:bg-secondary-container transition-all duration-200 shadow-lg shadow-secondary/20 active:scale-95">
            <span class="material-symbols-outlined text-lg fill">vital_signs</span><span>${esc(h.primaryCta)}</span></a>
          <a href="#flagship" class="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg bg-surface-container-lowest/10 border border-on-tertiary-container/40 text-white font-headline-sm text-body-md hover:bg-surface-container-lowest/20 transition-all duration-200 backdrop-blur-sm">
            <span class="material-symbols-outlined text-lg">play_circle</span><span>${esc(h.secondaryCta)}</span></a>
        </div>
        <div class="w-full grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-outline/30">${stats}</div>
      </div>
      ${dots}
    </section>`;
  }

  /* ---- Event media helpers: photo gallery, video clips, live streams ---- */
  const eventSrc = (x) => (x.type === 'live' ? x.liveUrl : x.type === 'video' ? (x.videoFile || x.videoUrl) : '');
  const LIVE_BADGE = {
    live: '<span class="bg-secondary text-white"><i class="live-dot"></i> LIVE NOW</span>',
    upcoming: '<span class="bg-amber-500 text-white">UPCOMING LIVE</span>',
    ended: '<span class="bg-primary-container text-white">REPLAY</span>',
  };

  function embedUrl(raw) {
    let u;
    try { u = new URL(raw, location.origin); } catch (e) { return ''; }
    if (!/^https?:$/.test(u.protocol)) return '';
    const host = u.hostname.replace(/^(www\.|m\.|web\.)/, '');
    const id = (v) => (/^[\w-]{6,20}$/.test(v || '') ? v : '');
    if (host === 'youtu.be') { const v = id(u.pathname.slice(1)); return v ? `https://www.youtube.com/embed/${v}?autoplay=1&rel=0` : ''; }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      let v = id(u.searchParams.get('v'));
      const m = /^\/(live|embed|shorts|v)\/([\w-]+)/.exec(u.pathname);
      if (!v && m) v = id(m[2]);
      if (v) return `https://www.youtube.com/embed/${v}?autoplay=1&rel=0`;
      const ch = /^\/channel\/(UC[\w-]{20,24})\/live/.exec(u.pathname);
      if (ch) return `https://www.youtube.com/embed/live_stream?channel=${ch[1]}&autoplay=1`;
      return '';
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const m = /(\d{6,})/.exec(u.pathname); return m ? `https://player.vimeo.com/video/${m[1]}?autoplay=1` : '';
    }
    if (host === 'facebook.com' || host === 'fb.watch') {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u.href)}&show_text=false&autoplay=true`;
    }
    return '';
  }

  let closeModal = null;
  function openModal(build) {
    if (closeModal) closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'mig-modal'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
    const box = document.createElement('div'); box.className = 'box';
    const btn = document.createElement('button'); btn.className = 'close'; btn.type = 'button'; btn.setAttribute('aria-label', 'Close'); btn.textContent = '×';
    box.append(btn, build(overlay));
    overlay.append(box);
    document.body.append(overlay);
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const close = () => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();                       // removing the node also stops video / iframe playback
      document.body.style.overflow = '';
      closeModal = null;
    };
    closeModal = close;
    btn.addEventListener('click', close);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    btn.focus();
  }

  function playMedia(x) {
    const src = eventSrc(x);
    if (!src) return;
    const embed = embedUrl(src);
    const isFile = /\.(mp4|webm|mov|ogv)(\?|$)/i.test(src) || src.startsWith('/uploads/');
    if (!embed && !isFile) { window.open(src, '_blank', 'noopener'); return; } // unknown host → open normally
    openModal(() => {
      const frag = document.createDocumentFragment();
      let el;
      if (embed) {
        el = document.createElement('iframe'); el.src = embed; el.title = x.title || 'Video';
        el.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; el.allowFullscreen = true; el.referrerPolicy = 'strict-origin-when-cross-origin';
      } else {
        el = document.createElement('video'); el.src = src; el.controls = true; el.autoplay = true; el.playsInline = true;
        if (x.image) el.poster = x.image;
      }
      const cap = document.createElement('div'); cap.className = 'cap'; cap.textContent = x.title || '';
      frag.append(el, cap);
      return frag;
    });
  }

  function openGallery(x, start) {
    const urls = [x.image, ...((x.gallery || []).map((g) => g.url))].filter(Boolean);
    if (!urls.length) return;
    let i = Math.min(Math.max(start || 0, 0), urls.length - 1);
    openModal((overlay) => {
      const wrapEl = document.createElement('div');
      const lb = document.createElement('div'); lb.className = 'lb';
      const im = document.createElement('img'); im.alt = x.title || '';
      const count = document.createElement('div'); count.className = 'count';
      const mk = (cls, ch, label) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'nav ' + cls; b.textContent = ch; b.setAttribute('aria-label', label); return b; };
      const prev = mk('prev', '‹', 'Previous photo'), next = mk('next', '›', 'Next photo');
      const show = (n) => { i = (n + urls.length) % urls.length; im.src = urls[i]; count.textContent = `${i + 1} / ${urls.length}`; };
      prev.addEventListener('click', () => show(i - 1)); next.addEventListener('click', () => show(i + 1));
      document.addEventListener('keydown', function key(e) {
        if (!document.body.contains(lb)) return document.removeEventListener('keydown', key);
        if (e.key === 'ArrowLeft') show(i - 1); if (e.key === 'ArrowRight') show(i + 1);
      });
      lb.append(im);
      if (urls.length > 1) lb.append(prev, next, count);
      const cap = document.createElement('div'); cap.className = 'cap'; cap.textContent = x.title || '';
      wrapEl.append(lb, cap); show(i);
      return wrapEl;
    });
  }

  function events(d) {
    const e = d.site.events || {};
    // currently-live streams first, otherwise keep the admin's order
    const list = [...d.events].sort((a, b) => (b.type === 'live' && b.liveStatus === 'live') - (a.type === 'live' && a.liveStatus === 'live'));
    d._events = list; // referenced by click handlers (index-based, so no URLs sit in HTML attributes)

    const cats = [...new Set(list.map((x) => x.category).filter(Boolean))];
    const types = [['video', 'Videos'], ['live', 'Live']].filter(([t]) => list.some((x) => x.type === t));
    const filters = [['', 'All Releases', 'all'], ...cats.map((c) => [c, c, 'cat']), ...types.map(([t, l]) => [t, l, 'type'])]
      .map(([val, label, kind], i) => `<button class="filter-btn${i === 0 ? ' on' : ''}" data-kind="${kind}" data-val="${esc(val)}">${esc(label)}</button>`).join('');

    const cards = list.map((x, idx) => {
      const type = x.type || 'photo';
      const photos = [x.image, ...((x.gallery || []).map((g) => g.url))].filter(Boolean);
      const src = eventSrc(x);
      const playable = (type === 'video' || type === 'live') && !!src;
      const hasGallery = type === 'photo' && photos.length > 0;
      const open = playable || hasGallery;
      const badge = type === 'live' ? `<div class="absolute top-3 right-3 font-label-code text-label-badge px-2.5 py-1 rounded flex items-center gap-1.5 [&>span]:flex [&>span]:items-center [&>span]:gap-1.5 [&>span]:px-2 [&>span]:py-0.5 [&>span]:rounded">${LIVE_BADGE[x.liveStatus] || LIVE_BADGE.upcoming}</div>` : '';
      const play = playable ? `<div class="absolute inset-0 flex items-center justify-center pointer-events-none"><span class="w-16 h-16 rounded-full bg-secondary/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><span class="material-symbols-outlined fill" style="font-size:36px">${type === 'live' ? 'sensors' : 'play_arrow'}</span></span></div>` : '';
      const count = hasGallery && photos.length > 1 ? `<div class="absolute bottom-3 left-3 bg-primary-container/90 text-white font-label-code text-label-badge px-2 py-0.5 rounded flex items-center gap-1"><span class="material-symbols-outlined text-sm">photo_library</span>${photos.length} PHOTOS</div>` : '';
      const mediaInner = `
          ${x.image ? `<img loading="lazy" alt="${esc(x.title)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="${img(x.image)}">` : ''}
          ${x.tag ? `<div class="absolute top-3 left-3 bg-secondary text-white font-label-code text-label-badge px-2.5 py-1 rounded">${esc(x.tag)}</div>` : ''}
          ${badge}${play}${count}
          ${x.duration ? `<div class="absolute bottom-3 right-3 bg-primary-container/90 text-white font-label-code text-label-badge px-2 py-0.5 rounded backdrop-blur-sm">${esc(x.duration)}</div>` : ''}`;
      const media = open
        ? `<button type="button" data-open="${idx}" aria-label="${type === 'photo' ? 'View photos: ' : type === 'live' ? 'Watch live: ' : 'Play video: '}${esc(x.title)}" class="relative block w-full aspect-video overflow-hidden bg-primary-container cursor-pointer">${mediaInner}</button>`
        : `<div class="relative aspect-video overflow-hidden bg-primary-container">${mediaInner}</div>`;

      const cta = safeUrl(x.ctaUrl);
      const defLabel = type === 'live' ? (x.liveStatus === 'ended' ? 'Watch Replay' : 'Watch Live') : type === 'video' ? 'Watch Video' : photos.length ? `View Photos` : '';
      const label = x.ctaLabel || defLabel;
      const ctaCls = 'inline-flex items-center gap-1 font-body-sm text-body-sm text-secondary font-medium group-hover:translate-x-1 transition-transform';
      const ctaHtml = !label ? '<span></span>'
        : cta ? `<a href="${cta}" target="_blank" rel="noopener noreferrer" class="${ctaCls}">${esc(label)} <span class="material-symbols-outlined text-sm">arrow_forward</span></a>`
        : open ? `<button type="button" data-open="${idx}" class="${ctaCls}">${esc(label)} <span class="material-symbols-outlined text-sm">arrow_forward</span></button>`
        : `<span class="${ctaCls}">${esc(label)}</span>`;
      return `
      <article class="event-card group bg-surface-container-lowest rounded-lg border border-outline-variant/40 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col" data-cat="${esc(x.category)}" data-type="${esc(type)}">
        ${media}
        <div class="p-5 flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2 text-on-surface-variant font-label-code text-label-badge mb-2">
              <span class="text-on-tertiary-container font-semibold">${esc(x.series)}</span><span>${esc(x.date)}</span>
            </div>
            <h3 class="font-headline-sm text-headline-sm text-on-surface group-hover:text-secondary transition-colors">${esc(x.title)}</h3>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-2">${esc(x.description)}</p>
          </div>
          <div class="mt-4 pt-3 border-t border-outline-variant/30 flex items-center justify-between gap-2">
            ${ctaHtml}
            <span class="font-label-code text-label-badge text-outline">${esc(x.stage)}</span>
          </div>
        </div>
      </article>`;
    }).join('');
    return `
    <section id="events" class="py-space-xl bg-surface-container-low border-b border-outline-variant/40">
      <div class="${wrap}">
        <div class="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>${idx(e.index)}${h2(e.title)}<p class="font-body-md text-on-surface-variant max-w-2xl mt-1">${esc(e.subtitle)}</p></div>
          <div id="eventFilters" class="flex flex-wrap items-center gap-2 bg-surface-container-lowest p-1.5 rounded-lg border border-outline-variant/40 shadow-sm">${filters}</div>
        </div>
        <div id="eventGrid" class="grid grid-cols-1 md:grid-cols-3 gap-6">${cards || '<p class="text-on-surface-variant">No events published yet.</p>'}</div>
      </div>
    </section>`;
  }

  function about(d) {
    const a = d.site.about || {};
    const vals = d.values.map((v, i) => `
      <div class="p-5 rounded-lg bg-surface-container-low border border-outline-variant/40 hover:border-on-tertiary-container transition-colors">
        <span class="font-label-code text-label-badge text-secondary">${String(i + 1).padStart(2, '0')}</span>
        <h4 class="font-headline-sm text-body-lg text-on-surface font-semibold mt-1">${esc(v.title)}</h4>
        <p class="font-body-sm text-body-sm text-on-surface-variant mt-2">${esc(v.description)}</p>
      </div>`).join('');
    return `
    <section id="about" class="py-space-xl bg-surface-container-lowest border-b border-outline-variant/40">
      <div class="${wrap} space-y-12">
        <div>${idx(a.index)}${h2(a.title)}</div>
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div class="lg:col-span-6 p-8 rounded-xl bg-surface-container-low border border-outline-variant/50 flex flex-col justify-between">
            <div>
              <span class="font-label-code text-label-badge text-on-tertiary-container tracking-widest uppercase">Overview</span>
              <h3 class="font-headline-md text-headline-md text-on-surface mt-2 mb-4">${esc(a.whoTitle)}</h3>
              <p class="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">${esc(a.whoText)}</p>
            </div>
            <div class="mt-6 pt-4 border-t border-outline-variant/30 flex items-center gap-2 text-on-tertiary-container">
              <span class="material-symbols-outlined fill">verified</span><span class="font-label-code text-label-code font-bold">${esc(a.badge)}</span>
            </div>
          </div>
          <div class="lg:col-span-6 flex flex-col gap-6 justify-between">
            <div class="p-8 rounded-xl bg-primary-container text-white border border-outline/30 shadow-md">
              <div class="flex items-center gap-2 mb-2 text-on-tertiary-container"><span class="material-symbols-outlined">visibility</span><span class="font-label-code text-label-badge tracking-widest uppercase">Aspirational Target</span></div>
              <h3 class="font-headline-md text-headline-sm md:text-headline-md text-white font-bold mb-3">${esc(a.visionTitle)}</h3>
              <p class="font-body-md text-body-md text-inverse-on-surface/90 leading-relaxed">${esc(a.visionText)}</p>
            </div>
            <div class="p-8 rounded-xl bg-surface-container border border-outline-variant/40">
              <div class="flex items-center gap-2 mb-2 text-on-tertiary-container"><span class="material-symbols-outlined">flag</span><span class="font-label-code text-label-badge tracking-widest uppercase">Action Matrix</span></div>
              <h3 class="font-headline-md text-headline-sm md:text-headline-md text-on-surface font-bold mb-3">${esc(a.missionTitle)}</h3>
              <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">${esc(a.missionText)}</p>
            </div>
          </div>
        </div>
        <div>
          <div class="flex items-center justify-between mb-6 gap-2 flex-wrap">
            <h3 class="font-headline-sm text-headline-sm text-on-surface font-semibold">${esc(a.valuesTitle)}</h3>
            <span class="font-label-code text-label-badge text-outline">${esc(a.valuesIndex)}</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">${vals}</div>
        </div>
      </div>
    </section>`;
  }

  function services(d) {
    const s = d.site.services || {};
    const cards = d.services.map((x) => `
      <div class="p-6 rounded-lg bg-surface-container-lowest border border-outline-variant/40 hover:shadow-md hover:border-on-tertiary-container transition-all flex flex-col">
        <div class="flex items-center justify-between mb-4">
          <div class="p-2.5 rounded bg-primary-container text-secondary"><span class="material-symbols-outlined">${esc(x.icon)}</span></div>
          <span class="font-label-code text-label-badge text-outline">${esc(x.label)}</span>
        </div>
        <h3 class="font-headline-sm text-headline-sm text-on-surface">${esc(x.title)}</h3>
        <p class="font-body-sm text-body-sm text-on-surface-variant mt-2 flex-1">${esc(x.description)}</p>
        <div class="mt-4 pt-3 border-t border-outline-variant/30 font-label-code text-label-badge text-on-tertiary-container">${esc(x.footerTag)}</div>
      </div>`).join('');
    return `
    <section id="what-we-do" class="py-space-xl bg-surface-container-low border-b border-outline-variant/40">
      <div class="${wrap}">
        <div class="mb-8">${idx(s.index)}${h2(s.title)}<p class="font-body-md text-on-surface-variant mt-1">${esc(s.subtitle)}</p></div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${cards}</div>
      </div>
    </section>`;
  }

  function flagship(d) {
    const f = d.site.flagship || {};
    const pillars = d.pillars.map((x) => `
      <div class="p-5 rounded-lg bg-surface-container-lowest/5 border border-outline/20 flex gap-4">
        <span class="material-symbols-outlined text-secondary shrink-0">${esc(x.icon)}</span>
        <div><h4 class="font-headline-sm text-body-md text-white font-semibold">${esc(x.title)}</h4>
        <p class="font-body-sm text-body-sm text-inverse-on-surface/70 mt-1">${esc(x.description)}</p></div>
      </div>`).join('');
    const stages = d.approach.map((x) => `
      <div class="p-5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 flex flex-col">
        <span class="font-label-code text-label-badge text-secondary">${esc(x.stageLabel)}</span>
        <h4 class="font-headline-sm text-body-lg text-on-surface font-semibold mt-1">${esc(x.title)}</h4>
        <p class="font-body-sm text-body-sm text-on-surface-variant mt-2 flex-1">${esc(x.description)}</p>
        <span class="mt-3 font-label-code text-label-badge text-on-tertiary-container">${esc(x.footerTag)}</span>
      </div>`).join('');
    const why = d.why.map((x, i) => `
      <div class="p-5 rounded-lg bg-surface-container-lowest border border-outline-variant/40">
        <span class="font-label-code text-label-badge text-secondary">${String(i + 1).padStart(2, '0')}</span>
        <h4 class="font-headline-sm text-body-md text-on-surface font-semibold mt-1">${esc(x.title)}</h4>
        <p class="font-body-sm text-body-sm text-on-surface-variant mt-2">${esc(x.description)}</p>
      </div>`).join('');
    return `
    <section id="flagship" class="py-space-xl bg-surface-container-lowest border-b border-outline-variant/40">
      <div class="${wrap} space-y-14">
        <div>${idx(f.index)}${h2(f.title)}<p class="font-body-md text-on-surface-variant mt-1">${esc(f.subtitle)}</p></div>
        <div class="rounded-xl overflow-hidden bg-primary-container text-white border border-outline/30 shadow-lg grid grid-cols-1 lg:grid-cols-2">
          <div class="p-8 md:p-10 flex flex-col justify-center gap-5">
            <span class="inline-flex w-fit items-center gap-2 px-3 py-1 rounded-full bg-secondary/20 border border-secondary/40 font-label-code text-label-badge text-secondary-fixed-dim">
              <span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>${esc(f.status)}</span>
            <h3 class="font-display-hero text-headline-lg-mobile md:text-headline-lg font-bold">${esc(f.name)}</h3>
            <div><p class="font-label-code text-label-badge text-on-tertiary-container tracking-widest mb-1">// OFFICIAL SYNOPSIS</p>
            <p class="font-body-md text-inverse-on-surface/90 leading-relaxed">${esc(f.synopsis)}</p></div>
            <div class="flex flex-wrap gap-3 pt-2">
              <a href="#contact" class="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-secondary text-white font-headline-sm text-body-md hover:bg-secondary-container transition-all active:scale-95"><span class="material-symbols-outlined text-lg">contract</span>${esc(f.primaryCta)}</a>
              <a href="#events" class="inline-flex items-center px-6 py-3 rounded-lg border border-on-tertiary-container/50 text-white font-headline-sm text-body-md hover:bg-white/10 transition-all">${esc(f.secondaryCta)}</a>
            </div>
          </div>
          <div class="relative min-h-[280px] bg-tertiary-container">
            ${f.image ? `<img loading="lazy" alt="${esc(f.name)}" class="absolute inset-0 w-full h-full object-cover opacity-90" src="${img(f.image)}">` : ''}
            <div class="absolute bottom-3 left-3 bg-primary-container/90 font-label-code text-label-badge px-2 py-1 rounded">${esc(f.cameraLabel)}</div>
            <div class="absolute top-3 right-3 bg-secondary font-label-code text-label-badge px-2 py-1 rounded">${esc(f.pipelineLabel)}</div>
          </div>
        </div>
        <div>
          <div class="mb-6">${idx(f.pillarsIndex)}<h3 class="font-headline-md text-headline-md text-on-surface">${esc(f.pillarsTitle)}</h3></div>
          <div class="bg-primary-container rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">${pillars}</div>
        </div>
        <div>
          <div class="mb-6">${idx(f.approachIndex)}<h3 class="font-headline-md text-headline-md text-on-surface">${esc(f.approachTitle)}</h3></div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">${stages}</div>
        </div>
        <div>
          <div class="mb-6">${idx(f.whyIndex)}<h3 class="font-headline-md text-headline-md text-on-surface">${esc(f.whyTitle)}</h3></div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">${why}</div>
        </div>
      </div>
    </section>`;
  }

  function team(d) {
    const t = d.site.team || {};
    const board = d.team.map((m) => `
      <article class="bg-surface-container-lowest rounded-lg border border-outline-variant/40 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col">
        <div class="relative aspect-[4/5] bg-primary-container overflow-hidden">
          ${m.image ? `<img loading="lazy" alt="${esc(m.name)}" class="w-full h-full object-cover" src="${img(m.image)}">` : ''}
          <span class="absolute top-3 left-3 bg-secondary text-white font-label-code text-label-badge px-2 py-1 rounded">${esc(m.badge)}</span>
        </div>
        <div class="p-5 flex-1 flex flex-col gap-2">
          <h3 class="font-headline-sm text-headline-sm text-on-surface">${esc(m.name)}</h3>
          <p class="font-body-sm text-body-sm text-on-tertiary-container font-semibold">${esc(m.role)}</p>
          <p class="font-body-sm text-body-sm text-on-surface-variant">${esc(m.profession)}</p>
          <div class="mt-2 pt-3 border-t border-outline-variant/30 flex-1">
            <p class="font-label-code text-label-badge text-outline mb-1">LEADERSHIP MESSAGE</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant italic">“${esc(m.message)}”</p>
          </div>          
        </div>
      </article>`).join('');
    const crew = d.crew.map((c) => `
      <article class="bg-surface-container-lowest rounded-lg border border-outline-variant/40 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col">
        <div class="relative aspect-[4/5] bg-primary-container overflow-hidden flex items-center justify-center">
          ${c.image
            ? `<img loading="lazy" alt="${esc(c.name)}" class="w-full h-full object-cover" src="${img(c.image)}">`
            : `<span class="material-symbols-outlined text-secondary" style="font-size:72px">person</span>`}
        </div>
        <div class="p-4 flex flex-col gap-1">
          <h4 class="font-headline-sm text-body-lg text-on-surface font-semibold leading-snug">${esc(c.name)}</h4>
          ${c.profession ? `<p class="font-body-sm text-body-sm text-on-tertiary-container font-semibold">${esc(c.profession)}</p>` : ''}
          ${c.stageName ? `<p class="font-body-sm text-body-sm text-on-surface-variant"><span class="font-medium text-on-surface">Stage Name:</span> ${esc(c.stageName)}</p>` : ''}
          ${c.role ? `<p class="font-body-sm text-body-sm text-on-surface-variant"><span class="font-medium text-on-surface">Role:</span> ${esc(c.role)}</p>` : ''}
          ${c.memberId ? `<p class="font-body-sm text-body-sm text-on-surface-variant"><span class="font-medium text-on-surface">Membership No:</span> ${esc(c.memberId)}</p>` : ''}
        </div>
      </article>`).join('');
    return `
    <section id="team" class="py-space-xl bg-surface-container-low border-b border-outline-variant/40">
      <div class="${wrap} space-y-14">
        <div>${idx(t.index)}${h2(t.title)}<p class="font-body-md text-on-surface-variant max-w-2xl mt-1">${esc(t.subtitle)}</p></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">${board}</div>
        <div>
          <div class="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-2">
            <div>${idx(t.crewIndex)}<h3 class="font-headline-md text-headline-md text-on-surface">${esc(t.crewTitle)}</h3>
            <p class="font-body-sm text-on-surface-variant mt-1">${esc(t.crewSubtitle)}</p></div>
            <span class="font-label-code text-label-badge text-outline">${esc(t.crewTotal)}</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">${crew}</div>
          <div class="mt-6 p-5 rounded-lg bg-primary-container text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div><h4 class="font-headline-sm text-body-lg font-semibold">${esc(t.careersTitle)}</h4>
            <p class="font-body-sm text-inverse-on-surface/80 mt-1">${esc(t.careersText)}</p></div>
            <a href="#contact" class="inline-flex w-fit items-center px-5 py-2.5 rounded-lg bg-secondary font-headline-sm text-body-sm hover:bg-secondary-container transition-colors">${esc(t.careersCta)}</a>
          </div>
        </div>
      </div>
    </section>`;
  }

  function media(d) {
    const m = d.site.media || {};
    const items = d.media.map((x, i) => {
      const big = i === 0 ? 'md:col-span-2 md:row-span-2' : '';
      let visual;
      if (x.type === 'video' && /^https:\/\/(www\.youtube\.com\/embed\/|player\.vimeo\.com\/video\/)/.test(x.videoUrl || '')) {
        visual = `<iframe class="absolute inset-0 w-full h-full" src="${esc(x.videoUrl)}" title="${esc(x.caption)}" loading="lazy" allowfullscreen></iframe>`;
      } else {
        visual = x.image ? `<img loading="lazy" alt="${esc(x.caption)}" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="${img(x.image)}">` : '';
      }
      return `
      <figure class="group relative overflow-hidden rounded-lg bg-primary-container min-h-[220px] ${big}">
        ${visual}
        <figcaption class="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-primary-container/95 to-transparent pointer-events-none">
          <span class="font-label-code text-label-badge text-secondary-fixed-dim">${esc(x.label)}</span>
          <p class="font-headline-sm text-body-md text-white mt-1">${esc(x.caption)}</p>
        </figcaption>
      </figure>`;
    }).join('');
    return `
    <section id="media" class="py-space-xl bg-surface-container-lowest border-b border-outline-variant/40">
      <div class="${wrap}">
        <div class="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div>${idx(m.index)}${h2(m.title)}<p class="font-body-md text-on-surface-variant max-w-2xl mt-1">${esc(m.subtitle)}</p></div>
          <span class="font-label-code text-label-badge px-2 py-1 bg-surface-container text-on-tertiary-container rounded w-fit">${esc(m.badge)}</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-4 auto-rows-[220px] gap-4">${items}</div>
      </div>
    </section>`;
  }

  function contact(d) {
    const c = d.site.contact || {};
    const socials = (c.socials || []).map((x) => {
      const u = socialUrl(x.url);
      const nm = esc(x.name);
      return u
        ? `<a href="${u}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc((d.site.brand || {}).name || 'our')} ${nm} page (opens in a new tab)" class="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg border border-outline/50 bg-white/5 font-label-code text-label-badge hover:bg-secondary hover:border-secondary hover:text-white transition-colors active:scale-95"><span>${nm}</span><span class="material-symbols-outlined text-sm">arrow_outward</span></a>`
        : `<span title="Link not set yet" class="inline-flex items-center min-h-[44px] px-4 py-2 rounded-lg border border-outline/20 font-label-code text-label-badge text-inverse-on-surface/50">${nm}</span>`;
    }).join('');
    const opts = (c.categories || []).map((o) => `<option>${esc(o)}</option>`).join('');
    const field = 'w-full rounded border border-outline-variant bg-white px-3 py-2.5 text-on-surface focus:border-on-tertiary-container focus:ring-0';
    const label = 'block font-label-code text-label-badge text-on-surface-variant mb-1 uppercase';
    return `
    <section id="contact" class="py-space-xl bg-primary-container text-white">
      <div class="${wrap}">
        <div class="mb-8"><div class="font-label-code text-label-code text-on-tertiary-container mb-1 tracking-wider uppercase">${esc(c.index)}</div>
          <h2 class="font-display-hero text-headline-lg text-white font-bold tracking-tight">${esc(c.title)}</h2>
          <p class="font-body-md text-inverse-on-surface/80 mt-1">${esc(c.subtitle)}</p></div>
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div class="lg:col-span-5 space-y-6">
            <div><p class="font-label-code text-label-badge text-secondary-fixed-dim">${esc(c.hqLabel)}</p>
              <h3 class="font-headline-md text-headline-md">${esc(c.hqTitle)}</h3>
              <p class="font-body-md text-inverse-on-surface/80 mt-2">${esc(c.hqText)}</p></div>
            <div class="space-y-4">
              <div class="flex gap-3"><span class="material-symbols-outlined text-secondary">mail</span><div><p class="font-label-code text-label-badge text-on-tertiary-container">DIRECT EMAIL</p><a class="hover:text-secondary-fixed-dim break-all" href="mailto:${esc(c.email)}">${esc(c.email)}</a></div></div>
              <div class="flex gap-3"><span class="material-symbols-outlined text-secondary">call</span><div><p class="font-label-code text-label-badge text-on-tertiary-container">TELEPHONE DISPATCH</p><p>${esc(c.phones)}</p></div></div>
              <div class="flex gap-3"><span class="material-symbols-outlined text-secondary">location_on</span><div><p class="font-label-code text-label-badge text-on-tertiary-container">PHYSICAL LOCATION</p><p>${esc(c.address)}</p><p class="text-inverse-on-surface/70 text-body-sm">${esc(c.postal)}</p></div></div>
            </div>
            <div><p class="font-label-code text-label-badge text-on-tertiary-container mb-2">DIGITAL BROADCAST CHANNELS</p><div class="flex flex-wrap gap-2">${socials}</div></div>
            <blockquote class="border-l-2 border-secondary pl-4 font-headline-sm text-body-lg italic">“${esc(c.quote)}”</blockquote>
          </div>
          <div class="lg:col-span-7 bg-surface-container-lowest text-on-surface rounded-xl p-6 md:p-8">
            <h3 class="font-headline-md text-headline-md mb-5">${esc(c.formTitle)}</h3>
            <form id="contactForm" class="space-y-4" novalidate>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label class="${label}" for="f-first">First Name *</label><input id="f-first" name="firstName" required maxlength="80" autocomplete="given-name" class="${field}"></div>
                <div><label class="${label}" for="f-last">Last Name *</label><input id="f-last" name="lastName" required maxlength="80" autocomplete="family-name" class="${field}"></div>
                <div><label class="${label}" for="f-email">Official Email *</label><input id="f-email" name="email" type="email" required maxlength="160" autocomplete="email" class="${field}"></div>
                <div><label class="${label}" for="f-phone">Telephone / WhatsApp *</label><input id="f-phone" name="phone" type="tel" required maxlength="40" autocomplete="tel" class="${field}"></div>
              </div>
              <div><label class="${label}" for="f-cat">Partnership Category *</label><select id="f-cat" name="category" class="${field}">${opts}</select></div>
              <div><label class="${label}" for="f-msg">Message &amp; Collaboration Scope *</label><textarea id="f-msg" name="message" rows="5" required maxlength="4000" class="${field}"></textarea></div>
              <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;opacity:0;height:0;width:0">
              <div id="formMsg" role="status" class="hidden rounded px-3 py-2 text-body-sm"></div>
              <button type="submit" class="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary-container text-white font-headline-sm text-body-md hover:bg-secondary transition-colors active:scale-95 disabled:opacity-60">
                <span class="material-symbols-outlined text-lg">send</span><span>Send Message</span></button>
              <p class="font-body-sm text-body-sm text-on-surface-variant">${esc(c.privacyNote)}</p>
            </form>
          </div>
        </div>
      </div>
    </section>`;
  }

  function footer(d) {
    const b = d.site.brand || {}, f = d.site.footer || {};
    const logo = safeUrl(b.logo) ? `<img src="${safeUrl(b.logo)}" alt="" class="h-12 w-auto max-w-[180px] object-contain mb-3">` : '';
    const nav = [['#hero', 'Home'], ['#events', 'Events'], ['#about', 'About'], ['#what-we-do', 'What We Do'], ['#flagship', 'Flagship'], ['#team', 'Team'], ['#media', 'Media'], ['#contact', 'Contact']]
      .map(([href, label]) => `<a href="${href}" class="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-outline/40 bg-white/5 font-headline-sm text-body-sm text-white hover:bg-secondary hover:border-secondary transition-colors active:scale-95">${label}</a>`).join('');
    return `
    <div class="bg-tertiary-container text-inverse-on-surface border-t border-outline/30">
      <div class="w-full px-4 md:px-8 py-10 flex flex-col md:flex-row md:justify-between gap-8">
        <div class="md:max-w-md text-left">
          ${logo}
          <p class="font-display-hero text-headline-sm font-bold uppercase text-white">${esc(b.name)}</p>
          <p class="font-body-sm text-inverse-on-surface/70 mt-1">${esc(b.footerTagline)}</p>
          <span class="inline-flex items-center gap-2 mt-3 font-label-code text-label-badge text-secondary-fixed-dim"><span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>${esc(f.status)}</span>
        </div>
        <div class="flex flex-col gap-4 md:items-end md:text-right">
          <div class="flex flex-wrap gap-x-6 gap-y-2 md:justify-end font-body-sm">
            <a class="hover:text-white" href="#about">Privacy Policy</a><a class="hover:text-white" href="#what-we-do">Terms of Broadcast</a>
            <a class="hover:text-white" href="#flagship">Production Pipeline</a><a class="hover:text-white" href="#team">Careers</a>
            <a class="hover:text-white" href="#events">Press Kit</a><a class="hover:text-white" href="#contact">Nairobi Studio Contact</a>
          </div>
          <p class="font-label-code text-label-badge text-inverse-on-surface/60">${esc(f.note)}</p>
        </div>
      </div>
      <nav aria-label="Footer navigation" class="border-t border-outline/20">
        <div class="foot-nav w-full px-4 md:px-8 py-5 flex flex-wrap justify-center gap-2 md:gap-3">${nav}</div>
      </nav>
      <div class="border-t border-outline/20">
        <p class="w-full px-4 md:px-8 py-4 text-center font-label-code text-label-badge text-inverse-on-surface/60">${esc(f.copyright)}</p>
      </div>
    </div>`;
  }

  /* ---------------- Behaviour ---------------- */
  function wireHero() {
    const slides = [...document.querySelectorAll('.hero-slide')];
    if (slides.length < 2) return;
    const dots = [...document.querySelectorAll('.hero-dots button')];
    slides.forEach((el) => { const m = /url\('([^']+)'\)/.exec(el.style.backgroundImage || ''); if (m) new Image().src = m[1]; });
    let i = 0, timer;
    const go = (n) => {
      if (n === i) return;
      const prev = slides[i];
      prev.classList.remove('active'); prev.classList.add('prev');
      setTimeout(() => prev.classList.remove('prev'), 1900);
      i = n;
      slides[i].classList.remove('prev'); slides[i].classList.add('active');
      dots.forEach((d, k) => d.classList.toggle('on', k === i));
    };
    const start = () => {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      clearInterval(timer);
      timer = setInterval(() => { if (!document.hidden) go((i + 1) % slides.length); }, 6000);
    };
    dots.forEach((d) => d.addEventListener('click', () => { go(Number(d.dataset.i)); start(); }));
    start();
  }

  function wireBrand() {
    const a = $('#brandLink');
    if (!a) return;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const mm = $('#mobileNav'); if (mm) mm.classList.add('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (history.replaceState) history.replaceState(null, '', '#hero');
    });
  }

  function wireEvents(d) {
    const box = $('#eventFilters');
    if (box) box.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      box.querySelectorAll('.filter-btn').forEach((b) => b.classList.toggle('on', b === btn));
      const { kind, val } = btn.dataset;
      document.querySelectorAll('.event-card').forEach((c) => {
        const show = kind === 'all' || (kind === 'cat' && c.dataset.cat === val) || (kind === 'type' && c.dataset.type === val);
        c.style.display = show ? '' : 'none';
      });
    });
    const grid = $('#eventGrid');
    if (grid) grid.addEventListener('click', (e) => {
      const t = e.target.closest('[data-open]');
      if (!t) return;
      const x = (d._events || [])[Number(t.dataset.open)];
      if (!x) return;
      if ((x.type || 'photo') === 'photo') openGallery(x, 0); else playMedia(x);
    });
  }

  function wireForm() {
    const form = $('#contactForm');
    if (!form) return;
    const msg = $('#formMsg');
    const show = (text, ok) => {
      msg.textContent = text;
      msg.className = 'rounded px-3 py-2 text-body-sm ' + (ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-error-container text-on-error-container');
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      const body = Object.fromEntries(new FormData(form).entries());
      if (!body.firstName.trim() || !body.lastName.trim() || !body.email.trim() || !body.phone.trim() || !body.message.trim()) {
        return show('Please complete all required fields.', false);
      }
      btn.disabled = true;
      try {
        const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Something went wrong. Please try again.');
        form.reset();
        show('Thank you — your message has been received. Our production team will be in touch shortly.', true);
      } catch (err) { show(err.message, false); }
      btn.disabled = false;
    });
  }

  function wireNav() {
    const menu = $('#mobileNav');
    $('#menuBtn').addEventListener('click', () => menu.classList.toggle('hidden'));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) menu.classList.add('hidden'); });

    const links = [...document.querySelectorAll('#mainNav .nav-link')];
    const map = new Map(links.map((l) => [l.getAttribute('href').slice(1), l]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting && map.has(en.target.id)) {
          links.forEach((l) => l.classList.remove('active'));
          map.get(en.target.id).classList.add('active');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    map.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });

    const rv = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); rv.unobserve(en.target); } }), { threshold: 0.05 });
    document.querySelectorAll('main > section').forEach((s) => { s.classList.add('reveal'); rv.observe(s); });
  }

  /* ---------------- Boot ---------------- */
  (async function init() {
    const app = $('#app');
    try {
      const res = await fetch('/api/site');
      if (!res.ok) throw new Error('bad response');
      const d = await res.json();
      d.site = d.site || {};
      const s = d.site;

      if (s.seo && s.seo.title) document.title = s.seo.title;
      if (s.seo && s.seo.description) { const m = document.querySelector('meta[name=description]'); if (m) m.content = s.seo.description; }
      const logoUrl = safeUrl((s.brand || {}).logo);
      if (logoUrl) {
        const box = $('#brandLogoBox');
        const im = document.createElement('img');
        im.src = logoUrl.replace(/&amp;/g, '&'); im.alt = (s.brand && s.brand.name) || 'Logo';
        im.className = 'h-14 md:h-[4.5rem] w-auto max-w-[150px] sm:max-w-[230px] object-contain';
        box.replaceChildren(im);
        box.className = 'flex items-center justify-center group-active:scale-95 transition-transform';
        let ic = document.querySelector('link[rel=icon]');
        if (!ic) { ic = document.createElement('link'); ic.rel = 'icon'; document.head.append(ic); }
        ic.href = im.src;
      }
      const c = s.contact || {};
      $('#waTop').href = c.whatsapp ? `https://wa.me/${encodeURIComponent(String(c.whatsapp).replace(/\D/g, ''))}?text=${encodeURIComponent(c.whatsappText || '')}` : '#contact';

      app.innerHTML = [hero(d), events(d), about(d), services(d), flagship(d), team(d), media(d), contact(d)].join('');
      $('#footer').innerHTML = footer(d);
      wireHero(); wireEvents(d); wireForm(); wireNav(); wireBrand();
    } catch (e) {
      app.innerHTML = '<div class="min-h-[70vh] flex flex-col items-center justify-center gap-2 text-center px-6"><p class="font-headline-md text-headline-md text-secondary">Signal lost</p><p class="text-on-surface-variant">We could not load the site content. Please refresh the page.</p></div>';
    }
  })();
})();
