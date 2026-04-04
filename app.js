// --- FIREBASE CONFIGURATION ---
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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

let user = null;
let activeFriend = "";
let blockedList = [];

// --- AUTH LOGIC ---
auth.onAuthStateChanged(u => {
    if(u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', s => {
            const d = s.val() || {};
            user = { uid: u.uid, name: u.displayName, photo: d.photo || u.photoURL, inst: d.inst||"", city: d.city||"", uClass: d.uClass||"", year: d.year||"" };
            blockedList = d.blocked || [];
            syncUI(); loadFeed(); loadFriends(); listenReq(); listenMsgs();
        });
    } else { document.getElementById('login-overlay').style.display = "flex"; }
});

function syncUI() {
    document.getElementById('h-img').src = user.photo;
    document.getElementById('p-img').src = user.photo;
    document.getElementById('p-name').innerText = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-city').value = user.city;
    document.getElementById('p-class').value = user.uClass;
    document.getElementById('p-year').value = user.year;
}

// --- ADVANCED SEARCH ---
function search() {
    const sInst = document.getElementById('s-inst').value.toUpperCase().trim();
    const sCity = document.getElementById('s-city').value.toUpperCase().trim();
    const sClass = document.getElementById('s-class').value.toUpperCase().trim();
    const sYear = document.getElementById('s-year').value.trim();

    db.ref('users').once('value', snap => {
        const r = document.getElementById('search-results'); r.innerHTML = "<h4>Search Results</h4>";
        snap.forEach(c => {
            const u = c.val(); if(c.key === user.uid) return;
            
            const matchInst = !sInst || (u.inst && u.inst.toUpperCase().includes(sInst));
            const matchCity = !sCity || (u.city && u.city.toUpperCase().includes(sCity));
            const matchClass = !sClass || (u.uClass && u.uClass.toUpperCase().includes(sClass));
            const matchYear = !sYear || (u.year && u.year.toString() === sYear);

            if(matchInst && matchCity && matchClass && matchYear) {
                r.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <span><b>${u.name}</b><br><small>${u.inst || ''} | ${u.uClass || ''}</small></span>
                    <button onclick="connect('${c.key}','${u.name}')" class="btn-blue" style="width:auto; padding:5px 15px;">Connect</button>
                </div>`;
            }
        });
    });
}

// --- FEED & DELETION ---
async function handlePost() {
    const txt = document.getElementById('msgInput').value.trim();
    if(!txt || !user.inst) return notify("Please set your profile first!");
    const filter = (user.inst + user.city + user.uClass + user.year).replace(/\s/g, '').toUpperCase();
    let img = "";
    const f = document.getElementById('feedPhoto').files[0];
    if(f) {
        const r = new FileReader();
        img = await new Promise(res => { r.onload = e => res(e.target.result); r.readAsDataURL(f); });
    }
    db.ref('posts').push({ uid: user.uid, name: user.name, msg: txt, img: img, time: Date.now(), filterKey: filter });
    document.getElementById('msgInput').value = "";
}

function loadFeed() {
    const key = (user.inst + user.city + user.uClass + user.year).replace(/\s/g, '').toUpperCase();
    db.ref('posts').on('value', snap => {
        const c = document.getElementById('post-container'); c.innerHTML = "";
        snap.forEach(s => {
            const p = s.val();
            if(p.filterKey === key) {
                const del = p.uid === user.uid ? `<i class="fas fa-trash" style="float:right;color:red;cursor:pointer" onclick="deletePost('${s.key}')"></i>` : '';
                c.innerHTML = `<div class="card">${del}<b>${p.name}</b><p>${p.msg}</p>${p.img ? `<img src="${p.img}" class="post-img">`:''}</div>` + c.innerHTML;
            }
        });
    });
}

function deletePost(id) { if(confirm("Delete this post?")) db.ref('posts/'+id).remove(); }

// --- CHAT & FRIENDS ---
function openChat(uid, name) {
    activeFriend = uid; document.getElementById('chat-user').innerText = name;
    document.getElementById('chat-window').style.display = "flex";
    const cid = user.uid < uid ? user.uid+'_'+uid : uid+'_'+user.uid;
    db.ref('private_messages/'+cid).on('value', snap => {
        const c = document.getElementById('chat-msgs'); c.innerHTML = "";
        snap.forEach(s => {
            const m = s.val(); if(blockedList.includes(m.sender)) return;
            const div = document.createElement('div');
            div.className = `msg-bubble ${m.sender === user.uid ? 'mine':'theirs'}`;
            div.innerText = m.text;
            div.onclick = () => { if(confirm("Delete message?")) db.ref(`private_messages/${cid}/${s.key}`).remove(); };
            c.appendChild(div);
        });
        c.scrollTop = c.scrollHeight;
    });
}

function sendMsg() {
    const val = document.getElementById('chatInput').value.trim();
    if(!val) return;
    const cid = user.uid < activeFriend ? user.uid+'_'+activeFriend : activeFriend+'_'+user.uid;
    db.ref('private_messages/'+cid).push({ sender: user.uid, text: val, time: Date.now() });
    document.getElementById('chatInput').value = "";
}

function connect(uid, name) {
    db.ref(`friends/${user.uid}/${uid}`).once('value', s => {
        if(s.exists()) openChat(uid, name);
        else db.ref(`friend_requests/${uid}/${user.uid}`).set({ from: user.name }).then(() => notify("Request Sent!"));
    });
}

function loadFriends() {
    db.ref('friends/'+user.uid).on('value', snap => {
        const list = document.getElementById('friends-list'); list.innerHTML = "";
        if(snap.exists()) {
            document.getElementById('friends-card').style.display = "block";
            snap.forEach(s => {
                db.ref('users/'+s.key).once('value', u => {
                    const d = u.val();
                    if(d) list.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:10px; align-items:center;"><b>${d.name}</b><button onclick="openChat('${u.key}','${d.name}')" class="btn-blue" style="width:auto; padding:5px 15px;">Chat</button></div>`;
                });
            });
        } else { document.getElementById('friends-card').style.display = "none"; }
    });
}

// --- SYSTEM UTILS ---
function clearHistory() { if(confirm("Clear history?")) db.ref(`private_messages/${(user.uid < activeFriend ? user.uid+'_'+activeFriend : activeFriend+'_'+user.uid)}`).remove(); }
function block() { if(confirm("Block user?")) { if(!blockedList.includes(activeFriend)) blockedList.push(activeFriend); db.ref(`users/${user.uid}/blocked`).set(blockedList).then(() => closeChat()); } }
function report() { const r = prompt("Reason for reporting:"); if(r) db.ref('reports').push({ by: user.uid, target: activeFriend, reason: r, time: Date.now() }); }
function accept(fid) { db.ref(`friends/${user.uid}/${fid}`).set(true); db.ref(`friends/${fid}/${user.uid}`).set(true); db.ref(`friend_requests/${user.uid}/${fid}`).remove(); notify("Request Accepted!"); }

function listenReq() { db.ref('friend_requests/'+user.uid).on('value', s => {
    document.getElementById('req-dot').style.display = s.exists()?"block":"none";
    const l = document.getElementById('req-list'); l.innerHTML = "";
    if(s.exists()){
        document.getElementById('req-card').style.display = "block";
        s.forEach(req => { l.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>${req.val().from}</span> <button onclick="accept('${req.key}')" class="btn-blue" style="width:auto; padding:2px 10px;">Accept</button></div>`; });
    } else { document.getElementById('req-card').style.display = "none"; }
});}

function listenMsgs() { db.ref('friends/'+user.uid).on('child_added', s => {
    const cid = user.uid < s.key ? user.uid+'_'+s.key : s.key+'_'+user.uid;
    db.ref('private_messages/'+cid).limitToLast(1).on('child_added', m => {
        if(m.val().sender !== user.uid && activeFriend !== m.val().sender && (Date.now()-m.val().time < 3000)) notify("New Message!");
    });
});}

function uploadProfilePic() {
    const f = document.getElementById('p-upload').files[0];
    if(f) { const r = new FileReader(); r.onload = e => db.ref('users/'+user.uid).update({ photo: e.target.result }); r.readAsDataURL(f); }
}

function saveProfile() {
    const d = { inst: document.getElementById('p-inst').value, city: document.getElementById('p-city').value, uClass: document.getElementById('p-class').value, year: document.getElementById('p-year').value };
    db.ref('users/'+user.uid).update(d).then(() => notify("Profile Saved!"));
}

function login() { auth.signInWithPopup(provider); }
function logout() { auth.signOut().then(() => location.reload()); }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }
function closeChat() { activeFriend = ""; document.getElementById('chat-window').style.display = "none"; }
function show(id, el) { document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav')); document.getElementById(id).classList.add('active'); el.classList.add('active-nav'); }
function notify(m) { const t = document.getElementById('toast'); t.innerText = m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 3000); }
