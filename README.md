# RYVO

Mini-jeux compétitifs (8 jeux), classements, duels et Coupe des écoles, avec une console d'administration.

- **Le jeu** : `index.html` (à la racine)
- **La console admin** : `admin/index.html` (accessible via `/admin/`, non indexée par les moteurs de recherche)
- **La base de données** : `supabase/schema.sql` (tables, règles de sécurité, logique serveur)
- **Le réglage** : `config.js` (adresse du projet Supabase + clé publique, vendeur, paiement, pubs)
- **Le paiement** : `supabase/functions/payments/index.ts` (fonction serveur Stripe : page de paiement + confirmation)

Sans réglage (`config.js` vide), le jeu tourne en **mode démo** : tout est simulé et enregistré dans le navigateur.

---

## Mise en route (une seule fois)

### 1. Créer la base de données

1. Ouvre ton projet sur [supabase.com](https://supabase.com) → **SQL Editor** → **New query**.
2. Copie tout le contenu de [`supabase/schema.sql`](supabase/schema.sql), colle-le, clique **Run**.
3. Tu dois voir « Success. No rows returned ». Le script peut être relancé plus tard (mise à jour) sans perdre les données.

### 2. Régler la connexion des joueurs

Dans Supabase → **Authentication** :

- **Sign In / Providers → Email** : activé, avec **Confirm email** activé.
- **URL Configuration** :
  - *Site URL* : `https://<ton-pseudo-github>.github.io/RYVO/` (avec le `/RYVO/` à la fin, sinon le lien de confirmation mène à une page 404)
  - *Redirect URLs* : ajoute `https://<ton-pseudo-github>.github.io/ryvo/**`
- **Multi-Factor** : laisse **TOTP** activé (c'est le cas par défaut). La console admin l'exige.
- **Emails** : le service d'e-mail fourni par Supabase est très limité (quelques e-mails par heure, et seulement vers les membres de l'équipe du projet). Avant d'ouvrir aux joueurs, branche un vrai service d'envoi dans **Authentication → Emails → SMTP Settings** (Brevo, Resend, Postmark… ont des offres gratuites).

### 3. Brancher le site sur Supabase

1. Supabase → **Project Settings → API Keys**. Copie :
   - l'adresse du projet (`https://xxxx.supabase.co`),
   - la clé **publishable** (`sb_publishable_…`) — ou, dans l'onglet *Legacy*, la clé **anon**.
2. Remplis `config.js` :

```js
window.RYVO_CONFIG = {
  url: 'https://xxxx.supabase.co',
  anonKey: 'sb_publishable_xxxxxxxx',
  contact: 'contact@ton-domaine.fr'
};
```

> ⚠️ **Ne mets jamais la clé `secret` / `service_role` ici ni nulle part dans ce dépôt.** Elle contourne toute la sécurité. La clé publishable/anon, elle, est faite pour être publique : sans les fonctions serveur, elle ne donne accès à rien.

### 4. Te donner les droits d'administrateur

1. Ouvre le jeu en ligne, crée ton compte joueur et confirme ton e-mail.
2. Dans Supabase → **SQL Editor**, lance (avec ton e-mail) :

```sql
insert into public.admins(user_id, role)
select id, 'super' from auth.users where email = 'ton-email@exemple.fr';
```

3. Va sur `/admin/`, connecte-toi : la console te demande d'activer la double authentification (scanne le QR code avec Google Authenticator, 1Password, Authy…).

Les autres membres de l'équipe s'ajoutent ensuite depuis la console (**Équipe → Inviter**) : ils créent un compte joueur avec l'e-mail invité, puis se connectent sur `/admin/`.

### 5. Ajouter du contenu

Depuis la console : questions de quiz, mots, jeu du jour, compétitions. Le script installe déjà un jeu de questions et de mots de départ.

**Écoles et années : ce sont les joueurs qui les renseignent.** Après l'inscription, une fenêtre demande l'école (recherche, ou « Ajouter » si elle n'existe pas : nom, ville, pays) et l'année d'études (1re à 6e année et plus). La « promo » d'un joueur = même école + même année.

- Les doublons sont évités automatiquement (accents, majuscules, ponctuation et sigle ignorés dans la même ville). Un joueur peut ajouter 3 écoles par jour, 10 au total.
- L'école peut être corrigée pendant 24 h, puis elle reste 30 jours (on ne change pas d'équipe en pleine Coupe). L'année se modifie à tout moment.
- Les points de Coupe comptent tout de suite. Le badge « vérifié » est un bonus facultatif : il n'est possible que si tu ajoutes le domaine e-mail de l'école dans la console.
- Dans la console (**Écoles**), tu vois qui a ajouté chaque école et tu peux la renommer, **fusionner** deux doublons ou la **supprimer**.

---

## Comment RYVO gagne de l'argent (sans partenariats)

Tout est gratuit pour jouer. Les revenus viennent des joueurs eux-mêmes, et **rien de ce qui se vend ne fait gagner** : pas d'essais en plus, pas de bonus, pas de cote.

1. **Boutique de cosmétiques.** Avatars, cadres et thèmes, visibles par tous dans les classements. Ils s'achètent avec des **gemmes**, vendues par packs (0,99 €, 4,99 €, 9,99 € par défaut, modifiables dans la console).
2. **Ligues privées.** N'importe quel joueur crée une ligue pour son groupe (amis, promo, asso, club) et partage un code ou un lien. Le classement prend les vraies parties vérifiées par le serveur pendant la période. Gratuit jusqu'à 20 joueurs et 14 jours ; **Ligue+** (300 gemmes) : 200 joueurs, 60 jours, couleur, export CSV.
3. **Pubs récompensées.** Le joueur choisit de regarder une courte pub pour gagner 10 gemmes (5 fois par jour maximum). Jamais de pub pendant une partie.

### Encaisser les achats (Stripe)

Avant de vendre : il te faut un statut (la micro-entreprise suffit pour démarrer) et des conditions de vente. Le jeu affiche un modèle de conditions de vente (Boutique → « Conditions de vente ») : fais-le relire, et renseigne `seller` dans `config.js`. Tant que `seller` est vide ou que `payments` vaut `false`, les packs restent visibles mais ne sont pas achetables.

1. Crée un compte sur [stripe.com](https://stripe.com) et reste en **mode test** au début. Dans **Développeurs → Clés API**, copie la **clé secrète** (`sk_test_…`). Elle ne va **jamais** dans ce dépôt.
2. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**. Nomme-la `payments`, colle tout le contenu de [`supabase/functions/payments/index.ts`](supabase/functions/payments/index.ts), puis **Deploy**.
   Dans les réglages de la fonction, **désactive « Enforce JWT verification »** (Stripe doit pouvoir l'appeler ; la fonction vérifie elle-même la session du joueur pour la page de paiement).
   *(Avec l'outil en ligne de commande : `supabase functions deploy payments --no-verify-jwt`.)*
3. Stripe → **Développeurs → Webhooks → Ajouter une destination**. Adresse : `https://<ton-projet>.supabase.co/functions/v1/payments/webhook`. Événements : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`. Copie le **secret de signature** (`whsec_…`).
4. Supabase → **Edge Functions → Secrets** : ajoute
   - `STRIPE_SECRET_KEY` = la clé secrète,
   - `STRIPE_WEBHOOK_SECRET` = le secret de signature,
   - `SITE_URL` = `https://<ton-pseudo-github>.github.io/RYVO/`.
5. Dans `config.js` : `seller: '…'` et `payments: true`. Commit et push.
6. Teste un achat avec la carte de test `4242 4242 4242 4242` (date future, n'importe quel code). Les gemmes arrivent en quelques secondes ; le paiement apparaît dans la console (**Boutique**).
7. Pour encaisser pour de vrai : active ton compte Stripe, remplace la clé et le secret du webhook par ceux du **mode live** (nouvelle destination webhook en live).

Le prix et le nombre de gemmes viennent de la base, jamais du navigateur. La fonction vérifie la signature de Stripe, et un même paiement n'est crédité qu'une fois. Un montant inattendu n'est pas crédité : il apparaît « À vérifier » dans la console. Un remboursement fait depuis Stripe retire les gemmes.

### Activer les pubs récompensées

1. Crée un compte [Google AdSense](https://adsense.google.com), ajoute ton site et attends la validation.
2. Demande l'accès aux annonces pour jeux HTML5 (**Ad Placement API**, annonces avec récompense). Google peut refuser un site à faible trafic : dans ce cas, réessaie plus tard.
3. AdSense → **Confidentialité et messages** → active le message de consentement européen (RGPD). Il est obligatoire pour les joueurs en Europe.
4. Dans `config.js` : `ads: { client: 'ca-pub-…', test: true }`. Vérifie qu'une pub de test s'affiche, puis passe `test: false`.

Limite honnête : un site web ne peut pas prouver au serveur qu'une pub a vraiment été regardée. C'est pour ça que la récompense est plafonnée (nombre par jour, délai entre deux pubs) et ne sert qu'aux cosmétiques.

## Sécurité : comment c'est protégé

- **Aucun accès direct aux tables.** Toutes les tables ont la sécurité ligne par ligne (RLS) activée, sans aucune règle d'accès, et les droits sont retirés aux visiteurs. Le site ne peut appeler que des fonctions serveur précises.
- **Chaque fonction vérifie qui appelle.** Les fonctions joueur exigent un compte connecté et actif (pas suspendu ni banni). Les fonctions admin vérifient le rôle (super, modération, contenu, partenariats) **et** la double authentification.
- **Les invités peuvent jouer, mais rien n'est enregistré.** Sans compte, chaque jeu se lance en partie d'essai locale ; à la fin, la fenêtre d'inscription/connexion s'ouvre. Seules les parties lancées une fois connecté sont envoyées au serveur (une partie invité ne peut pas être « rattrapée » après coup, sinon n'importe qui pourrait inventer un score).
- **Les scores sont calculés par le serveur.** Une partie classée commence par un ticket serveur (`start_run`). Pour le Quiz, chaque réponse est corrigée côté serveur ; pour Word Rush, chaque mot est vérifié côté serveur ; pour les autres jeux, le serveur contrôle la cohérence (durées, vitesses, records anormaux) et signale ou annule les parties suspectes (onglet **Anti-triche** de la console).
- **Journal d'audit.** Chaque action admin est enregistrée et ne peut pas être effacée.
- **Données personnelles.** Les e-mails sont masqués dans la console (affichage complet tracé dans le journal). Chaque joueur peut exporter ses données et supprimer son compte depuis son profil.
- **Paiements.** Le site ne touche jamais à une carte : il ouvre la page Stripe. Les gemmes ne sont créditées que par la fonction serveur, après un paiement confirmé et signé par Stripe. Les clés Stripe vivent uniquement dans les secrets Supabase.
- **Le site** : politique de sécurité du contenu (CSP) qui n'autorise que Supabase, la bibliothèque officielle et, pour les pubs, les domaines de Google ; console admin non indexée.

Limite honnête : dans un jeu qui tourne dans le navigateur, aucun anti-triche n'est parfait. Les contrôles serveur bloquent les scores impossibles et signalent les suspects ; la modération fait le reste.

## Ce qui n'est pas encore branché

- **Paiement par carte et pubs** : le code est prêt, il reste à créer les comptes Stripe et AdSense (voir plus haut).
- **Amis** : le classement « amis » n'est pas encore disponible en ligne.
- **Duels** : asynchrones (tu affrontes le record réel d'un joueur proche de ta cote), pas en temps réel.

---

## Modifier le code

Les pages publiées sont assemblées à partir des sources de `build/` :

```
build/game/    p1.css.html … p6.live.js   → index.html
build/admin/   a1.css.html, b2 … b5        → admin/index.html
supabase/src/  01 … 09 .sql                → supabase/schema.sql
supabase/functions/payments/index.ts        → à coller dans Supabase (Edge Functions)
```

Après une modification : `bash build/build.sh`, puis commit et push. Si tu modifies les fichiers SQL, relance `supabase/schema.sql` dans le SQL Editor.

## Hébergement gratuit

- GitHub Pages sert le site (le dépôt doit être public pour l'offre gratuite ; rien de secret n'y est stocké).
- Le projet Supabase gratuit se met en pause après une semaine sans activité : il suffit de le relancer depuis le tableau de bord.
