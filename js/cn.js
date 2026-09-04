const cnCorrecta = "642642642!";

const cn = prompt("🔒 Introduce la cn:");

if (cn !== contraseñaCorrecta) {
    document.body.innerHTML = "<h1>❌ cn incorrecta</h1>";
} else {
    // Bloquear clic derecho
    document.addEventListener("contextmenu", e => e.preventDefault());

    // Bloquear algunos atajos
    document.addEventListener("keydown", e => {
        if (
            e.key === "F12" ||
            (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) ||
            (e.ctrlKey && e.key.toUpperCase() === "U")
        ) {
            e.preventDefault();
        }
    });
}
