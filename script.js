const modal = document.getElementById("bookingModal");
const btn = document.getElementById("menuToggle");
const span = document.getElementsByClassName("close-btn")[0];

// Butona tıklayınca modalı aç
btn.onclick = function() {
    modal.style.display = "block";
}

// (X) butonuna tıklayınca modalı kapat
span.onclick = function() {
    modal.style.display = "none";
}

// Modal dışına tıklayınca kapat
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}