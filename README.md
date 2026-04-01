# Révolution Network - Dashboard Web Application

Une application web complète de gestion de réseau blockchain avec interface utilisateur moderne et responsive.

## 📋 Description

Révolution Network est une plateforme de gestion de nœuds blockchain avec système de récompenses, parrainages et suivi de performance. L'interface est inspirée des meilleurs dashboards crypto modernes.

## ✨ Fonctionnalités

### Pages Principales

1. **Vue d'ensemble (Overview)**
   - Statistiques de récompenses Saison 1 et quotidiennes
   - Statut des nœuds en temps réel
   - Graphiques interactifs des récompenses
   - Informations sur la saison en cours

2. **Mes Nœuds**
   - Liste complète de tous les nœuds
   - Statuts en temps réel (Connecté, Déconnecté, Maintenance)
   - Métriques de performance (Uptime, Points, Localisation)
   - Actions de configuration et gestion

3. **Récompenses**
   - Résumé total des récompenses par catégorie
   - Tableau détaillé par date
   - Répartition Network, Parrainages, Boost, Bonus

4. **Parrainages**
   - Statistiques de parrainages
   - Lien de parrainage personnel
   - Liste des utilisateurs parrainés
   - Suivi des points gagnés

5. **Profil**
   - Informations utilisateur
   - Badge de niveau (Gold Member)
   - Accomplissements débloqués/verrouillés
   - Gestion du compte

### Fonctionnalités Techniques

- **Thème Dark/Light** : Basculement entre mode sombre et clair
- **Responsive** : Compatible mobile, tablette et desktop
- **Animations** : Transitions fluides et micro-interactions
- **Graphiques** : Visualisation de données avec Recharts
- **Navigation** : Menu latéral avec navigation fluide

## 🛠️ Technologies Utilisées

- **React 18** : Framework JavaScript
- **Recharts** : Bibliothèque de graphiques
- **Lucide React** : Icônes modernes
- **CSS3** : Styles avec gradients et animations
- **Babel Standalone** : Compilation JSX dans le navigateur

## 📦 Installation

### Option 1 : Utilisation directe

1. Téléchargez tous les fichiers
2. Ouvrez `index.html` dans votre navigateur
3. Aucune installation nécessaire !

### Option 2 : Serveur local

```bash
# Avec Python 3
python -m http.server 8000

# Avec Node.js (npx)
npx serve

# Avec PHP
php -S localhost:8000
```

Puis ouvrez : `http://localhost:8000`

## 📁 Structure des Fichiers

```
revolution-network/
│
├── index.html              # Page HTML principale
├── styles.css              # Feuille de styles CSS
├── revolution-network.jsx  # Code source React (optionnel)
└── README.md              # Documentation
```

## 🎨 Personnalisation

### Changer les couleurs

Modifiez les variables CSS dans `styles.css` :

```css
/* Couleur principale (vert) */
#10b981 → Votre couleur

/* Couleur secondaire (violet) */
#a78bfa → Votre couleur

/* Arrière-plan sombre */
#0a0a0a → Votre couleur
```

### Modifier les données

Les données sont simulées dans le code. Pour utiliser de vraies données :

1. Remplacez les `useState` avec des appels API
2. Utilisez `useEffect` pour charger les données
3. Connectez à votre backend

Exemple :
```javascript
const [nodes, setNodes] = useState([]);

useEffect(() => {
  fetch('https://votre-api.com/nodes')
    .then(res => res.json())
    .then(data => setNodes(data));
}, []);
```

## 🌐 Navigateurs Supportés

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Opera 76+

## 📱 Responsive Design

L'application s'adapte automatiquement :

- **Desktop** (1200px+) : Mise en page complète avec sidebar
- **Tablette** (768px - 1199px) : Layout adapté
- **Mobile** (< 768px) : Menu hamburger, layout optimisé

## 🎯 Points Techniques

### Performance
- Utilisation de React.memo pour optimiser les re-rendus
- Lazy loading des composants
- Animations CSS performantes

### Accessibilité
- Contraste WCAG AA
- Navigation au clavier
- Labels ARIA

### Sécurité
- Pas de stockage de données sensibles
- Validation des inputs
- Sanitization des données

## 🔧 Développement

Pour développer et modifier le code :

1. Installez un éditeur (VS Code recommandé)
2. Installez les extensions :
   - ES7+ React/Redux/React-Native snippets
   - Prettier - Code formatter
   - Live Server

3. Modifiez le code dans `index.html`
4. Utilisez Live Server pour voir les changements en temps réel

## 🚀 Déploiement

### GitHub Pages

```bash
# Créez un repo GitHub
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/votre-nom/revolution-network.git
git push -u origin main

# Activez GitHub Pages dans Settings → Pages
```

### Netlify

1. Déposez le dossier sur netlify.com
2. Ou utilisez Netlify CLI :
```bash
npm install -g netlify-cli
netlify deploy
```

### Vercel

```bash
npm install -g vercel
vercel
```

## 📊 Données Simulées

Les données actuelles sont simulées pour démonstration :

- **Nœuds** : 9 nœuds avec statuts variés
- **Récompenses** : Points générés aléatoirement
- **Parrainages** : 5 utilisateurs fictifs
- **Graphiques** : Données des 14 derniers jours

Pour production, remplacez par vos vraies données API.

## 🎨 Design System

### Couleurs
- **Primaire** : `#10b981` (Vert émeraude)
- **Secondaire** : `#a78bfa` (Violet)
- **Accent** : `#6366f1` (Indigo)
- **Warning** : `#fbbf24` (Jaune)
- **Danger** : `#ef4444` (Rouge)

### Typographie
- **Famille** : Inter, SF Pro Display
- **Tailles** : 11px - 48px
- **Poids** : 400, 500, 600, 700, 800

### Espacements
- **Base** : 4px
- **Petit** : 8px - 12px
- **Moyen** : 16px - 24px
- **Grand** : 32px - 48px

## 🐛 Problèmes Connus

Aucun problème majeur identifié. Pour signaler un bug :
1. Vérifiez la console du navigateur
2. Testez avec un autre navigateur
3. Vérifiez la connexion internet (pour les CDN)

## 📝 Licence

Ce projet est sous licence MIT. Libre d'utilisation pour projets personnels et commerciaux.

## 👥 Contribution

Les contributions sont bienvenues ! Pour contribuer :

1. Fork le projet
2. Créez une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add AmazingFeature'`)
4. Push la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 📞 Contact

Pour toute question ou suggestion :
- Email : contact@revolution-network.io
- Twitter : @RevolutionNet
- Discord : Revolution Network

## 🙏 Remerciements

- Design inspiré par Gradient Network
- Icônes par Lucide
- Graphiques par Recharts
- Police Inter par Rasmus Andersson

---

**Révolution Network** - Propulsez votre réseau blockchain vers de nouveaux sommets ! 🚀
