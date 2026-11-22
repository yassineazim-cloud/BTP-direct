/* =========================================================
   BTP Direct · Chantiers du Maroc — application
   Données : Supabase (voir config.js) · Carte : Leaflet / OpenStreetMap
   ========================================================= */
"use strict";
const CFG = window.BTP_CONFIG || {};

/* ---------- Constantes ---------- */
const TYPES=["Logement","Bureaux","École","Santé","Route & ouvrage d'art","Équipement sportif","Équipement culturel","Commerce","Hôtellerie","Industrie","Infrastructure","Aménagement urbain","Autre"];
const STATUTS={ao:{l:"Appel d'offres",c:"b-ao",col:"#d19a12"},cours:{l:"En cours",c:"b-cours",col:"#e30a23"},fini:{l:"Terminé",c:"b-fini",col:"#2f7d4f"}};
const ROLES=["Maître d'ouvrage","Maître d'ouvrage délégué","Architecte","Bureau d'études","Bureau de contrôle","Laboratoire","Entreprise générale","Sous-traitant","Fournisseur"];
const SOURCES=["Panneau de chantier photographié","Photo du panneau envoyée par WhatsApp","Avis d'appel d'offres publié sur le portail des marchés publics","Résultats d'appel d'offres (marché public)","Programme prévisionnel des achats publics","Post LinkedIn","Article de presse","Communiqué de presse du maître d'ouvrage","Information recueillie auprès d'un intervenant"];
const PALETTE=["#0e3468","#2f7d4f","#b5562b","#6b4fa0","#a3191f","#8a5a00","#3b6e8f","#4a4f55","#c27b00","#1d6f6a","#33507a","#9a3d64","#2a5f9e","#6d5a3c"];

/* ---------- État ---------- */
let sb=null, SESSION=null, IS_ADMIN=false, SITE_PUBLIC=false, READY=false;
let VILLES={}, CO={}, CH=[];
let ADM={sig:[],dem:[]};

/* ---------- Utilitaires ---------- */
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>(n||0).toLocaleString("fr-FR");
const vNom=v=>VILLES[v]?VILLES[v].n:"";
const badge=st=>STATUTS[st]?`<span class="badge ${STATUTS[st].c}">${STATUTS[st].l}</span>`:"";
const initials=n=>String(n||"?").replace(/\(.*\)/,"").split(/[\s']+/).filter(w=>w.length>2||/^[A-Z]/.test(w)).slice(0,2).map(w=>w[0]).join("").toUpperCase()||"?";
const coLogo=(id,cls="")=>`<div class="co-logo ${cls}" style="background:${esc(CO[id]?.col||"#4a4f55")}">${esc(initials(CO[id]?.n))}</div>`;
const slugify=s=>String(s).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"x";
const norm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
const llOf=c=>(c.lat!=null&&c.lng!=null)?[c.lat,c.lng]:(VILLES[c.v]?VILLES[c.v].ll:[32.2,-6.4]);
const PUB=()=>CH.filter(c=>c.publie);
const rtf=new Intl.RelativeTimeFormat("fr",{numeric:"auto"});
function ago(d){
  if(!d)return"";const s=(new Date(d)-Date.now())/1000,a=Math.abs(s);
  if(a<3600)return rtf.format(Math.round(s/60),"minute");
  if(a<86400)return rtf.format(Math.round(s/3600),"hour");
  if(a<86400*7)return rtf.format(Math.round(s/86400),"day");
  if(a<86400*30)return rtf.format(Math.round(s/604800),"week");
  if(a<86400*365)return rtf.format(Math.round(s/2592000),"month");
  return rtf.format(Math.round(s/31536000),"year");
}
const dateFr=d=>d?new Date(d).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"}):"";
const isNew=c=>Date.now()-new Date(c.created)<7*86400e3;
const pin='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
const lockI='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const verI='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 2.1 3.2-.3.9 3.1 2.8 1.6-1.1 3 1.1 3-2.8 1.6-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1-2.8-1.6 1.1-3-1.1-3 2.8-1.6.9-3.1 3.2.3z"/><path d="M8 12.5l2.6 2.6L16 9.7" stroke="#fff" stroke-width="2" fill="none"/></svg>';
const waI='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>';
function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("show");clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove("show"),3000)}
const waLink=txt=>CFG.WHATSAPP?`https://wa.me/${String(CFG.WHATSAPP).replace(/\D/g,"")}?text=${encodeURIComponent(txt)}`:"";

/* Illustration de chantier (utilisée quand il n'y a pas encore de photo) */
function rnd(seed){let s=seed*9301+49297;return()=>{s=(s*9301+49297)%233280;return s/233280}}
function scene(seed,v){
  const r=rnd(seed*7+v*13);
  const skies=[["#9cc7e8","#e9f1f6"],["#f2b98a","#f7e4cf"],["#7fa9cf","#dbe7ef"],["#b9c7d3","#eef1f3"]];
  const sk=skies[(seed+v)%skies.length];
  const floors=5+Math.floor(r()*8), fh=14, bw=120+r()*90, bx=60+r()*(v===1?40:120), base=200;
  const top=base-floors*fh;
  let s=`<svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="g${seed}${v}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sk[0]}"/><stop offset="1" stop-color="${sk[1]}"/></linearGradient></defs><rect width="400" height="260" fill="url(#g${seed}${v})"/>`;
  for(let i=0;i<5;i++){const w=40+r()*50,h=40+r()*70,x=i*90-20+r()*30;s+=`<rect x="${x}" y="${base-h}" width="${w}" height="${h}" fill="#c9ced3" opacity=".7"/>`;
    for(let k=0;k<Math.floor(h/16);k++)s+=`<rect x="${x+6}" y="${base-h+6+k*16}" width="${w-12}" height="5" fill="#b3b9bf" opacity=".7"/>`}
  s+=`<rect x="${bx}" y="${top}" width="${bw}" height="${floors*fh}" fill="#8d9399" opacity=".25"/>`;
  const cols=Math.max(3,Math.round(bw/26));
  for(let f=0;f<=floors;f++){const y=base-f*fh;s+=`<rect x="${bx-4}" y="${y-3}" width="${bw+8}" height="4" fill="#9ea4a9"/>`}
  for(let c=0;c<=cols;c++){const x=bx+c*bw/cols;s+=`<rect x="${x-2}" y="${top}" width="4" height="${floors*fh}" fill="#a9aeb3"/>`}
  s+=`<rect x="${bx}" y="${top-10}" width="${bw*0.6}" height="8" fill="#d98c3a"/>`;
  const cx=bx+bw+20+r()*30, ch=Math.max(150,base-top+70), ct=base-ch;
  s+=`<g stroke="#e2a10f" stroke-width="2" fill="none"><path d="M${cx-5} ${base}V${ct}M${cx+5} ${base}V${ct}"/>`;
  for(let y=base;y>ct;y-=10)s+=`<path d="M${cx-5} ${y}L${cx+5} ${y-10}"/>`;
  s+=`<path d="M${cx-150} ${ct}H${cx+50}M${cx-150} ${ct+7}H${cx+5}M${cx} ${ct-22}L${cx-150} ${ct}M${cx} ${ct-22}L${cx+50} ${ct}"/></g>`;
  s+=`<rect x="${cx+30}" y="${ct-2}" width="18" height="12" fill="#6b7177"/><rect x="${cx-8}" y="${ct-6}" width="12" height="10" fill="#e2a10f"/>`;
  s+=`<rect y="${base}" width="400" height="60" fill="#b9a68a"/><rect y="${base+8}" width="400" height="34" fill="#f4f4f2"/>`;
  for(let i=0;i<10;i++)s+=`<rect x="${i*40}" y="${base+8}" width="40" height="34" fill="none" stroke="#c9c9c4"/>`;
  s+=`<rect y="${base+8}" width="400" height="5" fill="#e30a23"/><rect x="${150+v*30}" y="${base+16}" width="70" height="22" fill="#f4c430" stroke="#1a1a1a"/><rect x="${156+v*30}" y="${base+21}" width="58" height="3" fill="#1a1a1a"/><rect x="${156+v*30}" y="${base+28}" width="40" height="2" fill="#1a1a1a"/><rect x="${156+v*30}" y="${base+32}" width="48" height="2" fill="#1a1a1a"/>`;
  s+=`<rect y="${base+42}" width="400" height="20" fill="#7d7468"/></svg>`;
  return s;
}
const imgOr=(url,seed,v,alt="")=>url?`<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy" onerror="this.onerror=null;this.outerHTML=scene(${+seed||1},${+v||0})">`:scene(seed,v);

/* ---------- Chargement des données ---------- */
function mapChantier(r){
  return {id:r.id,nom:r.nom,type:r.type,v:r.ville_id,q:r.quartier||"",lat:r.lat,lng:r.lng,st:r.statut,debut:r.debut||"n.c.",fin:r.fin||"n.c.",
    av:r.avancement||0,montant:r.montant||"n.c.",pub:r.marche_public,surf:r.surface||"n.c.",niv:r.gabarit||"n.c.",desc:r.description||"",
    src:{t:r.source_titre||"",by:r.source_par||"",d:r.source_date||"",url:r.source_url||""},
    ints:(r.chantier_intervenants||[]).sort((a,b)=>a.ordre-b.ordre).map(i=>[i.role,i.intervenant_id]).filter(i=>CO[i[1]]),
    photos:r.photos||[],vues:r.vues||0,publie:r.publie,created:r.created_at,updated:r.updated_at,seed:r.id,raw:r};
}
async function loadAll(){
  const [rg,v,i,c]=await Promise.all([
    sb.from("reglages").select("site_public").eq("id",1).maybeSingle(),
    sb.from("villes").select("*").order("ordre"),
    sb.from("intervenants").select("*").order("nom"),
    sb.from("chantiers").select("*,chantier_intervenants(role,intervenant_id,ordre)").order("created_at",{ascending:false})
  ]);
  const err=rg.error||v.error||i.error||c.error; if(err)throw err;
  SITE_PUBLIC=!!(rg.data&&rg.data.site_public);
  VILLES={};v.data.forEach(x=>VILLES[x.id]={n:x.nom,r:x.region,ll:[x.lat,x.lng],z:x.zoom,o:x.ordre});
  CO={};i.data.forEach(x=>CO[x.id]={n:x.nom,k:x.categorie,v:x.ville_id,col:x.couleur,ver:x.verifie,since:x.depuis,eff:x.effectif,d:x.description,raw:x});
  CH=c.data.map(mapChantier);
}
async function checkAdmin(){
  IS_ADMIN=false;
  if(!SESSION)return;
  const {data}=await sb.from("admins").select("user_id").eq("user_id",SESSION.user.id).maybeSingle();
  IS_ADMIN=!!data;
}
async function loadAdmin(){
  const [s,d]=await Promise.all([
    sb.from("signalements").select("*").order("created_at",{ascending:false}).limit(500),
    sb.from("demandes").select("*").order("created_at",{ascending:false}).limit(500)
  ]);
  ADM.sig=s.data||[];ADM.dem=d.data||[];
}
async function refresh(){await loadAll();if(IS_ADMIN)await loadAdmin();updateNav();}
function updateNav(){
  const n=ADM.sig.filter(s=>s.etat==="nouveau").length+ADM.dem.filter(d=>!d.traite).length;
  $("#navAdmin").hidden=!IS_ADMIN;
  $("#navAdmin").innerHTML="Modération"+(n?` <span class="tag" style="background:var(--accent);color:#fff;padding:1px 7px">${n}</span>`:"");
}

/* ---------- Carte ---------- */
let maps=[];
function makeMap(el,list,center,zoom){
  if(!el)return;
  if(!window.L){el.innerHTML='<div class="map-fallback">La carte (OpenStreetMap) s\'affiche avec une connexion internet.</div>';return}
  const m=L.map(el,{scrollWheelZoom:false}).setView(center,zoom);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(m);
  list.forEach(c=>{
    L.circleMarker(llOf(c),{radius:9,color:"#fff",weight:2,fillColor:STATUTS[c.st].col,fillOpacity:1}).addTo(m)
     .bindPopup(`<div class="pop"><b>${esc(c.nom)}</b>${esc(c.q)}${c.q?", ":""}${esc(vNom(c.v))}<br>${STATUTS[c.st].l} · ${esc(c.type)}<br><a href="#/chantier/${c.id}">Voir la fiche →</a></div>`);
  });
  maps.push(m);
  return m;
}
const legend=`<div class="legend">${Object.values(STATUTS).map(s=>`<span><i style="background:${s.col}"></i>${s.l}</span>`).join("")}</div>`;
const fitTo=(m,l,pad=40)=>{if(m&&l.length>1)m.fitBounds(l.map(llOf),{padding:[pad,pad],maxZoom:13})};

/* ---------- Blocs communs ---------- */
function card(c){
  return `<a class="card" href="#/chantier/${c.id}"><div class="thumb">${imgOr(c.photos[0],c.seed,0,c.nom)}${badge(c.st)}${isNew(c)?'<span class="new">Nouveau</span>':""}</div>
   <div class="card-b"><span class="tag" style="align-self:flex-start">${esc(c.type)}</span><h3>${esc(c.nom)}</h3>
   <div class="loc">${pin}${esc(c.q)}${c.q?", ":""}${esc(vNom(c.v))}</div>
   <div class="card-f"><span>${c.montant!=="n.c."?"<b>"+esc(c.montant)+"</b>":"Montant n.c."}</span><span>${esc(ago(c.updated))}</span></div></div></a>`;
}
function adSlot(side){
  return `<div class="ad ${side?"side":""}"><span class="lbl">Espace partenaire</span><div class="logo">Vous</div><div><b>Votre marque ici</b><p>Fournisseurs, fabricants, loueurs de matériel : touchez les décideurs des chantiers en cours au Maroc.</p></div><a class="btn" href="#/" onclick="openPub();return false">Annoncer ici</a></div>`;
}
function ctaBlock(){
  const wa=waLink("Bonjour BTP Direct, je vous signale un chantier :");
  return `<div class="cta"><div><h2>Vous passez devant un chantier ? Signalez-le.</h2><p>Une photo du panneau suffit. Notre équipe vérifie les informations et publie la fiche, avec votre nom si vous le souhaitez.</p>
   <div class="acts"><a class="btn primary lg" href="#/signaler">Signaler un chantier</a>${wa?`<a class="btn wa lg" href="${wa}" target="_blank" rel="noopener">${waI}Par WhatsApp</a>`:""}</div></div>
   <ol class="steps"><li><span class="n">1</span><div><b>Photographiez le panneau</b><span class="muted">ou collez le lien d'un article, d'un post LinkedIn, d'un appel d'offres.</span></div></li>
   <li><span class="n">2</span><div><b>On vérifie</b><span class="muted">Recoupement des intervenants et de la source sous 48 h.</span></div></li>
   <li><span class="n">3</span><div><b>C'est publié</b><span class="muted">Fiche en ligne, carte mise à jour, relais sur LinkedIn.</span></div></li></ol></div>`;
}
const emptyBox=t=>`<div class="empty">${t}<br><a href="#/signaler" style="color:var(--accent);font-weight:600">Vous connaissez un chantier ? Signalez-le.</a></div>`;
const draftNote=()=>IS_ADMIN&&!SITE_PUBLIC?`<div class="wrap"><div class="draft">Site en préparation : seul vous (administrateur) voyez ces chantiers. Ouvrez le site au public depuis <a href="#/admin/reglages">Modération › Réglages</a>.</div></div>`:"";

/* ---------- Écrans publics ---------- */
function vHome(){
  const P=PUB();
  const latest=P.slice(0,8);
  const cityKeys=Object.keys(VILLES);
  const byCity=cityKeys.map(k=>({k,n:P.filter(c=>c.v===k).length})).sort((a,b)=>b.n-a.n||VILLES[a.k].o-VILLES[b.k].o);
  const withCh=byCity.filter(c=>c.n);
  const cities=(withCh.length?withCh:byCity.slice(0,10));
  const nCo=new Set(P.flatMap(c=>c.ints.map(i=>i[1]))).size;
  return `${draftNote()}
  <section class="hero"><div class="wrap">
    <div>
      <h1>Tous les chantiers du Maroc, <em>au même endroit.</em></h1>
      <p class="lead">Qui construit quoi, où et avec qui. Maître d'ouvrage, architecte, bureau d'études, entreprises : chaque chantier est vérifié et sourcé.</p>
      <form class="citysearch" onsubmit="goSearch(event)">
        <input id="hq" list="dlc" placeholder="Une ville, un quartier, une entreprise…" aria-label="Rechercher">
        <datalist id="dlc">${Object.values(VILLES).map(c=>`<option value="${esc(c.n)}">`).join("")}</datalist>
        <select id="ht" aria-label="Type"><option value="">Tous types</option>${TYPES.map(t=>`<option>${esc(t)}</option>`).join("")}</select>
        <button class="btn primary">Rechercher</button>
      </form>
      <div class="quick">${cities.slice(0,6).map(c=>`<a href="#/ville/${c.k}">${esc(VILLES[c.k].n)}${c.n?" · "+c.n:""}</a>`).join("")}</div>
    </div>
    <div class="hero-card">
      <h3>La communauté BTP Direct</h3>
      <div class="stats">
        <div class="stat"><b>${fmt(P.length)}</b><span>chantiers référencés</span></div>
        <div class="stat"><b>${withCh.length}</b><span>villes couvertes</span></div>
        <div class="stat"><b>36 k</b><span>abonnés LinkedIn (profil + page)</span></div>
        <div class="stat"><b>${fmt(nCo)}</b><span>entreprises citées</span></div>
      </div>
      <div class="li"><svg viewBox="0 0 24 24" fill="#fff"><rect width="24" height="24" rx="4" fill="#0a66c2"/><path d="M7 10h2v7H7zM8 6.6a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4zM11 10h2v1c.4-.7 1.2-1.2 2.3-1.2 2 0 2.7 1.2 2.7 3.2v4h-2v-3.6c0-1-.2-1.8-1.2-1.8s-1.4.8-1.4 1.8V17h-2z" fill="#fff"/></svg><span>26 k abonnés sur le profil fondateur, 10 k sur la page BTP Direct. Chaque nouveau chantier est relayé sur LinkedIn.</span></div>
    </div>
  </div></section>

  <section class="blk"><div class="wrap">
    <div class="sec-h"><div><h2>La carte des chantiers</h2><p>Cliquez sur un point pour ouvrir la fiche.</p></div><a class="more" href="#/chantiers">Voir la liste complète →</a></div>
    <div class="mapbox"><div class="map" id="map1"></div>${legend}</div>
  </div></section>

  <section class="blk" style="padding-top:0"><div class="wrap">
    <div class="sec-h"><div><h2>Derniers chantiers ajoutés</h2><p>Vérifiés par l'équipe avant publication.</p></div><a class="more" href="#/chantiers">Tous les chantiers →</a></div>
    ${latest.length?`<div class="grid">${latest.slice(0,4).map(card).join("")}</div>
    <div style="margin:22px 0">${adSlot()}</div>
    ${latest.length>4?`<div class="grid">${latest.slice(4,8).map(card).join("")}</div>`:""}`:emptyBox("Les premiers chantiers arrivent très bientôt.")}
  </div></section>

  <section class="blk" style="padding-top:0"><div class="wrap">
    <div class="sec-h"><div><h2>Parcourir par ville</h2></div><a class="more" href="#/villes">Toutes les villes →</a></div>
    <div class="cities">${cities.map(c=>`<a class="city" href="#/ville/${c.k}"><div><b>${esc(VILLES[c.k].n)}</b><small>${esc(VILLES[c.k].r)}</small></div><span class="n">${c.n}</span></a>`).join("")}</div>
  </div></section>

  <section class="blk" style="padding-top:0"><div class="wrap">${ctaBlock()}</div></section>`;
}

let F={types:new Set(),st:new Set(),tri:"recent",view:"liste",q:""};
function matchQ(c,q){
  if(!q)return true;
  const hay=norm([c.nom,c.q,vNom(c.v),c.type,c.desc,...c.ints.map(i=>CO[i[1]]?.n)].join(" "));
  return norm(q).split(/\s+/).every(w=>hay.includes(w));
}
function vList(cityKey){
  const city=cityKey?VILLES[cityKey]:null;
  const base=PUB().filter(c=>!cityKey||c.v===cityKey);
  const cnt=(k,v)=>base.filter(c=>c[k]===v).length;
  return `${draftNote()}<div class="wrap">
   <div class="crumbs"><a href="#/">Accueil</a> › ${city?`<a href="#/villes">Villes</a> › ${esc(city.n)}`:"Tous les chantiers"}</div>
   <div class="page-h"><div><h1>${city?"Chantiers à "+esc(city.n):"Tous les chantiers"}</h1><p>${city?esc(city.r)+" · ":""}<span id="nres">${base.length}</span> chantiers référencés${F.q?` · recherche « ${esc(F.q)} » <a href="#/" onclick="F.q='';route();return false" style="color:var(--accent)">effacer</a>`:""}</p></div>
    ${city?`<select class="btn" onchange="location.hash='#/ville/'+this.value" aria-label="Changer de ville">${Object.entries(VILLES).map(([k,c])=>`<option value="${k}" ${k===cityKey?"selected":""}>${esc(c.n)}</option>`).join("")}</select>`:""}</div>
   <div class="layout">
    <aside class="filters">
     <h3>Statut</h3>${Object.entries(STATUTS).map(([k,s])=>`<label class="opt"><input type="checkbox" data-f="st" value="${k}" ${F.st.has(k)?"checked":""}><span class="badge ${s.c}">${s.l}</span><span class="c">${cnt("st",k)}</span></label>`).join("")}
     <h3>Type de chantier</h3>${TYPES.filter(t=>cnt("type",t)||F.types.has(t)).map(t=>`<label class="opt"><input type="checkbox" data-f="types" value="${esc(t)}" ${F.types.has(t)?"checked":""}>${esc(t)}<span class="c">${cnt("type",t)}</span></label>`).join("")||'<p class="muted" style="font-size:13px;margin:0">Aucun chantier pour le moment.</p>'}
     ${!city?`<h3>Ville</h3><select onchange="if(this.value)location.hash='#/ville/'+this.value"><option value="">Toutes les villes</option>${Object.entries(VILLES).map(([k,c])=>`<option value="${k}">${esc(c.n)}</option>`).join("")}</select>`:""}
     <h3>Montant</h3><label class="opt"><input type="checkbox" id="fMont">Marchés publics uniquement</label>
     <div style="margin-top:16px">${adSlot(true)}</div>
    </aside>
    <div>
     <div class="toolbar">
      <div class="seg" id="segV"><button data-v="liste" aria-pressed="${F.view==="liste"}">Liste</button><button data-v="carte" aria-pressed="${F.view==="carte"}">Carte</button></div>
      <label class="muted" style="font-size:14px">Trier par <select id="tri" style="border:1px solid var(--line);border-radius:8px;padding:6px 8px;background:var(--surface)"><option value="recent">Plus récents</option><option value="vues">Plus consultés</option><option value="av">Avancement</option></select></label>
     </div>
     <div id="res"></div>
    </div>
   </div></div>`;
}
function bindList(cityKey){
  const city=cityKey?VILLES[cityKey]:null;
  const draw=()=>{
    maps.forEach(m=>m.remove());maps=[];
    let l=PUB().filter(c=>(!cityKey||c.v===cityKey)&&(!F.types.size||F.types.has(c.type))&&(!F.st.size||F.st.has(c.st))&&(!$("#fMont").checked||c.pub)&&matchQ(c,F.q));
    l.sort((a,b)=>F.tri==="vues"?b.vues-a.vues:F.tri==="av"?b.av-a.av:new Date(b.created)-new Date(a.created));
    $("#nres").textContent=l.length;
    const r=$("#res");
    if(!l.length){r.innerHTML=emptyBox("Aucun chantier ne correspond pour le moment.");return}
    if(F.view==="carte"){r.innerHTML=`<div class="mapbox"><div class="map" id="map2" style="height:560px"></div>${legend}</div>`;
      fitTo(makeMap($("#map2"),l,city?city.ll:[32.4,-6.6],city?city.z:6),l);}
    else r.innerHTML=`<div class="grid">${l.map(card).join("")}</div>`;
  };
  $$(".filters input[data-f]").forEach(i=>i.onchange=()=>{const s=F[i.dataset.f];i.checked?s.add(i.value):s.delete(i.value);draw()});
  $("#fMont").onchange=draw;
  $("#tri").value=F.tri;$("#tri").onchange=e=>{F.tri=e.target.value;draw()};
  $("#segV").onclick=e=>{const b=e.target.closest("button");if(!b)return;F.view=b.dataset.v;$$("#segV button").forEach(x=>x.setAttribute("aria-pressed",x===b));draw()};
  draw();
}

function vVilles(){
  const P=PUB();
  const list=Object.entries(VILLES).map(([k,c])=>({k,c,n:P.filter(x=>x.v===k).length})).sort((a,b)=>b.n-a.n||a.c.o-b.c.o);
  return `${draftNote()}<div class="wrap"><div class="crumbs"><a href="#/">Accueil</a> › Villes</div>
   <div class="page-h"><div><h1>Chantiers par ville</h1><p>${list.filter(x=>x.n).length} villes avec des chantiers référencés.</p></div></div>
   <div class="mapbox" style="margin-bottom:22px"><div class="map" id="map1"></div>${legend}</div>
   <div class="cities">${list.map(({k,c,n})=>`<a class="city" href="#/ville/${k}"><div><b>${esc(c.n)}</b><small>${esc(c.r)}</small></div><span class="n">${n}</span></a>`).join("")}</div></div>`;
}

function vDetail(id){
  const c=CH.find(x=>x.id==id); if(!c||(!c.publie&&!IS_ADMIN)) return vNotFound();
  const city=VILLES[c.v]||{n:"",r:""};
  const eg=c.ints.find(i=>i[0]==="Entreprise générale");
  const mo=c.ints.find(i=>i[0].startsWith("Maître d'ouvrage"));
  const phases=c.st==="ao"?[["Annonce du projet","done"],["Appel d'offres en cours","now"],["Attribution",""],["Démarrage des travaux",""],["Livraison",""]]
   :c.st==="cours"?[["Appel d'offres / consultation","done"],["Démarrage des travaux · "+c.debut,"done"],["Travaux en cours · "+c.av+" %","now"],["Livraison prévue · "+c.fin,""]]
   :[["Démarrage des travaux · "+c.debut,"done"],["Travaux","done"],["Réception · "+c.fin,"done"]];
  const similar=PUB().filter(x=>x.id!==c.id&&(x.v===c.v||x.type===c.type)).slice(0,3);
  const ph=c.photos, n=ph.length;
  const cap=c.src.d?`Photo · ${esc(c.src.d)}`:"Photo";
  let gal;
  if(!n) gal=`<div class="gallery"><div>${scene(c.seed,0)}<span class="cap">Illustration · photo à venir</span></div><div>${scene(c.seed,1)}</div><div>${scene(c.seed,2)}</div></div>`;
  else if(n===1) gal=`<div class="gallery g1"><div><img src="${esc(ph[0])}" alt="${esc(c.nom)}" onclick="openLb(${c.id},0)"><span class="cap">${cap}</span></div></div>`;
  else if(n===2) gal=`<div class="gallery g2"><div><img src="${esc(ph[0])}" alt="${esc(c.nom)}" onclick="openLb(${c.id},0)"><span class="cap">${cap}</span></div><div><img src="${esc(ph[1])}" alt="" onclick="openLb(${c.id},1)"></div></div>`;
  else gal=`<div class="gallery"><div><img src="${esc(ph[0])}" alt="${esc(c.nom)}" onclick="openLb(${c.id},0)"><span class="cap">${cap}</span></div><div><img src="${esc(ph[1])}" alt="" onclick="openLb(${c.id},1)"></div><div><img src="${esc(ph[2])}" alt="" onclick="openLb(${c.id},2)">${n>3?`<span class="cnt">+ ${n-3} photo${n>4?"s":""}</span>`:""}</div></div>`;
  return `<div class="wrap">
   <div class="crumbs"><a href="#/">Accueil</a> › <a href="#/ville/${c.v}">${esc(city.n)}</a> › ${esc(c.nom)}</div>
   ${!c.publie?`<div class="draft" style="margin-bottom:12px">Brouillon : cette fiche n'est pas visible du public. <a href="#/admin/edit/${c.id}">Modifier</a></div>`:IS_ADMIN?`<div style="text-align:right;margin-bottom:8px"><a class="btn" href="#/admin/edit/${c.id}">✎ Modifier cette fiche</a></div>`:""}
   ${gal}
   <div class="detail">
    <div>
     <div class="d-h">${badge(c.st)}<span class="tag">${esc(c.type)}</span>${c.pub?'<span class="tag" style="background:var(--fini-soft);color:var(--fini)">Marché public</span>':'<span class="tag">Projet privé</span>'}</div>
     <h1>${esc(c.nom)}</h1>
     <p class="sub">${pin.replace("<svg",'<svg width="16" height="16"')}${esc(c.q)}${c.q?", ":""}${esc(city.n)} · ${esc(city.r)} · Mis à jour ${esc(ago(c.updated))} · ${fmt(c.vues)} vues</p>
     <div class="facts">
      <div class="fact"><span>Montant</span><b>${esc(c.montant)}</b></div>
      <div class="fact"><span>Démarrage</span><b>${esc(c.debut)}</b></div>
      <div class="fact"><span>${c.st==="fini"?"Livré":"Livraison"}</span><b>${esc(c.fin)}</b></div>
      <div class="fact"><span>Surface / taille</span><b>${esc(c.surf)}</b></div>
      <div class="fact"><span>Gabarit</span><b>${esc(c.niv)}</b></div>
     </div>
     ${c.desc?`<div class="panel"><h2>Le projet</h2><p style="margin:0;white-space:pre-line">${esc(c.desc)}</p></div>`:""}
     <div class="panel"><h2>Intervenants</h2>
      ${c.ints.length?`<table class="ints"><thead><tr><th>Rôle</th><th>Société</th><th class="c-contact">Contact</th></tr></thead><tbody>
      ${c.ints.map(([r,id])=>`<tr><td class="role">${esc(r)}</td><td><a href="#/entreprise/${esc(id)}">${esc(CO[id].n)}</a> ${CO[id].ver?`<span class="ver" title="Profil vérifié">${verI}</span>`:""}</td><td class="c-contact"><button class="lock" onclick="openContact(${c.id},'${esc(id)}')">${lockI}<span class="blur">+212 6 •• •• •• ••</span></button></td></tr>`).join("")}
      </tbody></table>`:'<p class="muted" style="margin:0">Intervenants en cours d\'identification.</p>'}
      <p class="muted" style="font-size:13px;margin:12px 0 0">Vous êtes intervenant sur ce chantier et n'apparaissez pas ? <a href="#/" onclick="openCorrection(${c.id},true);return false" style="color:var(--accent);font-weight:600">Ajoutez votre société</a></p>
     </div>
     <div class="panel"><h2>Avancement</h2><ul class="timeline">${phases.map(([t,s])=>`<li class="${s}">${esc(t)}</li>`).join("")}</ul></div>
     <div class="panel"><h2>Localisation</h2><div class="mapbox"><div class="map sm" id="map1"></div></div><p class="muted" style="font-size:13px;margin:8px 0 0">Position approximative, ${esc(c.q)}${c.q?", ":""}${esc(city.n)}.</p></div>
     <div class="panel"><h2>Source</h2>
      <div class="source"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/></svg><div><b>${esc(c.src.t||"Source BTP Direct")}</b><br>${esc(c.src.by)}${c.src.by&&c.src.d?" · ":""}${esc(c.src.d)}${c.src.url&&/^https?:\/\//i.test(c.src.url)?`<br><a href="${esc(c.src.url)}" target="_blank" rel="noopener nofollow" style="color:var(--brand);font-weight:600">Consulter la source ↗</a>`:""}<br><span class="muted">Vérifié par l'équipe BTP Direct avant publication.</span></div></div>
      <p class="muted" style="font-size:13px;margin:12px 0 0">Une information est inexacte ? <a href="#/" onclick="openCorrection(${c.id});return false" style="color:var(--accent);font-weight:600">Proposer une correction</a></p>
     </div>
    </div>
    <aside>
     <div class="panel contact-box"><h2>Travailler sur ce chantier</h2>
      <p>Vous êtes fournisseur, sous-traitant ou bureau d'études ? Obtenez les coordonnées des décideurs.</p>
      ${mo?`<div class="lockrow"><span>Maître d'ouvrage</span><span class="lock">${lockI}<span class="blur">contact@••••••.ma</span></span></div>`:""}
      ${eg?`<div class="lockrow"><span>Conducteur de travaux</span><span class="lock">${lockI}<span class="blur">+212 6 •• •• ••</span></span></div>`:""}
      <div class="lockrow"><span>Responsable achats</span><span class="lock">${lockI}<span class="blur">achats@••••••.ma</span></span></div>
      <button class="btn primary lg" onclick="openContact(${c.id})">Obtenir le contact</button>
      <div class="note">Mise en relation à l'unité ou incluse dans l'abonnement Pro</div>
     </div>
     ${c.ints.filter(i=>i[0]!=="Sous-traitant"&&i[0]!=="Fournisseur").length?`<div class="panel" style="padding:4px;background:var(--panel);border:0">
      <div class="panneau-in">
       <div class="panneau-h"><strong>${esc(c.nom)}</strong><span class="ar">لوحة الورش</span></div>
       ${c.ints.filter(i=>i[0]!=="Sous-traitant"&&i[0]!=="Fournisseur").map(([r,id])=>`<div class="prow"><i>${esc(r)}</i><span>${esc(CO[id].n)}</span></div>`).join("")}
       <div class="prow"><i>Délai</i><span>${esc(c.debut)} → ${esc(c.fin)}</span></div>
      </div>
     </div>`:""}
     <div class="panel"><h2>Suivre ce chantier</h2><p class="muted" style="font-size:14px;margin:0 0 12px">Recevez une alerte à chaque mise à jour (attribution, avancement, livraison).</p>
      <div class="share"><button class="btn" onclick="openAlerte(${c.id})">🔔 Suivre</button><button class="btn" onclick="share(${c.id})">Partager</button></div></div>
     <div style="margin-top:16px">${adSlot(true)}</div>
    </aside>
   </div>
   ${similar.length?`<section class="blk"><div class="sec-h"><h2>Chantiers similaires</h2></div><div class="grid">${similar.map(card).join("")}</div></section>`:""}
  </div>`;
}

const chOf=id=>PUB().filter(c=>c.ints.some(i=>i[1]===id));
function vCompany(id){
  const co=CO[id]; if(!co) return vNotFound();
  const list=chOf(id);
  const roles=[...new Set(list.flatMap(c=>c.ints.filter(i=>i[1]===id).map(i=>i[0])))];
  const villes=[...new Set(list.map(c=>vNom(c.v)))];
  return `${draftNote()}<div class="wrap"><div class="crumbs"><a href="#/">Accueil</a> › <a href="#/entreprises">Entreprises</a> › ${esc(co.n)}</div>
   <div class="co-h">${coLogo(id)}<div><h1>${esc(co.n)} ${co.ver?`<span class="ver">${verI}Profil vérifié</span>`:""}</h1>
    <div class="meta"><span>${esc(co.k)}</span>${co.v&&VILLES[co.v]?`<span>Siège : ${esc(vNom(co.v))}</span>`:""}${co.since?`<span>Depuis ${esc(co.since)}</span>`:""}${co.eff?`<span>${esc(co.eff)} salariés</span>`:""}</div></div>
    <div class="acts">${IS_ADMIN?`<button class="btn" onclick="editCo('${esc(id)}')">✎ Modifier</button>`:""}<button class="btn primary" onclick="openContact(null,'${esc(id)}')">Obtenir le contact</button></div></div>
   <div class="co-stats">
    <div class="fact"><span>Chantiers référencés</span><b>${list.length}</b></div>
    <div class="fact"><span>En cours</span><b>${list.filter(c=>c.st==="cours").length}</b></div>
    <div class="fact"><span>Terminés</span><b>${list.filter(c=>c.st==="fini").length}</b></div>
    <div class="fact"><span>Villes</span><b>${villes.length}</b></div>
   </div>
   ${co.ver?"":`<div class="claim"><div><b>C'est votre entreprise ?</b><p>Revendiquez ce profil gratuitement : ajoutez votre logo, vos références et vos contacts, et soyez visible auprès des maîtres d'ouvrage.</p></div><button class="btn brand" onclick="openClaim('${esc(id)}')">Revendiquer ce profil</button></div>`}
   <div class="detail" style="margin-top:0">
    <div>
     <div class="sec-h"><div><h2>Ses chantiers</h2>${roles.length?`<p>Rôles : ${esc(roles.join(", "))}</p>`:""}</div></div>
     ${list.length?`<div class="grid">${list.map(card).join("")}</div>`:'<div class="empty">Aucun chantier publié pour le moment.</div>'}
    </div>
    <aside>
     ${co.d?`<div class="panel"><h2>À propos</h2><p style="margin:0;font-size:14px;white-space:pre-line">${esc(co.d)}</p></div>`:""}
     <div class="panel"><h2>Implantation</h2><div class="mapbox"><div class="map sm" id="map1" style="height:220px"></div></div></div>
     <div class="panel contact-box"><h2>Coordonnées</h2>
      <div class="lockrow"><span>Téléphone</span><span class="lock">${lockI}<span class="blur">+212 5 •• •• •• ••</span></span></div>
      <div class="lockrow"><span>E-mail</span><span class="lock">${lockI}<span class="blur">contact@••••••.ma</span></span></div>
      <div class="lockrow"><span>Dirigeant</span><span class="lock">${lockI}<span class="blur">M. •••••• ••••••</span></span></div>
      <button class="btn primary" onclick="openContact(null,'${esc(id)}')">Débloquer les coordonnées</button></div>
    </aside>
   </div></div>`;
}

function vCompanies(){
  const n=id=>chOf(id).length;
  const ids=Object.keys(CO).filter(id=>IS_ADMIN||n(id));
  const cats=[...ROLES,...new Set(ids.map(id=>CO[id].k).filter(k=>!ROLES.includes(k)))];
  const groups=cats.map(r=>[r,ids.filter(id=>CO[id].k===r)]).filter(g=>g[1].length);
  const plural=r=>r.startsWith("Maître d'ouvrage")?r.replace("Maître","Maîtres"):r.replace(/^(\S+)/,"$1s").replace("Bureaus","Bureaux");
  return `${draftNote()}<div class="wrap"><div class="crumbs"><a href="#/">Accueil</a> › Entreprises</div>
   <div class="page-h"><div><h1>Entreprises et intervenants</h1><p>Chaque société citée sur un chantier a son profil et la liste de ses références.</p></div></div>
   ${groups.length?groups.map(([r,ids])=>`<h2 style="font-size:19px;margin:22px 0 12px">${esc(plural(r))}</h2><div class="co-list">${ids.map(id=>`<a class="co-item" href="#/entreprise/${esc(id)}">${coLogo(id)}<div><b>${esc(CO[id].n)} ${CO[id].ver?`<span class="ver">${verI}</span>`:""}</b><small>${CO[id].v&&VILLES[CO[id].v]?esc(vNom(CO[id].v))+" · ":""}${n(id)} chantier${n(id)>1?"s":""}</small></div></a>`).join("")}</div>`).join(""):'<div class="empty">Les entreprises apparaîtront ici dès la publication des premiers chantiers.</div>'}
  </div>`;
}

/* ---------- Signaler un chantier ---------- */
let SIG_POS=null;
function vSignal(){
  SIG_POS=null;
  const wa=waLink("Bonjour BTP Direct, je vous signale un chantier. Voici la photo du panneau et la localisation :");
  return `<div class="wrap"><div class="crumbs"><a href="#/">Accueil</a> › Signaler un chantier</div>
   <div class="page-h"><div><h1>Signaler un chantier</h1><p>Chaque signalement est vérifié par l'équipe avant publication, en général sous 48 h.</p></div></div>
   <div class="form-wrap">
    <form class="form" id="sigForm" onsubmit="submitSignal(event)">
     <div id="sigErr"></div>
     <h2>Le chantier</h2>
     <div class="field"><label for="sNom">Nom ou description du projet</label><input id="sNom" required minlength="2" maxlength="300" placeholder="Ex. : Immeuble R+8 boulevard Zerktouni"></div>
     <div class="row">
      <div class="field"><label for="sType">Type</label><select id="sType">${TYPES.map(t=>`<option>${esc(t)}</option>`).join("")}</select></div>
      <div class="field"><label for="sVille">Ville</label><select id="sVille">${Object.entries(VILLES).map(([k,c])=>`<option value="${k}">${esc(c.n)}</option>`).join("")}</select></div>
     </div>
     <div class="field"><label for="sQ">Quartier ou adresse <span class="hint">(ou position GPS)</span></label><div style="display:flex;gap:8px"><input id="sQ" maxlength="300" placeholder="Ex. : Maârif, angle rue X"><button type="button" class="btn" onclick="getPos(this)">📍 Ma position</button></div></div>
     <div class="field"><span class="lab">Statut</span><div class="radios">${Object.entries(STATUTS).map(([k,s],i)=>`<label><input type="radio" name="st" value="${k}" ${i===1?"checked":""}>${s.l}</label>`).join("")}<label><input type="radio" name="st" value="">Je ne sais pas</label></div></div>
     <h2>Photos et source</h2>
     <label class="drop"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="12" rx="1"/><path d="M7 16v4M17 16v4M7 8h10M7 12h6"/></svg><b>Photo du panneau de chantier</b><br>Idéalement lisible : autorisation, maître d'ouvrage, architecte, entreprises<input type="file" id="sPh1" accept="image/*" onchange="this.parentElement.querySelector('b').textContent=this.files[0]?'✓ '+this.files[0].name:'Photo du panneau de chantier'"></label>
     <div style="height:12px"></div>
     <label class="drop" style="padding:14px"><b>Autres photos du chantier</b> <span>(facultatif, 5 max)</span><input type="file" id="sPh2" accept="image/*" multiple onchange="this.parentElement.querySelector('b').textContent='✓ '+Math.min(5,this.files.length)+' photo(s)'"></label>
     <div class="field" style="margin-top:14px"><label for="sSrc">Lien vers une source <span class="hint">(article, post LinkedIn, avis d'appel d'offres)</span></label><input id="sSrc" type="url" maxlength="1000" placeholder="https://"></div>
     <h2>Intervenants connus <span class="muted" style="font-family:var(--f-body);font-weight:500;font-size:14px">(facultatif)</span></h2>
     <div class="row">${["Maître d'ouvrage","Architecte","Bureau d'études","Entreprise générale"].map((r,i)=>`<div class="field"><label for="sI${i}">${r}</label><input id="sI${i}" data-role="${esc(r)}" maxlength="200" placeholder="Nom de la société"></div>`).join("")}</div>
     <div class="field"><label for="sNote">Autres informations</label><textarea id="sNote" maxlength="5000" placeholder="Montant, dates, sous-traitants, avancement…"></textarea></div>
     <h2>Vous</h2>
     <div class="row"><div class="field"><label for="sName">Nom</label><input id="sName" maxlength="200" placeholder="Prénom Nom"></div><div class="field"><label for="sTel">Téléphone ou e-mail</label><input id="sTel" maxlength="200" placeholder="Pour vous recontacter si besoin"></div></div>
     <label class="check"><input type="checkbox" id="sCite" checked>Citer mon nom comme contributeur sur la fiche publiée</label>
     <button class="btn primary lg" style="width:100%" id="sBtn">Envoyer pour vérification</button>
    </form>
    <aside>
     ${wa?`<div class="side-box wa-box"><h3>Plus rapide : WhatsApp</h3><p>Envoyez simplement la photo du panneau et la localisation. On s'occupe du reste.</p>
      <a class="btn wa lg" href="${wa}" target="_blank" rel="noopener">${waI}Envoyer sur WhatsApp</a></div>`:""}
     <div class="side-box"><h3>Comment c'est vérifié</h3>
      <ol class="steps"><li><span class="n">1</span><div><b>Réception</b><span class="muted">Le signalement arrive dans la file de modération.</span></div></li>
      <li><span class="n">2</span><div><b>Recoupement</b><span class="muted">Panneau, autorisation, presse, contact des intervenants.</span></div></li>
      <li><span class="n">3</span><div><b>Publication</b><span class="muted">La fiche est mise en ligne avec sa source et relayée sur LinkedIn.</span></div></li></ol></div>
     <div class="side-box"><h3>Contributeurs du mois</h3><p style="margin:0">Les meilleurs contributeurs sont mis en avant dans le post LinkedIn mensuel.</p></div>
    </aside>
   </div></div>`;
}
function getPos(btn){
  if(!navigator.geolocation){toast("Localisation non disponible sur cet appareil");return}
  btn.disabled=true;btn.textContent="📍 …";
  navigator.geolocation.getCurrentPosition(p=>{
    SIG_POS=[+p.coords.latitude.toFixed(6),+p.coords.longitude.toFixed(6)];
    const q=$("#sQ"); if(!q.value)q.value=`Position GPS ${SIG_POS[0]}, ${SIG_POS[1]}`;
    btn.disabled=false;btn.textContent="📍 Position ✓";toast("Position récupérée");
  },()=>{btn.disabled=false;btn.textContent="📍 Ma position";toast("Impossible de récupérer la position")},{enableHighAccuracy:true,timeout:15000});
}
async function compress(file,max=1600){
  try{
    const img=await createImageBitmap(file);
    const s=Math.min(1,max/Math.max(img.width,img.height));
    const cv=document.createElement("canvas");cv.width=Math.round(img.width*s);cv.height=Math.round(img.height*s);
    cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);
    const b=await new Promise(r=>cv.toBlob(r,"image/jpeg",.82));
    if(b)return b;
  }catch(e){}
  if(/^image\/(jpeg|png|webp)$/.test(file.type))return file;
  throw new Error("Format d'image non pris en charge : "+file.name);
}
async function uploadPhoto(file,folder){
  const blob=await compress(file);
  const path=`${folder}/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.jpg`;
  const {error}=await sb.storage.from("photos").upload(path,blob,{contentType:blob.type||"image/jpeg",upsert:false});
  if(error)throw error;
  return sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
}
async function submitSignal(e){
  e.preventDefault();
  const btn=$("#sBtn");btn.disabled=true;btn.textContent="Envoi en cours…";$("#sigErr").innerHTML="";
  try{
    const files=[...$("#sPh1").files,...[...$("#sPh2").files].slice(0,5)];
    const photos=[];
    for(const f of files){btn.textContent=`Envoi des photos (${photos.length+1}/${files.length})…`;photos.push(await uploadPhoto(f,"signalements"))}
    const ints={};$$("[data-role]").forEach(i=>{if(i.value.trim())ints[i.dataset.role]=i.value.trim()});
    const st=(document.querySelector('input[name="st"]:checked')||{}).value||null;
    const nom=$("#sNom").value.trim(), v=$("#sVille").value;
    const {error}=await sb.from("signalements").insert({nom,type:$("#sType").value,ville_id:v,quartier:$("#sQ").value.trim()||null,
      lat:SIG_POS?SIG_POS[0]:null,lng:SIG_POS?SIG_POS[1]:null,statut:st,source_url:$("#sSrc").value.trim()||null,intervenants:ints,
      note:$("#sNote").value.trim()||null,contributeur_nom:$("#sName").value.trim()||null,contributeur_contact:$("#sTel").value.trim()||null,
      citer:$("#sCite").checked,photos});
    if(error)throw error;
    $("#sigForm").outerHTML=`<div class="form success"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><h2 style="border:0;padding:0;margin:0;font-size:24px">Merci, c'est reçu !</h2><p>« ${esc(nom)} » à ${esc(vNom(v))} est en attente de vérification par l'équipe. La fiche sera publiée dès qu'elle sera validée.</p><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn" href="#/">Retour à l'accueil</a><a class="btn primary" href="#/signaler" onclick="setTimeout(route,0)">Signaler un autre chantier</a></div></div>`;
    window.scrollTo({top:0,behavior:"smooth"});
  }catch(err){
    console.error(err);
    $("#sigErr").innerHTML=`<div class="err">L'envoi n'a pas abouti : ${esc(err.message||err)}. Réessayez, ou envoyez-nous la photo par WhatsApp.</div>`;
    btn.disabled=false;btn.textContent="Envoyer pour vérification";window.scrollTo({top:0,behavior:"smooth"});
  }
}

/* ---------- Demandes (contact, abonnement, alerte, pub, correction, revendication) ---------- */
function openModal(html){$("#modalC").innerHTML=`<button class="x" onclick="closeModal()" aria-label="Fermer">×</button>`+html;$("#modal").classList.add("open")}
function closeModal(){$("#modal").classList.remove("open")}
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeModal();closeLb()}if($("#lb").classList.contains("open")){if(e.key==="ArrowLeft")lbGo(-1);if(e.key==="ArrowRight")lbGo(1)}});
let DEM={};
function demandeForm(o){
  DEM=o;
  const f=o.fields||["nom","societe","telephone","email","message"];
  const L={nom:["Nom et prénom","text",true],societe:["Société","text",false],telephone:["Téléphone","tel",false],email:["E-mail","email",false],message:[o.msgLabel||"Message","area",!!o.msgRequired]};
  return `<form id="demForm" onsubmit="sendDemande(event)"><div id="demErr"></div>
   <div class="row">${f.filter(k=>k!=="message").map(k=>`<div class="field"><label for="d_${k}">${L[k][0]}</label><input id="d_${k}" type="${L[k][1]}" maxlength="200" ${L[k][2]?"required":""}></div>`).join("")}</div>
   ${f.includes("message")?`<div class="field"><label for="d_message">${L.message[0]}</label><textarea id="d_message" maxlength="5000" ${L.message[2]?"required":""} placeholder="${esc(o.msgPh||"")}"></textarea></div>`:""}
   <button class="btn primary lg" style="width:100%" id="demBtn">${esc(o.btn||"Envoyer")}</button>
   <p class="fine">Vos coordonnées sont uniquement utilisées par l'équipe BTP Direct pour vous répondre.</p></form>`;
}
async function sendDemande(e){
  e.preventDefault();
  const g=k=>{const el=$("#d_"+k);return el?el.value.trim()||null:null};
  if(!g("telephone")&&!g("email")&&DEM.type!=="correction"){$("#demErr").innerHTML='<div class="err">Indiquez au moins un téléphone ou un e-mail pour qu\'on puisse vous répondre.</div>';return}
  const btn=$("#demBtn");btn.disabled=true;btn.textContent="Envoi…";
  const {error}=await sb.from("demandes").insert({type:DEM.type,chantier_id:DEM.chantier_id||null,intervenant_id:DEM.intervenant_id||null,offre:DEM.offre||null,
    nom:g("nom"),societe:g("societe"),telephone:g("telephone"),email:g("email"),message:g("message")});
  if(error){console.error(error);$("#demErr").innerHTML=`<div class="err">L'envoi n'a pas abouti. Réessayez dans un instant.</div>`;btn.disabled=false;btn.textContent=DEM.btn||"Envoyer";return}
  $("#modalC").innerHTML=`<button class="x" onclick="closeModal()" aria-label="Fermer">×</button><div class="success" style="padding:20px 0"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><h2 style="padding:0">Demande envoyée</h2><p>${esc(DEM.ok||"Merci ! L'équipe BTP Direct vous recontacte très vite.")}</p><button class="btn" onclick="closeModal()">Fermer</button></div>`;
}
function openContact(cid,coid){
  const c=cid?CH.find(x=>x.id===cid):null;
  const who=coid&&CO[coid]?CO[coid].n:(c?"les intervenants de « "+c.nom+" »":"");
  openModal(`<h2>Obtenir le contact</h2><p>Accédez aux coordonnées de ${esc(who)} : nom du décideur, téléphone, e-mail.</p>
   <div class="plans">
    <div class="plan"><b>Mise en relation</b><div class="price">149 <small>MAD / contact</small></div><ul><li>1 contact vérifié</li><li>Mise en relation par l'équipe</li></ul><button class="btn" onclick="contactStep(${cid||"null"},${coid?`'${esc(coid)}'`:"null"},'Mise en relation')">Choisir</button></div>
    <div class="plan best"><b>Abonnement Pro</b><div class="price">490 <small>MAD / mois</small></div><ul><li>Contacts illimités</li><li>Alertes appels d'offres par ville</li><li>Export Excel</li></ul><button class="btn primary" onclick="contactStep(${cid||"null"},${coid?`'${esc(coid)}'`:"null"},'Abonnement Pro')">Essai gratuit 14 jours</button></div>
   </div><p class="fine">Laissez vos coordonnées à l'étape suivante, l'équipe vous recontacte pour finaliser.</p>`);
}
function contactStep(cid,coid,offre){
  const c=cid?CH.find(x=>x.id===cid):null;
  openModal(`<h2>${esc(offre)}</h2><p>${c?"Chantier : « "+esc(c.nom)+" ». ":""}${coid&&CO[coid]?"Société : "+esc(CO[coid].n)+". ":""}Laissez vos coordonnées, on vous recontacte rapidement.</p>`+
   demandeForm({type:offre==="Abonnement Pro"?"abonnement":"contact",chantier_id:cid,intervenant_id:coid,offre,btn:"Envoyer ma demande",msgLabel:"Votre besoin (facultatif)",msgPh:"Ex. : je suis fournisseur d'aluminium et je cherche le responsable achats",ok:"Merci ! L'équipe BTP Direct vous recontacte sous 24 h pour la mise en relation."}));
}
function openPlans(){
  openModal(`<h2>Abonnement Pro</h2><p>Pour les fournisseurs, sous-traitants et bureaux d'études qui cherchent des chantiers : contacts des décideurs, alertes et exports.</p>
   <div class="plans">
    <div class="plan"><b>Mise en relation</b><div class="price">149 <small>MAD / contact</small></div><ul><li>1 contact vérifié</li><li>Mise en relation par l'équipe</li></ul><button class="btn" onclick="contactStep(null,null,'Mise en relation')">Choisir</button></div>
    <div class="plan best"><b>Abonnement Pro</b><div class="price">490 <small>MAD / mois</small></div><ul><li>Contacts illimités</li><li>Alertes appels d'offres par ville</li><li>Export Excel</li></ul><button class="btn primary" onclick="contactStep(null,null,'Abonnement Pro')">Essai gratuit 14 jours</button></div>
   </div>`);
}
function openAlerte(cid){const c=CH.find(x=>x.id===cid);openModal(`<h2>Suivre ce chantier</h2><p>« ${esc(c.nom)} » : on vous prévient à chaque mise à jour.</p>`+demandeForm({type:"alerte",chantier_id:cid,fields:["nom","telephone","email"],btn:"Activer l'alerte",ok:"C'est noté, vous serez prévenu des mises à jour de ce chantier."}))}
function openPub(){openModal(`<h2>Annoncer sur BTP Direct</h2><p>Mettez votre marque devant les décideurs des chantiers : site, newsletter et LinkedIn (36 k abonnés).</p>`+demandeForm({type:"pub",btn:"Être recontacté",msgLabel:"Votre projet (facultatif)",msgPh:"Produit, villes visées, budget…",ok:"Merci ! On vous recontacte avec nos offres partenaires."}))}
function openCorrection(cid,ajout){const c=CH.find(x=>x.id===cid);openModal(`<h2>${ajout?"Ajouter votre société":"Proposer une correction"}</h2><p>Chantier : « ${esc(c.nom)} ».</p>`+demandeForm({type:"correction",chantier_id:cid,fields:["nom","societe","telephone","email","message"],msgRequired:true,msgLabel:ajout?"Votre rôle sur ce chantier":"Qu'est-ce qui est inexact ?",btn:"Envoyer",ok:"Merci, votre message a été transmis à l'équipe."}))}
function openClaim(coid){openModal(`<h2>Revendiquer ce profil</h2><p>${esc(CO[coid].n)} : l'équipe vérifie que vous représentez bien la société puis vous donne la main sur le profil.</p>`+demandeForm({type:"revendication",intervenant_id:coid,btn:"Envoyer la demande",msgLabel:"Votre fonction dans la société",ok:"Merci ! On vous recontacte pour vérifier et activer votre profil."}))}
async function share(cid){
  const c=CH.find(x=>x.id===cid);const url=location.href.split("#")[0]+"#/chantier/"+cid;
  try{if(navigator.share){await navigator.share({title:c.nom,url});return}await navigator.clipboard.writeText(url);toast("Lien copié, prêt à partager sur LinkedIn")}
  catch(e){window.open("https://www.linkedin.com/sharing/share-offsite/?url="+encodeURIComponent(url),"_blank","noopener")}
}

/* Visionneuse photos */
let LB={list:[],i:0};
function openLb(cid,i){const c=CH.find(x=>x.id===cid);LB={list:c.photos,i};lbShow();$("#lb").classList.add("open")}
function lbShow(){$("#lbImg").src=LB.list[LB.i];$("#lbC").textContent=`${LB.i+1} / ${LB.list.length}`;$("#lb .lp").hidden=$("#lb .ln").hidden=LB.list.length<2}
function lbGo(d){LB.i=(LB.i+d+LB.list.length)%LB.list.length;lbShow()}
function closeLb(){$("#lb").classList.remove("open")}

function goSearch(e){
  e.preventDefault();
  const q=$("#hq").value.trim(), t=$("#ht").value;
  F.types=new Set(t?[t]:[]);F.st=new Set();F.q="";
  const k=Object.keys(VILLES).find(k=>norm(VILLES[k].n)===norm(q)||k===norm(q));
  if(k){location.hash="#/ville/"+k;return}
  const co=q&&Object.keys(CO).find(id=>norm(CO[id].n)===norm(q));
  if(co){location.hash="#/entreprise/"+co;return}
  F.q=q; if(location.hash==="#/chantiers")route(); else location.hash="#/chantiers";
}

function vNotFound(){return `<div class="wrap"><div class="empty" style="margin:40px 0">Page introuvable. <a href="#/" style="color:var(--accent)">Retour à l'accueil</a></div></div>`}
function vBientot(){
  const li=CFG.LINKEDIN_PAGE||CFG.LINKEDIN_PROFIL;
  return `<section class="hero"><div class="wrap" style="grid-template-columns:1fr;text-align:center;padding-top:80px;padding-bottom:90px">
   <div style="max-width:680px;margin:0 auto"><h1>Tous les chantiers du Maroc, <em>bientôt au même endroit.</em></h1>
   <p class="lead" style="margin-left:auto;margin-right:auto">Qui construit quoi, où et avec qui. La plateforme BTP Direct ouvre très bientôt. En attendant, vous pouvez déjà nous signaler un chantier.</p>
   <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn primary lg" href="#/signaler">Signaler un chantier</a>${li?`<a class="btn lg" style="background:#fff;color:#0e3468;border-color:#fff" href="${esc(li)}" target="_blank" rel="noopener">Suivre BTP Direct sur LinkedIn</a>`:""}</div></div>
  </div></section>`;
}
function vSetup(msg){
  return `<div class="wrap"><div class="panel" style="max-width:640px;margin:40px auto"><h2>Configuration à terminer</h2><p class="muted" style="margin:0">${msg}</p></div></div>`;
}

/* =========================================================
   ESPACE ADMINISTRATEUR
   ========================================================= */
function vLogin(){
  return `<div class="wrap"><div class="login"><form class="form" onsubmit="doLogin(event)">
   <h2 style="font-size:22px">Espace équipe</h2><p class="muted" style="margin:0 0 16px">Réservé aux administrateurs BTP Direct.</p><div id="lgErr"></div>
   <div class="field"><label for="lgE">E-mail</label><input id="lgE" type="email" required autocomplete="username"></div>
   <div class="field"><label for="lgP">Mot de passe</label><input id="lgP" type="password" required autocomplete="current-password"></div>
   <button class="btn primary lg" style="width:100%" id="lgB">Se connecter</button>
   <p style="text-align:center;margin:14px 0 0"><a href="#/" onclick="forgot();return false" class="muted" style="font-size:13px">Mot de passe oublié ?</a></p>
  </form></div></div>`;
}
async function doLogin(e){
  e.preventDefault();const b=$("#lgB");b.disabled=true;b.textContent="Connexion…";
  const {data,error}=await sb.auth.signInWithPassword({email:$("#lgE").value.trim(),password:$("#lgP").value});
  if(error){$("#lgErr").innerHTML=`<div class="err">E-mail ou mot de passe incorrect.</div>`;b.disabled=false;b.textContent="Se connecter";return}
  SESSION=data.session;await checkAdmin();await refresh();route();
}
async function forgot(){
  const em=$("#lgE").value.trim();
  if(!em){$("#lgErr").innerHTML='<div class="err">Saisissez d\'abord votre e-mail ci-dessus.</div>';return}
  const {error}=await sb.auth.resetPasswordForEmail(em,{redirectTo:location.href.split("#")[0]});
  toast(error?"Erreur : "+error.message:"E-mail de réinitialisation envoyé");
}
function newPasswordModal(){
  openModal(`<h2>Nouveau mot de passe</h2><p>Choisissez votre nouveau mot de passe administrateur.</p><form onsubmit="setPwd(event)"><div class="field"><label for="np">Nouveau mot de passe</label><input id="np" type="password" minlength="8" required autocomplete="new-password"></div><button class="btn primary lg" style="width:100%">Enregistrer</button></form>`);
}
async function setPwd(e){e.preventDefault();const {error}=await sb.auth.updateUser({password:$("#np").value});closeModal();toast(error?"Erreur : "+error.message:"Mot de passe modifié");location.hash="#/admin"}
async function logout(){await sb.auth.signOut();SESSION=null;IS_ADMIN=false;ADM={sig:[],dem:[]};await refresh();location.hash="#/"}

function admTabs(cur){
  const nS=ADM.sig.filter(s=>s.etat==="nouveau").length, nD=ADM.dem.filter(d=>!d.traite).length;
  const t=[["signalements","Signalements",nS],["chantiers","Chantiers",0],["demandes","Demandes",nD],["entreprises","Entreprises",0],["reglages","Réglages",0]];
  return `<div class="crumbs"><a href="#/">Accueil</a> › Modération</div>
   <div class="page-h"><div><h1>Espace équipe</h1><p>Connecté : ${esc(SESSION.user.email)} · <a href="#/" onclick="logout();return false" style="color:var(--accent)">Se déconnecter</a></p></div><a class="btn primary" href="#/admin/edit/nouveau">+ Nouveau chantier</a></div>
   ${!SITE_PUBLIC?`<div class="draft" style="margin:0 0 16px">Le site est en préparation : les visiteurs voient la page « Bientôt disponible ». <a href="#/admin/reglages">Ouvrir au public</a></div>`:""}
   <div class="tabs">${t.map(([k,l,n])=>`<a href="#/admin/${k}" ${k===cur?'aria-current="page"':""}>${l}${n?`<span class="n">${n}</span>`:""}</a>`).join("")}</div>`;
}

/* Signalements */
let SIG_ALL=false;
function vAdmSig(){
  const list=ADM.sig.filter(s=>SIG_ALL||s.etat==="nouveau");
  const etat={nouveau:"",publie:'<span class="badge b-fini">Fiche créée</span>',rejete:'<span class="badge b-ao">Rejeté</span>'};
  return `<div class="wrap">${admTabs("signalements")}
   <div class="toolbar"><span class="muted">${list.length} signalement${list.length>1?"s":""} ${SIG_ALL?"au total":"en attente"}</span><label class="opt" style="padding:0"><input type="checkbox" ${SIG_ALL?"checked":""} onchange="SIG_ALL=this.checked;route()">Afficher aussi les signalements traités</label></div>
   ${list.length?`<div class="queue">${list.map(s=>{
     const ints=Object.entries(s.intervenants||{});const ct=s.contributeur_contact||"";
     const tel=ct.replace(/[^\d+]/g,"");const isMail=/@/.test(ct);
     const wa=!isMail&&tel.length>=9?`https://wa.me/${tel.replace(/^\+/,"").replace(/^0/,"212")}?text=${encodeURIComponent("Bonjour, merci pour votre signalement « "+s.nom+" » sur BTP Direct. Pourriez-vous nous préciser")}`:"";
     return `<div class="q-item ${s.etat!=="nouveau"?"ok":""}"><div class="thumb">${imgOr(s.photos[0],s.id+90,1)}</div>
     <div><h3>${esc(s.nom)} ${etat[s.etat]||""}</h3><p>${esc(s.type||"")} · ${esc(vNom(s.ville_id))}${s.quartier?" · "+esc(s.quartier):""} · ${esc(ago(s.created_at))}</p>
      ${s.note?`<p>${esc(s.note)}</p>`:""}
      <div class="kv">${ints.map(([r,n])=>`<b>${esc(r)} :</b> ${esc(n)}`).join(" · ")}</div>
      <div class="kv"><b>Par :</b> ${esc(s.contributeur_nom||"Anonyme")}${ct?" · "+esc(ct):""}${s.citer?"":" · ne pas citer"}${s.source_url&&/^https?:/i.test(s.source_url)?` · <a href="${esc(s.source_url)}" target="_blank" rel="noopener nofollow" style="color:var(--accent)">Source ↗</a>`:""}${s.lat?` · <a href="https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=17/${s.lat}/${s.lng}" target="_blank" rel="noopener" style="color:var(--accent)">GPS ↗</a>`:""}</div>
      ${s.photos.length?`<div class="thumbs">${s.photos.map(p=>`<a class="ph" href="${esc(p)}" target="_blank" rel="noopener"><img src="${esc(p)}" alt=""></a>`).join("")}</div>`:""}</div>
     <div class="acts">${s.etat==="nouveau"?`<button class="btn" onclick="sigEtat(${s.id},'rejete')">Rejeter</button>${wa?`<a class="btn" href="${wa}" target="_blank" rel="noopener">Demander des infos</a>`:isMail?`<a class="btn" href="mailto:${esc(ct)}?subject=${encodeURIComponent("Votre signalement BTP Direct")}">Demander des infos</a>`:""}<a class="btn primary" href="#/admin/edit/nouveau/${s.id}">Créer la fiche</a>`:`<button class="btn" onclick="sigEtat(${s.id},'nouveau')">Remettre en attente</button>`}</div></div>`}).join("")}</div>`
   :'<div class="empty">Aucun signalement en attente. Les signalements envoyés depuis « Signaler un chantier » arrivent ici.</div>'}
  </div>`;
}
async function sigEtat(id,etat){const {error}=await sb.from("signalements").update({etat}).eq("id",id);if(error)return toast("Erreur : "+error.message);await loadAdmin();updateNav();route()}

/* Liste des chantiers */
function vAdmCh(){
  return `<div class="wrap">${admTabs("chantiers")}
   ${CH.length?`<div class="tbl-wrap"><table class="adm"><thead><tr><th>Chantier</th><th class="hide-sm">Ville</th><th class="hide-sm">Statut</th><th>Visible</th><th class="hide-sm">Vues</th><th></th></tr></thead><tbody>
   ${CH.map(c=>`<tr><td><a href="#/chantier/${c.id}" style="font-weight:600;text-decoration:none">${esc(c.nom)}</a><br><small class="muted">${esc(c.type)} · ${c.photos.length} photo(s) · ${c.ints.length} intervenant(s)</small></td><td class="hide-sm">${esc(vNom(c.v))}</td><td class="hide-sm">${badge(c.st)}</td>
    <td><label class="opt" style="padding:0"><input type="checkbox" ${c.publie?"checked":""} onchange="togglePub(${c.id},this.checked)">${c.publie?"Publié":"Brouillon"}</label></td><td class="hide-sm">${fmt(c.vues)}</td>
    <td><div class="acts"><a class="btn" href="#/admin/edit/${c.id}">Modifier</a><button class="btn" onclick="delCh(${c.id},this)">Supprimer</button></div></td></tr>`).join("")}
   </tbody></table></div>`:`<div class="empty">Aucun chantier pour le moment.<br><a href="#/admin/edit/nouveau" style="color:var(--accent);font-weight:600">Ajouter votre premier chantier</a></div>`}
  </div>`;
}
async function togglePub(id,v){const {error}=await sb.from("chantiers").update({publie:v}).eq("id",id);if(error)return toast("Erreur : "+error.message);await refresh();route();toast(v?"Chantier publié":"Chantier repassé en brouillon")}
async function delCh(id,btn){
  if(btn.dataset.sure!=="1"){btn.dataset.sure="1";btn.textContent="Confirmer ?";btn.style.borderColor="var(--accent)";btn.style.color="var(--accent)";setTimeout(()=>{if(btn.isConnected){btn.dataset.sure="";btn.textContent="Supprimer";btn.style.cssText=""}},4000);return}
  const {error}=await sb.from("chantiers").delete().eq("id",id);if(error)return toast("Erreur : "+error.message);await refresh();route();toast("Chantier supprimé");
}

/* Éditeur de chantier */
let ED=null;
function vAdmEdit(id,sigId){
  const c=id==="nouveau"?null:CH.find(x=>x.id==id);
  if(id!=="nouveau"&&!c)return vNotFound();
  const s=sigId?ADM.sig.find(x=>x.id==sigId):null;
  const r=c?c.raw:{};
  ED={id:c?c.id:null,sigId:s?s.id:null,photos:c?[...c.photos]:(s?[...s.photos]:[]),
      lat:c?r.lat:(s?s.lat:null),lng:c?r.lng:(s?s.lng:null),
      ints:c?c.ints.map(([role,iid])=>[role,CO[iid].n]):(s?Object.entries(s.intervenants||{}):[])};
  if(!ED.ints.length)ED.ints=[["Maître d'ouvrage",""],["Architecte",""],["Entreprise générale",""]];
  const val=(k,d="")=>esc(c?(r[k]??d):d);
  const v0=c?c.v:(s?s.ville_id:"casablanca");
  const st0=c?c.st:(s&&s.statut?s.statut:"cours");
  const ty0=c?c.type:(s?s.type:TYPES[0]);
  const srcT=c?r.source_titre:(s?(s.photos.length?"Panneau de chantier photographié":"Signalement de la communauté"):"");
  const srcBy=c?r.source_par:(s?(s.citer&&s.contributeur_nom?"Signalé par "+s.contributeur_nom:"Signalé par un membre de la communauté"):"");
  const srcD=c?r.source_date:(s?dateFr(s.created_at):dateFr(new Date()));
  const srcU=c?r.source_url:(s?s.source_url:"");
  const desc=c?r.description:(s?(s.note||""):"");
  return `<div class="wrap"><div class="crumbs"><a href="#/">Accueil</a> › <a href="#/admin/chantiers">Modération</a> › ${c?"Modifier":"Nouveau chantier"}</div>
   <div class="page-h"><div><h1>${c?"Modifier le chantier":"Nouveau chantier"}</h1>${s?`<p>À partir du signalement « ${esc(s.nom)} »</p>`:""}</div>${c?`<a class="btn" href="#/chantier/${c.id}">Voir la fiche</a>`:""}</div>
   <div class="form-wrap">
   <form class="form" id="edForm" onsubmit="saveCh(event)"><div id="edErr"></div>
    <h2>Le chantier</h2>
    <div class="field"><label for="eNom">Nom du projet</label><input id="eNom" required maxlength="300" value="${c?esc(c.nom):s?esc(s.nom):""}"></div>
    <div class="row">
     <div class="field"><label for="eType">Type</label><select id="eType">${[...new Set([...TYPES,ty0].filter(Boolean))].map(t=>`<option ${t===ty0?"selected":""}>${esc(t)}</option>`).join("")}</select></div>
     <div class="field"><label for="eVille">Ville</label><select id="eVille" onchange="edCity()">${Object.entries(VILLES).map(([k,x])=>`<option value="${k}" ${k===v0?"selected":""}>${esc(x.n)}</option>`).join("")}</select></div>
    </div>
    <div class="field"><label for="eQ">Quartier / adresse</label><input id="eQ" maxlength="300" value="${c?esc(r.quartier||""):s?esc(s.quartier||""):""}"></div>
    <div class="field"><span class="lab">Position sur la carte <span class="hint">(cliquez sur la carte pour placer le point ; sinon le centre de la ville est utilisé)</span></span><div class="mapbox"><div class="map pick" id="mapE"></div></div><div class="muted" style="font-size:13px;margin-top:4px" id="ePos"></div></div>
    <div class="field"><span class="lab">Statut</span><div class="radios">${Object.entries(STATUTS).map(([k,x])=>`<label><input type="radio" name="est" value="${k}" ${k===st0?"checked":""}>${x.l}</label>`).join("")}</div></div>
    <div class="row">
     <div class="field"><label for="eDeb">Démarrage <span class="hint">(ex. Mars 2025, T1 2027)</span></label><input id="eDeb" maxlength="60" value="${val("debut")}"></div>
     <div class="field"><label for="eFin">Livraison</label><input id="eFin" maxlength="60" value="${val("fin")}"></div>
     <div class="field"><label for="eAv">Avancement (%)</label><input id="eAv" type="number" min="0" max="100" value="${c?r.avancement:0}"></div>
     <div class="field"><label for="eMt">Montant <span class="hint">(ex. ≈ 380 M MAD)</span></label><input id="eMt" maxlength="80" value="${val("montant")}"></div>
     <div class="field"><label for="eSurf">Surface / taille</label><input id="eSurf" maxlength="80" value="${val("surface")}"></div>
     <div class="field"><label for="eNiv">Gabarit <span class="hint">(ex. R+11, 2 sous-sols)</span></label><input id="eNiv" maxlength="80" value="${val("gabarit")}"></div>
    </div>
    <label class="check"><input type="checkbox" id="ePub" ${c&&r.marche_public?"checked":""}>Marché public</label>
    <div class="field"><label for="eDesc">Description</label><textarea id="eDesc" style="min-height:120px">${esc(desc||"")}</textarea></div>

    <h2>Photos</h2>
    <p class="muted" style="font-size:13.5px;margin:-4px 0 10px">La première photo sert de vignette. Les photos sont compressées automatiquement.</p>
    <div class="thumbs" id="ePh"></div>
    <label class="drop" style="padding:14px;margin-top:10px"><b>+ Ajouter des photos</b><input type="file" accept="image/*" multiple onchange="addPhotos(this)"></label>

    <h2>Intervenants</h2>
    <p class="muted" style="font-size:13.5px;margin:-4px 0 10px">Tapez le nom de la société : si elle existe déjà, elle est proposée ; sinon son profil est créé automatiquement.</p>
    <datalist id="dlCo">${Object.values(CO).map(x=>`<option value="${esc(x.n)}">`).join("")}</datalist>
    <div id="eInts"></div>
    <button type="button" class="btn" onclick="ED.ints.push(['Sous-traitant','']);drawInts()">+ Ajouter un intervenant</button>

    <h2>Source</h2>
    <div class="row">
     <div class="field"><label for="eSrcT">Type de source</label><input id="eSrcT" list="dlSrc" maxlength="200" value="${esc(srcT||"")}"><datalist id="dlSrc">${SOURCES.map(x=>`<option value="${esc(x)}">`).join("")}</datalist></div>
     <div class="field"><label for="eSrcBy">Par</label><input id="eSrcBy" maxlength="200" value="${esc(srcBy||"")}" placeholder="Ex. Veille BTP Direct"></div>
     <div class="field"><label for="eSrcD">Date</label><input id="eSrcD" maxlength="60" value="${esc(srcD||"")}"></div>
     <div class="field"><label for="eSrcU">Lien <span class="hint">(facultatif)</span></label><input id="eSrcU" type="url" maxlength="1000" value="${esc(srcU||"")}" placeholder="https://"></div>
    </div>

    <h2>Publication</h2>
    <label class="check"><input type="checkbox" id="ePubl" ${c?(c.publie?"checked":""):"checked"}>Publier la fiche (visible du public${SITE_PUBLIC?"":", une fois le site ouvert"})</label>
    <button class="btn primary lg" style="width:100%" id="eBtn">Enregistrer</button>
   </form>
   <aside><div class="side-box"><h3>Astuce</h3><p>Décochez « Publier » pour garder la fiche en brouillon le temps de compléter les informations.</p><p style="margin:0">Le nom affiché sur la fiche, la carte et le panneau de chantier vient directement de ce formulaire.</p></div>
   ${s&&s.photos.length?`<div class="side-box"><h3>Photos du signalement</h3><p>Elles ont été reprises automatiquement dans la fiche.</p></div>`:""}</aside>
   </div></div>`;
}
function bindEdit(){
  drawPhotos();drawInts();
  const v=VILLES[$("#eVille").value];
  const start=ED.lat!=null?[ED.lat,ED.lng]:v.ll;
  if(!window.L)return;
  const m=L.map($("#mapE"),{scrollWheelZoom:false}).setView(start,ED.lat!=null?15:v.z);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(m);
  maps.push(m);ED.map=m;
  const setPos=(ll)=>{
    if(ED.marker)ED.marker.remove();
    if(ll){ED.marker=L.marker(ll,{draggable:true}).addTo(m);ED.marker.on("dragend",e=>{const p=e.target.getLatLng();ED.lat=+p.lat.toFixed(6);ED.lng=+p.lng.toFixed(6);posTxt()})}
    posTxt();
  };
  const posTxt=()=>{$("#ePos").innerHTML=ED.lat!=null?`Position : ${ED.lat}, ${ED.lng} · <a href="#/" onclick="ED.lat=ED.lng=null;ED.marker&&ED.marker.remove();ED.marker=null;this.parentElement.textContent='Pas de position précise (centre de la ville).';return false" style="color:var(--accent)">retirer</a>`:"Pas de position précise (centre de la ville)."};
  m.on("click",e=>{ED.lat=+e.latlng.lat.toFixed(6);ED.lng=+e.latlng.lng.toFixed(6);setPos([ED.lat,ED.lng])});
  setPos(ED.lat!=null?[ED.lat,ED.lng]:null);
}
function edCity(){const v=VILLES[$("#eVille").value];if(ED.map&&ED.lat==null)ED.map.setView(v.ll,v.z)}
function drawPhotos(){
  $("#ePh").innerHTML=ED.photos.map((p,i)=>`<div class="ph"><img src="${esc(p)}" alt="">${i===0?'<span class="main">Vignette</span>':`<button type="button" title="Mettre en vignette" style="right:auto;left:3px" onclick="ED.photos.unshift(ED.photos.splice(${i},1)[0]);drawPhotos()">★</button>`}<button type="button" title="Retirer" onclick="ED.photos.splice(${i},1);drawPhotos()">×</button></div>`).join("")||'<span class="muted" style="font-size:13.5px">Aucune photo pour le moment.</span>';
}
async function addPhotos(inp){
  const files=[...inp.files];inp.value="";
  for(let i=0;i<files.length;i++){
    toast(`Envoi de la photo ${i+1}/${files.length}…`);
    try{ED.photos.push(await uploadPhoto(files[i],"chantiers"));drawPhotos()}catch(e){toast("Erreur photo : "+(e.message||e))}
  }
  toast("Photos ajoutées. Pensez à enregistrer.");
}
function drawInts(){
  const roles=[...new Set([...ROLES,...ED.ints.map(i=>i[0])])];
  $("#eInts").innerHTML=ED.ints.map(([r,n],i)=>`<div class="int-row"><select onchange="ED.ints[${i}][0]=this.value">${roles.map(x=>`<option ${x===r?"selected":""}>${esc(x)}</option>`).join("")}</select><input list="dlCo" value="${esc(n)}" placeholder="Nom de la société" oninput="ED.ints[${i}][1]=this.value"><button type="button" title="Retirer" onclick="ED.ints.splice(${i},1);drawInts()">×</button></div>`).join("");
}
async function ensureCo(name,role){
  const ex=Object.keys(CO).find(id=>norm(CO[id].n)===norm(name));
  if(ex)return ex;
  let id=slugify(name),k=2;while(CO[id])id=slugify(name)+"-"+(k++);
  const cat=ROLES.includes(role)?role:"Entreprise générale";
  const col=PALETTE[[...id].reduce((a,ch)=>a+ch.charCodeAt(0),0)%PALETTE.length];
  const {error}=await sb.from("intervenants").insert({id,nom:name.trim(),categorie:cat,couleur:col});
  if(error)throw error;
  CO[id]={n:name.trim(),k:cat,col};
  return id;
}
async function saveCh(e){
  e.preventDefault();
  const btn=$("#eBtn");btn.disabled=true;btn.textContent="Enregistrement…";$("#edErr").innerHTML="";
  try{
    const g=id=>$(id).value.trim()||null;
    const row={nom:g("#eNom"),type:$("#eType").value,ville_id:$("#eVille").value,quartier:g("#eQ"),lat:ED.lat,lng:ED.lng,
      statut:document.querySelector('input[name="est"]:checked').value,debut:g("#eDeb"),fin:g("#eFin"),
      avancement:Math.max(0,Math.min(100,parseInt($("#eAv").value)||0)),montant:g("#eMt"),marche_public:$("#ePub").checked,
      surface:g("#eSurf"),gabarit:g("#eNiv"),description:g("#eDesc"),source_titre:g("#eSrcT"),source_par:g("#eSrcBy"),
      source_date:g("#eSrcD"),source_url:g("#eSrcU"),photos:ED.photos,publie:$("#ePubl").checked};
    if(row.statut==="fini"&&row.avancement<100)row.avancement=100;
    let id=ED.id;
    if(id){const {error}=await sb.from("chantiers").update(row).eq("id",id);if(error)throw error}
    else{if(ED.sigId)row.signalement_id=ED.sigId;const {data,error}=await sb.from("chantiers").insert(row).select("id").single();if(error)throw error;id=data.id}
    const links=[];
    for(const [role,name] of ED.ints.filter(i=>i[1]&&i[1].trim())){links.push({chantier_id:id,intervenant_id:await ensureCo(name,role),role,ordre:links.length})}
    const d=await sb.from("chantier_intervenants").delete().eq("chantier_id",id);if(d.error)throw d.error;
    if(links.length){const {error}=await sb.from("chantier_intervenants").insert(links);if(error)throw error}
    if(ED.sigId)await sb.from("signalements").update({etat:"publie"}).eq("id",ED.sigId);
    await refresh();toast("Chantier enregistré");location.hash="#/chantier/"+id;
  }catch(err){
    console.error(err);$("#edErr").innerHTML=`<div class="err">Erreur : ${esc(err.message||err)}</div>`;
    btn.disabled=false;btn.textContent="Enregistrer";window.scrollTo({top:0,behavior:"smooth"});
  }
}

/* Demandes */
function vAdmDem(){
  const T={contact:"Mise en relation",abonnement:"Abonnement Pro",alerte:"Alerte chantier",pub:"Publicité",correction:"Correction",revendication:"Revendication"};
  return `<div class="wrap">${admTabs("demandes")}
   ${ADM.dem.length?`<div class="tbl-wrap"><table class="adm"><thead><tr><th>Demande</th><th>Contact</th><th class="hide-sm">Message</th><th>Traitée</th></tr></thead><tbody>
   ${ADM.dem.map(d=>{const c=d.chantier_id&&CH.find(x=>x.id===d.chantier_id);const co=d.intervenant_id&&CO[d.intervenant_id];const tel=(d.telephone||"").replace(/[^\d]/g,"").replace(/^0/,"212");
   return `<tr style="${d.traite?"opacity:.55":""}"><td><span class="tag">${esc(T[d.type]||d.type)}</span><br><small class="muted">${esc(dateFr(d.created_at))}</small>${c?`<br><a href="#/chantier/${c.id}" style="font-size:13px">${esc(c.nom)}</a>`:""}${co?`<br><a href="#/entreprise/${esc(d.intervenant_id)}" style="font-size:13px">${esc(co.n)}</a>`:""}</td>
   <td><b>${esc(d.nom||"")}</b>${d.societe?`<br>${esc(d.societe)}`:""}${d.telephone?`<br><a href="https://wa.me/${tel}" target="_blank" rel="noopener">${esc(d.telephone)}</a>`:""}${d.email?`<br><a href="mailto:${esc(d.email)}">${esc(d.email)}</a>`:""}</td>
   <td class="hide-sm" style="max-width:340px;white-space:pre-line">${esc(d.message||"")}</td>
   <td><input type="checkbox" ${d.traite?"checked":""} onchange="demTraite(${d.id},this.checked)" aria-label="Traitée"></td></tr>`}).join("")}
   </tbody></table></div>`:'<div class="empty">Aucune demande pour le moment. Les clics sur « Obtenir le contact », « Suivre », « Annoncer ici »… arrivent ici.</div>'}</div>`;
}
async function demTraite(id,v){const {error}=await sb.from("demandes").update({traite:v}).eq("id",id);if(error)return toast("Erreur : "+error.message);await loadAdmin();updateNav();route()}

/* Entreprises */
function vAdmCo(){
  const ids=Object.keys(CO);
  return `<div class="wrap">${admTabs("entreprises")}
   <div class="toolbar"><span class="muted">${ids.length} entreprise(s). Elles sont créées automatiquement quand vous les citez sur un chantier.</span><button class="btn" onclick="editCo(null)">+ Nouvelle entreprise</button></div>
   ${ids.length?`<div class="tbl-wrap"><table class="adm"><thead><tr><th>Société</th><th class="hide-sm">Catégorie</th><th class="hide-sm">Chantiers</th><th></th></tr></thead><tbody>
   ${ids.map(id=>`<tr><td><a href="#/entreprise/${esc(id)}" style="font-weight:600;text-decoration:none">${esc(CO[id].n)}</a> ${CO[id].ver?`<span class="ver">${verI}</span>`:""}</td><td class="hide-sm">${esc(CO[id].k)}</td><td class="hide-sm">${CH.filter(c=>c.ints.some(i=>i[1]===id)).length}</td><td><div class="acts"><button class="btn" onclick="editCo('${esc(id)}')">Modifier</button><button class="btn" onclick="delCo('${esc(id)}',this)">Supprimer</button></div></td></tr>`).join("")}
   </tbody></table></div>`:'<div class="empty">Aucune entreprise pour le moment.</div>'}</div>`;
}
function editCo(id){
  const r=id?CO[id].raw||{}:{};
  const cats=[...new Set([...ROLES,r.categorie].filter(Boolean))];
  openModal(`<h2>${id?"Modifier l'entreprise":"Nouvelle entreprise"}</h2><p></p><form onsubmit="saveCo(event,${id?`'${esc(id)}'`:"null"})"><div id="coErr"></div>
   <div class="field"><label for="cN">Nom</label><input id="cN" required maxlength="200" value="${esc(r.nom||"")}"></div>
   <div class="row"><div class="field"><label for="cK">Catégorie</label><select id="cK">${cats.map(x=>`<option ${x===r.categorie?"selected":""}>${esc(x)}</option>`).join("")}</select></div>
   <div class="field"><label for="cV">Siège</label><select id="cV"><option value="">—</option>${Object.entries(VILLES).map(([k,x])=>`<option value="${k}" ${k===r.ville_id?"selected":""}>${esc(x.n)}</option>`).join("")}</select></div>
   <div class="field"><label for="cS">Créée en</label><input id="cS" type="number" min="1900" max="2100" value="${esc(r.depuis||"")}"></div>
   <div class="field"><label for="cE">Effectif</label><input id="cE" maxlength="60" value="${esc(r.effectif||"")}" placeholder="Ex. 50 à 80"></div></div>
   <div class="field"><label for="cD">Description</label><textarea id="cD">${esc(r.description||"")}</textarea></div>
   <div class="row"><div class="field"><label for="cC">Couleur du logo</label><input id="cC" type="color" value="${esc(r.couleur||"#0e3468")}" style="height:44px;padding:4px"></div>
   <label class="check" style="align-self:end"><input type="checkbox" id="cVer" ${r.verifie?"checked":""}>Profil vérifié</label></div>
   <button class="btn primary lg" style="width:100%">Enregistrer</button></form>`);
}
async function saveCo(e,id){
  e.preventDefault();
  const row={nom:$("#cN").value.trim(),categorie:$("#cK").value,ville_id:$("#cV").value||null,depuis:parseInt($("#cS").value)||null,
    effectif:$("#cE").value.trim()||null,description:$("#cD").value.trim()||null,couleur:$("#cC").value,verifie:$("#cVer").checked};
  let r;
  if(id)r=await sb.from("intervenants").update(row).eq("id",id);
  else{let nid=slugify(row.nom),k=2;while(CO[nid])nid=slugify(row.nom)+"-"+(k++);r=await sb.from("intervenants").insert({id:nid,...row})}
  if(r.error){$("#coErr").innerHTML=`<div class="err">Erreur : ${esc(r.error.message)}</div>`;return}
  closeModal();await refresh();route();toast("Entreprise enregistrée");
}
async function delCo(id,btn){
  if(btn.dataset.sure!=="1"){btn.dataset.sure="1";btn.textContent="Confirmer ?";btn.style.color="var(--accent)";setTimeout(()=>{if(btn.isConnected){btn.dataset.sure="";btn.textContent="Supprimer";btn.style.cssText=""}},4000);return}
  const {error}=await sb.from("intervenants").delete().eq("id",id);if(error)return toast("Erreur : "+error.message);await refresh();route();toast("Entreprise supprimée");
}

/* Réglages */
function vAdmReg(){
  return `<div class="wrap">${admTabs("reglages")}
   <div class="panel" style="max-width:640px"><h2>Ouverture du site au public</h2>
    <p class="muted">${SITE_PUBLIC?"Le site est <b style='color:var(--fini)'>ouvert au public</b> : les internautes voient tous les chantiers publiés.":"Le site est <b style='color:var(--ao)'>en préparation</b> : les internautes voient une page « Bientôt disponible » (ils peuvent déjà signaler un chantier). Vous seul voyez les chantiers."}</p>
    <button class="btn ${SITE_PUBLIC?"":"primary"} lg" onclick="setPublic(${!SITE_PUBLIC})">${SITE_PUBLIC?"Repasser en préparation":"Ouvrir le site au public"}</button>
   </div>
   <div class="panel" style="max-width:640px"><h2>Bon à savoir</h2><p class="muted" style="margin:0">Pour ajouter une ville qui manque, ou modifier le numéro WhatsApp et les liens LinkedIn, demandez à Claude : c'est une petite modification.</p></div></div>`;
}
async function setPublic(v){const {error}=await sb.from("reglages").update({site_public:v}).eq("id",1);if(error)return toast("Erreur : "+error.message);await refresh();route();toast(v?"Le site est ouvert au public 🎉":"Site repassé en préparation")}

/* ---------- Routeur ---------- */
let lastView="";
function route(){
  maps.forEach(m=>m.remove());maps=[];
  closeModal();closeLb();$("#nav").classList.remove("open");
  const app=$("#app");
  if(/access_token|type=recovery|error_description/.test(location.hash)){app.innerHTML='<div class="loading"><div class="spin"></div>Connexion…</div>';return}
  if(!READY)return;
  const [, r="", a, b, c2]=(location.hash||"#/").split("/");
  let navKey=r||"home";
  const view=r+"/"+(a||"");
  const closed=!SITE_PUBLIC&&!IS_ADMIN;
  if(r==="admin"){
    if(!SESSION)app.innerHTML=vLogin();
    else if(!IS_ADMIN)app.innerHTML=`<div class="wrap">${vSetup("Ce compte n'a pas encore les droits administrateur. Lancez le script « 2-devenir-admin.sql » dans Supabase avec votre e-mail, puis rechargez la page.")}<p style="text-align:center"><a href="#/" onclick="logout();return false">Se déconnecter</a></p></div>`;
    else if(!a||a==="signalements")app.innerHTML=vAdmSig();
    else if(a==="chantiers")app.innerHTML=vAdmCh();
    else if(a==="demandes")app.innerHTML=vAdmDem();
    else if(a==="entreprises")app.innerHTML=vAdmCo();
    else if(a==="reglages")app.innerHTML=vAdmReg();
    else if(a==="edit"){app.innerHTML=vAdmEdit(b,b==="nouveau"?c2:null);if($("#edForm"))bindEdit()}
    else app.innerHTML=vNotFound();
  }
  else if(r==="signaler"){app.innerHTML=vSignal()}
  else if(closed){app.innerHTML=vBientot();navKey="home"}
  else if(r===""){app.innerHTML=vHome();fitTo(makeMap($("#map1"),PUB(),[32.2,-6.4],6),PUB())}
  else if(r==="ville"&&VILLES[a]){app.innerHTML=vList(a);bindList(a);navKey="villes"}
  else if(r==="chantiers"){app.innerHTML=vList(null);bindList(null)}
  else if(r==="villes"){app.innerHTML=vVilles();makeMap($("#map1"),PUB(),[31.8,-7.2],5)}
  else if(r==="chantier"){app.innerHTML=vDetail(a);const c=CH.find(x=>x.id==a);if(c&&(c.publie||IS_ADMIN)){makeMap($("#map1"),[c],llOf(c),c.lat!=null?15:13);if(c.publie&&!IS_ADMIN&&sessionStorage.getItem("v"+c.id)!=="1"){try{sessionStorage.setItem("v"+c.id,"1")}catch(e){}sb.rpc("compter_vue",{cid:c.id}).then(()=>{})}}navKey="chantiers"}
  else if(r==="entreprise"&&CO[a]){app.innerHTML=vCompany(a);const l=chOf(a);const ctr=CO[a].v&&VILLES[CO[a].v]?VILLES[CO[a].v].ll:[31.8,-7.2];fitTo(makeMap($("#map1"),l,ctr,6),l,20);navKey="entreprises"}
  else if(r==="entreprises"){app.innerHTML=vCompanies()}
  else app.innerHTML=vNotFound();
  $$("nav.main a").forEach(x=>{if(x.dataset.r===navKey)x.setAttribute("aria-current","page");else x.removeAttribute("aria-current")});
  if(view!==lastView)window.scrollTo(0,0);
  lastView=view;
}
window.addEventListener("hashchange",route);

/* ---------- Démarrage ---------- */
(async function init(){
  $("#yr").textContent=new Date().getFullYear();
  if(CFG.LINKEDIN_PROFIL)$("#ftLiP").href=CFG.LINKEDIN_PROFIL;
  if(CFG.LINKEDIN_PAGE)$("#ftLiPage").href=CFG.LINKEDIN_PAGE;
  const wa=waLink("Bonjour BTP Direct, je vous signale un chantier :");
  if(wa){$("#ftWa").href=wa;$("#ftWa").target="_blank"}
  if(!CFG.SUPABASE_URL||!CFG.SUPABASE_ANON_KEY){$("#app").innerHTML=vSetup("Renseignez l'adresse et la clé Supabase dans le fichier <b>config.js</b>.");return}
  if(!window.supabase){$("#app").innerHTML=vSetup("Impossible de charger Supabase. Vérifiez votre connexion internet puis rechargez la page.");return}
  sb=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);
  sb.auth.onAuthStateChange((ev,session)=>{
    SESSION=session;
    if(ev==="PASSWORD_RECOVERY"){setTimeout(()=>{location.hash="#/admin";newPasswordModal()},300)}
  });
  try{
    const {data}=await sb.auth.getSession();SESSION=data.session;
    await checkAdmin();await refresh();
  }catch(e){console.error(e);$("#app").innerHTML=vSetup("Connexion à la base impossible : "+esc(e.message||e)+". Vérifiez que le script d'installation a bien été lancé dans Supabase.");return}
  READY=true;
  if(/access_token|type=recovery/.test(location.hash))history.replaceState(null,"",location.pathname+"#/admin");
  route();
})();
