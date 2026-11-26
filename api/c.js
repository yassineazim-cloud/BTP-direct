// BTP Direct : page d'aperçu d'un chantier pour LinkedIn, WhatsApp, Facebook…
// Adresse : /c/123  →  affiche le nom, la ville et la photo du chantier, puis
// redirige le visiteur vers la fiche (/#/chantier/123).
const SUPABASE_URL = "https://lskjyzutmhfezzhzpkxq.supabase.co";
const SUPABASE_KEY = "sb_publishable_RvS7X9Mr9n8PAZwVavmI3A_lavLK8JU"; // clé publique

const STATUTS = { ao: "Appel d'offres", cours: "En cours", fini: "Terminé" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

module.exports = async function handler(req, res) {
  const id = parseInt(String((req.query && req.query.id) || "").replace(/\D/g, ""), 10);
  const host = req.headers["x-forwarded-host"] || req.headers.host || "btp-direct.vercel.app";
  const base = "https://" + host;
  let c = null;
  if (id > 0) {
    try {
      const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/apercu_chantier", {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ cid: id }),
      });
      if (r.ok) { const rows = await r.json(); c = Array.isArray(rows) ? rows[0] : null; }
    } catch (e) { c = null; }
  }
  const cible = c ? base + "/#/chantier/" + id : base + "/";
  const titre = c ? c.nom + " · " + c.ville : "BTP Direct · Tous les chantiers du Maroc";
  const desc = c
    ? (c.auteur ? "Publié par " + c.auteur + " sur BTP Direct. " : "Publié par BTP Direct. ") + [c.type, c.ville, STATUTS[c.statut]].filter(Boolean).join(" · ") + ". Découvrez qui construit ce chantier sur BTP Direct, la communauté du BTP, de la construction et de l'architecture au Maroc."
    : "Qui construit quoi, où et avec qui. La communauté du BTP, de la construction et de l'architecture au Maroc.";
  const image = c && /^https:\/\//.test(c.photo || "") ? c.photo : base + "/logo.webp";
  const url = c ? base + "/c/" + id : base + "/";

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
  res.status(200).send(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="BTP Direct">
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(titre)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0;url=${esc(cible)}">
<script>location.replace(${JSON.stringify(cible)})</script>
</head><body style="font-family:sans-serif;text-align:center;padding:40px">
<p>Ouverture du chantier… <a href="${esc(cible)}">Cliquez ici si rien ne se passe</a>.</p>
</body></html>`);
};
