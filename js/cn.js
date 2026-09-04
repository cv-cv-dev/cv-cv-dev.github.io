// 🔐 CONTRASEÑA
const CONTRASENA = "1234";

const entrada = prompt("🔒 Introduce la contraseña:");

if (entrada !== CONTRASENA) {
    document.body.innerHTML = `
        <div style="
            text-align:center;
            margin-top:100px;
            font-family:Arial;
        ">
            <h1>🔒 Acceso denegado</h1>
            <p>Contraseña incorrecta.</p>
        </div>
    `;

    throw new Error("Acceso denegado");
}

// 🚫 BLOQUEAR CLIC DERECHO
document.addEventListener("contextmenu", function(e) {
    e.preventDefault();
});

// 🚫 BLOQUEAR ATAJOS
document.addEventListener("keydown", function(e) {

    // F12
    if (e.key === "F12") {
        e.preventDefault();
    }

    // Ctrl + Shift + I
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
    }

    // Ctrl + Shift + J
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
    }

    // Ctrl + Shift + C
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
    }

    // Ctrl + U
    if (e.ctrlKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
    }
});
