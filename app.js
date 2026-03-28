const firebaseConfig = { databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app/" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let user = JSON.parse(localStorage.getItem("alumniUser")) || null;
let currentChatFriend = "";

window.onload = () => {
    updateHeaderUI();
    if(user && user.name) {
        document.getElementById('p-name').value = user.name || "";
        document.getElementById('p-inst').value = user.inst || "";
        document.getElementById('p-year').value = user.year || "";
        document.getElementById('p-class').value = user.uClass || "";
        document.getElementById('p-city').value = user.city || "";
    }
};

function updateHeaderUI() {
    if(user) {
        document.getElementById('header-user-name').innerText = "👤 " + user.name;
        document.getElementById('header-group-tag').innerText = "🎓 " + user.inst;
    }
}

function show(id, title, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    document.getElementById('page-title').innerText = title;
    el.classList.add('active-nav');
    if(id === 'friends') loadMyFriends();
}

function previewFile(inputId, imgId) {
    const file = document.getElementById(inputId).files[0];
    const preview = document.getElementById(imgId);
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => { preview.src = e.target.result; preview.style.display = "block"; };
        reader.readAsDataURL(file);
    }
}

function saveProfile() {
    const name = document.getElementById('p-name').value.trim();
    const inst = document.getElementById('p-inst').value.trim();
    const year = document.getElementById('p-year').value.trim();
    const uClass = document.getElementById('p-class').value.trim();
    const city = document.getElementById('p-city').value.trim();
    if(!name || !inst || !year) return alert("Fill Name, Inst, Year!");
    user = { name, inst, year, uClass, city, groupKey: (inst+year).replace(/\s+/g,'').toUpperCase() };
    localStorage.setItem("alumniUser", JSON.stringify(user));
    db.ref('users/' + name).set(user).then(() => location.reload());
}

// --- FEED LOGIC (LIKE & COMMENT) ---
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
        name: user.name, msg, imageUrl, groupKey: user.groupKey,
        likes: 0,
        time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
    }).then(() => {
        document.getElementById('msgInput').value = "";
        document.getElementById('imageInput').value = "";
        document.getElementById('imagePreview').style.display = "none";
        document.getElementById('postBtn').disabled = false;
    });
}

db.ref('posts').on('value', snap => {
    const cont = document.getElementById('post-container'); cont.innerHTML = "";
    snap.forEach(c => {
        const p = c.val();
        const postId = c.key;
        if(user && p.groupKey === user.groupKey) {
            let del = p.name === user.name ? `<button class="btn-red" style="position:absolute; right:15px;" onclick="db.ref('posts/${postId}').remove()">Delete</button>` : "";
            let img = p.imageUrl ? `<img src="${p.imageUrl}" class="feed-img">` : "";
            let likes = p.likes || 0;
            
            let comms = "";
            if(p.comments) {
                Object.values(p.comments).forEach(cm => {
                    comms += `<div style="margin-bottom:4px;"><b>${cm.user}:</b> ${cm.text}</div>`;
                });
            }

            const postCard = `
                <div class="card">
                    ${del}
                    <b>${p.name}</b> <small style="color:gray;">${p.time}</small>
                    <p style="margin:10px 0;">${p.msg || ""}</p>
                    ${img}
                    <div class="post-footer">
                        <button class="like-btn" onclick="likePost('${postId}', ${likes})">❤️ ${likes} Likes</button>
                        <button class="comm-btn" onclick="document.getElementById('in-${postId}').focus()">💬 Comment</button>
                    </div>
                    <div class="comments-list" id="list-${postId}">${comms || "No comments yet"}</div>
                    <div class="comment-box">
                        <input type="text" id="in-${postId}" placeholder="Add a comment..." style="margin:0; font-size:12px;">
                        <button class="btn-blue" style="width:auto; padding:5px 10px;" onclick="addComment('${postId}')">Post</button>
                    </div>
                </div>`;
            cont.innerHTML = postCard + cont.innerHTML;
        }
    });
});

function likePost(id, count) {
    db.ref('posts/' + id + '/likes').set(count + 1);
}

function addComment(id) {
    const input = document.getElementById('in-' + id);
    const text = input.value.trim();
    if(text && user) {
        db.ref('posts/' + id + '/comments').push({ user: user.name, text: text });
        input.value = "";
    }
}

// --- SEARCH & FRIENDS ---
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

function sendRequest(t) { db.ref('friends/' + user.name + '/' + t).set(true); db.ref('friends/' + t + '/' + user.name).set(true); alert("Added to friends!"); }

function loadMyFriends() {
    db.ref('friends/' + user.name).on('value', snap => {
        const l = document.getElementById('my-friends-list'); l.innerHTML = "<h4>My Friends</h4>";
        snap.forEach(c => {
            l.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><b>👤 ${c.key}</b><button class="btn btn-blue" style="width:auto; padding:5px 15px;" onclick="openChat('${c.key}')">Chat</button></div>`;
        });
    });
}

// --- CHAT LOGIC ---
function openChat(f) {
    currentChatFriend = f;
    document.getElementById('chat-with-name').innerText = f;
    document.getElementById('chat-window').style.display = "flex";
    loadMessages();
}

function closeChat() { document.getElementById('chat-window').style.display = "none"; }

function sendPrivateMessage() {
    const msg = document.getElementById('privateMsgInput').value.trim();
    if(!msg || !currentChatFriend) return;
    const chatId = user.name < currentChatFriend ? `${user.name}_${currentChatFriend}` : `${currentChatFriend}_${user.name}`;
    db.ref('private_messages/' + chatId).push({ sender: user.name, text: msg, time: new Date().toLocaleTimeString() });
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

function logout() { localStorage.clear(); location.reload(); }
