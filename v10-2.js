(function(){
  const A = window.App;
  if(!A) return console.warn("WebsiteWerk v10.2: App nicht gefunden");

  if(document.getElementById("ww-v10-2-style")) return;

  const safeEsc = (s)=>String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const stagesAcq = (typeof AS !== "undefined") ? AS : [{id:"discovered",l:"Discovered"},{id:"engaged",l:"Engaged"},{id:"sales_ready",l:"Sales Ready"},{id:"won",l:"Won"}];
  const stagesCli = (typeof CS !== "undefined") ? CS : [{id:"onboarding",l:"Onboarding"},{id:"production",l:"Production"},{id:"live",l:"Live"}];
  const transAcq = (typeof AT !== "undefined") ? AT : {};
  const transCli = (typeof CT !== "undefined") ? CT : {};

  const st = document.createElement("style");
  st.id = "ww-v10-2-style";
  st.textContent = `
    .ww-filterbar{margin:0 0 12px 0;padding:13px 14px;display:flex;gap:10px;align-items:end;flex-wrap:wrap}
    .ww-filterbar .mf{margin:0;min-width:140px}
    .ww-filterbar .mf label{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#7A858D;font-weight:800}
    .ww-filterbar input,.ww-filterbar select{height:34px;border:1px solid var(--border);border-radius:9px;padding:6px 9px;background:#fff;color:var(--ink);font-size:13px}
    .ww-filterstats{display:flex;gap:7px;flex-wrap:wrap;margin-left:auto}
    .ww-pill{border:1px solid var(--border);background:#fff;border-radius:999px;padding:7px 10px;font-size:12px;color:#5f6b73}
    .ww-pill b{color:var(--ink)}
    .ww-primary{background:var(--a)!important;color:#fff!important;border-color:var(--a)!important}
  `;
  document.head.appendChild(st);

  A.saveUiCfg = function(){
    try{ localStorage.setItem("ww:cfg", JSON.stringify(this.cfg || {})); }catch(e){}
  };

  A.applyAcqFilters = function(){
    const g = id => document.getElementById(id)?.value || "";
    this.cfg.acqFilters = {
      q: g("af-q"),
      source: g("af-source"),
      stage: g("af-stage"),
      inbound: g("af-inbound"),
      minScore: g("af-score"),
      sort: g("af-sort")
    };
    this.saveUiCfg();
    this.rBoard("akquise");
    this.polishV10Text();
  };

  A.resetAcqFilters = function(){
    this.cfg.acqFilters = {q:"",source:"all",stage:"all",inbound:"all",minScore:"",sort:"smart"};
    this.saveUiCfg();
    this.rBoard("akquise");
    this.polishV10Text();
  };

  A.polishV10Text = function(){
    const repl = [
      ["Demo zurücksetzen","Arbeitsstand zurücksetzen"],
      ["Demo-Daten wiederherstellen?","Arbeitsstand wirklich zurücksetzen?"],
      ["Factory-Durchlauf starten","Sales-Ready Build starten"],
      ["Factory-Durchlauf","Sales-Ready Build"],
      ["Demo deployed auf Cloudflare Pages","Sales-Ready WordPress-Staging bereit"],
      ["Demo deployed (Cloudflare Pages)","Sales-Ready WordPress-Staging bereit"],
      ["Demo-Link","Abnahme-Link"],
      ["Demos","Builds"],
      ["Cloudflare Pages – Demo-Deploy","WordPress-Staging / Sales-Ready Veröffentlichung"],
      ["Cloudflare Pages","WordPress-Staging"],
      ["individuelle Multi-Seiten-Website","vollständiger WordPress-Fertigstand"]
    ];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n=>{
      let t = n.nodeValue;
      repl.forEach(([a,b])=>{ t = t.split(a).join(b); });
      n.nodeValue = t;
    });
  };

  A.loadFunnel = async function(){
    try{
      const r = await fetch(this.apiBase()+"/api/analytics/funnel");
      if(!r.ok) return;
      const f = await r.json();
      const total = f.totalBuilds ?? f.totalDemos ?? f.builds ?? f.demos ?? 0;
      const clicks = f.buildClicks ?? f.demoClicks ?? f.clicks ?? 0;
      const engaged = f.engaged ?? 0;
      const won = f.won ?? 0;
      const conv = f.conversionRate ?? (clicks ? Math.round((won/clicks)*100) : 0);
      const el = document.getElementById("funnel-box");
      if(el) el.innerHTML = `<div class="hl" style="margin-bottom:10px">SALES-READY FUNNEL</div><div style="display:flex;gap:8px;flex-wrap:wrap">
        <div class="hst"><div class="hl">Builds</div><div class="hv">${total}</div></div>
        <div class="hst"><div class="hl">Klicks</div><div class="hv">${clicks}</div></div>
        <div class="hst"><div class="hl">Engaged</div><div class="hv">${engaged}</div></div>
        <div class="hst"><div class="hl">Kunden</div><div class="hv" style="color:var(--g)">${won}</div></div>
        <div class="hst"><div class="hl">Conversion</div><div class="hv" style="color:var(--a)">${conv}%</div></div>
      </div>`;
    }catch(e){}
  };

  A.rBoard = function(w){
    const acq = w === "akquise";
    const stages = acq ? stagesAcq : stagesCli;
    const allItems = acq ? (this.state.leads || []) : (this.state.clients || []);
    const kF = acq ? "stage" : "phase";
    const pl = acq ? "acq" : "cli";
    const tm = acq ? transAcq : transCli;
    const al = this.drag && this.drag.pl === pl ? new Set(tm[this.drag.from] || []) : null;

    let items = allItems.slice();
    let toolbar = "";

    if(acq){
      const ui = Object.assign({q:"",source:"all",stage:"all",inbound:"all",minScore:"",sort:"smart"}, this.cfg.acqFilters || {});
      const sources = Array.from(new Set(allItems.map(l=>l.source || "manuell"))).sort();
      const q = String(ui.q || "").toLowerCase().trim();
      const minScore = Number(ui.minScore || 0);

      const isInbound = l => !!l.inbound || /website|mountainium|website-check|kontakt|debug/i.test(l.source || "");
      const isMountainium = l => /mountainium/i.test(l.source || "") || !!l.inbound;

      items = items.filter(l=>{
        const hay = [l.name,l.email,l.phone,l.branche,l.ort,l.website,l.source,l.topic,l.message,l.stage].join(" ").toLowerCase();
        if(q && !hay.includes(q)) return false;
        if(ui.source !== "all" && (l.source || "manuell") !== ui.source) return false;
        if(ui.stage !== "all" && l.stage !== ui.stage) return false;
        if(ui.inbound === "inbound" && !isInbound(l)) return false;
        if(ui.inbound === "mountainium" && !isMountainium(l)) return false;
        if(ui.inbound === "manual" && isInbound(l)) return false;
        if(minScore && (+l.score || 0) < minScore) return false;
        return true;
      });

      items.sort((a,b)=>{
        if(ui.sort === "score") return (+b.score||0)-(+a.score||0);
        if(ui.sort === "name") return String(a.name||"").localeCompare(String(b.name||""),"de");
        if(ui.sort === "date") return new Date(b.createdAt||0)-new Date(a.createdAt||0);
        if(ui.sort === "source") return String(a.source||"").localeCompare(String(b.source||""),"de");
        const am = isMountainium(a) ? 1 : 0, bm = isMountainium(b) ? 1 : 0;
        if(am !== bm) return bm - am;
        const ap = a.stage === "engaged" ? 2 : a.stage === "sales_ready" ? 1 : 0;
        const bp = b.stage === "engaged" ? 2 : b.stage === "sales_ready" ? 1 : 0;
        if(ap !== bp) return bp - ap;
        return (+b.score||0)-(+a.score||0);
      });

      const inboundCount = allItems.filter(isInbound).length;
      const mountainiumCount = allItems.filter(isMountainium).length;

      toolbar = `<div class="panel ww-filterbar">
        <div class="mf" style="min-width:220px"><label>Suche</label><input id="af-q" placeholder="Name, Mail, Branche, Ort, Quelle…" value="${safeEsc(ui.q)}" onkeydown="if(event.key==='Enter')App.applyAcqFilters()"></div>
        <div class="mf"><label>Quelle</label><select id="af-source"><option value="all">Alle Quellen</option>${sources.map(s=>`<option value="${safeEsc(s)}" ${ui.source===s?"selected":""}>${safeEsc(s)}</option>`).join("")}</select></div>
        <div class="mf"><label>Status</label><select id="af-stage"><option value="all">Alle Status</option>${stagesAcq.map(s=>`<option value="${safeEsc(s.id)}" ${ui.stage===s.id?"selected":""}>${safeEsc(s.l)}</option>`).join("")}</select></div>
        <div class="mf"><label>Typ</label><select id="af-inbound"><option value="all" ${ui.inbound==="all"?"selected":""}>Alle</option><option value="mountainium" ${ui.inbound==="mountainium"?"selected":""}>Mountainium zuerst</option><option value="inbound" ${ui.inbound==="inbound"?"selected":""}>Website-Anfragen</option><option value="manual" ${ui.inbound==="manual"?"selected":""}>Manuell/Leadfinder</option></select></div>
        <div class="mf" style="min-width:90px"><label>Min. Score</label><input id="af-score" type="number" min="0" max="100" value="${safeEsc(ui.minScore)}"></div>
        <div class="mf"><label>Sortierung</label><select id="af-sort"><option value="smart" ${ui.sort==="smart"?"selected":""}>Smart</option><option value="score" ${ui.sort==="score"?"selected":""}>Score</option><option value="date" ${ui.sort==="date"?"selected":""}>Datum</option><option value="name" ${ui.sort==="name"?"selected":""}>Name</option><option value="source" ${ui.sort==="source"?"selected":""}>Quelle</option></select></div>
        <button class="btn bg ww-primary" onclick="App.applyAcqFilters()">Filtern</button>
        <button class="btn bg" onclick="App.resetAcqFilters()">Reset</button>
        <div class="ww-filterstats">
          <span class="ww-pill">sichtbar <b>${items.length}</b></span>
          <span class="ww-pill">gesamt <b>${allItems.length}</b></span>
          <span class="ww-pill">Website <b>${inboundCount}</b></span>
          <span class="ww-pill">Mountainium <b>${mountainiumCount}</b></span>
        </div>
      </div>`;
    }

    document.getElementById("v-"+w).innerHTML = `${toolbar}<div class="board">${stages.map(st=>{
      const cards = items.filter(i=>i[kF]===st.id);
      let cls = "col";
      if(al){ if(al.has(st.id)) cls += " dok"; else if(st.id !== this.drag.from) cls += " dno"; }
      return `<div class="${cls}" ondragover="App.dOver(event,'${pl}','${st.id}')" ondrop="App.dDrop(event,'${pl}','${st.id}')">
        <div class="ch"><span class="cn" ${st.t?'style="color:#A8B1B8"':''}>${st.l}</span><span class="cc">${cards.length}</span></div>
        <div class="cb">${cards.length ? cards.map(c=>this.cardH(c,pl,st.id)).join("") : `<div class="ce">leer</div>`}</div>
      </div>`;
    }).join("")}</div>`;
  };

  const oldRenderAll = A.renderAll.bind(A);
  A.renderAll = function(){
    oldRenderAll();
    setTimeout(()=>this.polishV10Text(),0);
  };

  setTimeout(()=>{
    try{
      A.renderAll();
      A.polishV10Text();
      console.log("WebsiteWerk v10.2 Sales-Ready UI aktiv");
    }catch(e){ console.warn("WebsiteWerk v10.2 Fehler:", e); }
  },80);
})();
