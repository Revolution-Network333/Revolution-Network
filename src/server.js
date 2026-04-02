const start = async () => {
  // Le serveur relais ne fait plus de migrations PostgreSQL car le projet est passé sur MySQL.
  // Les migrations MySQL doivent être gérées directement dans le dossier backend.
  
  console.log('Démarrage du serveur relais Revolution Network...');
  console.log('Mode Proxy activé vers : backend/src/server.js');

  process.env.SRC_PROXY = 'backend';
  
  try {
    // On lance le vrai serveur backend situé dans le sous-dossier
    require('../backend/src/server.js');
  } catch (err) {
    console.error('Erreur lors du lancement du backend :', err);
    process.exit(1);
  }
};

start();
