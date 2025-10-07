// Simple script to clear authentication state
console.log('Current localStorage token:', localStorage.getItem('token'));

// Clear the expired token
localStorage.removeItem('token');
console.log('Token cleared from localStorage');

// Refresh the page to reinitialize authentication
window.location.reload();