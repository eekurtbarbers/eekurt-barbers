const modal = document.getElementById("bookingModal");
const btn = document.getElementById("menuToggle");
const emblem = document.getElementById("emblemBtn");
const bookNow = document.getElementById("bookNowBtn");
const span = document.getElementsByClassName("close-btn")[0];

function openModal() { modal.style.display = "block"; }

btn.onclick = openModal;
emblem.onclick = openModal;
bookNow.onclick = function(e) { e.preventDefault(); openModal(); };

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