(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('video.js')) :
  typeof define === 'function' && define.amd ? define(['video.js'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.videojsChatWindow = factory(global.videojs));
})(this, (function (videojsImport) { 'use strict';

  const videojs = videojsImport?.default || videojsImport;

  class ChatWindow {
    constructor(player, options = {}) {
      this.player = player;
      this.options_ = options;
      this.isVisible = false;

      this._polling = false;
      this._lastId = null;
      this._pollController = null;

      player.ready(() => {
        if (player.controlBar && player.controlBar.pictureInPictureToggle) {
          player.controlBar.pictureInPictureToggle.hide();
        }

        if (!this.container) {
          this.container = videojs.dom.createEl('div', { className: 'vjs-chat-window' });

          this.messages = videojs.dom.createEl('div', { className: 'vjs-chat-messages' });
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
          player.controlBar.el().appendChild(this.container);

          this._onKeyDown = (e) => {
            if (e.key === 'Enter' && this.input.value.trim()) {
              const text = this.input.value.trim();
              this.addMessage(options.username || 'You', text);
              this.input.value = '';
              this._sendToServer(text);
            }
          };
          this.input.addEventListener('keydown', this._onKeyDown);
        }

        this._addToggleButton(player);

        if (this.options_.endpoint) {
          this._startPolling();
        }

        // v8: use player.on, not this.on
        player.on('dispose', () => this.dispose());
      });
    }

    _addToggleButton(player) {
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
              <path d="M12 22l3-3h3a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H6A3 3 0 0 0 3 5v11a3 3 0 0 0 3 3h3l3 3z"/>
              <path d="M8 9h8"/><path d="M8 13h5"/>
            </svg>
          `;
          }
        }
        handleClick() { plugin.toggleChat(); }
      }

      const cb = player.controlBar;
      if (!cb) return;
      const btn = new ChatToggleButton(player);
      const fs = cb.getChild('FullscreenToggle') || cb.getChild('fullscreenToggle');
      if (fs) cb.addChild(btn, {}, cb.children().indexOf(fs));
      else cb.addChild(btn);
    }

    toggleChat() {
      this.isVisible = !this.isVisible;
      if (this.container) this.container.style.display = this.isVisible ? 'flex' : 'none';
      if (this.isVisible) {
        this.messages.scrollTop = this.messages.scrollHeight;
        if (this.input) this.input.focus();
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

    _endpoint(path) {
      if (!this.options_.endpoint) return null;
      return this.options_.endpoint.replace(/\/+$/, '') + path;
    }

    async _sendToServer(message) {
      const url = this._endpoint('/send');
      if (!url) return;
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(this.options_.headers || {}) },
          credentials: this.options_.credentials || 'same-origin',
          body: JSON.stringify({
            message,
            session_id: this.options_.sessionId || null
          })
        });
      } catch (_) {}
    }

    _startPolling() {
      if (this._polling) return;
      this._polling = true;

      const poll = async () => {
        while (this._polling) {
          this._pollController = new AbortController();
          try {
            const base = this._endpoint('/poll');
            if (!base) return;

            const u = new URL(base, window.location.origin);
            if (this._lastId) u.searchParams.set('since_id', this._lastId);
            if (this.options_.sessionId) u.searchParams.set('session_id', this.options_.sessionId);

            const res = await fetch(u.toString(), {
              headers: { ...(this.options_.headers || {}) },
              credentials: this.options_.credentials || 'same-origin',
              signal: this._pollController.signal
            });
            if (!res.ok) throw new Error('poll failed');

            const data = await res.json();
            if (data && Array.isArray(data.messages)) {
              for (const m of data.messages) {
                if (m.id) this._lastId = m.id;
                if (m.type === 'text') {
                  this.addMessage(m.user || (this.options_.botName || 'Bot'), m.text || '');
                } else if (m.type === 'command') {
                  this._executeCommand(m.command, m.args || {});
                }
              }
            }
          } catch (_) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      };

      poll();
    }

    _executeCommand(type, args = {}) {
      const p = this.player;
      switch (type) {
        case 'pause': p.pause(); break;
        case 'play': p.play(); break;
        case 'restart': p.currentTime(0); p.play(); break;
        case 'seek':
          if (typeof args.time === 'number') p.currentTime(args.time);
          break;
        case 'rate':
          if (typeof args.rate === 'number') p.playbackRate(args.rate);
          break;
        case 'mute': p.muted(true); break;
        case 'unmute': p.muted(false); break;
        case 'loadSource':
          if (args.src && args.type) p.src({ src: args.src, type: args.type });
          break;
      }
    }

    dispose() {
      this._polling = false;
      if (this._pollController) this._pollController.abort();
      if (this.input && this._onKeyDown) {
        this.input.removeEventListener('keydown', this._onKeyDown);
      }
      if (this.container?.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
    }
  }

  // v8-friendly registration (also works on older versions)
  const registerPlugin =
    (typeof videojs.registerPlugin === 'function' && videojs.registerPlugin) ||
    (typeof videojs.plugin === 'function' && videojs.plugin);

  function chatWindow(options) {
    if (!this.chatWindow_) this.chatWindow_ = new ChatWindow(this, options);
    return this.chatWindow_;
  }

  if (!registerPlugin) {
    // Optional: visible warning if something is really wrong
    // eslint-disable-next-line no-console
    console.warn('[videojs-chat-window] Could not find video.js plugin API (registerPlugin/plugin).');
  } else {
    registerPlugin.call(videojs, 'chatWindow', chatWindow);
  }

  return ChatWindow;

}));
