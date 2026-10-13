// Configuration publique du site RYVO.
// Ces deux valeurs se trouvent dans Supabase > Project Settings > API.
// La clé « anon » (ou « publishable ») est faite pour être publique : la sécurité
// repose sur les règles de la base. Ne mets JAMAIS ici la clé « service_role » / « secret ».
window.RYVO_CONFIG = {
  url: 'https://sbksevlrrcxkiggxeyvq.supabase.co',      // ex. 'https://abcdefghijkl.supabase.co'
  anonKey: 'sb_publishable_43GSljlQ2G_686b1ggH5_A_2_WHKjKt',  // ex. 'eyJhbGciOi...' ou 'sb_publishable_...'
  contact: '',  // e-mail de contact affiché en bas du jeu (RGPD), ex. 'contact@ryvo.fr'

  // ----- Boutique (voir README, « Encaisser les achats ») -----
  // Vendeur affiché dans les conditions de vente. Obligatoire pour vendre, ex. 'Benjamin X, EI, SIRET 123 456 789 00012, 1 rue …, 76600 Le Havre'
  seller: '',
  // Passe à true une fois la fonction « payments » déployée et Stripe configuré. Tant que c'est false, les packs sont affichés mais pas achetables.
  payments: false,
  // Pubs récompensées (Google AdSense, jeux HTML5). ex. { client: 'ca-pub-1234567890123456', test: true } ; test: true affiche des pubs de test.
  ads: null
};
