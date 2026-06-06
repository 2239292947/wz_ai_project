// Build helper that patches fs.readdir to ignore EACCES errors on Windows
const fs = require('fs');
const origReaddir = fs.readdir;
fs.readdir = function(p, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  return origReaddir.call(this, p, options, (err, files) => {
    if (err && err.code === 'EACCES') callback(null, []);
    else callback(err, files);
  });
};
const origReaddirSync = fs.readdirSync;
fs.readdirSync = function(p, options) {
  try { return origReaddirSync.call(this, p, options); }
  catch (err) { if (err.code === 'EACCES') return []; throw err; }
};

// Now require and run next build
require('next/dist/cli/next-build');
