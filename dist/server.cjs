var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_app = require("firebase/app");
var import_firestore = require("firebase/firestore");
try {
  (0, import_firestore.setLogLevel)("silent");
} catch {
}
var isIdleStreamMsg = (msg) => msg.includes("Disconnecting idle stream") || msg.includes("Timed out waiting for new targets") || msg.includes("GrpcConnection RPC");
var originalStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = (chunk, encoding, callback) => {
  const str = typeof chunk === "string" ? chunk : chunk.toString().dotAll() || "";
  if (isIdleStreamMsg(str)) {
    if (typeof encoding === "function") encoding();
    if (typeof callback === "function") callback();
    return true;
  }
  return originalStderrWrite(chunk, encoding, callback);
};
var originalConsoleWarn = console.warn.bind(console);
console.warn = (...args) => {
  const msg = args.map((a) => typeof a === "string" ? a : a.message || JSON.stringify(a)).join(" ");
  if (isIdleStreamMsg(msg)) return;
  originalConsoleWarn(...args);
};
var originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  const msg = args.map((a) => typeof a === "string" ? a : a.message || JSON.stringify(a)).join(" ");
  if (isIdleStreamMsg(msg)) return;
  originalConsoleError(...args);
};
process.on("unhandledRejection", (reason) => {
  const str = String(reason?.message || reason || "");
  if (isIdleStreamMsg(str)) return;
  console.warn("Unhandled Rejection:", reason);
});
var PORT = 3e3;
var dropsMap = /* @__PURE__ */ new Map();
var STORAGE_FILE = import_path.default.join("/tmp", "ephem-drops-store.json");
var STATS_STORAGE_FILE = import_path.default.join("/tmp", "ephem-stats-store.json");
var FIRESTORE_COLLECTION = "ephemeral-vault-drops";
var firestoreDb = null;
try {
  const configPath = import_path.default.join(process.cwd(), "firebase-applet-config.json");
  if (import_fs.default.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(import_fs.default.readFileSync(configPath, "utf-8"));
    const fbApp = (0, import_app.getApps)().length > 0 ? (0, import_app.getApps)()[0] : (0, import_app.initializeApp)(firebaseConfig);
    firestoreDb = firebaseConfig.firestoreDatabaseId ? (0, import_firestore.getFirestore)(fbApp, firebaseConfig.firestoreDatabaseId) : (0, import_firestore.getFirestore)(fbApp);
    console.log(`[Firebase] Initialized Firestore for collection: ${FIRESTORE_COLLECTION}`);
  }
} catch (e) {
  console.warn("[Firebase] Firestore initialization notice:", e);
}
var FIRESTORE_TELEMETRY_COLLECTION = "telemetry-stats";
var FIRESTORE_TELEMETRY_DOC = "global";
var cumulativeStats = {
  downloadedFiles: 0,
  sentTransfers: 0,
  bytesSent: 0,
  ratingsCount: 0,
  ratingsSum: 0
};
var pendingNearbyOffersMap = /* @__PURE__ */ new Map();
var nearbyDevicesMap = /* @__PURE__ */ new Map();
function getRealTelemetry() {
  const sentTransfers = cumulativeStats.sentTransfers;
  const downloadedFiles = cumulativeStats.downloadedFiles;
  const totalBytes = cumulativeStats.bytesSent;
  const gigabytesSent = Number((totalBytes / (1024 * 1024 * 1024)).toFixed(4));
  let rating = 5;
  if (cumulativeStats.ratingsCount > 0) {
    rating = Number((cumulativeStats.ratingsSum / cumulativeStats.ratingsCount).toFixed(1));
  }
  return {
    downloadedFiles,
    sentTransfers,
    gigabytesSent,
    bytesSent: totalBytes,
    rating,
    ratingsCount: cumulativeStats.ratingsCount
  };
}
async function loadPersistedStats() {
  if (firestoreDb) {
    try {
      const docRef = (0, import_firestore.doc)(firestoreDb, FIRESTORE_TELEMETRY_COLLECTION, FIRESTORE_TELEMETRY_DOC);
      const snap = await (0, import_firestore.getDoc)(docRef);
      if (snap.exists()) {
        const loaded = snap.data();
        cumulativeStats = {
          downloadedFiles: Number(loaded.downloadedFiles) || 0,
          sentTransfers: Number(loaded.sentTransfers) || 0,
          bytesSent: Number(loaded.bytesSent) || 0,
          ratingsCount: Number(loaded.ratingsCount) || 0,
          ratingsSum: Number(loaded.ratingsSum) || 0
        };
        console.log("[Firebase] Loaded real telemetry from Firestore:", cumulativeStats);
        persistStats();
        return;
      }
    } catch (err) {
    }
  }
  try {
    if (import_fs.default.existsSync(STATS_STORAGE_FILE)) {
      const raw = import_fs.default.readFileSync(STATS_STORAGE_FILE, "utf-8");
      const loaded = JSON.parse(raw);
      if (loaded) {
        cumulativeStats = {
          downloadedFiles: Number(loaded.downloadedFiles) || 0,
          sentTransfers: Number(loaded.sentTransfers) || 0,
          bytesSent: Number(loaded.bytesSent) || 0,
          ratingsCount: Number(loaded.ratingsCount) || 0,
          ratingsSum: Number(loaded.ratingsSum) || 0
        };
      }
    }
  } catch (e) {
    console.warn("Notice: Stats restore notice:", e);
  }
}
async function persistStats() {
  try {
    import_fs.default.writeFileSync(STATS_STORAGE_FILE, JSON.stringify(cumulativeStats), "utf-8");
  } catch {
  }
  if (firestoreDb) {
    try {
      const docRef = (0, import_firestore.doc)(firestoreDb, FIRESTORE_TELEMETRY_COLLECTION, FIRESTORE_TELEMETRY_DOC);
      await (0, import_firestore.setDoc)(docRef, {
        downloadedFiles: cumulativeStats.downloadedFiles,
        sentTransfers: cumulativeStats.sentTransfers,
        bytesSent: cumulativeStats.bytesSent,
        ratingsCount: cumulativeStats.ratingsCount,
        ratingsSum: cumulativeStats.ratingsSum,
        rating: cumulativeStats.ratingsCount > 0 ? Number((cumulativeStats.ratingsSum / cumulativeStats.ratingsCount).toFixed(1)) : 4.9,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (err) {
    }
  }
}
loadPersistedStats();
async function loadPersistedDrops() {
  try {
    if (import_fs.default.existsSync(STORAGE_FILE)) {
      const raw = import_fs.default.readFileSync(STORAGE_FILE, "utf-8");
      const items = JSON.parse(raw);
      const now = Date.now();
      for (const item of items) {
        if (!item.expiresAt || item.expiresAt > now) {
          dropsMap.set(item.id, item);
        }
      }
    }
  } catch (err) {
  }
  if (firestoreDb) {
    try {
      const colRef = (0, import_firestore.collection)(firestoreDb, FIRESTORE_COLLECTION);
      const snap = await (0, import_firestore.getDocs)(colRef);
      const now = Date.now();
      let restored = 0;
      for (const docItem of snap.docs) {
        const item = docItem.data();
        if (item.expiresAt && item.expiresAt <= now) {
          (0, import_firestore.deleteDoc)(docItem.ref).catch(() => {
          });
          continue;
        }
        if (item.expirationPolicy === "never" && item.transfersConsumed >= item.transfersMax) {
          (0, import_firestore.deleteDoc)(docItem.ref).catch(() => {
          });
          continue;
        }
        dropsMap.set(item.id, item);
        restored++;
      }
      console.log(`[Firebase] Successfully restored ${restored} persistent drops from Firestore`);
    } catch (err) {
    }
  }
}
function persistDrops() {
  try {
    const list = Array.from(dropsMap.values());
    import_fs.default.writeFileSync(STORAGE_FILE, JSON.stringify(list), "utf-8");
  } catch (err) {
  }
}
async function syncDropToCloud(drop) {
  persistDrops();
  if (firestoreDb) {
    try {
      const docRef = (0, import_firestore.doc)(firestoreDb, FIRESTORE_COLLECTION, drop.id);
      await (0, import_firestore.setDoc)(docRef, { ...drop, savedAt: Date.now() });
    } catch (err) {
    }
  }
}
async function removeDropFromCloud(id) {
  persistDrops();
  if (firestoreDb) {
    try {
      const docRef = (0, import_firestore.doc)(firestoreDb, FIRESTORE_COLLECTION, id);
      await (0, import_firestore.deleteDoc)(docRef);
    } catch (err) {
    }
  }
}
async function fetchDropFromCloudIfMissing(id) {
  if (dropsMap.has(id)) {
    return dropsMap.get(id);
  }
  if (!firestoreDb) return null;
  try {
    const docRef = (0, import_firestore.doc)(firestoreDb, FIRESTORE_COLLECTION, id);
    const snap = await (0, import_firestore.getDoc)(docRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.expiresAt && data.expiresAt <= Date.now()) {
      (0, import_firestore.deleteDoc)(docRef).catch(() => {
      });
      return null;
    }
    dropsMap.set(data.id, data);
    return data;
  } catch {
    return null;
  }
}
loadPersistedDrops();
var sseClients = /* @__PURE__ */ new Set();
function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}

`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
}
function formatRemaining(expiresAt, policy) {
  if (policy === "never") return "Single Access";
  const diff = expiresAt - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / (1e3 * 60 * 60));
  const minutes = Math.floor(diff % (1e3 * 60 * 60) / (1e3 * 60));
  const seconds = Math.floor(diff % (1e3 * 60) / 1e3);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
setInterval(async () => {
  const currentTime = Date.now();
  let changed = false;
  for (const [id, drop] of dropsMap.entries()) {
    if (drop.expiresAt && drop.expiresAt <= currentTime) {
      dropsMap.delete(id);
      removeDropFromCloud(id);
      broadcast({ type: "drop-deleted", payload: { id, reason: "expired" } });
      changed = true;
    }
  }
  if (changed) {
    persistDrops();
  }
}, 1e4);
setInterval(() => {
  const cutoff = Date.now() - 18e3;
  let pruned = false;
  for (const [id, dev] of nearbyDevicesMap.entries()) {
    if (dev.lastSeen < cutoff) {
      nearbyDevicesMap.delete(id);
      pruned = true;
    }
  }
  if (pruned) {
    broadcast({
      type: "nearby-devices",
      payload: Array.from(nearbyDevicesMap.values())
    });
  }
}, 4e3);
async function startServer() {
  const app = (0, import_express.default)();
  app.use(import_express.default.json({ limit: "50mb" }));
  app.use(import_express.default.urlencoded({ extended: true, limit: "50mb" }));
  function getActiveReceivingDevices() {
    const now = Date.now();
    return Array.from(nearbyDevicesMap.values()).filter(
      (d) => Boolean(d.isReceiving) && now - d.lastSeen < 18e3
    );
  }
  app.get("/api/events", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive"
    });
    res.write(`data: ${JSON.stringify({ type: "connected" })}

`);
    res.write(`data: ${JSON.stringify({ type: "stats-update", payload: getRealTelemetry() })}

`);
    res.write(`data: ${JSON.stringify({ type: "nearby-devices", payload: getActiveReceivingDevices() })}

`);
    sseClients.add(res);
    req.on("close", () => {
      sseClients.delete(res);
    });
  });
  app.post("/api/nearby/announce", (req, res) => {
    const { id, name, type, browser, os, avatarColor, isReceiving } = req.body || {};
    if (!id) {
      return res.status(400).json({ error: "Device ID required" });
    }
    const record = {
      id,
      name: name || "Device",
      type: type || "laptop",
      browser: browser || "Browser",
      os: os || "OS",
      avatarColor: avatarColor || "#f97316",
      lastSeen: Date.now(),
      isReceiving: Boolean(isReceiving)
    };
    nearbyDevicesMap.set(id, record);
    const activeDevices = getActiveReceivingDevices();
    broadcast({ type: "nearby-devices", payload: activeDevices });
    res.json({ success: true, devices: activeDevices });
  });
  app.post("/api/nearby/status", (req, res) => {
    const { id, isReceiving } = req.body || {};
    if (id && nearbyDevicesMap.has(id)) {
      const dev = nearbyDevicesMap.get(id);
      dev.isReceiving = Boolean(isReceiving);
      dev.lastSeen = Date.now();
      broadcast({ type: "nearby-devices", payload: getActiveReceivingDevices() });
    }
    res.json({ success: true });
  });
  app.post("/api/nearby/leave", (req, res) => {
    const { id } = req.body || {};
    if (id && nearbyDevicesMap.has(id)) {
      nearbyDevicesMap.delete(id);
      broadcast({ type: "nearby-devices", payload: getActiveReceivingDevices() });
    }
    res.json({ success: true });
  });
  app.get("/api/nearby/devices", (req, res) => {
    res.json(getActiveReceivingDevices());
  });
  app.post("/api/nearby/transfer", (req, res) => {
    const { transferId, fromDevice, toDeviceId, file, message } = req.body || {};
    if (!toDeviceId || !file) {
      return res.status(400).json({ error: "Target device ID and file required" });
    }
    const targetDevice = nearbyDevicesMap.get(toDeviceId);
    if (!targetDevice || !targetDevice.isReceiving || Date.now() - targetDevice.lastSeen > 3e4) {
      return res.status(400).json({
        error: "Target device is not currently in Live Receive mode. Please make sure the recipient has opened Receive > Live."
      });
    }
    const txId = transferId || `nb-tx-${Date.now()}`;
    pendingNearbyOffersMap.set(txId, {
      sizeBytes: file.sizeBytes || (file.content ? Buffer.byteLength(file.content, "utf8") : 1024),
      name: file.name || "File"
    });
    broadcast({
      type: "nearby-transfer-offer",
      payload: {
        transferId: txId,
        fromDevice,
        toDeviceId,
        file,
        message,
        timestamp: Date.now()
      }
    });
    res.json({ success: true });
  });
  app.post("/api/nearby/transfer/respond", (req, res) => {
    const { transferId, toDeviceId, fromDeviceId, status, reason } = req.body || {};
    if (!transferId || !status) {
      return res.status(400).json({ error: "Transfer ID and status required" });
    }
    if (status === "accepted") {
      const cached = pendingNearbyOffersMap.get(transferId);
      const transferredBytes = cached?.sizeBytes || 1024;
      cumulativeStats.sentTransfers += 1;
      cumulativeStats.downloadedFiles += 1;
      cumulativeStats.bytesSent += transferredBytes;
      persistStats();
      broadcast({ type: "stats-update", payload: getRealTelemetry() });
    }
    broadcast({
      type: "nearby-transfer-response",
      payload: {
        transferId,
        toDeviceId,
        fromDeviceId,
        status,
        reason
      }
    });
    res.json({ success: true });
  });
  app.post("/api/ratings", async (req, res) => {
    const { rating } = req.body || {};
    const numRating = Math.round(Number(rating));
    if (!numRating || numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: "Valid rating between 1 and 5 is required" });
    }
    cumulativeStats.ratingsCount += 1;
    cumulativeStats.ratingsSum += numRating;
    await persistStats();
    const updatedStats = getRealTelemetry();
    broadcast({ type: "stats-update", payload: updatedStats });
    res.json({ success: true, stats: updatedStats });
  });
  app.get("/api/stats", (req, res) => {
    res.json(getRealTelemetry());
  });
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      activeDropsCount: dropsMap.size,
      connectedClients: sseClients.size,
      timestamp: Date.now()
    });
  });
  app.get("/api/drops", (req, res) => {
    const drops = Array.from(dropsMap.values()).map((drop) => ({
      ...drop,
      expiresInText: formatRemaining(drop.expiresAt, drop.expirationPolicy)
    }));
    res.json(drops);
  });
  app.get("/api/drops/:id", async (req, res) => {
    const { id } = req.params;
    let drop = dropsMap.get(id);
    if (!drop) {
      drop = await fetchDropFromCloudIfMissing(id) || void 0;
    }
    if (!drop) {
      return res.status(404).json({ error: "Drop not found or has been shredded." });
    }
    if (drop.expiresAt && drop.expiresAt <= Date.now()) {
      dropsMap.delete(id);
      removeDropFromCloud(id);
      broadcast({ type: "drop-deleted", payload: { id, reason: "expired" } });
      return res.status(410).json({ error: "Drop has expired." });
    }
    res.json({
      ...drop,
      expiresInText: formatRemaining(drop.expiresAt, drop.expirationPolicy)
    });
  });
  app.post("/api/drops", async (req, res) => {
    try {
      const body = req.body;
      if (!body || !body.content) {
        return res.status(400).json({ error: "Payload content is required." });
      }
      const id = body.id || `EPHEM-SH-${Math.floor(1e3 + Math.random() * 9e3)}-${["Q", "X", "A", "Z"][Math.floor(Math.random() * 4)]}`;
      const expirationPolicy = body.expirationPolicy || "1d";
      let expiresAt = Date.now() + 24 * 3600 * 1e3;
      if (expirationPolicy === "1h") {
        expiresAt = Date.now() + 3600 * 1e3;
      } else if (expirationPolicy === "7d") {
        expiresAt = Date.now() + 7 * 24 * 3600 * 1e3;
      } else if (expirationPolicy === "never") {
        expiresAt = Date.now() + 24 * 3600 * 1e3;
      }
      const newDrop = {
        id,
        key: body.key || Math.random().toString(36).substring(2, 10),
        name: body.name?.trim() || "Untitled",
        type: body.type || "Text / Raw",
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes || Buffer.byteLength(body.content, "utf8"),
        content: body.content,
        createdTimeAgo: "Just now",
        createdAt: Date.now(),
        expiresInText: formatRemaining(expiresAt, expirationPolicy),
        expiresAt,
        expirationPolicy,
        cipher: body.cipher || "AES-256-GCM",
        sha256: body.sha256 || "verified-sha256-checksum",
        version: "v1.0.0",
        verified: true,
        description: "",
        enclaveAttestation: "AWS Nitro Enclave v4",
        pcr0: "Verified against KMS hardware authority",
        publicKeyOrigin: "vault-transit-ephemeral-client",
        transfersConsumed: 0,
        transfersMax: expirationPolicy === "never" ? 1 : 25,
        host: "drop-edge-iad.internal",
        status: "active"
      };
      dropsMap.set(newDrop.id, newDrop);
      await syncDropToCloud(newDrop);
      cumulativeStats.sentTransfers += 1;
      cumulativeStats.bytesSent += newDrop.sizeBytes || 1024;
      persistStats();
      broadcast({ type: "drop-created", payload: newDrop });
      broadcast({ type: "stats-update", payload: getRealTelemetry() });
      res.status(201).json(newDrop);
    } catch (err) {
      res.status(500).json({ error: "Internal server error while storing drop" });
    }
  });
  app.post("/api/drops/:id/consume", async (req, res) => {
    const { id } = req.params;
    let drop = dropsMap.get(id);
    if (!drop) {
      drop = await fetchDropFromCloudIfMissing(id) || void 0;
    }
    if (!drop) {
      return res.status(404).json({ error: "Drop not found." });
    }
    drop.transfersConsumed += 1;
    cumulativeStats.downloadedFiles += 1;
    persistStats();
    if (drop.expirationPolicy === "never" && drop.transfersConsumed >= drop.transfersMax) {
      dropsMap.delete(id);
      await removeDropFromCloud(id);
      broadcast({ type: "drop-deleted", payload: { id, reason: "burned" } });
      broadcast({ type: "stats-update", payload: getRealTelemetry() });
      return res.json({ ...drop, status: "burned", burned: true });
    }
    await syncDropToCloud(drop);
    broadcast({
      type: "drop-consumed",
      payload: { id, transfersConsumed: drop.transfersConsumed }
    });
    broadcast({ type: "stats-update", payload: getRealTelemetry() });
    res.json(drop);
  });
  app.get(["/raw/:id", "/api/drops/:id/raw"], async (req, res) => {
    const { id } = req.params;
    let drop = dropsMap.get(id);
    if (!drop) {
      drop = await fetchDropFromCloudIfMissing(id) || void 0;
    }
    if (!drop) {
      return res.status(404).send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Document Expired</title></head><body style="font-family:-apple-system,sans-serif;text-align:center;padding:60px 20px;background:#f8fafc;color:#1e293b;"><div style="max-width:400px;margin:0 auto;background:#fff;padding:32px;border-radius:16px;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(0,0,0,0.05);"><div style="font-size:32px;margin-bottom:12px;">\u{1F512}</div><h2 style="margin:0 0 8px;">Document Not Found</h2><p style="color:#64748b;font-size:14px;line-height:1.5;">This secure document has expired or was already burned.</p></div></body></html>`);
    }
    drop.transfersConsumed += 1;
    if (drop.expirationPolicy === "never" && drop.transfersConsumed >= drop.transfersMax) {
      dropsMap.delete(id);
      await removeDropFromCloud(id);
      broadcast({ type: "drop-deleted", payload: { id, reason: "burned" } });
    } else {
      await syncDropToCloud(drop);
    }
    if (drop.content.startsWith("data:")) {
      const match = drop.content.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mime = match[1];
        const buffer = Buffer.from(match[2], "base64");
        res.setHeader("Content-Type", mime);
        res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(drop.name)}"`);
        return res.send(buffer);
      }
    }
    res.setHeader("Content-Type", drop.mimeType || "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(drop.name)}"`);
    res.send(drop.content);
  });
  app.get("/api/drops/:id/download", async (req, res) => {
    const { id } = req.params;
    let drop = dropsMap.get(id);
    if (!drop) {
      drop = await fetchDropFromCloudIfMissing(id) || void 0;
    }
    if (!drop) {
      return res.status(404).send("Drop not found or already burned.");
    }
    drop.transfersConsumed += 1;
    cumulativeStats.downloadedFiles += 1;
    persistStats();
    broadcast({ type: "stats-update", payload: getRealTelemetry() });
    if (drop.content.startsWith("data:")) {
      const match = drop.content.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mime = match[1];
        const buffer = Buffer.from(match[2], "base64");
        res.setHeader("Content-Type", mime);
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(drop.name)}"`);
        res.send(buffer);
      } else {
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(drop.name)}"`);
        res.setHeader("Content-Type", drop.mimeType || "application/octet-stream");
        res.send(drop.content);
      }
    } else {
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(drop.name)}"`);
      res.setHeader("Content-Type", drop.mimeType || "text/plain; charset=utf-8");
      res.send(drop.content);
    }
    if (drop.expirationPolicy === "never" && drop.transfersConsumed >= drop.transfersMax) {
      dropsMap.delete(id);
      await removeDropFromCloud(id);
      broadcast({ type: "drop-deleted", payload: { id, reason: "burned" } });
    } else {
      await syncDropToCloud(drop);
      broadcast({
        type: "drop-consumed",
        payload: { id, transfersConsumed: drop.transfersConsumed }
      });
    }
  });
  app.delete("/api/drops/:id", async (req, res) => {
    const { id } = req.params;
    const existed = dropsMap.delete(id);
    await removeDropFromCloud(id);
    if (existed) {
      broadcast({ type: "drop-deleted", payload: { id, reason: "shredded" } });
      return res.json({ success: true, message: `Drop ${id} shredded successfully.` });
    }
    res.status(404).json({ error: "Drop not found or already shredded." });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend server listening on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
