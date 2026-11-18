import OBR from "@owlbear-rodeo/sdk";

// ======================================
// 1. PALETTE DE COULEURS DISPONIBLES
// ======================================

const colors = [
    { name: "Corail", value: "#fb7b77" },
    { name: "Abricot", value: "#fdc170" },
    { name: "Citron", value: "#f3f87f" },
    { name: "Vert", value: "#98f786" },
    { name: "Cyan", value: "#69ebfc" },
    { name: "Bleu", value: "#6d9efc" },
    { name: "Violet", value: "#937df8" },
    { name: "Rose", value: "#f78ef0" }
];


// ======================================
// 2. DONNEES DE LA ROUE
// ======================================

let segments = [
    { text: "Potion", color: "#fb7b77", weight: 10 },
    { text: "Épée", color: "#fdc170", weight: 20 },
    { text: "Bouclier", color: "#f3f87f", weight: 30 },
    { text: "Rien", color: "#98f786", weight: 40 }
];

// Toutes les roues sauvegardées du joueur
let wheels = [];

// Identifiant de la roue actuellement sélectionnée
let activeWheelId = null;

// Angle actuel de rotation de la roue
let wheelRotation = 0;
let wheelBorderColor = "#ffffff";
let isSpinning = false;

// Segment actuellement affiché comme gagnant
let currentWinner = null;

// Identifiant utilisé pour sauvegarder la roue du joueur
let currentWheelStorageKey = null;

// Minuteur pour éviter trop de sauvegardes successives
let wheelSaveTimeout = null;


async function loadWheelFromRoom() {

    try {

        const roomMetadata = await OBR.room.getMetadata();

        const savedData = roomMetadata[currentWheelStorageKey];

        // Récupérer les roues enregistrées
        if (savedData && Array.isArray(savedData.wheels)) {

            wheels = savedData.wheels.map(wheel => ({
                ...wheel,
                ownerId: wheel.ownerId || OBR.player.id
            }));

            // Restaurer l'identifiant de la roue sélectionnée
            // null signifie qu'aucune roue n'était sélectionnée
            if (Object.prototype.hasOwnProperty.call(savedData, "activeWheelId")) {
                activeWheelId = savedData.activeWheelId;
            } else {
                activeWheelId = wheels.length > 0 ? wheels[0].id : null;
            }

        }

        // Compatibilité avec l'ancien système de sauvegarde
        else if (Array.isArray(savedData)) {

            wheels = [{
                id: crypto.randomUUID(),
                ownerId: OBR.player.id,
                name: "Roue 1",
                segments: savedData
            }];

            activeWheelId = wheels[0].id;

        }

        // Première utilisation : créer une roue par défaut
        else {

            // Liste des noms possibles
            const possibleNames = [
                "Potion",
                "Épée",
                "Bouclier",
                "Or",
                "Gemme",
                "Trésor",
                "Parchemin",
                "Clé",
                "Piège",
                "Monstre",
                "Magie",
                "Armure",
                "Anneau",
                "Amulette",
                "Rien",
                "Malédiction"
            ];

            // Mélanger les noms
            const shuffledNames = [...possibleNames];

            for (let i = shuffledNames.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));

                [shuffledNames[i], shuffledNames[j]] =
                    [shuffledNames[j], shuffledNames[i]];
            }

            // Mélanger les couleurs
            const shuffledColors = [...colors];

            for (let i = shuffledColors.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));

                [shuffledColors[i], shuffledColors[j]] =
                    [shuffledColors[j], shuffledColors[i]];
            }

            // Créer les 8 segments
            const initialSegments = shuffledNames.slice(0, 8).map((name, index) => ({
                text: name,
                color: shuffledColors[index].value,
                weight: 12.5
            }));

            wheels = [{
                id: crypto.randomUUID(),
                ownerId: OBR.player.id,
                name: "Roue 1",
                segments: initialSegments
            }];

            activeWheelId = wheels[0].id;

        }

        // Retrouver la roue active
        let activeWheel = wheels.find(
            wheel => wheel.id === activeWheelId
        );

        // Si l'identifiant enregistré n'existe plus,
        // sélectionner la première roue disponible
        if (!activeWheel && activeWheelId !== null && wheels.length > 0) {

            activeWheel = wheels[0];
            activeWheelId = activeWheel.id;

        }

        // Charger la roue active, si elle existe
        if (activeWheel) {

            segments = activeWheel.segments.map(segment => ({
                ...segment
            }));

            wheelTitle.textContent = activeWheel.name;

        } else {

            segments = [];
            wheelTitle.textContent = "";

        }

        renderEditor();
        drawWheel();
        renderWheelList();
        updateWheelLayout();

        if (!savedData) {
            scheduleWheelSave();
        }

    } catch (error) {

        console.error("Erreur de chargement des roues :", error);

    }
}

async function getPlayerWheels(playerId) {
    try {
        const roomMetadata = await OBR.room.getMetadata();

        const playerStorageKey =
            `com.rouepersonnalisee.spinning-wheel/player/${playerId}`;

        const savedData = roomMetadata[playerStorageKey];

        if (savedData && Array.isArray(savedData.wheels)) {

            // Vérifier si le joueur actuel est MJ
            const isGM = currentPlayers.some(
                player => player.id === OBR.player.id && player.role === "GM"
            );

            // Le propriétaire et le MJ voient toutes les roues
            if (playerId === OBR.player.id || isGM) {
                return savedData.wheels;
            }

            // Les autres joueurs ne voient que les roues visibles
            return savedData.wheels.filter(
                wheel => wheel.visible !== false
            );
        }

        return [];

    } catch (error) {
        console.error("Erreur de récupération des roues du joueur :", error);
        return [];
    }
}

// Actualiser l'apparence du cadenas
function updateWheelLockAppearance() {

    if (!wheelLock) return;

    // Vérifier si le joueur actuel est MJ
    const isGM = currentPlayers.some(
        player => player.id === OBR.player.id && player.role === "GM"
    );

    // Retrouver la roue actuellement affichée
    const currentWheel = isViewingOtherPlayer
        ? viewedPlayerWheels.find(
            wheel => wheel.id === viewedActiveWheelId
        )
        : wheels.find(
            wheel => wheel.id === activeWheelId
        );

    if (!currentWheel) return;

    // Définir l'état du cadenas
    wheelLock.dataset.locked =
        currentWheel.locked === true ? "true" : "false";

    // Masquer le cadenas ouvert aux joueurs non-MJ
    wheelLock.style.display =
        !isGM && currentWheel.locked !== true
            ? "none"
            : "flex";

    // Récupérer la couleur du segment sous le pointeur
    const winningSegment = getWinningSegment();

    if (winningSegment) {
        wheelLock.style.color = winningSegment.color;
    }

}

// Actualiser l'apparence des boutons de visibilité
function updateWheelVisibilityAppearance() {

    const showButton = document.getElementById("toggleWheelVisibility");
    const hideButton = document.getElementById("hideWheelVisibility");

    if (!showButton || !hideButton) return;

    // Vérifier si le joueur actuel est MJ
    const isGM = currentPlayers.some(
        player => player.id === OBR.player.id && player.role === "GM"
    );

    // Les boutons sont réservés au MJ dans ses propres roues
    if (!isGM || isViewingOtherPlayer) {
        showButton.style.display = "none";
        hideButton.style.display = "none";
        return;
    }

    // Retrouver la roue actuellement sélectionnée
    const currentWheel = wheels.find(
        wheel => wheel.id === activeWheelId
    );

    if (!currentWheel) {
        showButton.style.display = "none";
        hideButton.style.display = "none";
        return;
    }

    // Afficher un seul bouton selon l'état de visibilité
    const isVisible = currentWheel.visible !== false;

    showButton.style.display = isVisible ? "flex" : "none";
    hideButton.style.display = isVisible ? "none" : "flex";
}

// Verrouiller ou déverrouiller une roue avec le cadenas
async function toggleWheelLock() {


    // Vérifier que le joueur est MJ
    const isGM = currentPlayers.some(
        player => player.id === OBR.player.id && player.role === "GM"
    );

    if (!isGM) return;

    // Déterminer le propriétaire et l'identifiant de la roue consultée
    const playerId = isViewingOtherPlayer
        ? viewedPlayerId
        : OBR.player.id;

    const wheelId = isViewingOtherPlayer
        ? viewedActiveWheelId
        : activeWheelId;

    // Retrouver la roue sélectionnée
    const viewedWheel = isViewingOtherPlayer
        ? viewedPlayerWheels.find(wheel => wheel.id === wheelId)
        : wheels.find(wheel => wheel.id === wheelId);

    if (!viewedWheel) return;

    // Inverser son état de verrouillage
    const newLockedState = viewedWheel.locked !== true;

    // Récupérer les données actuelles de la salle
    const playerStorageKey =
        `com.rouepersonnalisee.spinning-wheel/player/${playerId}`;

    const roomMetadata = await OBR.room.getMetadata();
    const savedData = roomMetadata[playerStorageKey];

    if (!savedData || !Array.isArray(savedData.wheels)) return;

    // Modifier uniquement la roue sélectionnée
    const updatedWheels = savedData.wheels.map(wheel => {

        if (wheel.id !== wheelId) {
            return wheel;
        }

        return {
            ...wheel,
            locked: newLockedState
        };

    });

    // Sauvegarder le nouvel état
    await OBR.room.setMetadata({
        [playerStorageKey]: {
            ...savedData,
            wheels: updatedWheels
        }
    });

    // Mettre à jour la roue actuellement affichée
    viewedWheel.locked = newLockedState;

    // Actualiser l'interface
    renderEditor();
    drawWheel();

    // Afficher la bibliothèque du joueur concerné
    renderWheelList(
        isViewingOtherPlayer ? viewedPlayerWheels : wheels
    );

}

// Masquer ou afficher une roue aux autres joueurs
async function toggleWheelVisibility() {

    // Vérifier que le joueur est MJ
    const isGM = currentPlayers.some(
        player => player.id === OBR.player.id && player.role === "GM"
    );

    if (!isGM || isViewingOtherPlayer) return;

    // Retrouver la roue personnelle sélectionnée
    const currentWheel = wheels.find(
        wheel => wheel.id === activeWheelId
    );

    if (!currentWheel) return;

    // Inverser son état de visibilité
    const newVisibleState = currentWheel.visible === false;

    // Récupérer les données actuelles de la salle
    const playerStorageKey =
        `com.rouepersonnalisee.spinning-wheel/player/${OBR.player.id}`;

    const roomMetadata = await OBR.room.getMetadata();
    const savedData = roomMetadata[playerStorageKey];

    if (!savedData || !Array.isArray(savedData.wheels)) return;

    // Modifier uniquement la roue sélectionnée
    const updatedWheels = savedData.wheels.map(wheel => {

        if (wheel.id !== activeWheelId) {
            return wheel;
        }

        return {
            ...wheel,
            visible: newVisibleState
        };

    });

    // Sauvegarder le nouvel état
    await OBR.room.setMetadata({
        [playerStorageKey]: {
            ...savedData,
            wheels: updatedWheels
        }
    });

    // Actualiser la roue locale
    currentWheel.visible = newVisibleState;

    // Actualiser l'interface
    renderWheelList();
    drawWheel();

}

function viewPlayerWheels(playerId) {

    viewedPlayerId = playerId;
    isViewingOtherPlayer = true;

    const viewedPlayer = currentPlayers.find(player => player.id === playerId);

    if (viewedPlayer) {
        document.querySelector("header p").textContent =
            viewedPlayer.name;
    }

    document.getElementById("wheelLock").style.display = "flex";

    getPlayerWheels(playerId).then(playerWheels => {

        // Ignorer le résultat si le MJ a changé de joueur ou quitté la consultation
        if (!isViewingOtherPlayer || playerId !== viewedPlayerId) return;

        viewedPlayerWheels = playerWheels;

        // Sélectionner automatiquement la première roue
        const activeWheel = viewedPlayerWheels[0] || null;

        viewedActiveWheelId = activeWheel
            ? activeWheel.id
            : null;

        // Afficher les miniatures du joueur consulté
        renderWheelList(viewedPlayerWheels);

        // Afficher la première roue
        if (activeWheel) {

            segments = activeWheel.segments.map(segment => ({
                ...segment
            }));

            wheelTitle.textContent = activeWheel.name;

        } else {

            segments = [];
            wheelTitle.textContent = "";

        }

        renderEditor();
        drawWheel();
        updateWheelLayout();

    });

}

async function viewMyWheels() {

    viewedPlayerId = OBR.player.id;
    isViewingOtherPlayer = false;

    // Réafficher le nom du joueur connecté
    document.querySelector("header p").textContent =
        currentPlayerName;

    viewedPlayerWheels = [];

    // Recharger les roues depuis les métadonnées de la salle
    await loadWheelFromRoom();

}

function scheduleWheelSave() {

    clearTimeout(wheelSaveTimeout);

    wheelSaveTimeout = setTimeout(async () => {

        try {

            // Si on consulte la roue d'un autre joueur
            if (isViewingOtherPlayer) {

                const isGM = currentPlayers.some(
                    player => player.id === OBR.player.id && player.role === "GM"
                );

                const viewedWheel = viewedPlayerWheels.find(
                    wheel => wheel.id === viewedActiveWheelId
                );

                // Vérifier les droits du MJ
                if (!isGM || !viewedWheel || viewedWheel.locked === true) {
                    return;
                }

                // Récupérer la clé de sauvegarde du propriétaire
                const playerStorageKey =
                    `com.rouepersonnalisee.spinning-wheel/player/${viewedPlayerId}`;

                // Récupérer les données actuelles de la salle
                const roomMetadata = await OBR.room.getMetadata();
                const savedData = roomMetadata[playerStorageKey];

                if (!savedData || !Array.isArray(savedData.wheels)) {
                    console.error("Impossible de retrouver les roues du joueur.");
                    return;
                }

                // Mettre à jour uniquement la roue consultée
                const updatedWheels = savedData.wheels.map(wheel => {

                    if (wheel.id !== viewedActiveWheelId) {
                        return wheel;
                    }

                    return {
                        ...wheel,
                        name: viewedWheel.name,
                        segments: segments.map(segment => ({
                            text: segment.text,
                            color: segment.color,
                            weight: segment.weight
                        }))
                    };

                });

                // Enregistrer les modifications chez le propriétaire
                await OBR.room.setMetadata({
                    [playerStorageKey]: {
                        ...savedData,
                        wheels: updatedWheels
                    }
                });

                // Actualiser les données locales
                viewedPlayerWheels = updatedWheels;

                // Actualiser les miniatures
                renderWheelList(viewedPlayerWheels);

                return;
            }

            // Sauvegarde normale de ses propres roues
            if (!currentWheelStorageKey) return;

            saveActiveWheel();

            const dataToSave = {
                wheels: wheels.map(wheel => ({
                    id: wheel.id,
                    ownerId: wheel.ownerId,
                    name: wheel.name,
                    locked: wheel.locked === true,
                    visible: wheel.visible !== false,
                    segments: wheel.segments.map(segment => ({
                        text: segment.text,
                        color: segment.color,
                        weight: segment.weight
                    }))
                })),

                activeWheelId: activeWheelId
            };

            await OBR.room.setMetadata({
                [currentWheelStorageKey]: dataToSave
            });

        } catch (error) {

            console.error("Erreur de sauvegarde des roues :", error);

        }

    }, 500);
}


// ======================================
// 3. RECUPERATION DES ELEMENTS HTML
// ======================================

const canvas = document.getElementById("wheelCanvas");
const wheelLock = document.getElementById("wheelLock");

// Déclencher le verrouillage au clic sur le cadenas
wheelLock.addEventListener("click", toggleWheelLock);

// Boutons de visibilité des roues
const showWheelVisibility = document.getElementById("toggleWheelVisibility");
const hideWheelVisibility = document.getElementById("hideWheelVisibility");

showWheelVisibility.addEventListener("click", toggleWheelVisibility);
hideWheelVisibility.addEventListener("click", toggleWheelVisibility);

const pointer = document.querySelector(".pointer");
const ctx = canvas.getContext("2d");

// Éléments de la bibliothèque de roues
const wheelList = document.getElementById("wheelList");
const createWheelButton = document.getElementById("createWheel");
const deleteWheelButton = document.getElementById("deleteWheel");
const openHistoryButton = document.getElementById("openHistory");
const openPlayersButton = document.getElementById("openPlayers");
const wheelTitle = document.getElementById("wheelTitle");

// Panneau de personnalisation
const editorPanel = document.querySelector(".editor");
const toggleEditorButton = document.getElementById("toggleEditor");

// Replier ou déplier la personnalisation
toggleEditorButton.addEventListener("click", () => {

    editorPanel.classList.toggle("collapsed");

    const isCollapsed = editorPanel.classList.contains("collapsed");

    toggleEditorButton.title = isCollapsed
        ? "Afficher la personnalisation"
        : "Replier la personnalisation";

});

// Éléments de la fenêtre de résultat
const resultOverlay = document.getElementById("resultOverlay");
const resultBox = document.getElementById("resultBox");
const closeResultButton = document.getElementById("closeResult");
const winnerName = document.getElementById("winnerName");
const removeWinnerButton = document.getElementById("removeWinner");

const segmentsList = document.getElementById("segmentsList");
const addButton = document.getElementById("addSegment");
const totalWeight = document.getElementById("totalWeight");

const equalButton = document.getElementById("equalPercentages");


// ======================================
// 4. CALCUL DES PROBABILITES
// ======================================

function getTotalWeight() {
    return segments.reduce((total, segment) => total + segment.weight, 0);
}

// ======================================
// RECALCUL AUTOMATIQUE DES POIDS
// ======================================

// Répartir équitablement les poids entre les segments
function equalizePercentages() {

    if (segments.length === 0) return;

    // Attribuer un poids de 1 à chaque segment
    segments.forEach(segment => {
        segment.weight = 1;
    });

    scheduleWheelSave();

    renderEditor();
    drawWheel();

    // Actualiser les miniatures de la bibliothèque affichée
    renderWheelList(
        isViewingOtherPlayer ? viewedPlayerWheels : wheels
    );
}

equalButton.addEventListener("click", equalizePercentages);


// ======================================
// 5. SECURISATION DU TEXTE HTML
// ======================================

function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}


// ======================================
// 6. AFFICHAGE DE L'EDITEUR
// ======================================


function renderEditor() {

    const isGM = currentPlayers.some(
        player => player.id === OBR.player.id && player.role === "GM"
    );

    // Masquer la suppression pour les joueurs ordinaires
    // lorsqu'ils consultent les roues d'un autre joueur
    deleteWheelButton.hidden = isViewingOtherPlayer && !isGM;

    const viewedWheel = isViewingOtherPlayer
        ? viewedPlayerWheels.find(
            wheel => wheel.id === viewedActiveWheelId
        )
        : wheels.find(
            wheel => wheel.id === activeWheelId
        );

    const isWheelLocked = viewedWheel?.locked === true;

    // Autoriser la modification du titre uniquement si la roue est accessible
    wheelTitle.contentEditable =
        viewedWheel && !isWheelLocked && !isSpinning &&
            (!isViewingOtherPlayer || isGM)
            ? "true"
            : "false";

    editorPanel.inert =
        isWheelLocked || (isViewingOtherPlayer && !isGM);

    segmentsList.innerHTML = "";

    const total = getTotalWeight();

    segments.forEach((segment, index) => {

        const element = document.createElement("div");

        element.className = "segment-row";

        const probability = total > 0
            ? (segment.weight / total) * 100
            : 0;

        element.innerHTML = `
    <div class="segment-name-wrapper">

        <span class="segment-number">${index + 1}.</span>

        <input
            type="text"
            class="segment-text"
            data-index="${index}"
            data-field="text"
            value="${escapeHTML(segment.text)}"
            placeholder="Nom du segment"
            onfocus="this.select()"
            ${isSpinning ? "disabled" : ""}
        >

    </div>

    <input
        type="number"
        class="segment-weight"
        data-index="${index}"
        data-field="weight"
        min="1"
        step="0.1"
        value="${Number(segment.weight.toFixed(1))}"
        onfocus="this.select()"
        ${isSpinning ? "disabled" : ""}
    >

            <span class="segment-probability">
                ${probability.toFixed(1)} %
            </span>

            <button
                type="button"
                class="remove-segment"
                data-remove="${index}"
                title="Supprimer"
                ${isSpinning ? "disabled" : ""}
            >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">

                    <path d="M3 6h18v1.5H3z" />
                    <path d="M9 3.5h6V6H9z" />
                    <path d="M5.5 8h13l-1.2 12.5a1.5 1.5 0 0 1-1.5 1.4H8.2a1.5 1.5 0 0 1-1.5-1.4L5.5 8z" />
                    <path d="M9 10.5h1.5v8H9zM13.5 10.5H15v8h-1.5z" fill="#383e4b" />
                </svg>
            </button>
        `;

        segmentsList.appendChild(element);
    });

    totalWeight.textContent = getTotalWeight();

}

function updateWheelLayout() {

    const displayedWheels = isViewingOtherPlayer
        ? viewedPlayerWheels
        : wheels;

    const hasWheels = displayedWheels.length > 0;

    const hasActiveWheel = isViewingOtherPlayer
        ? displayedWheels.some(wheel => wheel.id === viewedActiveWheelId)
        : wheels.some(wheel => wheel.id === activeWheelId);

    document.body.classList.toggle("no-wheels", !hasWheels);

    document.body.classList.toggle(
        "no-wheel-selected",
        hasWheels && !hasActiveWheel
    );

}


// Afficher les roues dans la colonne latérale
function renderWheelList(wheelsToDisplay = wheels) {

    // Synchroniser les segments avant de dessiner les miniatures
    if (!isViewingOtherPlayer) {
        saveActiveWheel();
    }

    // Adapter le bouton selon la liste affichée

    if (isViewingOtherPlayer) {

        createWheelButton.innerHTML = `
            <svg viewBox="0 0 48 48" width="38" height="38">
                <!-- Feuille arrière réduite -->
                <rect x="5" y="5" width="28" height="32"
                   rx="6" fill="currentColor"/>

              <!-- Feuille avant -->
             <rect x="14" y="13" width="30" height="33"
                    rx="6"
                    fill="currentColor"
                   stroke="#383e4b"
                 stroke-width="3"/>

              <!-- Plus en négatif -->
              <path d="M29 21V38M20.5 29.5H37.5"
                 stroke="#383e4b"
                   stroke-width="3.8"
                   stroke-linecap="round"/>
            </svg>
       `;

        createWheelButton.title = "Copier une roue";

    } else {

        createWheelButton.innerHTML = `
        <svg viewBox="0 0 48 48"
            width="38" height="38">

            <circle cx="24" cy="24" r="18"
                fill="currentColor"/>

            <path d="M24 13V35M13 24H35"
                stroke="#383e4b"
                stroke-width="4"
                stroke-linecap="round"/>

        </svg>
    `;

        createWheelButton.title = "Créer une nouvelle roue";

    }

    wheelList.innerHTML = "";

    wheelsToDisplay.forEach(wheel => {

        const button = document.createElement("button");

        button.type = "button";
        button.className = "wheel-item";
        button.disabled = isSpinning;
        button.dataset.wheelId = wheel.id;
        button.title = wheel.name;

        const selectedWheelId = isViewingOtherPlayer
            ? viewedActiveWheelId
            : activeWheelId;

        if (wheel.id === selectedWheelId) {
            button.classList.add("active");
        }

        const thumbnail = document.createElement("div");
        thumbnail.className = "wheel-thumbnail";

        const total = wheel.segments.reduce(
            (sum, segment) => sum + segment.weight, 0
        );

        let position = 0;

        const colors = wheel.segments.map(segment => {

            const percentage = total > 0
                ? segment.weight / total * 100
                : 100 / wheel.segments.length;

            const start = position;
            position += percentage;

            return `${segment.color} ${start}% ${position}%`;

        });

        thumbnail.style.background =
            `conic-gradient(${colors.join(", ")})`;

        button.appendChild(thumbnail);
        wheelList.appendChild(button);

    });
}



function saveActiveWheel() {

    const activeWheel = wheels.find(
        wheel => wheel.id === activeWheelId
    );

    if (!activeWheel) return;

    activeWheel.ownerId = activeWheel.ownerId || OBR.player.id;

    activeWheel.segments = segments.map(segment => ({
        text: segment.text,
        color: segment.color,
        weight: segment.weight
    }));
}


// Sélectionner une roue
function selectWheel(wheelId) {

    saveActiveWheel();

    const selectedWheel = wheels.find(
        wheel => wheel.id === wheelId
    );

    if (!selectedWheel) return;

    activeWheelId = wheelId;

    wheelTitle.textContent = selectedWheel.name;

    segments = selectedWheel.segments.map(segment => ({
        ...segment
    }));

    wheelRotation = 0;

    renderEditor();
    drawWheel();
    // Mettre à jour la sélection sans reconstruire les miniatures
    wheelList.querySelectorAll(".wheel-item").forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.wheelId === activeWheelId
        );

    });
    updateWheelLayout();
    scheduleWheelSave();

}

// Créer une nouvelle roue
function createNewWheel() {

    saveActiveWheel();

    // Liste des noms possibles
    const possibleNames = [
        "Potion",
        "Épée",
        "Bouclier",
        "Or",
        "Gemme",
        "Trésor",
        "Parchemin",
        "Clé",
        "Piège",
        "Monstre",
        "Magie",
        "Armure",
        "Anneau",
        "Amulette",
        "Rien",
        "Malédiction"
    ];

    // Mélanger les noms
    const shuffledNames = [...possibleNames];

    for (let i = shuffledNames.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [shuffledNames[i], shuffledNames[j]] =
            [shuffledNames[j], shuffledNames[i]];
    }

    // Mélanger les couleurs
    const shuffledColors = [...colors];

    for (let i = shuffledColors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [shuffledColors[i], shuffledColors[j]] =
            [shuffledColors[j], shuffledColors[i]];
    }

    // Créer les 3 segments
    const newSegments = shuffledNames.slice(0, 3).map((name, index) => ({
        text: name,
        color: shuffledColors[index].value,
        weight: 1
    }));

    const newWheel = {
        id: crypto.randomUUID(),
        ownerId: OBR.player.id,
        name: `Roue ${wheels.length + 1}`,
        segments: newSegments
    };

    wheels.push(newWheel);
    activeWheelId = newWheel.id;

    // Ouvrir automatiquement la personnalisation
    editorPanel.classList.remove("collapsed");
    toggleEditorButton.title = "Replier la personnalisation";

    document.body.classList.remove("no-wheels");

    wheelTitle.textContent = newWheel.name;

    segments = newWheel.segments.map(segment => ({
        ...segment
    }));

    renderEditor();
    drawWheel();
    renderWheelList();
    updateWheelLayout();
    scheduleWheelSave();
}

// Ouvrir la confirmation de suppression de la roue
function deleteActiveWheel() {

    // Vérifier si le joueur actuel est MJ
    const isGM = currentPlayers.some(
        player => player.id === OBR.player.id && player.role === "GM"
    );

    // Retrouver la roue actuellement affichée
    const currentWheel = isViewingOtherPlayer
        ? viewedPlayerWheels.find(
            wheel => wheel.id === viewedActiveWheelId
        )
        : wheels.find(
            wheel => wheel.id === activeWheelId
        );

    // Vérifier que la roue existe et n'est pas verrouillée
    if (!currentWheel || currentWheel.locked === true) return;

    // Interdire aux non-MJ de supprimer la roue d'un autre joueur
    if (isViewingOtherPlayer && !isGM) return;

    // Ouvrir la confirmation
    document.getElementById("deleteWheelOverlay").style.display = "flex";
}

// Supprimer la roue actuellement affichée
async function deleteWheel() {

    // Empêcher la suppression pendant une rotation
    if (isSpinning) return;

    // Si le MJ consulte les roues d'un autre joueur
    if (isViewingOtherPlayer) {

        // Annuler toute sauvegarde différée en attente
        clearTimeout(wheelSaveTimeout);

        try {

            // Vérifier que le joueur actuel est MJ
            const isGM = currentPlayers.some(
                player => player.id === OBR.player.id && player.role === "GM"
            );

            if (!isGM) return;

            // Retrouver la roue consultée
            const viewedWheel = viewedPlayerWheels.find(
                wheel => wheel.id === viewedActiveWheelId
            );

            // Interdire la suppression si la roue est verrouillée
            if (!viewedWheel || viewedWheel.locked === true) return;

            // Récupérer les données du propriétaire
            const playerStorageKey =
                `com.rouepersonnalisee.spinning-wheel/player/${viewedPlayerId}`;

            const roomMetadata = await OBR.room.getMetadata();
            const savedData = roomMetadata[playerStorageKey];

            if (!savedData || !Array.isArray(savedData.wheels)) {
                console.error("Impossible de retrouver les roues du joueur.");
                return;
            }

            // Retirer la roue supprimée
            const updatedWheels = savedData.wheels.filter(
                wheel => wheel.id !== viewedActiveWheelId
            );

            // Conserver la roue active du propriétaire si elle existe encore
            const nextSavedActiveWheelId = updatedWheels.some(
                wheel => wheel.id === savedData.activeWheelId
            )
                ? savedData.activeWheelId
                : (updatedWheels[0]?.id ?? null);

            // Enregistrer les nouvelles données chez le propriétaire
            await OBR.room.setMetadata({
                [playerStorageKey]: {
                    ...savedData,
                    wheels: updatedWheels,
                    activeWheelId: nextSavedActiveWheelId
                }
            });

            // Actualiser les roues affichées
            viewedPlayerWheels = updatedWheels;

            // Sélectionner la première roue restante
            const nextWheel = viewedPlayerWheels[0] || null;

            viewedActiveWheelId = nextWheel
                ? nextWheel.id
                : null;

            // Charger les segments de la nouvelle roue
            segments = nextWheel
                ? nextWheel.segments.map(segment => ({ ...segment }))
                : [];

            wheelTitle.textContent = nextWheel
                ? nextWheel.name
                : "";

            // Actualiser l'interface
            renderEditor();
            renderWheelList(viewedPlayerWheels);
            updateWheelLayout();
            drawWheel();

        } catch (error) {

            console.error("Erreur lors de la suppression de la roue du joueur :", error);

        }

        return;
    }

    // Vérifier que la roue personnelle existe
    if (!activeWheelId) return;

    const currentWheel = wheels.find(
        wheel => wheel.id === activeWheelId
    );

    // Interdire la suppression d'une roue verrouillée
    if (!currentWheel || currentWheel.locked === true) return;

    // Supprimer la roue personnelle
    wheels = wheels.filter(
        wheel => wheel.id !== activeWheelId
    );

    // S'il reste des roues
    if (wheels.length > 0) {

        activeWheelId = wheels[0].id;
        wheelTitle.textContent = wheels[0].name;

        segments = wheels[0].segments.map(segment => ({
            ...segment
        }));

        document.body.classList.remove("no-wheels");

    } else {

        // Si la bibliothèque est vide
        activeWheelId = null;
        segments = [];
        wheelTitle.textContent = "";

        document.body.classList.add("no-wheels");
    }

    // Actualiser l'interface
    renderEditor();
    renderWheelList();
    updateWheelLayout();
    updateWheelVisibilityAppearance();

    if (segments.length > 0) {
        drawWheel();
    }

    // Enregistrer les modifications
    scheduleWheelSave();
}


// Sélectionner ou désélectionner une roue
wheelList.addEventListener("click", event => {

    const button = event.target.closest(".wheel-item");

    if (!button) return;

    const wheelId = button.dataset.wheelId;

    // Si on consulte les roues d'un autre joueur
    if (isViewingOtherPlayer) {

        const selectedWheel = viewedPlayerWheels.find(
            wheel => wheel.id === wheelId
        );

        if (!selectedWheel) return;

        segments = selectedWheel.segments.map(segment => ({
            ...segment
        }));

        viewedActiveWheelId = selectedWheel.id;
        wheelTitle.textContent = selectedWheel.name;

        drawWheel();
        renderEditor();
        renderWheelList(viewedPlayerWheels);
        updateWheelLayout();

        return;
    }

    // Si la roue cliquée est déjà sélectionnée, la désélectionner
    if (wheelId === activeWheelId) {

        saveActiveWheel();

        activeWheelId = null;
        segments = [];
        wheelTitle.textContent = "";

        renderEditor();
        renderWheelList();
        updateWheelLayout();

        scheduleWheelSave();

        return;
    }

    // Sinon, sélectionner la nouvelle roue
    selectWheel(wheelId);

});



// Créer une roue avec le bouton +
createWheelButton.addEventListener("click", async () => {

    // Si on consulte les roues d'un autre joueur
    if (isViewingOtherPlayer) {

        // Récupérer la roue actuellement affichée
        const wheelToCopy = viewedPlayerWheels.find(
            wheel => wheel.id === viewedActiveWheelId
        );

        // Vérifier qu'une roue est bien sélectionnée
        if (!wheelToCopy) return;

        // Préparer une copie indépendante
        const copiedWheel = {
            id: crypto.randomUUID(),
            ownerId: OBR.player.id,
            name: wheelToCopy.name,
            locked: Boolean(wheelToCopy.locked),
            segments: wheelToCopy.segments.map(segment => ({
                ...segment
            }))
        };

        // Revenir à sa propre vue et attendre le chargement
        await viewMyWheels();

        // Ajouter la copie à ses roues personnelles
        wheels.push(copiedWheel);

        // Sélectionner la copie
        activeWheelId = copiedWheel.id;

        // Afficher la copie
        segments = copiedWheel.segments.map(segment => ({
            ...segment
        }));

        wheelTitle.textContent = copiedWheel.name;

        // Actualiser l'interface et sauvegarder
        renderEditor();
        drawWheel();
        renderWheelList();
        updateWheelLayout();

        scheduleWheelSave();

        return;
    }

    // Sinon, créer une nouvelle roue normalement
    createNewWheel();

});


// Fermer la fenêtre avec le petit bouton ×
closeResultButton.addEventListener("click", () => {

    resultOverlay.style.display = "none";
    resultOverlay.parentElement.classList.remove("result-visible");

});

// Supprimer un segment de la roue affichée
function deleteSegment(index, closeWinner = false) {

    if (isSpinning) return;
    if (!Number.isInteger(index) || !segments[index]) return;

    // Vérifier si le joueur actuel est MJ
    const isGM = currentPlayers.some(
        player => player.id === OBR.player.id && player.role === "GM"
    );

    // Retrouver la roue actuellement affichée
    const currentWheel = isViewingOtherPlayer
        ? viewedPlayerWheels.find(
            wheel => wheel.id === viewedActiveWheelId
        )
        : wheels.find(
            wheel => wheel.id === activeWheelId
        );

    // Vérifier les droits de suppression
    if (!currentWheel || currentWheel.locked === true) return;
    if (isViewingOtherPlayer && !isGM) return;

    // Supprimer le segment sélectionné
    segments.splice(index, 1);

    // Fermer le résultat si la suppression vient du gagnant
    if (closeWinner) {
        resultOverlay.style.display = "none";
        resultOverlay.parentElement.classList.remove("result-visible");
        currentWinner = null;
    }

    // Si la roue n'a plus de segments, supprimer la roue
    if (segments.length === 0) {
        deleteWheel();
        return;
    }

    // Redistribuer les couleurs des segments restants
    redistributeSegmentColors();

    // Actualiser l'interface
    renderEditor();

    if (isViewingOtherPlayer) {
        renderWheelList(viewedPlayerWheels);
    } else {
        renderWheelList();
    }

    updateWheelLayout();
    updateWheelVisibilityAppearance();
    drawWheel();

    // Enregistrer les modifications
    scheduleWheelSave();
}

// Supprimer définitivement le segment gagnant
removeWinnerButton.addEventListener("click", () => {
    if (!currentWinner) return;

    // Retrouver le segment gagnant dans la roue affichée
    const winnerIndex = segments.findIndex(segment =>
        segment.text === currentWinner.text &&
        segment.color === currentWinner.color &&
        segment.weight === currentWinner.weight
    );

    if (winnerIndex === -1) return;

    // Supprimer le gagnant avec la fonction commune
    deleteSegment(winnerIndex, true);
});

// Fermer la fenêtre en cliquant en dehors du rectangle
resultOverlay.addEventListener("click", event => {

    if (event.target === resultOverlay) {
        resultOverlay.style.display = "none";
        resultOverlay.parentElement.classList.remove("result-visible");
    }

});

// Enregistrer le nouveau nom de la roue
wheelTitle.addEventListener("blur", () => {

    // Retrouver la roue actuellement affichée
    const activeWheel = isViewingOtherPlayer
        ? viewedPlayerWheels.find(
            wheel => wheel.id === viewedActiveWheelId
        )
        : wheels.find(
            wheel => wheel.id === activeWheelId
        );

    if (!activeWheel) return;

    // Refuser toute modification si la roue est verrouillée ou en rotation
    if (activeWheel.locked === true || isSpinning) {
        wheelTitle.textContent = activeWheel.name;
        return;
    }

    const newName = wheelTitle.textContent.trim();

    // Refuser un nom vide
    if (newName === "") {
        wheelTitle.textContent = activeWheel.name;
        return;
    }

    activeWheel.name = newName;

    // Actualiser les miniatures de la bonne bibliothèque
    if (isViewingOtherPlayer) {
        renderWheelList(viewedPlayerWheels);
    } else {
        renderWheelList();
    }

    // Enregistrer les modifications
    scheduleWheelSave();

});


// Empêcher le retour à la ligne dans le titre
wheelTitle.addEventListener("keydown", event => {

    if (event.key === "Enter") {
        event.preventDefault();
        wheelTitle.blur();
    }

});

deleteWheelButton.addEventListener("click", () => {
    deleteActiveWheel();
});

// ======================================
// 7. MODIFICATION DES SEGMENTS
// ======================================

segmentsList.addEventListener("input", event => {

    const field = event.target.dataset.field;
    const index = Number(event.target.dataset.index);

    if (field === undefined || !segments[index]) return;

    if (field === "text") {
        segments[index].text = event.target.value;
        scheduleWheelSave();
        drawWheel();
        return;
    }

    if (field === "weight") {

        const value = Number(event.target.value);

        // Ignorer les valeurs inférieures à 1 pendant la saisie
        if (!Number.isFinite(value) || value < 1) return;

        segments[index].weight = value;

        scheduleWheelSave();

        renderProbabilities();
        drawWheel();

        // Actualiser les miniatures de la bibliothèque affichée
        renderWheelList(
            isViewingOtherPlayer ? viewedPlayerWheels : wheels
        );
    }

});

// Corriger le poids lorsque l'utilisateur quitte le champ
segmentsList.addEventListener("change", event => {

    if (event.target.dataset.field !== "weight") return;

    const index = Number(event.target.dataset.index);

    if (!segments[index]) return;

    const value = Number(event.target.value);

    // Imposer un poids minimum de 1
    const validWeight =
        Number.isFinite(value) && value >= 1 ? value : 1;

    segments[index].weight = validWeight;

    event.target.value = Number(validWeight.toFixed(1));

    scheduleWheelSave();

    renderProbabilities();
    drawWheel();

});


// Supprimer un segment avec le bouton poubelle
segmentsList.addEventListener("click", event => {
    const button = event.target.closest(".remove-segment");
    if (!button || isSpinning) return;

    const index = Number(button.dataset.remove);

    deleteSegment(index);
});

// ======================================
// 8. ACTUALISATION DES PROBABILITES
// ======================================

// Actualiser les probabilités des segments
function renderProbabilities() {

    const total = getTotalWeight();

    // Afficher la somme des poids
    totalWeight.textContent = total;

    // Récupérer les pourcentages affichés
    const probabilityElements =
        segmentsList.querySelectorAll(".segment-probability");

    probabilityElements.forEach((element, index) => {

        if (!segments[index]) return;

        const probability = total > 0
            ? (segments[index].weight / total) * 100
            : 0;

        element.textContent =
            probability.toFixed(1) + " %";
    });
}

// ======================================
// REDISTRIBUTION DES COULEURS
// ======================================

function redistributeSegmentColors() {

    const segmentCount = segments.length;
    const assignedColors = [];

    // Mélanger aléatoirement les couleurs disponibles
    function shuffleColors() {
        const shuffled = [...colors];

        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));

            [shuffled[i], shuffled[j]] =
                [shuffled[j], shuffled[i]];
        }

        return shuffled;
    }

    // Vérifier si une couleur respecte les contraintes
    function isColorValid(index, color) {

        for (let i = 0; i < index; i++) {

            const distance = index - i;
            const circularDistance = Math.min(
                distance,
                segmentCount - distance
            );

            if (
                circularDistance <= 3 &&
                assignedColors[i] === color
            ) {
                return false;
            }
        }

        return true;
    }

    // Attribuer les couleurs avec retour en arrière
    function assignColor(index) {

        if (index >= segmentCount) {
            return true;
        }

        const shuffledColors = shuffleColors();

        for (const color of shuffledColors) {

            if (!isColorValid(index, color.value)) {
                continue;
            }

            assignedColors[index] = color.value;

            if (assignColor(index + 1)) {
                return true;
            }
        }

        assignedColors[index] = null;
        return false;
    }

    if (!assignColor(0)) {
        return false;
    }

    // Appliquer les nouvelles couleurs
    segments.forEach((segment, index) => {
        segment.color = assignedColors[index];
    });

    return true;
}




// ======================================
// 9. AJOUT D'UN SEGMENT
// ======================================

addButton.addEventListener("click", () => {

    // Créer un nouveau segment avec un poids de base de 1
    const newSegment = {
        text: "Nom du segment",
        color: colors[0].value,
        weight: 1
    };

    segments.push(newSegment);

    // Redistribuer les couleurs
    redistributeSegmentColors();

    // Sauvegarder et actualiser
    scheduleWheelSave();

    renderEditor();

    // Actualiser la liste de roues affichée
    if (isViewingOtherPlayer) {
        renderWheelList(viewedPlayerWheels);
    } else {
        renderWheelList();
    }

    drawWheel();
});




// ======================================
// 11. DESSIN DE LA ROUE
// ======================================

function drawWheel() {

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 270;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const segmentUnderPointer = getWinningSegment();


    // Actualiser la couleur et l'état du cadenas
    updateWheelLockAppearance();

    // Actualiser les boutons de visibilité
    updateWheelVisibilityAppearance();

    if (pointer && segmentUnderPointer) {
        const color = segmentUnderPointer.color;

        // Assombrir légèrement la couleur du segment
        const darkerColor = color.replace(
            /^#([0-9a-f]{6})$/i,
            (match, hex) => {
                const r = Math.round(parseInt(hex.slice(0, 2), 16) * 0.75);
                const g = Math.round(parseInt(hex.slice(2, 4), 16) * 0.75);
                const b = Math.round(parseInt(hex.slice(4, 6), 16) * 0.75);

                return `rgb(${r}, ${g}, ${b})`;
            }
        );

        pointer.style.setProperty("--pointer-color", darkerColor);
        document.getElementById("wheelTitle").style.color = darkerColor;
        wheelBorderColor = darkerColor;
    }

    if (segments.length === 0) return;

    const total = getTotalWeight();

    const effectiveTotal =
        total > 0 ? total : segments.length;

    let currentAngle = -Math.PI / 2 + wheelRotation;

    segments.forEach(segment => {

        const anglePerSegment =
            (Math.PI * 2) * (segment.weight / effectiveTotal);

        const startAngle = currentAngle;

        const endAngle =
            startAngle + anglePerSegment;

        const middleAngle =
            startAngle + anglePerSegment / 2;

        currentAngle = endAngle;

        // Ne pas afficher de texte dans un segment à 0 %
        if (segment.weight <= 0) return;

        // Dessiner le segment
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);

        ctx.arc(
            centerX,
            centerY,
            radius,
            startAngle,
            endAngle
        );

        ctx.closePath();

        ctx.fillStyle = segment.color;
        ctx.fill();

        ctx.strokeStyle = wheelBorderColor;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Positionner le texte dans son segment
        ctx.save();

        ctx.translate(centerX, centerY);
        ctx.rotate(middleAngle);

        const textRadius = radius * 0.65;

        // Avancer sur l'axe horizontal local
        ctx.translate(textRadius, 0);

        // Largeur disponible indépendamment du nombre de segments
        const maxWidth = radius * 0.70;

        // Texte sur une seule ligne, avec une taille fixe
        const fontSize = 22;
        let displayText = String(segment.text).trim();

        ctx.font = `bold ${fontSize}px Arial`;

        // Tronquer le texte s'il dépasse la largeur autorisée
        if (ctx.measureText(displayText).width > maxWidth) {

            const suffix = "...";

            while (
                displayText.length > 0 &&
                ctx.measureText(displayText + suffix).width > maxWidth
            ) {
                displayText = displayText.slice(0, -1);
            }

            displayText = displayText.trimEnd() + suffix;
        }

        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Ombre légère sous le texte
        ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        ctx.fillText(displayText, 0, 0);

        // Réinitialiser l'ombre
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        ctx.restore();
    });

    // Cercle central
    ctx.beginPath();

    ctx.arc(
        centerX,
        centerY,
        38,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = wheelBorderColor;
    ctx.fill();

}


// ======================================
// 12. IDENTIFICATION DU SEGMENT GAGNANT
// ======================================

function getWinningSegment() {

    const total = getTotalWeight();

    if (total <= 0) return null;

    const fullCircle = Math.PI * 2;

    // Position du pointeur par rapport à la roue
    const relativeAngle =
        ((Math.PI / 2 - wheelRotation) % fullCircle + fullCircle)
        % fullCircle;

    let currentAngle = 0;

    for (const segment of segments) {

        const segmentAngle =
            fullCircle * (segment.weight / total);

        if (
            relativeAngle >= currentAngle &&
            relativeAngle < currentAngle + segmentAngle
        ) {
            return segment;
        }

        currentAngle += segmentAngle;
    }

    return segments[segments.length - 1];
}

// Afficher la fenêtre avec le résultat du tirage
function showWinner(winner) {

    winnerName.textContent = winner.text;

    currentWinner = winner;

    // Couleur du segment gagnant
    resultBox.style.backgroundColor = winner.color;
    resultBox.style.borderColor = getComputedStyle(pointer).getPropertyValue("--pointer-color").trim();
    closeResultButton.style.color = getComputedStyle(pointer).getPropertyValue("--pointer-color").trim();

    // Afficher la fenêtre
    resultOverlay.style.display = "flex";
    resultOverlay.parentElement.classList.add("result-visible");

}


// ======================================
// 13. ANIMATION DE LA ROUE
// ======================================

async function shareWheelSpin(startRotation, totalRotation, winner, startAt) {
    const spinId = crypto.randomUUID();

    await OBR.broadcast.sendMessage(
        "com.rouepersonnalisee.spinning-wheel/spin",
        {
            playerName: currentPlayerName,
            spinId,
            wheelName: document.getElementById("wheelTitle").textContent,
            segments: JSON.parse(JSON.stringify(segments)),
            startRotation,
            totalRotation,
            winner: {
                text: winner.text,
                color: winner.color
            },
            startAt,
            duration: 5000,
            resultDuration: 5000
        }
    );

    return spinId;
}

// Envoyer le résultat définitif aux autres joueurs
async function shareSpinResult(spinId, playerName, winnerText) {

    const resultTime = new Date().toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit"
    });

    await OBR.broadcast.sendMessage(
        "com.rouepersonnalisee.spinning-wheel/result",
        {
            spinId,
            playerName,
            winnerText,
            resultTime
        }
    );

    // Ajouter le résultat dans son propre historique
    addHistoryEntry({
        time: resultTime,
        playerName: playerName,
        winnerText: winnerText
    });
}


async function spinWheel() {

    // Fermer la personnalisation si on clique sur la roue
    if (!editorPanel.classList.contains("collapsed")) {
        editorPanel.classList.add("collapsed");
        toggleEditorButton.title = "Afficher la personnalisation";
        return;
    }

    // Empêcher de relancer pendant une rotation
    if (isSpinning) return;

    // Vérifier que les poids sont valides
    if (getTotalWeight() <= 0) {
        alert("Veuillez attribuer un poids aux segments avant de lancer la roue.");
        return;
    }

    isSpinning = true;
    toggleEditorButton.disabled = true;
    deleteWheelButton.disabled = true;
    createWheelButton.disabled = true;

    // Afficher la bonne bibliothèque de roues
    renderWheelList(
        isViewingOtherPlayer ? viewedPlayerWheels : wheels
    );

    addButton.disabled = true;

    equalButton.disabled = true;

    renderEditor();

    // Paramètres de l'animation
    const duration = 5000;

    const startRotation = wheelRotation;

    // Nombre de tours : entre 5 et 8
    const totalRotation =
        Math.PI * 2 * (5 + Math.random() * 3);

    // Préparer le résultat final
    const finalRotation = startRotation + totalRotation;

    // Déterminer le gagnant à partir de la rotation finale
    wheelRotation = finalRotation;
    const winner = getWinningSegment();

    const sharedStartAt = Date.now();

    let currentSpinId = null;

    // Envoyer les informations aux autres joueurs
    if (winner) {
        currentSpinId = await shareWheelSpin(
            startRotation,
            totalRotation,
            winner,
            sharedStartAt
        );

        processedSpinIds.add(currentSpinId);
    }

    // Revenir à la rotation de départ pour lancer l'animation normalement
    wheelRotation = startRotation;

    let startTime = null;

    // Fonction qui anime la roue
    function animate(currentTime) {

        if (Date.now() < sharedStartAt) {
            requestAnimationFrame(animate);
            return;
        }

        if (startTime === null) {
            startTime = currentTime;
        }

        const elapsed = currentTime - startTime;

        const progress = Math.min(
            elapsed / duration,
            1
        );

        // Ralentissement progressif
        const easedProgress =
            1 - Math.pow(1 - progress, 3);

        // Calcul de la rotation actuelle
        wheelRotation =
            startRotation + totalRotation * easedProgress;

        // Redessiner la roue
        drawWheel();

        // Continuer ou terminer l'animation
        if (progress < 1) {

            requestAnimationFrame(animate);

        } else {

            isSpinning = false;
            createWheelButton.disabled = false;
            toggleEditorButton.disabled = false;
            deleteWheelButton.disabled = false;

            // Afficher la bonne bibliothèque de roues
            renderWheelList(
                isViewingOtherPlayer ? viewedPlayerWheels : wheels
            );

            renderEditor();
            addButton.disabled = false;
            equalButton.disabled = false;

            const winner = getWinningSegment();

            if (winner && currentSpinId) {

                shareSpinResult(
                    currentSpinId,
                    currentPlayerName,
                    winner.text
                );

                showWinner(winner);
            }
        }
    }

    requestAnimationFrame(animate);
}

// Déclencher la rotation au clic
canvas.addEventListener("click", spinWheel);

// ======================================
// 14. INITIALISATION
// ======================================

let currentPlayerName = "";

let currentPlayers = [];
let viewedPlayerId = null;
let viewedPlayerWheels = [];
let viewedActiveWheelId = null;
let isViewingOtherPlayer = false;

renderEditor();
drawWheel();

let historyEntries = [];
const processedSpinIds = new Set();
const MAX_HISTORY_ENTRIES = 10;

let historyWindow = null;
let playerListWindow = null;
let lastEditorGap = null;

// Actualiser le contenu de l'historique
function renderHistoryEntries() {

    if (!historyWindow) return;

    const list = historyWindow.querySelector("#historyList");
    list.innerHTML = "";

    if (historyEntries.length === 0) {
        list.textContent = "Aucun résultat pour le moment.";
        return;
    }

    historyEntries.forEach(entry => {

        const line = document.createElement("div");

        line.className = "history-entry";

        // Construire la ligne sans interpréter le texte des joueurs
        line.appendChild(document.createTextNode(`${entry.time} : `));

        const playerName = document.createElement("strong");
        playerName.textContent = entry.playerName;

        line.appendChild(playerName);
        line.appendChild(document.createTextNode(` ${entry.winnerText}`));

        list.appendChild(line);

    });
}

// Actualiser le contenu de la liste des joueurs
function renderPlayerListEntries() {

    if (!playerListWindow) return;

    const list = playerListWindow.querySelector("#playerList");
    list.innerHTML = "";

    if (currentPlayers.length === 0) {
        list.textContent = "Aucun joueur présent.";
        return;
    }

    currentPlayers.forEach(player => {

        const line = document.createElement("div");

        line.className = "player-list-entry";

        // Afficher le nom à gauche
        const name = document.createElement("span");
        name.textContent = player.name;

        // Afficher le rôle à droite
        const role = document.createElement("span");
        role.textContent = player.role;

        line.appendChild(name);
        line.appendChild(role);

        line.addEventListener("click", () => {

            closePlayerListWindow();

            if (player.id === OBR.player.id) {
                viewMyWheels();
            } else {
                viewPlayerWheels(player.id);
            }

        });

        list.appendChild(line);

    });
}

// Ajouter un résultat à l'historique
function addHistoryEntry(entry) {

    historyEntries.push(entry);

    if (historyEntries.length > MAX_HISTORY_ENTRIES) {
        historyEntries.shift();
    }

    renderHistoryEntries();
}

// Fermer la fenêtre d'historique
function closeHistoryWindow() {

    if (!historyWindow) return;

    historyWindow.remove();
    historyWindow = null;
}

// Fermer la fenêtre de la liste des joueurs
function closePlayerListWindow() {

    if (!playerListWindow) return;

    playerListWindow.remove();
    playerListWindow = null;

}

// Ouvrir la fenêtre de la liste des joueurs
function openPlayerListWindow() {

    if (playerListWindow) return;

    playerListWindow = document.createElement("div");
    playerListWindow.className = "player-list-window";

    playerListWindow.innerHTML = `
        <div class="player-list-header">
            <span>Joueurs</span>
        </div>
        <div id="playerList"></div>
    `;

    document.body.appendChild(playerListWindow);

    const buttonPosition = openPlayersButton.getBoundingClientRect();
    const sidebarPosition = document.querySelector(".wheel-sidebar").getBoundingClientRect();
    const editorPosition = document.querySelector(".editor").getBoundingClientRect();

    if (editorPosition.width > 0) {
        lastEditorGap = editorPosition.left - sidebarPosition.right;
    }

    const editorGap = lastEditorGap ?? 0;

    playerListWindow.style.left = `${sidebarPosition.right + editorGap + 10}px`;
    playerListWindow.style.top = "auto";
    playerListWindow.style.bottom = `${window.innerHeight - buttonPosition.bottom}px`;

    renderPlayerListEntries();
}

// Ouvrir la fenêtre d'historique
function openHistoryWindow() {

    if (historyWindow) return;

    historyWindow = document.createElement("div");
    historyWindow.className = "history-window";

    historyWindow.innerHTML = `
        <div class="history-header">
            <span>Historique</span>
        </div>
        <div id="historyList"></div>
    `;

    document.body.appendChild(historyWindow);

    const buttonPosition = openHistoryButton.getBoundingClientRect();
    const sidebarPosition = document.querySelector(".wheel-sidebar").getBoundingClientRect();
    const editorPosition = document.querySelector(".editor").getBoundingClientRect();

    if (editorPosition.width > 0) {
        lastEditorGap = editorPosition.left - sidebarPosition.right;
    }

    const editorGap = lastEditorGap ?? 0;

    historyWindow.style.left = `${sidebarPosition.right + editorGap + 10}px`;
    historyWindow.style.top = "auto";
    historyWindow.style.bottom = `${window.innerHeight - buttonPosition.bottom}px`;

    renderHistoryEntries();
}

// Clic sur l'icône : ouvrir ou fermer
openHistoryButton.addEventListener("click", () => {

    if (historyWindow) {
        closeHistoryWindow();
    } else {
        openHistoryWindow();
    }

});

// Clic sur l'icône : ouvrir ou fermer la liste des joueurs
openPlayersButton.addEventListener("click", () => {

    if (playerListWindow) {
        closePlayerListWindow();
    } else {
        openPlayerListWindow();
    }

});

// Fermer en cliquant ailleurs
document.addEventListener("click", (event) => {

    if (!historyWindow) return;

    if (historyWindow.contains(event.target)) return;
    if (openHistoryButton.contains(event.target)) return;

    closeHistoryWindow();

});

// Fermer la liste des joueurs en cliquant ailleurs
document.addEventListener("click", (event) => {

    if (!playerListWindow) return;

    if (playerListWindow.contains(event.target)) return;
    if (openPlayersButton.contains(event.target)) return;

    closePlayerListWindow();

});


// ======================================
// 15. CONNEXION À OWLBEAR RODEO
// ======================================

OBR.onReady(async () => {

    try {

        const playerName = await OBR.player.getName();
        currentPlayerName = playerName;
        const playerId = OBR.player.id;
        const playerRole = await OBR.player.getRole();

        // Créer une clé de sauvegarde propre à ce joueur
        currentWheelStorageKey =
            `com.rouepersonnalisee.spinning-wheel/player/${playerId}`;

        // Récupérer les autres joueurs présents dans la salle
        const otherPlayers = await OBR.party.getPlayers();

        // Initialiser la liste des joueurs
        currentPlayers = [
            {
                id: playerId,
                name: playerName,
                role: playerRole
            },
            ...otherPlayers
        ];

        // Charger la roue personnelle après l'initialisation des joueurs
        await loadWheelFromRoom();
        viewedPlayerId = playerId;

        OBR.party.onChange(async (otherPlayers) => {

            // Actualiser le rôle du joueur actuel
            const updatedPlayerRole = await OBR.player.getRole();

            currentPlayers = [
                {
                    id: playerId,
                    name: playerName,
                    role: updatedPlayerRole
                },
                ...otherPlayers
            ];

            // Actualiser le nom du joueur consulté
            if (isViewingOtherPlayer) {

                const viewedPlayer = currentPlayers.find(
                    player => player.id === viewedPlayerId
                );

                if (viewedPlayer) {
                    document.querySelector("header p").textContent =
                        viewedPlayer.name;
                }
            }

            // Actualiser les droits de personnalisation
            renderEditor();

            if (playerListWindow) {
                renderPlayerListEntries();
            }

        });

        // Détecter les changements de rôle du joueur actuel
        OBR.player.onChange((player) => {

            currentPlayers = currentPlayers.map(existingPlayer => {

                if (existingPlayer.id === playerId) {
                    return {
                        ...existingPlayer,
                        role: player.role
                    };
                }

                return existingPlayer;

            });

            renderEditor();

            if (playerListWindow) {
                renderPlayerListEntries();
            }

        });

        // Détecter les modifications des métadonnées de la salle
        OBR.room.onMetadataChange(async (metadata) => {

            // Si le joueur consulte les roues d'un autre joueur
            if (isViewingOtherPlayer) {

                const playerIdToRefresh = viewedPlayerId;
                const selectedWheelId = viewedActiveWheelId;

                // Récupérer les dernières roues du joueur consulté
                const updatedWheels = await getPlayerWheels(playerIdToRefresh);

                // Vérifier que le joueur consulté n'a pas changé entre-temps
                if (!isViewingOtherPlayer || viewedPlayerId !== playerIdToRefresh) {
                    return;
                }

                viewedPlayerWheels = updatedWheels;

                // Retrouver la roue précédemment sélectionnée
                const activeWheel = updatedWheels.find(
                    wheel => wheel.id === selectedWheelId
                ) || updatedWheels[0] || null;

                viewedActiveWheelId = activeWheel ? activeWheel.id : null;

                if (activeWheel) {

                    segments = activeWheel.segments.map(segment => ({
                        ...segment
                    }));

                    wheelTitle.textContent = activeWheel.name;

                } else {

                    segments = [];
                    wheelTitle.textContent = "";

                }

                renderEditor();
                drawWheel();
                renderWheelList(viewedPlayerWheels);
                updateWheelLayout();

                return;
            }

            // Sinon, vérifier si les données de ses propres roues ont changé

            const localData = {
                wheels: wheels.map(wheel => ({
                    id: wheel.id,
                    ownerId: wheel.ownerId,
                    name: wheel.name,
                    locked: wheel.locked === true,
                    visible: wheel.visible !== false,
                    segments: wheel.segments.map(segment => ({
                        text: segment.text,
                        color: segment.color,
                        weight: segment.weight
                    }))
                })),

                activeWheelId: activeWheelId
            };

            const roomData = metadata?.[currentWheelStorageKey];

            // Ne pas recharger si les données sont déjà identiques
            if (JSON.stringify(roomData) === JSON.stringify(localData)) {
                return;
            }

            // Recharger uniquement si les données ont réellement changé
            await loadWheelFromRoom();

        });

        document.querySelector("header p").textContent = playerName;

        const scenePersistentWindows = new Map();
        const pendingSceneRotations = [];
        let isProcessingSceneRotations = false;


        async function createManagedScenePreviewWindow(slot) {

            const popoverId =
                `com.rouepersonnalisee.spinning-wheel/preview/scene-persistent/${slot}`;

            const channelName =
                `com.rouepersonnalisee.spinning-wheel/preview/scene-persistent/${slot}`;

            const channel = new BroadcastChannel(channelName);

            const previewWindow = {
                slot: slot,
                id: popoverId,
                channel: channel,
                ready: false,
                busy: false
            };

            scenePersistentWindows.set(slot, previewWindow);

            channel.onmessage = (event) => {

                if (event.data?.type === "ready") {

                    previewWindow.ready = true;
                    processPendingSceneRotations();

                }

            };

            try {

                const viewportWidth = await OBR.viewport.getWidth();
                const viewportHeight = await OBR.viewport.getHeight();

                const previewHeight = 309;
                const gap = 10;
                const spacing = previewHeight + gap;

                const slotsPerColumn = Math.max(
                    1,
                    Math.floor((viewportHeight - 10 - previewHeight) / spacing) + 1
                );

                const column = Math.floor(slot / slotsPerColumn);
                const row = slot % slotsPerColumn;

                const anchorLeft = Math.max(
                    0,
                    viewportWidth - 10 - column * (300 + gap)
                );

                const anchorTop = Math.max(
                    0,
                    viewportHeight - 10 - row * spacing
                );

                // Délai uniquement lors de la création d'une nouvelle fenêtre
                await new Promise(resolve => setTimeout(resolve, 2000));

                await OBR.popover.open({

                    id: popoverId,

                    url: `/preview.html?waiting=1&channel=${encodeURIComponent(channelName)}`,

                    width: 0,
                    height: 0,

                    anchorPosition: {
                        left: anchorLeft,
                        top: anchorTop
                    },

                    anchorReference: "POSITION",

                    anchorOrigin: {
                        horizontal: "RIGHT",
                        vertical: "BOTTOM"
                    },

                    transformOrigin: {
                        horizontal: "RIGHT",
                        vertical: "BOTTOM"
                    },

                    hidePaper: true,
                    disableClickAway: true

                });

            } catch (error) {

                channel.close();
                scenePersistentWindows.delete(slot);

                processPendingSceneRotations();

                console.error("ERREUR DE CRÉATION D'UNE FENÊTRE PERSISTANTE :", error);

            }

        }

        async function processPendingSceneRotations() {

            if (isProcessingSceneRotations) {
                return;
            }

            isProcessingSceneRotations = true;

            try {

                while (pendingSceneRotations.length > 0) {

                    // Chercher une fenêtre déjà ouverte et disponible
                    let availableWindow = null;

                    for (const previewWindow of scenePersistentWindows.values()) {

                        if (previewWindow.ready && !previewWindow.busy) {
                            availableWindow = previewWindow;
                            break;
                        }

                    }

                    // Si aucune fenêtre n'existe encore, créer la première
                    if (!availableWindow && scenePersistentWindows.size === 0) {

                        await createManagedScenePreviewWindow(0);
                        break;

                    }

                    // Si une fenêtre est en cours de chargement, attendre qu'elle soit prête
                    if (!availableWindow) {

                        const hasLoadingWindow = [...scenePersistentWindows.values()]
                            .some(previewWindow => !previewWindow.ready);

                        if (hasLoadingWindow) {
                            break;
                        }

                        // Toutes les fenêtres existantes sont occupées : en créer une nouvelle
                        const nextSlot = Math.max(
                            ...scenePersistentWindows.keys()
                        ) + 1;

                        await createManagedScenePreviewWindow(nextSlot);
                        break;

                    }

                    const data = pendingSceneRotations.shift();

                    availableWindow.busy = true;

                    await OBR.popover.setWidth(availableWindow.id, 300);
                    await OBR.popover.setHeight(availableWindow.id, 309);

                    try {

                        availableWindow.channel.postMessage({
                            type: "preview",
                            data: data
                        });

                    } catch (error) {

                        pendingSceneRotations.unshift(data);
                        availableWindow.busy = false;

                        console.error("ERREUR D'ENVOI D'UN APERÇU :", error);

                        break;

                    }

                    const previewEndAt =
                        data.startAt +
                        (data.duration || 5000) +
                        (data.resultDuration || 5000);

                    const waitingTime = Math.max(
                        0,
                        previewEndAt - Date.now()
                    );

                    setTimeout(async () => {

                        await OBR.popover.setWidth(availableWindow.id, 0);
                        await OBR.popover.setHeight(availableWindow.id, 0);

                        availableWindow.busy = false;
                        processPendingSceneRotations();

                    }, waitingTime);

                }

            } finally {

                isProcessingSceneRotations = false;

            }

        }

        function queueSceneRotation(data) {

            pendingSceneRotations.push(data);

            processPendingSceneRotations();

        }


        const noScenePreviewQueue = [];
        let noScenePreviewWindowOpened = false;
        let isOpeningNoScenePreviewWindow = false;

        let noScenePreviewReady = false;

        const noScenePreviewChannel = new BroadcastChannel(
            "com.rouepersonnalisee.spinning-wheel/preview"
        );

        noScenePreviewChannel.onmessage = (event) => {
            if (event.data?.type === "ready") {
                noScenePreviewReady = true;
                processNoScenePreviewQueue();
            }
        };

        function processNoScenePreviewQueue() {

            if (!noScenePreviewReady || noScenePreviewQueue.length === 0) {
                return;
            }

            while (noScenePreviewQueue.length > 0) {

                const data = noScenePreviewQueue.shift();

                noScenePreviewChannel.postMessage({
                    type: "preview",
                    data: data
                });

            }

        }

        async function openNoScenePreviewWindow() {

            if (noScenePreviewWindowOpened || isOpeningNoScenePreviewWindow) {
                return;
            }

            isOpeningNoScenePreviewWindow = true;
            noScenePreviewReady = false;

            try {

                let viewportWidth = window.screen.availWidth;
                let viewportHeight = window.screen.availHeight;

                try {
                    viewportWidth = await OBR.viewport.getWidth();
                    viewportHeight = await OBR.viewport.getHeight();
                } catch (error) {
                    console.warn("VIEWPORT OBR INDISPONIBLE :", error);
                }

                await OBR.popover.open({

                    id: "com.rouepersonnalisee.spinning-wheel/preview/no-scene",

                    url: "/preview.html?waiting=1&channel=com.rouepersonnalisee.spinning-wheel%2Fpreview",

                    width: 300,
                    height: 309,

                    anchorPosition: {
                        left: viewportWidth - 10,
                        top: viewportHeight - 10
                    },

                    anchorReference: "POSITION",

                    anchorOrigin: {
                        horizontal: "RIGHT",
                        vertical: "BOTTOM"
                    },

                    transformOrigin: {
                        horizontal: "RIGHT",
                        vertical: "BOTTOM"
                    },

                    hidePaper: true,
                    disableClickAway: true

                });

                noScenePreviewWindowOpened = true;

                console.log("FENÊTRE APERÇU SANS SCÈNE : OUVERTE");

            } catch (error) {

                console.error("ERREUR D'OUVERTURE DE L'APERÇU SANS SCÈNE :", error);

            } finally {

                isOpeningNoScenePreviewWindow = false;

            }

        }



        async function openPreviewWindow(data, fromQueue = false) {

            // Vérifier si une scène est ouverte
            let noScenePreview = false;

            try {
                await OBR.viewport.getHeight();
            } catch (error) {
                noScenePreview = true;
            }

            console.log(
                "MODE APERÇU :",
                noScenePreview ? "SANS SCÈNE" : "AVEC SCÈNE"
            );

            // Conserver le fonctionnement actuel sans scène
            if (noScenePreview) {

                noScenePreviewQueue.push(data);

                await openNoScenePreviewWindow();

                processNoScenePreviewQueue();

                return;

            }

            // Utiliser le nouveau gestionnaire avec scène
            queueSceneRotation(data);

        }



        // Recevoir les animations des autres joueurs
        OBR.broadcast.onMessage(
            "com.rouepersonnalisee.spinning-wheel/spin",
            (event) => {

                const data = event.data;

                // Vérifier que le message contient les données nécessaires
                if (
                    !data ||
                    !data.spinId ||
                    !data.winner ||
                    !Array.isArray(data.segments) ||
                    data.segments.length === 0
                ) {
                    console.warn("APERÇU IGNORÉ : données invalides", data);
                    return;
                }

                // Ouvrir une fenêtre indépendante pour cette rotation
                openPreviewWindow(data);
            }
        );

        // Recevoir les résultats définitifs des autres joueurs
        OBR.broadcast.onMessage(
            "com.rouepersonnalisee.spinning-wheel/result",
            (event) => {

                const data = event.data;

                // Éviter les doublons
                if (!data.spinId || processedSpinIds.has(data.spinId)) {
                    return;
                }

                processedSpinIds.add(data.spinId);

                addHistoryEntry({
                    time: data.resultTime,
                    playerName: data.playerName,
                    winnerText: data.winnerText
                });

            }
        );

    } catch (error) {

        console.error("Erreur de connexion à Owlbear :", error);

    }

});

// Boutons de confirmation de suppression
document.getElementById("confirmDeleteWheel").addEventListener("click", () => {

    document.getElementById("deleteWheelOverlay").style.display = "none";

    deleteWheel();
});

document.getElementById("cancelDeleteWheel").addEventListener("click", () => {

    document.getElementById("deleteWheelOverlay").style.display = "none";
});