// Jarvis Cyber — Toast Notification System
export class Toast {
  static container = null;

  static init() {
    this.container = document.getElementById('toast-container');
  }

  static show(message, type = 'info', duration = 4000) {
    if (!this.container) this.init();

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);

    return toast;
  }

  static success(msg, dur) { return this.show(msg, 'success', dur); }
  static error(msg, dur) { return this.show(msg, 'error', dur); }
  static warning(msg, dur) { return this.show(msg, 'warning', dur); }
  static info(msg, dur) { return this.show(msg, 'info', dur); }
}
