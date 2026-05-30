
//////////////////////////////
// ✅ DEBUG SYSTEM
//////////////////////////////

function logError(msg) {
  console.error(msg);

  const box = document.getElementById("errorBox");
  const el = document.createElement("div");
  el.textContent = "❌ " + msg;
  box.appendChild(el);
}

window.onerror = (msg) => logError(msg);
window.onunhandledrejection = (e) => logError(e.reason);

console.log("✅ App gestart");

//////////////////////////////
// ✅ IMPORTS
//////////////////////////////

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, deleteDoc,
  onSnapshot, query, orderBy, updateDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

//////////////////////////////
// ✅ INIT
//////////////////////////////

init();

function init() {
  setupFirebase();
  setupUI();
  setupListeners();
}

//////////////////////////////
// ✅ FIREBASE
//////////////////////////////

let db, queueCol, configDoc;

function setupFirebase() {

  const app = initializeApp({
    apiKey: "PASTE_HIER_JE_API_KEY",
    authDomain: "adem-in---adem-uit.firebaseapp.com",
    projectId: "adem-in---adem-uit"
  });

  db = getFirestore(app);
  queueCol = collection(db, "queue");
  configDoc = doc(db, "config", "settings");

  console.log("✅ Firebase OK");
}

//////////////////////////////
// ✅ STATE
//////////////////////////////

let clientId = localStorage.getItem("clientId") ||
  ("client_" + Math.random().toString(36).slice(2));

localStorage.setItem("clientId", clientId);

let lastItems = [];
let lastMe = null;
let currentDocId = null;
let slots = 1;
let isAdmin = false;
let wasTurn = false;

//////////////////////////////
// ✅ UI
//////////////////////////////

let ui = {};

function setupUI() {
  ui.name = document.getElementById("nameInput");
  ui.join = document.getElementById("joinBtn");
  ui.leave = document.getElementById("leaveBtn");
  ui.list = document.getElementById("queueList");
  ui.status = document.getElementById("yourStatus");
  ui.notice = document.getElementById("notice");
  ui.active = document.getElementById("activeInfo");

  ui.adminToggle = document.getElementById("adminToggle");
  ui.adminControls = document.getElementById("adminControls");
  ui.inc = document.getElementById("increaseSlot");
  ui.dec = document.getElementById("decreaseSlot");
  ui.slot = document.getElementById("slotCount");
}

//////////////////////////////
// ✅ HELPERS
//////////////////////////////

function safeRender() {
  if (lastItems.length) render(lastItems, lastMe);
}

async function safeUpdate(id, data) {
  try {
    await updateDoc(doc(db, "queue", id), data);
  } catch (e) {
    logError(e);
  }
}

function notify() {
  new Notification("👉 JIJ BENT AAN DE BEURT!");
}

//////////////////////////////
// ✅ LISTENERS
//////////////////////////////

function setupListeners() {

  ui.join.onclick = async () => {
    if (lastItems.find(i => i.clientId === clientId)) return;

    await addDoc(queueCol, {
      clientId,
      name: ui.name.value || "Anoniem",
      position: Date.now(),
      status: "waiting"
    });
  };

  ui.leave.onclick = () => {
    if (currentDocId)
      deleteDoc(doc(db, "queue", currentDocId));
  };

  //////////////////////////
  // ADMIN
  //////////////////////////

  ui.adminToggle.onchange = () => {

    if (ui.adminToggle.checked) {
      if (prompt("Wachtwoord") === "admin123") {
        isAdmin = true;
      } else {
        ui.adminToggle.checked = false;
        isAdmin = false;
      }
    } else {
      isAdmin = false;
    }

    ui.adminControls.style.display = isAdmin ? "block" : "none";
    safeRender();
  };

  ui.inc.onclick = () => setDoc(configDoc, { slots: slots + 1 });
  ui.dec.onclick = () => {
    if (slots > 1) setDoc(configDoc, { slots: slots - 1 });
  };

  //////////////////////////
  // FIRESTORE LISTENERS
  //////////////////////////

  onSnapshot(configDoc, snap => {
    if (snap.exists()) {
      slots = snap.data().slots;
      ui.slot.textContent = "Slots: " + slots;
      safeRender();
    }
  });

  onSnapshot(query(queueCol, orderBy("position")), snap => {

    const items = [];
    let me = null;

    snap.forEach(d => {
      const item = { id: d.id, ...d.data() };
      items.push(item);

      if (item.clientId === clientId) {
        currentDocId = d.id;
        me = item;
      }
    });

    lastItems = items;
    lastMe = me;

    render(items, me);
  });
}

//////////////////////////////
// ✅ ADMIN MOVE (ROBUST)
//////////////////////////////

async function reorder(items) {
  for (let i = 0; i < items.length; i++) {
    await safeUpdate(items[i].id, { position: i });
  }
}

function moveUp(items, i) {
  if (i === 0) return;
  const newItems = [...items];
  [newItems[i], newItems[i - 1]] = [newItems[i - 1], newItems[i]];
  reorder(newItems);
}

function moveDown(items, i) {
  if (i === items.length - 1) return;
  const newItems = [...items];
  [newItems[i], newItems[i + 1]] = [newItems[i + 1], newItems[i]];
  reorder(newItems);
}

//////////////////////////////
// ✅ RENDER
//////////////////////////////

function render(items, me) {

  ui.list.innerHTML = "";
  ui.notice.textContent = "";

  const activeCount = items.filter(i => i.status === "active").length;

  items.forEach((item, i) => {

    const li = document.createElement("li");
    li.textContent = `${i + 1}. ${item.name}`;

    if (item.id === currentDocId) {

      // START
      if (i < slots && activeCount < slots) {
        const start = document.createElement("button");
        start.textContent = "Start";
        start.onclick = () =>
          safeUpdate(item.id, { status: "active" });
        li.appendChild(start);
      }

      // STOP
      const stop = document.createElement("button");
      stop.textContent = "Stop";
      stop.onclick = () =>
        deleteDoc(doc(db, "queue", item.id));
      li.appendChild(stop);

      // LATER
      const later = document.createElement("button");
      later.textContent = "Later";
      later.onclick = () => moveDown(items, i);
      li.appendChild(later);
    }

    // ADMIN KNOPPEN
    if (isAdmin) {

      const up = document.createElement("button");
      up.textContent = "↑";
      up.onclick = () => moveUp(items, i);

      const down = document.createElement("button");
      down.textContent = "↓";
      down.onclick = () => moveDown(items, i);

      const del = document.createElement("button");
      del.textContent = "X";
      del.onclick = () =>
        deleteDoc(doc(db, "queue", item.id));

      li.appendChild(up);
      li.appendChild(down);
      li.appendChild(del);
    }

    ui.list.appendChild(li);
  });

  if (!me) {
    ui.status.textContent = "Niet in wachtrij";
    wasTurn = false;
    return;
  }

  const idx = items.findIndex(i => i.id === me.id);
  const isTurn = idx < slots;

  if (isTurn && !wasTurn) {
    notify();
    ui.notice.textContent = "👉 JE BENT AAN DE BEURT!";
  }

  wasTurn = isTurn;

  ui.status.textContent = "Positie: " + (idx + 1);
}
