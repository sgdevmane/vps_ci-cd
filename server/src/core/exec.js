import { spawn } from 'node:child_process';

const OUTPUT_CAP = 200_000; // chars kept per command

export function execCommand(command, cwd, timeoutMs = 30 * 60 * 1000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (code, output) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, output });
    };

    const child = spawn('sh', ['-c', command], { cwd, env: process.env });
    let output = '';
    const onData = (chunk) => {
      if (output.length < OUTPUT_CAP) output += chunk.toString();
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      output += `\n[killed: command timed out after ${Math.round(timeoutMs / 60000)} min]`;
      finish(124, output);
    }, timeoutMs);

    child.on('error', (err) => finish(127, `${output}\n[spawn error] ${err.message}`));
    child.on('close', (code) => finish(code ?? 1, output));
  });
}
