<script>
document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
});

document.addEventListener("keydown", function (e) {
    if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) ||
        (e.ctrlKey && e.key.toUpperCase() === "U") ||
        (e.metaKey && e.altKey && e.key.toUpperCase() === "I")
    ) {
        e.preventDefault();
        e.stopPropagation();
    }
});
</script>
