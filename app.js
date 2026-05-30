
//////////////////////////////
// ✅ IMPORTS
//////////////////////////////

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, deleteDoc,
  onSnapshot, query, orderBy, updateDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

//////////////////////////////
// ✅ STATE
//////////////////////////////

let db, queueCol, configDoc;
let ui = {};

let clientId = localStorage.getItem("clientId");
if (!clientId) {
  clientId = "client_" + Math.random().toString(36).slice(2);
  localStorage.setItem("clientId", clientId);
}

let currentDocId = null;
let lastItems = [];
let lastMe = null;

let slots = 1;
let isAdmin = false;
let wasAbleToStart = false;

//////////////////////////////
// 🔊 AUDIO
//////////////////////////////

const sound = new Audio(
  "https://notificationsounds.com/storage/sounds/file-sounds-1150-pristine.mp3"
);

let soundEnabled = false;

document.addEventListener("click", async () => {
  if (!soundEnabled) {
    try {
      await sound.play();
      sound.pause();
      sound.currentTime = 0;
      soundEnabled = true;
    } catch {}
  }
});

//////////////////////////////
// 🔔 NOTIFICATIE
//////////////////////////////

if ("Notification" in window) {
  Notification.requestPermission().catch(()=>{});
}

function notify() {

  if (Notification.permission === "granted") {
    new Notification("👉 JIJ BENT AAN DE BEURT!");
  }

  if (soundEnabled) {
    try {
      sound.pause();
      sound.currentTime = 0;
      sound.play();
    } catch {}
  }
}

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

function setupFirebase() {

  const app = initializeApp({
    apiKey: "PASTE_HIER_JE_API_KEY",
    authDomain: "adem-in---adem-uit.firebaseapp.com",
    projectId: "adem-in---adem-uit"
  });

  db = getFirestore(app);
  queueCol = collection(db, "queue");
  configDoc = doc(db, "config", "settings");
}

//////////////////////////////
// ✅ UI
//////////////////////////////

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
// ✅ LISTENERS
//////////////////////////////

function setupListeners() {

  // JOIN
  ui.join.onclick = async () => {
    if (lastItems.find(i => i.clientId === clientId)) return;

    await addDoc(queueCol, {
      clientId,
      name: ui.name.value || "Anoniem",
      position: Date.now(),
      status: "waiting"
    });
  };

  // LEAVE
  ui.leave.onclick = () => {
    if (currentDocId) {
      deleteDoc(doc(db, "queue", currentDocId));
    }
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
    render(lastItems, lastMe);
  };

  ui.inc.onclick = () => setDoc(configDoc, { slots: slots + 1 });

  ui.dec.onclick = () => {
    if (slots > 1) {
      setDoc(configDoc, { slots: slots - 1 });
    }
  };

  //////////////////////////
  // FIRESTORE
  //////////////////////////

  onSnapshot(configDoc, snap => {
    if (snap.exists()) {
      slots = snap.data().slots;
      ui.slot.textContent = "Slots: " + slots;
      render(lastItems, lastMe);
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
// ✅ ADMIN MOVE
//////////////////////////////

async function reorder(items) {
  for (let i = 0; i < items.length; i++) {
    await updateDoc(doc(db, "queue", items[i].id), {
      position: i
    });
  }
}

function moveUp(items, i) {
  if (i === 0) return;
  const newItems = [...items];
  [newItems[i - 1], newItems[i]] = [newItems[i], newItems[i - 1]];
  reorder(newItems);
}

function moveDown(items, i) {
  if (i === items.length - 1) return;
  const newItems = [...items];
  [newItems[i + 1], newItems[i]] = [newItems[i], newItems[i + 1]];
  reorder(newItems);
}

//////////////////////////////
// ✅ RENDER
//////////////////////////////

function render(items, me) {

  if (!items) return;

  ui.list.innerHTML = "";
  ui.notice.textContent = "";

  const activeCount = items.filter(i => i.status === "active").length;

  items.forEach((item, i) => {

    const li = document.createElement("li");
    li.textContent = `${i + 1}. ${item.name}`;

    if (item.status === "active") {
      li.textContent += " (bezig)";
    }

    // USER
    if (item.id === currentDocId) {

      const canStart =
        i < slots &&
        item.status !== "active" &&
        activeCount < slots;

      if (canStart) {
        const start = document.createElement("button");
        start.textContent = "Start";
        start.onclick = () =>
          updateDoc(doc(db, "queue", item.id), {
            status: "active"
          });
        li.appendChild(start);
      }

      const stop = document.createElement("button");
      stop.textContent = "Stop";
      stop.onclick = () =>
        deleteDoc(doc(db, "queue", item.id));
      li.appendChild(stop);

      const later = document.createElement("button");
      later.textContent = "Later";
      later.onclick = () => moveDown(items, i);
      li.appendChild(later);
    }

    // ADMIN
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

  // ✅ status gebruiker
  if (!me) {
    ui.status.textContent = "Niet in wachtrij";
    wasAbleToStart = false;
    return;
  }

  const idx = items.findIndex(i => i.id === me.id);

  // ✅ 🔥 CORRECTE LOGICA
  const canStart =
    idx < slots &&
    me.status !== "active" &&
    activeCount < slots;

  // ✅ notificatie ENKEL wanneer start mogelijk wordt
  if (canStart && !wasAbleToStart) {
    notify();
    ui.notice.textContent = "👉 JE BENT AAN DE BEURT!";
  }

  wasAbleToStart = canStart;

  ui.status.textContent = "Positie: " + (idx + 1);

  ui.active.textContent =
    activeCount ? `🔥 ${activeCount}/${slots} bezig` : "";
}
