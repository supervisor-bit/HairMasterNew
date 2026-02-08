// Initialize dark mode before React renders to prevent flash
const savedMode = localStorage.getItem('darkMode') === 'true';
if (savedMode) {
  document.documentElement.classList.add('dark');
}
