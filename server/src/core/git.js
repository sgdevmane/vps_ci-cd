import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export class GitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GitError';
  }
}

function runGit(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      {
        cwd,
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND || 'ssh -o BatchMode=yes',
        },
      },
      (err, stdout, stderr) => {
        if (err) reject(new GitError((stderr || '').trim() || err.message));
        else resolve({ stdout: (stdout || '').trim(), stderr: (stderr || '').trim() });
      },
    );
  });
}

function firstLine(text) {
  return String(text || '').split('\n').find((l) => l.trim()) || '';
}

function resolveTargetBranch(service, hookBranch) {
  if (service.branch_mode === 'fixed') return service.fixed_branch || null;
  if (service.branch_mode === 'webhook') return hookBranch || service.fixed_branch || null;
  return null; // "current" — stay on whatever is checked out
}

/**
 * Sync a service's folder with its repository.
 * Returns { branch, sha } actually checked out.
 */
export async function rollbackService(service, targetSha, log) {
  const folder = path.resolve(service.folder_path);
  if (!fs.existsSync(path.join(folder, '.git'))) {
    throw new GitError(`"${folder}" is not a git repository — nothing to roll back.`);
  }

  // Refresh remote refs (best effort — the commit usually exists locally already).
  try {
    const fetch = await runGit(['fetch', 'origin', '--prune'], folder);
    if (fetch.stderr) log(fetch.stderr);
  } catch {
    /* offline / no remote — local history is still usable */
  }

  try {
    await runGit(['cat-file', '-e', `${targetSha}^{commit}`], folder);
  } catch {
    throw new GitError(
      `Commit ${String(targetSha).slice(0, 7)} was not found in the local repository. Sync the service at least once before rolling back.`,
    );
  }

  const r = await runGit(['reset', '--hard', targetSha], folder);
  log(r.stdout || `Reset working tree to ${String(targetSha).slice(0, 7)}`);

  const sha = (await runGit(['rev-parse', 'HEAD'], folder)).stdout;
  let branch = null;
  try {
    const cur = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], folder);
    branch = cur.stdout === 'HEAD' ? null : cur.stdout;
  } catch {
    branch = null;
  }
  log(`Rolled back to ${sha.slice(0, 7)}${branch ? ` on branch "${branch}"` : ' (detached HEAD)'}`);
  return { branch, sha };
}

/**
 * Best-effort snapshot of the commit currently checked out in a folder.
 * Returns null when the folder is not (yet) a git repository.
 */
export async function currentSha(folder) {
  try {
    if (!fs.existsSync(path.join(folder, '.git'))) return null;
    return (await runGit(['rev-parse', 'HEAD'], folder)).stdout || null;
  } catch {
    return null;
  }
}

export async function syncService(service, hookBranch, log) {
  const folder = path.resolve(service.folder_path);
  let target = resolveTargetBranch(service, hookBranch);
  const isRepo = fs.existsSync(path.join(folder, '.git'));

  if (!isRepo) {
    if (!service.clone_if_empty) {
      throw new GitError(`"${folder}" is not a git repository and "Clone if empty" is disabled for this service.`);
    }
    if (fs.existsSync(folder) && fs.readdirSync(folder).length > 0) {
      throw new GitError(`"${folder}" is not a git repository and is not empty — refusing to clone into it.`);
    }
    fs.mkdirSync(folder, { recursive: true });
    log(`Folder is not a repository yet — cloning ${service.repo_url}`);
    let cloned = false;
    if (target) {
      try {
        const r = await runGit(['clone', '--branch', target, service.repo_url, folder], path.dirname(folder));
        log(r.stderr || `Cloned branch "${target}"`);
        cloned = true;
      } catch (e) {
        log(`Clone of branch "${target}" failed (${firstLine(e.message)}) — falling back to the default branch.`);
        if (fs.existsSync(folder) && fs.readdirSync(folder).length === 0) fs.rmdirSync(folder);
      }
    }
    if (!cloned) {
      const r = await runGit(['clone', service.repo_url, folder], path.dirname(folder));
      log(r.stderr || 'Cloned default branch');
    }
  } else {
    const fetch = await runGit(['fetch', 'origin', '--prune'], folder);
    if (fetch.stderr) log(fetch.stderr);
  }

  if (!target) {
    const cur = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], folder);
    if (cur.stdout === 'HEAD') {
      throw new GitError('The repository is in detached HEAD state. Check out a branch manually or switch the service to a fixed branch.');
    }
    target = cur.stdout;
    log(`Staying on current branch "${target}"`);
  }

  try {
    const r = await runGit(['checkout', target], folder);
    if (r.stderr) log(r.stderr);
  } catch (firstErr) {
    try {
      const r = await runGit(['checkout', '-b', target, '--track', `origin/${target}`], folder);
      if (r.stderr) log(r.stderr);
    } catch {
      throw new GitError(`Could not check out branch "${target}": ${firstLine(firstErr.message)}`);
    }
  }

  // verify the branch exists on the remote before merging/resetting against it
  try {
    await runGit(['rev-parse', '--verify', `refs/remotes/origin/${target}`], folder);
  } catch {
    throw new GitError(`Branch "${target}" does not exist on origin.`);
  }

  if (service.sync_mode === 'reset') {
    const r = await runGit(['reset', '--hard', `origin/${target}`], folder);
    log(r.stdout || `Reset to origin/${target}`);
  } else {
    try {
      const r = await runGit(['merge', '--ff-only', `origin/${target}`], folder);
      log(r.stdout || 'Already up to date.');
    } catch (e) {
      throw new GitError(
        `Fast-forward failed on "${target}" — the local history has diverged (local commits or edits). ` +
        `Switch this service to "Hard reset" sync mode to force-match the remote. Details: ${firstLine(e.message)}`,
      );
    }
  }

  const sha = (await runGit(['rev-parse', 'HEAD'], folder)).stdout;
  log(`On branch "${target}" at ${sha.slice(0, 7)}`);
  return { branch: target, sha };
}
