import { spawn } from 'node:child_process';

const OUTPUT_CAP = 200_000; // chars kept per command

export function execCommand(command, cwd, customEnv = {}, onChunk = null, timeoutMs = 30 * 60 * 1000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (code, output) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, output });
    };

    const env = { ...process.env, ...customEnv };
    const child = spawn('sh', ['-c', command], { cwd, env });
    let output = '';
    const onData = (chunk) => {
      const text = chunk.toString();
      if (output.length < OUTPUT_CAP) output += text;
      if (typeof onChunk === 'function') {
        try {
          onChunk(text);
        } catch {
          /* ignore stream error */
        }
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      const msg = `\n[killed: command timed out after ${Math.round(timeoutMs / 60000)} min]`;
      output += msg;
      if (typeof onChunk === 'function') onChunk(msg);
      finish(124, output);
    }, timeoutMs);

    child.on('error', (err) => {
      const msg = `${output}\n[spawn error] ${err.message}`;
      finish(127, msg);
    });
    child.on('close', (code) => finish(code ?? 1, output));
  });
}
