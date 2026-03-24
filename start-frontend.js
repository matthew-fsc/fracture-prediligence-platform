#!/usr/bin/env node
// Wrapper to start Vite from repo root — avoids spawn path-with-spaces issue
process.chdir(__dirname + '/frontend')
process.argv.push('--port', '5173')
require('./frontend/node_modules/vite/bin/vite.js')
