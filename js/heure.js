function afficherHeure() {
    const maintenant = new Date();
    const heures = String(maintenant.getHours()).padStart(2, '0');
    const minutes = String(maintenant.getMinutes()).padStart(2, '0');
    const secondes = String(maintenant.getSeconds()).padStart(2, '0');

    const heureFormatee = `${heures}:${minutes}:${secondes}`;
    document.getElementById('horloge').textContent = heureFormatee;
}

// Mettre à jour l'heure toutes les secondes
setInterval(afficherHeure, 1000);

// Appeler la fonction immédiatement pour éviter un délai initial
afficherHeure();


