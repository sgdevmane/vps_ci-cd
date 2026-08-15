import os from 'node:os';
import fs from 'node:fs';

export function getSystemHealth() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercent = Math.round((usedMem / totalMem) * 100);

  const cpus = os.cpus();
  const loadAvg = os.loadavg(); // [1m, 5m, 15m]

  let diskInfo = null;
  try {
    if (fs.statfsSync) {
      const stats = fs.statfsSync('/');
      const totalDisk = stats.bsize * stats.blocks;
      const freeDisk = stats.bsize * stats.bfree;
      const usedDisk = totalDisk - freeDisk;
      diskInfo = {
        totalGb: Number((totalDisk / 1e9).toFixed(1)),
        freeGb: Number((freeDisk / 1e9).toFixed(1)),
        usedPercent: Math.round((usedDisk / totalDisk) * 100),
      };
    }
  } catch {
    diskInfo = null;
  }

  const procMem = process.memoryUsage();

  return {
    uptimeSeconds: Math.round(os.uptime()),
    processUptimeSeconds: Math.round(process.uptime()),
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    nodeVersion: process.version,
    cpu: {
      cores: cpus.length,
      model: cpus[0]?.model || 'Unknown',
      loadAvg1m: Number(loadAvg[0].toFixed(2)),
      loadAvg5m: Number(loadAvg[1].toFixed(2)),
      loadAvg15m: Number(loadAvg[2].toFixed(2)),
    },
    memory: {
      totalMb: Math.round(totalMem / (1024 * 1024)),
      usedMb: Math.round(usedMem / (1024 * 1024)),
      freeMb: Math.round(freeMem / (1024 * 1024)),
      usedPercent: memPercent,
      processRssMb: Math.round(procMem.rss / (1024 * 1024)),
      processHeapMb: Math.round(procMem.heapUsed / (1024 * 1024)),
    },
    disk: diskInfo,
  };
}
