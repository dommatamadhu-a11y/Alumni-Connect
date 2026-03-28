const firebaseConfig = { databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app/" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let user = JSON.parse(localStorage.getItem("alumniUser")) || null;
let currentChatFriend = "";

window.onload = () => {
    updateHeaderUI();
    if(user && user.name) {
        fillInputs();
        trackOnlineStatus();
        listenToRequests();
        listenToChatNotifs();
    }
};

// --- CORE UTILS ---
function showToast(msg, color = "#333") {
    const x = document.getElementById("toast");
    x.innerText = msg; x.style.backgroundColor = color;
    x.className = "show";
    setTimeout(() => { x.className = x.className.replace("show", ""); }, 3000);
}

function updateHeaderUI() {
    if(user) {
        document.getElementById('header-user-name').innerText = "👤 " + user.name;
        document.getElementById('header-group-tag').innerText = "🎓 " + user.inst;
    }
}

function fillInputs() {
    document.getElementById('p-name').value = user.name || "";
    document.getElementById('p-inst').value = user.inst || "";
    document.getElementById('p-year').value = user.year || "";
    document.getElementById('p-class').value = user.uClass || "";
    document.getElementById('p-city').value = user.city || "";
}

function show(id, title, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    document.getElementById('page-title').innerText = title;
    el.classList.add('active-nav');
    if(id === 'friends') loadMyFriends();
}

// --- ONLINE STATUS LOGIC ---
function trackOnlineStatus() {
    const statusRef = db.ref('status/' + user.name);
    db.ref('.info/connected').on('value', snap => {
        if(snap.val() === false) return;
        statusRef.onDisconnect().set({ state: 'offline' }).then(() => {
            statusRef.set({ state: 'online' });
        });
    });
}

// --- PROFILE & SETTINGS ---
function saveProfile() {
    const name = document.getElementById('p-name').value.trim();
    const inst = document.getElementById('p-inst').value.trim();
    const year = document.getElementById('p-year').value.trim();
    const uClass = document.getElementById('p-class').value.trim();
    const city = document.getElementById('p-city').value.trim();
    if(!name || !inst || !year) return alert("Fill Name, Inst, Year!");

    user = { name, inst, year, uClass, city, groupKey: (inst+year).replace(/\s+/g,'').toUpperCase() };
    localStorage.setItem("alumniUser", JSON.stringify(user));
    db.ref('users/' + name).set(user).then(() => {
        showToast("✅ Profile Updated!", "#2ec4b6");
        setTimeout(() => location.reload(), 1000);
    });
}

// --- FEED (LIKES & COMMENTS) ---
function handleFeedPost() {
    const text = document.getElementById('msgInput').value.trim();
    const file = document.getElementById('imageInput').files[0];
    if(!user) return alert("Setup profile first!");
    const btn = document.getElementById('postBtn');
    btn.disabled = true;

    if(file) {
        const reader = new FileReader();
        reader.onload = () => savePost(text, reader.result);
        reader.readAsDataURL(file);
    } else {
        if(!text) { btn.disabled = false; return; }
        savePost(text, null);
    }
}

function savePost(msg, imageUrl) {
    db.ref('posts').push({
        name: user.name, msg, imageUrl, groupKey: user.groupKey, likes: 0,
        time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
    }).then(() => {
        showToast("Post Shared!");
        document.getElementById('msgInput').value = "";
        document.getElementById('imageInput').value = "";
        document.getElementById('preview-post').style.display = "none";
        document.getElementById('postBtn').disabled = false;
    });
}

db.ref('posts').on('value', snap => {
    const cont = document.getElementById('post-container'); cont.innerHTML = "";
    snap.forEach(c => {
        const p = c.val(); const postId = c.key;
        if(user && p.groupKey === user.groupKey) {
            let del = p.name === user.name ? `<button class="btn-red" style="float:right;" onclick="db.ref('posts/${postId}').remove()">Delete</button>` : "";
            let img = p.imageUrl ? `<img src="${p.imageUrl}" class="feed-img">` : "";
            let likes = p.likes || 0;
            let comms = "";
            if(p.comments) Object.values(p.comments).forEach(m => comms += `<div><b>${m.user}:</b> ${m.text}</div>`);

            cont.innerHTML = `
                <div class="card">
                    ${del}<b>${p.name}</b> <small style="color:gray;">${p.time}</small>
                    <p>${p.msg || ""}</p>${img}
                    <div class="post-footer">
                        <button class="action-btn" onclick="db.ref('posts/${postId}/likes').set(${likes+1})">❤️ ${likes}</button>
                        <button class="action-btn" onclick="document.getElementById('in-${postId}').focus()">💬 Comment</button>
                    </div>
                    <div class="comments-area">${comms || "No comments"}</div>
                    <div style="display:flex; margin-top:8px; gap:5px;">
                        <input type="text" id="in-${postId}" placeholder="Add comment..." style="margin:0; padding:5px; font-size:12px;">
                        <button class="btn-blue" style="width:auto; padding:5px 10px;" onclick="addComment('${postId}')">Post</button>
                    </div>
                </div>` + cont.innerHTML;
        }
    });
});

function addComment(id) {
    const input = document.getElementById('in-' + id);
    if(input.value.trim()) {
        db.ref('posts/' + id + '/comments').push({ user: user.name, text: input.value.trim() });
        input.value = "";
    }
}

// --- FRIENDS & SEARCH ---
function searchAlumni() {
    const sI = document.getElementById('s-inst').value.toUpperCase();
    const sY = document.getElementById('s-year').value;
    const sC = document.getElementById('s-city').value.toUpperCase();
    const sCl = document.getElementById('s-class').value.toUpperCase();
    const res = document.getElementById('search-results'); res.innerHTML = "Searching...";

    db.ref('users').once('value', snap => {
        res.innerHTML = "";
        snap.forEach(c => {
            const u = c.val();
            if(u.name !== user.name && (u.inst.toUpperCase().includes(sI) || u.year === sY || (u.city && u.city.toUpperCase().includes(sC)) || (u.uClass && u.uClass.toUpperCase().includes(sCl)))) {
                res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div><b>${u.name}</b><br><small>${u.uClass || ''} | ${u.city || ''}</small></div>
                    <button class="btn btn-blue" style="width:auto; padding:5px 15px;" onclick="sendRequest('${u.name}')">Add</button>
                </div>`;
            }
        });
    });
}

function sendRequest(t) {
    db.ref('requests/' + t + '/' + user.name).set({from: user.name}).then(() => showToast("📩 Request Sent!"));
}

function listenToRequests() {
    db.ref('requests/' + user.name).on('value', snap => {
        const dot = document.getElementById('friend-dot');
        const area = document.getElementById('req-area');
        const list = document.getElementById('req-list');
        if(snap.exists()) {
            dot.style.display = "block"; area.style.display = "block"; list.innerHTML = "";
            snap.forEach(c => {
                list.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span><b>${c.key}</b></span><button class="btn btn-blue" style="width:auto; padding:5px 10px;" onclick="accept('${c.key}')">Accept</button>
                </div>`;
            });
        } else { dot.style.display = "none"; area.style.display = "none"; }
    });
}

function accept(n) {
    db.ref('friends/'+user.name+'/'+n).set(true);
    db.ref('friends/'+n+'/'+user.name).set(true);
    db.ref('requests/'+user.name+'/'+n).remove().then(() => {
        showToast("🤝 Added Friend!");
        db.ref('chat_notifications/' + n + '/' + user.name).set("accepted");
    });
}

function loadMyFriends() {
    db.ref('friends/' + user.name).on('value', snap => {
        const l = document.getElementById('my-friends-list'); l.innerHTML = "<h4>My Friends</h4>";
        snap.forEach(c => {
            const fName = c.key;
            const fId = `st-${fName.replace(/\s+/g,'')}`;
            l.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                <b>👤 ${fName} <span id="${fId}" style="font-size:10px;"></span></b>
                <button class="btn btn-blue" style="width:auto; padding:5px 15px;" onclick="openChat('${fName}')">Chat</button>
            </div>`;
            db.ref('status/' + fName).on('value', sSnap => {
                const s = sSnap.val();
                const el = document.getElementById(fId);
                if(el) {
                    el.innerText = (s && s.state === 'online') ? "● Online" : "";
                    el.style.color = (s && s.state === 'online') ? "#2ec4b6" : "transparent";
                }
            });
        });
    });
}

// --- CHAT & NOTIFICATIONS ---
function openChat(f) {
    currentChatFriend = f;
    const title = document.getElementById('chat-with-name');
    document.getElementById('chat-window').style.display = "flex";
    db.ref('status/' + f).on('value', snap => {
        const s = snap.val();
        title.innerHTML = (s && s.state === 'online') ? `${f} <br><small style="color:#2ec4b6;">● Online</small>` : `${f} <br><small style="color:gray;">Offline</small>`;
    });
    db.ref('chat_notifications/' + user.name + '/' + f).remove();
    loadMessages();
}

function sendPrivateMessage() {
    const msg = document.getElementById('privateMsgInput').value.trim();
    if(!msg) return;
    const chatId = user.name < currentChatFriend ? `${user.name}_${currentChatFriend}` : `${currentChatFriend}_${user.name}`;
    db.ref('private_messages/' + chatId).push({ sender: user.name, text: msg, time: new Date().toLocaleTimeString() });
    db.ref('chat_notifications/' + currentChatFriend + '/' + user.name).set("new_msg");
    document.getElementById('privateMsgInput').value = "";
}

function loadMessages() {
    const chatId = user.name < currentChatFriend ? `${user.name}_${currentChatFriend}` : `${currentChatFriend}_${user.name}`;
    db.ref('private_messages/' + chatId).on('value', snap => {
        const c = document.getElementById('chat-messages'); c.innerHTML = "";
        snap.forEach(s => {
            const m = s.val();
            c.innerHTML += `<div class="msg-bubble ${m.sender===user.name?'mine':'theirs'}">${m.text}</div>`;
        });
        c.scrollTop = c.scrollHeight;
    });
}

function listenToChatNotifs() {
    db.ref('chat_notifications/' + user.name).on('value', snap => {
        const dot = document.getElementById('settings-dot');
        if(snap.exists()) {
            dot.style.display = "block";
            snap.forEach(c => {
                if(c.val() === "new_msg") showToast("💬 Message from " + c.key, "#4361ee");
            });
        } else dot.style.display = "none";
    });
}

function previewFile(inputId, imgId) {
    const file = document.getElementById(inputId).files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => { 
            const img = document.getElementById(imgId);
            img.src = e.target.result; img.style.display = "block"; 
        };
        reader.readAsDataURL(file);
    }
}

function closeChat() { document.getElementById('chat-window').style.display = "none"; }
function logout() { localStorage.clear(); location.reload(); }
