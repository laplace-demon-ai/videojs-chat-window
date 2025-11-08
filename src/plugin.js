import videojs from 'video.js';
const Plugin = videojs.getPlugin('plugin');

class ChatWindow extends Plugin {
  constructor(player, options = {}) {
    super(player, options);
    this.options_ = options;

    player.ready(() => {
      if (this.container) return; // guard if constructed twice

      this.container = videojs.dom.createEl('div', { className: 'vjs-chat-window' });
      this.messages  = videojs.dom.createEl('div', { className: 'vjs-chat-messages', attributes: { role: 'log', 'aria-live': 'polite' } });
      this.input     = videojs.dom.createEl('input', {
        className: 'vjs-chat-input',
        type: 'text',
        placeholder: options.placeholder || 'Type a message…',
        attributes: { 'aria-label': 'Chat input' }
      });

      this.container.appendChild(this.messages);
      this.container.appendChild(this.input);
      player.el().appendChild(this.container);

      this._onKeyDown = (e) => {
        if (e.key === 'Enter' && this.input.value.trim()) {
          this.addMessage(options.username || 'You', this.input.value.trim());
          this.input.value = '';
        }
      };
      this.input.addEventListener('keydown', this._onKeyDown);

      player.addClass('vjs-has-chat-window');

      // Clean up on dispose
      this.on(player, 'dispose', () => this.dispose());
    });
  }

  addMessage(user, text) {
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
    if (this.input && this._onKeyDown) this.input.removeEventListener('keydown', this._onKeyDown);
    if (this.container && this.container.parentNode) this.container.parentNode.removeChild(this.container);
    if (this.player_) this.player_.removeClass('vjs-has-chat-window');
    super.dispose();
  }
}

videojs.registerPlugin('chatWindow', function(options) {
  if (!this.chatWindow_) this.chatWindow_ = new ChatWindow(this, options);
  return this.chatWindow_;
});

export default ChatWindow;
