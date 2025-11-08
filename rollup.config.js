import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import fs from 'fs';

const cssSrc = 'src/plugin.css';
const cssDist = 'dist/videojs-chat-window.css';

// very small "copy css" helper
const copyCss = {
  name: 'copy-css',
  writeBundle() {
    fs.mkdirSync('dist', { recursive: true });
    fs.copyFileSync(cssSrc, cssDist);
  }
};

export default [
  // UMD (non-minified)
  {
    input: 'src/plugin.js',
    output: {
      file: 'dist/videojs-chat-window.js',
      format: 'umd',
      name: 'videojsChatWindow',
      globals: { 'video.js': 'videojs' }
    },
    external: ['video.js'],
    plugins: [resolve(), copyCss]
  },
  // UMD (minified)
  {
    input: 'src/plugin.js',
    output: {
      file: 'dist/videojs-chat-window.min.js',
      format: 'umd',
      name: 'videojsChatWindow',
      globals: { 'video.js': 'videojs' }
    },
    external: ['video.js'],
    plugins: [resolve(), terser(), copyCss]
  }
];
