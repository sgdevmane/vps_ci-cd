#!/usr/bin/env node
// Dev helper: capture screenshots of the panel through a Chrome instance
// started with --remote-debugging-port=9222.
import { readFileSync, writeFileSync } from "node:fs";

const [, , cookieFile = "/tmp/vcid.cookies", outPrefix = "/tmp/vcid-shot"] =
  process.argv;

let session = null;
try {
  const m = readFileSync(cookieFile, "utf8").match(/vcid_session\s+(\S+)/);
  session = m?.[1] || null;
} catch {
  /* anonymous screenshots only */
}

const targets = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const page = targets.find((t) => t.type === "page") || targets[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);

let idc = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++idc;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
  }
};
await new Promise((r) => (ws.onopen = r));

await send("Page.enable");
await send("Network.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 2,
  mobile: false,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(name, url, { authed = true, light = false } = {}) {
  if (authed && session) {
    await send("Network.setCookie", {
      name: "vcid_session",
      value: session,
      domain: "localhost",
      path: "/",
    });
  } else {
    await send("Network.deleteCookies", {
      name: "vcid_session",
      domain: "localhost",
    });
  }
  await send("Page.navigate", { url: "http://localhost:3000/" });
  await sleep(900);
  await send("Runtime.evaluate", {
    expression: `localStorage.setItem('vcid-theme', ${light ? "'light'" : "'dark'"})`,
  });
  await send("Page.navigate", { url });
  await sleep(600);
  await send("Page.reload", {});
  await sleep(2000);
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  const file = `${outPrefix}-${name}.png`;
  writeFileSync(file, Buffer.from(data, "base64"));
  console.log("saved", file);
}

await shot("login", "http://localhost:3000/#/", { authed: false });
await shot("dashboard", "http://localhost:3000/#/");
await shot("services", "http://localhost:3000/#/services");
await shot("service-edit", "http://localhost:3000/#/services/1");
await shot("activity", "http://localhost:3000/#/activity");
await shot("settings", "http://localhost:3000/#/settings");
await shot("services-light", "http://localhost:3000/#/services", {
  light: true,
});

ws.close();
process.exit(0);
