// Lógica inicial del proyecto MURAL.
document.addEventListener("DOMContentLoaded", () => {
  const yearElement = document.querySelector("#year");

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
});
