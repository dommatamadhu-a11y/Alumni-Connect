/**
 * Alumni Connect Pro - Fully Integrated Logic
 */

const firebaseConfig = {
  apiKey: "AIzaSyAWZ2ky33M2U5xSWL-XSkU32y25U-Bwyrc",
  authDomain: "class-connect-b58f0.firebaseapp.com",
  databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "class-connect-b58f0",
  storageBucket: "class-connect-b58f0.firebasestorage.app",
  messagingSenderId: "836461719745",
  appId: "1:836461719745:web:f827862e4db4954626a440",
  measurementId: "G-8QT4VQ5YW5"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

let user = null;
let currentChatFriendUID = "";

// Auth State
auth.onAuthStateChanged((u) => {
    const loginOverlay = document.getElementById('login-overlay');
    if (u) {
        loginOverlay.style.display = "none";
        db.ref('users/' + u.uid).on('value', snap => {
            const data = snap.val();
            user = {
                uid: u.uid, name: u.displayName, email: u.email, photo: u.photoURL,
                inst: data?.inst || "", year: data?.year || "", city: data?.city || "",
                studyingClass: data?.studyingClass || "",
                groupKey: data ? (data.inst + data.year).replace(/\s+/g,'').toUpperCase() : ""
            };
            updateUI();
            trackOnlineStatus();
        });
    } else {
        loginOverlay.style.display = "flex";
    }
});

function loginWithGoogle() {
    auth.signInWithPopup(provider).catch(err => alert("Error: " + err.message));
}

function updateUI() {
    if(!user) return;
    document.getElementById('header-user-name').innerText = user.name;
    document.getElementById('header-user-img').src = user.photo;
    document.getElementById('header-group-tag').innerText = user.inst ? "🎓 " + user.inst : "Setup Profile";
    document.getElementById('p-img-large').src = user.photo;
    document.getElementById('p-name-display').innerText = user.name;
    document.getElementById('p-email-display').innerText = user.email;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-city').value = user.city;
    document.getElementById('p-class').value = user.studyingClass;
}

function show(id, title, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    document.getElementById('page-title').innerText = title;
    el.classList.add('active-nav');
    if(id === 'friends') loadMyFriends();
}

function showToast(msg) {
    const x = document.getElementById("toast");
    x.innerText = msg; x.className = "show";
    setTimeout(() => x.className = "", 3000);
}

// Feed Post
function handleFeedPost() {
    const text = document.getElementById('msgInput').value.trim();
    if(!user.inst) return alert("Update profile first!");
    if(!text) return;
    db.ref('posts').push({
        uid: user.uid, name: user.name, photo: user.photo,
        msg: text, groupKey: user.groupKey,
        time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
    }).then(() => {
        document.getElementById('msgInput').value = "";
        showToast("Posted to your batch! ❤️");
    });
}

db.ref('posts').limitToLast(20).on('value', snap => {
    const cont = document.getElementById('post-container'); cont.innerHTML = "";
    snap.forEach(c => {
        const p = c.val();
        if(user && p.groupKey === user.groupKey) {
            cont.innerHTML = `<div class="card"><b>${p.name}</b> <small>${p.time}</small><p>${p.msg}</p></div>` + cont.innerHTML;
        }
    });
});

// Search & Friends
function searchAlumni() {
    const inst = document.getElementById('s-inst').value.toUpperCase();
    const year = document.getElementById('s-year').value;
    const city = document.getElementById('s-city').value.toUpperCase();
    const sc = document.getElementById('s-class').value.toUpperCase();
    const res = document.getElementById('my-friends-list');
    res.innerHTML = "Searching...";

    db.ref('users').once('value', snap => {
        res.innerHTML = "<h4>Results</h4>";
        snap.forEach(c => {
            const u = c.val();
            const match = (inst && u.inst?.toUpperCase().includes(inst)) || (year && u.year === year) || (city && u.city?.toUpperCase().includes(city)) || (sc && u.studyingClass?.toUpperCase().includes(sc));
            if(c.key !== user.uid && match) {
                res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between;">
                    <div><b>${u.name}</b><br><small>${u.city || ''}</small></div>
                    <button class="btn btn-blue" style="width:auto; padding:5px 15px;" onclick="addFriend('${c.key}', '${u.name}')">Connect</button>
                </div>`;
            }
        });
    });
}

function addFriend(fUid, fName) {
    db.ref('friends/' + user.uid + '/' + fUid).set({ name: fName });
    db.ref('friends/' + fUid + '/' + user.uid).set({ name: user.name });
    showToast("Connected! 🤝");
}

function loadMyFriends() {
    db.ref('friends/' + user.uid).on('value', snap => {
        const list = document.getElementById('my-friends-list'); list.innerHTML = "<h4>Connections</h4>";
        db.ref('blocks/' + user.uid).on('value', blockSnap => {
            const blocked = blockSnap.val() ? Object.keys(blockSnap.val()) : [];
            snap.forEach(c => {
                if(!blocked.includes(c.key)) {
                    list.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                        <b>👤 ${c.val().name} <span id="st-${c.key}" style="font-size:10px;"></span></b>
                        <button class="btn btn-blue" style="width:auto; padding:6px 15px;" onclick="openChat('${c.key}', '${c.val().name}')">Chat</button>
                    </div>`;
                }
            });
        });
    });
}

// Chat Functions
function toggleBlockMenu() {
    const m = document.getElementById('block-menu');
    m.style.display = (m.style.display === 'block') ? 'none' : 'block';
}

function clearChat() {
    if(confirm("Clear this chat history?")) {
        const chatId = user.uid < currentChatFriendUID ? `${user.uid}_${currentChatFriendUID}` : `${currentChatFriendUID}_${user.uid}`;
        db.ref('private_messages/' + chatId).remove();
        showToast("Chat Cleared! 🗑");
        toggleBlockMenu();
    }
}

function blockUser() {
    if(confirm("Block this user?")) {
        db.ref('blocks/' + user.uid + '/' + currentChatFriendUID).set(true);
        closeChat();
        toggleBlockMenu();
        showToast("Blocked 🚫");
    }
}

function reportUser() {
    let r = prompt("Reason?");
    if(r) {
        db.ref('reports').push({ reporter: user.uid, reported: currentChatFriendUID, reason: r });
        showToast("Reported 🚩");
        toggleBlockMenu();
    }
}

function openChat(fUid, fName) {
    currentChatFriendUID = fUid;
    document.getElementById('chat-with-name').innerText = fName;
    document.getElementById('chat-window').style.display = "flex";
    loadMessages();
}

function sendPrivateMessage() {
    const msg = document.getElementById('privateMsgInput').value.trim();
    if(!msg) return;
    const chatId = user.uid < currentChatFriendUID ? `${user.uid}_${currentChatFriendUID}` : `${currentChatFriendUID}_${user.uid}`;
    db.ref('private_messages/' + chatId).push({ sender: user.uid, text: msg });
    document.getElementById('privateMsgInput').value = "";
}

function loadMessages() {
    const chatId = user.uid < currentChatFriendUID ? `${user.uid}_${currentChatFriendUID}` : `${currentChatFriendUID}_${user.uid}`;
    db.ref('private_messages/' + chatId).on('value', snap => {
        const c = document.getElementById('chat-messages'); c.innerHTML = "";
        snap.forEach(s => {
            const m = s.val();
            c.innerHTML += `<div class="msg-bubble ${m.sender===user.uid?'mine':'theirs'}">${m.text}</div>`;
        });
        c.scrollTop = c.scrollHeight;
    });
}

// Profile & Account
function saveProfile() {
    db.ref('users/' + user.uid).update({
        inst: document.getElementById('p-inst').value,
        year: document.getElementById('p-year').value,
        city: document.getElementById('p-city').value,
        studyingClass: document.getElementById('p-class').value,
        name: user.name, photo: user.photo
    }).then(() => showToast("Updated! ✅"));
}

function deleteAccount() {
    if(confirm("DANGER: This will delete your profile and connections permanently. Continue?")) {
        db.ref('users/' + user.uid).remove();
        db.ref('friends/' + user.uid).remove();
        db.ref('status/' + user.uid).remove();
        auth.currentUser.delete().then(() => {
            alert("Account Deleted.");
            location.reload();
        }).catch(() => alert("Please logout and login again to delete account."));
    }
}

function trackOnlineStatus() {
    const sRef = db.ref('status/' + user.uid);
    db.ref('.info/connected').on('value', snap => {
        if(snap.val()) sRef.onDisconnect().set({ state: 'offline' }).then(() => sRef.set({ state: 'online' }));
    });
}

function closeChat() { document.getElementById('chat-window').style.display = "none"; }
function logout() { auth.signOut().then(() => location.reload()); }
