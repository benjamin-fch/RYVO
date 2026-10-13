// Configuration publique du site RYVO.
// Ces deux valeurs se trouvent dans Supabase > Project Settings > API.
// La clé « anon » (ou « publishable ») est faite pour être publique : la sécurité
// repose sur les règles de la base. Ne mets JAMAIS ici la clé « service_role » / « secret ».
window.RYVO_CONFIG = {
  url: 'https://sbksevlrrcxkiggxeyvq.supabase.co',      // ex. 'https://abcdefghijkl.supabase.co'
  anonKey: 'sb_publishable_43GSljlQ2G_686b1ggH5_A_2_WHKjKt',  // ex. 'eyJhbGciOi...' ou 'sb_publishable_...'
  contact: ''   // e-mail de contact affiché en bas du jeu (RGPD), ex. 'contact@ryvo.fr'
};
