// Jarvis Cyber — Modal Dialog Component
export class Modal {
  static activeModal = null;

  static show(title, contentHtml, opts = {}) {
    this.close(); // Close any existing modal

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) this.close(); };

    const modal = document.createElement('div');
    modal.className = 'modal';
    if (opts.width) modal.style.minWidth = opts.width;

    modal.innerHTML = `
      <div class="modal-header">
        <h2 class="modal-title">${title}</h2>
        <button class="modal-close" id="modal-close-btn">✕</button>
      </div>
      <div class="modal-body">${contentHtml}</div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.activeModal = overlay;

    modal.querySelector('#modal-close-btn').onclick = () => this.close();

    // Close on Escape
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    return modal;
  }

  static close() {
    if (this.activeModal) {
      this.activeModal.remove();
      this.activeModal = null;
    }
  }
}
