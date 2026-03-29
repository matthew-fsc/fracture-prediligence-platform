/**
 * Backend launcher — spawns uvicorn using the venv Python so we don't depend
 * on a globally-installed SQLAlchemy that may be incompatible with Python 3.13.
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const venvPython = join(__dirname, 'backend', '.venv', 'Scripts', 'python.exe');
const cwd = join(__dirname, 'backend');

const proc = spawn(
  venvPython,
  ['-m', 'uvicorn', 'app.main:app', '--reload', '--host', '0.0.0.0', '--port', '8000'],
  { cwd, stdio: 'inherit' }
);

proc.on('exit', code => process.exit(code ?? 0));
process.on('SIGINT',  () => proc.kill('SIGINT'));
process.on('SIGTERM', () => proc.kill('SIGTERM'));
