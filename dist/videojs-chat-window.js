(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('video.js')) :
  typeof define === 'function' && define.amd ? define(['video.js'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.videojsChatWindow = factory(global.videojs));
})(this, (function (videojs) { 'use strict';

  const Plugin = videojs.getPlugin('plugin');

  class ChatWindow extends Plugin {
    constructor(player, options = {}) {
      super(player, options);
      this.options_ = options;
      this.isVisible = false;

      player.ready(() => {
        // Remove Picture-in-Picture (if present)
        if (player.controlBar && player.controlBar.pictureInPictureToggle) {
          player.controlBar.pictureInPictureToggle.hide();
        }

        // Create chat box if not exists
        if (!this.container) {
          this.container = videojs.dom.createEl('div', {
            className: 'vjs-chat-window'
          });

          this.messages = videojs.dom.createEl('div', {
            className: 'vjs-chat-messages'
          });
          this.messages.setAttribute('role', 'log');
          this.messages.setAttribute('aria-live', 'polite');

          this.input = videojs.dom.createEl('input', {
            className: 'vjs-chat-input',
            type: 'text',
            placeholder: options.placeholder || 'Type a message…'
          });
          this.input.setAttribute('aria-label', 'Chat input');

          this.container.appendChild(this.messages);
          this.container.appendChild(this.input);

          // Attach to control bar so position is stable in fullscreen
          player.controlBar.el().appendChild(this.container);

          this._onKeyDown = (e) => {
            if (e.key === 'Enter' && this.input.value.trim()) {
              this.addMessage(options.username || 'You', this.input.value.trim());
              this.input.value = '';
            }
          };
          this.input.addEventListener('keydown', this._onKeyDown);
        }

        this.addToggleButton(player);

        this.on(player, 'dispose', () => this.dispose());
      });
    }

    addToggleButton(player) {
      const Button = videojs.getComponent('Button');
      const plugin = this;

      class ChatToggleButton extends Button {
        constructor(player, options) {
          super(player, options);
          this.controlText('Chat');
          this.addClass('vjs-chat-toggle');

          const ph = this.el().querySelector('.vjs-icon-placeholder');
          if (ph) {
            ph.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18"
                 stroke="currentColor" fill="none" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round"
                 style="pointer-events:none">
              <path d="M12 22l3-3h3a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H6A3 3 0 0 0 3 5v11a3 3 0 0 0 3 3h3l3 3z" />
              <path d="M8 9h8" />
              <path d="M8 13h5" />
            </svg>
          `;
          }
        }
        handleClick() {
          plugin.toggleChat();
        }
      }

      const cb = player.controlBar;
      if (!cb) return;

      const btn = new ChatToggleButton(player);

      // Insert before fullscreen button using Video.js only (no DOM insertBefore)
      const fs = cb.getChild('FullscreenToggle') || cb.getChild('fullscreenToggle');
      if (fs) {
        const index = cb.children().indexOf(fs);
        cb.addChild(btn, {}, index);
      } else {
        cb.addChild(btn);
      }
    }

    toggleChat() {
      this.isVisible = !this.isVisible;
      if (this.container) {
        this.container.style.display = this.isVisible ? 'flex' : 'none';
      }
      if (this.isVisible) {
        this.messages.scrollTop = this.messages.scrollHeight;
        if (this.input) {
          this.input.focus();
        }
      }
    }

    addMessage(user, text) {
      if (!this.messages) return;

      const msg = videojs.dom.createEl('div', {
        className: 'vjs-chat-message',
        innerHTML: `<strong class="vjs-chat-user"></strong><span class="vjs-chat-text"></span>`
      });
      msg.querySelector('.vjs-chat-user').textContent = `${user}: `;
      msg.querySelector('.vjs-chat-text').textContent = text;

      this.messages.appendChild(msg);
      this.messages.scrollTop = this.messages.scrollHeight;
    }

    dispose() {
      if (this.input && this._onKeyDown) {
        this.input.removeEventListener('keydown', this._onKeyDown);
      }
      if (this.container?.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      super.dispose();
    }
  }

  videojs.registerPlugin('chatWindow', function (options) {
    if (!this.chatWindow_) {
      this.chatWindow_ = new ChatWindow(this, options);
    }
    return this.chatWindow_;
  });

  return ChatWindow;

}));
