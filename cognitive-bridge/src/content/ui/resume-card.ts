export interface ResumeCardOptions {
  conversationTopic: string;
  suggestedAction: string;
  timeAway: string;
  onResume: () => void;
}

const AUTO_HIDE_DELAY_MS = 10 * 1000;

export function showResumeCard(options: ResumeCardOptions): void {
  const existingCard = document.querySelector('.cb-resume-card-host');
  if (existingCard) {
    existingCard.remove();
  }

  const host = document.createElement('div');
  host.className = 'cb-resume-card-host';
  
  const shadow = host.attachShadow({ mode: 'open' });
  
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        animation: slideDown 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        max-width: 500px;
        backdrop-filter: blur(10px);
      }

      .card:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
      }

      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes slideUp {
        from {
          opacity: 1;
          transform: translateY(0);
        }
        to {
          opacity: 0;
          transform: translateY(-20px);
        }
      }

      .card.hiding {
        animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
      }

      .topic {
        font-weight: 600;
        font-size: 14px;
        opacity: 0.95;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .time {
        font-size: 12px;
        opacity: 0.8;
        white-space: nowrap;
      }

      .action {
        font-size: 13px;
        opacity: 0.9;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .arrow {
        display: inline-block;
        transition: transform 0.2s;
      }

      .card:hover .arrow {
        transform: translateX(4px);
      }

      .close-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        opacity: 0;
        transition: all 0.2s;
      }

      .card:hover .close-btn {
        opacity: 1;
      }

      .close-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    </style>

    <div class="card">
      <button class="close-btn" aria-label="Dismiss">×</button>
      <div class="header">
        <div class="topic">${escapeHtml(options.conversationTopic)}</div>
        <div class="time">${escapeHtml(options.timeAway)}</div>
      </div>
      <div class="action">
        <span>${escapeHtml(options.suggestedAction)}</span>
        <span class="arrow">→</span>
      </div>
    </div>
  `;

  document.body.appendChild(host);

  const card = shadow.querySelector('.card') as HTMLElement;
  const closeBtn = shadow.querySelector('.close-btn') as HTMLElement;

  const hide = () => {
    card.classList.add('hiding');
    setTimeout(() => {
      host.remove();
    }, 300);
  };

  card.addEventListener('click', (e) => {
    if (e.target !== closeBtn) {
      options.onResume();
      hide();
    }
  });

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    hide();
  });

  setTimeout(hide, AUTO_HIDE_DELAY_MS);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
