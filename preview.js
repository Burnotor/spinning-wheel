import OBR from "@owlbear-rodeo/sdk";

const canvas = document.getElementById("previewCanvas");
const ctx = canvas.getContext("2d");

const overlay = document.querySelector(".preview-container");
const playerName = document.getElementById("previewPlayerName");
const wheelName = document.getElementById("previewWheelName");
const winnerDisplay = document.getElementById("previewWinner");
const previewPointer = document.querySelector(".preview-pointer");

let currentAnimationId = 0;


function drawPreviewWheel(segments, rotation) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 180;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const total = segments.reduce(
        (sum, segment) => sum + Math.max(0, segment.weight),
        0
    );

    if (total <= 0) return;

    let currentAngle = -Math.PI / 2 + rotation;
    let pointerColor = "#ffffff";

    // Trouver le segment sous le pointeur, à droite
    const pointerAngle = ((Math.PI / 2 - rotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    let accumulatedAngle = 0;

    for (const segment of segments) {
        if (segment.weight <= 0) continue;

        const angle = Math.PI * 2 * segment.weight / total;

        if (pointerAngle >= accumulatedAngle && pointerAngle < accumulatedAngle + angle) {
            const color = segment.color;

            pointerColor = color.replace(
                /^#([0-9a-f]{6})$/i,
                (match, hex) => {
                    const r = Math.round(parseInt(hex.slice(0, 2), 16) * 0.75);
                    const g = Math.round(parseInt(hex.slice(2, 4), 16) * 0.75);
                    const b = Math.round(parseInt(hex.slice(4, 6), 16) * 0.75);

                    return `rgb(${r}, ${g}, ${b})`;
                }
            );

            break;
        }

        accumulatedAngle += angle;
    }

    // Appliquer la couleur aux éléments de l'aperçu
    document.querySelector(".preview-pointer").style.setProperty("--pointer-color", pointerColor);
    playerName.style.color = pointerColor;

    segments.forEach(segment => {
        if (segment.weight <= 0) return;

        const angle = Math.PI * 2 * segment.weight / total;
        const startAngle = currentAngle;
        const endAngle = startAngle + angle;
        const middleAngle = startAngle + angle / 2;

        currentAngle = endAngle;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();

        ctx.fillStyle = segment.color;
        ctx.fill();

        ctx.strokeStyle = pointerColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(middleAngle);
        ctx.translate(radius * 0.65, 0);

        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";

        // Ombre légère sous le texte
        ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        let text = String(segment.text).trim();
        const maxWidth = radius * 0.70;

        while (text.length > 0 && ctx.measureText(text).width > maxWidth) {
            text = text.slice(0, -1);
        }

        if (text !== String(segment.text).trim()) {
            text = text.trimEnd() + "...";
        }

        ctx.fillText(text, 0, 0);

        // Réinitialiser l'ombre
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        ctx.restore();
    });

    // Centre de la roue
    ctx.beginPath();
    ctx.arc(centerX, centerY, 25, 0, Math.PI * 2);
    ctx.fillStyle = pointerColor;
    ctx.fill();

    // Contour extérieur
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = pointerColor;
    ctx.lineWidth = 4;
    ctx.stroke();
}


function handlePreview(data) {
    const animationId = ++currentAnimationId;

    // Masquer la fenêtre jusqu'au début prévu de l'aperçu
    overlay.style.display = "none";

    playerName.textContent = data.playerName;
    wheelName.textContent = data.wheelName || "";
    winnerDisplay.style.display = "none";
    overlay.classList.remove("result-active");

    const startRotation = data.startRotation;
    const totalRotation = data.totalRotation;

    function showResult(remainingResultDuration) {
        if (animationId !== currentAnimationId) return;

        if (remainingResultDuration <= 0) {
            overlay.style.display = "none";
            return;
        }

        winnerDisplay.textContent = data.winner.text;

        // Ombre légère sous le texte
        winnerDisplay.style.textShadow =
            "1px 1px 3px rgba(0, 0, 0, 0.35)";

        winnerDisplay.style.backgroundColor = data.winner.color.replace(
            /^#([0-9a-f]{6})$/i,
            (match, hex) => {
                const r = Math.round(parseInt(hex.slice(0, 2), 16) * 0.75);
                const g = Math.round(parseInt(hex.slice(2, 4), 16) * 0.75);
                const b = Math.round(parseInt(hex.slice(4, 6), 16) * 0.75);
                return `rgb(${r}, ${g}, ${b})`;
            }
        );

        winnerDisplay.style.display = "block";
        overlay.classList.add("result-active");

        setTimeout(() => {
            if (animationId === currentAnimationId) {
                overlay.classList.remove("result-active");
                overlay.style.display = "none";
            }
        }, remainingResultDuration);
    }

    function startAnimation() {
        if (animationId !== currentAnimationId) return;

        // Calculer le temps déjà écoulé depuis le lancement prévu
        const elapsedBeforeVisible = Math.max(0, Date.now() - data.startAt);

        // Si l'animation est déjà terminée, afficher directement le résultat
        if (elapsedBeforeVisible >= data.duration) {
            const rotation = startRotation + totalRotation;
            drawPreviewWheel(data.segments, rotation);

            const remainingResultDuration =
                data.resultDuration - (elapsedBeforeVisible - data.duration);

            showResult(remainingResultDuration);
            return;
        }

        const animationStartTime = performance.now() - elapsedBeforeVisible;

        function frame(currentTime) {
            if (animationId !== currentAnimationId) return;

            const elapsed = currentTime - animationStartTime;
            const progress = Math.min(elapsed / data.duration, 1);

            const originalProgress = progress;
            const easedProgress = 1 - Math.pow(1 - originalProgress, 3);

            const rotation = startRotation + totalRotation * easedProgress;

            drawPreviewWheel(data.segments, rotation);

            if (progress < 1) {
                requestAnimationFrame(frame);
            } else {
                showResult(data.resultDuration);
            }
        }

        requestAnimationFrame(frame);
    }

    const delay = Math.max(0, data.startAt - Date.now());

    setTimeout(() => {
        if (animationId !== currentAnimationId) return;

        overlay.style.display = "block";
        startAnimation();
    }, delay);
}

// File d'attente des previews
const previewQueue = [];
let isPreviewPlaying = false;

function processPreviewQueue() {
    if (isPreviewPlaying || previewQueue.length === 0) return;

    isPreviewPlaying = true;

    const data = previewQueue.shift();

    // Afficher la preview en tenant compte du temps déjà écoulé
    handlePreview(data);

    // Calculer la fin réelle de cette preview
    const previewEndAt =
        data.startAt +
        (data.duration || 5000) +
        (data.resultDuration || 5000);

    const waitingTime = Math.max(0, previewEndAt - Date.now());

    setTimeout(() => {
        isPreviewPlaying = false;
        processPreviewQueue();
    }, waitingTime);
}

function addPreviewToQueue(data) {
    // Vérifier que les données de l'aperçu sont complètes
    if (
        !data ||
        !data.playerName ||
        !Array.isArray(data.segments) ||
        data.segments.length === 0 ||
        !data.winner ||
        !data.winner.color ||
        !Number.isFinite(data.startAt) ||
        !Number.isFinite(data.startRotation) ||
        !Number.isFinite(data.totalRotation) ||
        !Number.isFinite(data.duration) ||
        !Number.isFinite(data.resultDuration)
    ) {
        console.warn("APERÇU REFUSÉ : données invalides", data);
        return;
    }

    // Vérifier les segments
    const validSegments = data.segments.every(segment =>
        segment &&
        typeof segment.text === "string" &&
        typeof segment.color === "string" &&
        Number.isFinite(segment.weight) &&
        segment.weight >= 0
    );

    if (!validSegments) {
        console.warn("APERÇU REFUSÉ : segments invalides", data);
        return;
    }

    const totalWeight = data.segments.reduce(
        (sum, segment) => sum + segment.weight,
        0
    );

    if (totalWeight <= 0) {
        console.warn("APERÇU REFUSÉ : poids total nul", data);
        return;
    }

    previewQueue.push(data);
    processPreviewQueue();
}

OBR.onReady(() => {
    // Conserver la compatibilité avec l'ancien système
    const params = new URLSearchParams(window.location.search);
    const encodedData = params.get("data");

    if (encodedData) {
        try {
            addPreviewToQueue(JSON.parse(encodedData));
        } catch (error) {
            console.error("Erreur de lecture de l'aperçu :", error);
        }
    }

    // Communication avec la fenêtre principale
    const previewChannel = new BroadcastChannel(
        params.get("channel") ||
        "com.rouepersonnalisee.spinning-wheel/preview"
    );

    previewChannel.onmessage = (event) => {
        if (event.data.type === "preview") {

            addPreviewToQueue(event.data.data);
        }

        if (event.data.type === "ping") {
            previewChannel.postMessage({ type: "ready" });
        }
    };

    // Signaler que la fenêtre est prête
    previewChannel.postMessage({ type: "ready" });
});