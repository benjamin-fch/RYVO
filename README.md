# RYVO

Mini-jeux compétitifs (8 jeux), classements, duels et Coupe des écoles, avec une console d'administration.

- **Le jeu** : `index.html` (à la racine)
- **La console admin** : `admin/index.html` (accessible via `/admin/`, non indexée par les moteurs de recherche)
- **La base de données** : `supabase/schema.sql` (tables, règles de sécurité, logique serveur)
- **Le réglage** : `config.js` (adresse du projet Supabase + clé publique)

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

Depuis la console : écoles (avec leur domaine e-mail, pour la vérification étudiante), questions de quiz, mots, jeu du jour, compétitions. Le script installe déjà un jeu de questions et de mots de départ.

---

## Sécurité : comment c'est protégé

- **Aucun accès direct aux tables.** Toutes les tables ont la sécurité ligne par ligne (RLS) activée, sans aucune règle d'accès, et les droits sont retirés aux visiteurs. Le site ne peut appeler que des fonctions serveur précises.
- **Chaque fonction vérifie qui appelle.** Les fonctions joueur exigent un compte connecté et actif (pas suspendu ni banni). Les fonctions admin vérifient le rôle (super, modération, contenu, partenariats) **et** la double authentification.
- **Les invités peuvent jouer, mais rien n'est enregistré.** Sans compte, chaque jeu se lance en partie d'essai locale ; à la fin, la fenêtre d'inscription/connexion s'ouvre. Seules les parties lancées une fois connecté sont envoyées au serveur (une partie invité ne peut pas être « rattrapée » après coup, sinon n'importe qui pourrait inventer un score).
- **Les scores sont calculés par le serveur.** Une partie classée commence par un ticket serveur (`start_run`). Pour le Quiz, chaque réponse est corrigée côté serveur ; pour Word Rush, chaque mot est vérifié côté serveur ; pour les autres jeux, le serveur contrôle la cohérence (durées, vitesses, records anormaux) et signale ou annule les parties suspectes (onglet **Anti-triche** de la console).
- **Journal d'audit.** Chaque action admin est enregistrée et ne peut pas être effacée.
- **Données personnelles.** Les e-mails sont masqués dans la console (affichage complet tracé dans le journal). Chaque joueur peut exporter ses données et supprimer son compte depuis son profil.
- **Le site** : politique de sécurité du contenu (CSP) qui n'autorise que Supabase et la bibliothèque officielle, console admin non indexée.

Limite honnête : dans un jeu qui tourne dans le navigateur, aucun anti-triche n'est parfait. Les contrôles serveur bloquent les scores impossibles et signalent les suspects ; la modération fait le reste.

## Ce qui n'est pas encore branché

- **Paiement** de l'offre Plus (Stripe) : la page offres existe, l'encaissement reste à brancher.
- **Amis** : le classement « amis » n'est pas encore disponible en ligne.
- **Duels** : asynchrones (tu affrontes le record réel d'un joueur proche de ta cote), pas en temps réel.

---

## Modifier le code

Les pages publiées sont assemblées à partir des sources de `build/` :

```
build/game/    p1.css.html … p6.live.js   → index.html
build/admin/   a1.css.html, b2 … b5        → admin/index.html
supabase/src/  01 … 05 .sql                → supabase/schema.sql
```

Après une modification : `bash build/build.sh`, puis commit et push. Si tu modifies les fichiers SQL, relance `supabase/schema.sql` dans le SQL Editor.

## Hébergement gratuit

- GitHub Pages sert le site (le dépôt doit être public pour l'offre gratuite ; rien de secret n'y est stocké).
- Le projet Supabase gratuit se met en pause après une semaine sans activité : il suffit de le relancer depuis le tableau de bord.
