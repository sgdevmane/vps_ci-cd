<script>
  let { log = '' } = $props();

  const lines = $derived((log || '').split('\n'));

  function lineClass(line) {
    if (/ERROR|✗|failed|rejected/i.test(line)) return 'log-line-err';
    if (/^\[.*\] \$ /.test(line)) return 'log-line-cmd';
    if (/successfully|synced|Completed/.test(line)) return 'log-line-ok';
    if (/^\s{4}/.test(line.replace(/^\[[^\]]+\]\s?/, '')) === false && /^\[[^\]]+\]\s+\S/.test(line)) {
      return '';
    }
    if (/^\s+/.test(line)) return 'log-line-dim';
    return '';
  }
</script>

<pre class="log-viewer">{#each lines as line, i (i)}<span class={lineClass(line)}>{line}
</span>{/each}</pre>
