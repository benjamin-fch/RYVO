// Configuration publique du site RYVO.
// Ces deux valeurs se trouvent dans Supabase > Project Settings > API.
// La clé « anon » (ou « publishable ») est faite pour être publique : la sécurité
// repose sur les règles de la base. Ne mets JAMAIS ici la clé « service_role » / « secret ».
window.RYVO_CONFIG = {
  url: '',      // ex. 'https://abcdefghijkl.supabase.co'
  anonKey: '',  // ex. 'eyJhbGciOi...' ou 'sb_publishable_...'
  contact: ''   // e-mail de contact affiché en bas du jeu (RGPD), ex. 'contact@ryvo.fr'
};
