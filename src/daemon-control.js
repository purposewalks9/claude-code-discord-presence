// Starting, stopping and finding the background daemon through its pidfile.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { DATA_DIR, PID_FILE } = require('./config');

const DAEMON_SCRIPT = path.join(__dirname, 'daemon.js');

/**
 * PID of the running daemon, or null if none is running.
 * @returns {number | null}
 */
function readDaemonPid() {
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8'), 10);
    process.kill(pid, 0); // throws if no such process
    return pid;
  } catch {
    return null;
  }
}

/** Starts the daemon in the background unless it is already running. */
function startDaemon() {
  if (readDaemonPid()) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  spawn(process.execPath, [DAEMON_SCRIPT], {
    detached: true,
    stdio: 'ignore',
    cwd: DATA_DIR,
    windowsHide: true,
  }).unref();
}

/**
 * Stops the daemon (if running) and removes the pidfile.
 * @returns {number | null} the PID that was stopped
 */
function stopDaemon() {
  const pid = readDaemonPid();
  if (pid) {
    try { process.kill(pid, 'SIGTERM'); } catch {}
  }
  try { fs.rmSync(PID_FILE, { force: true }); } catch {}
  return pid;
}

module.exports = { readDaemonPid, startDaemon, stopDaemon };
