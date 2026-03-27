const firebaseConfig = { databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app/" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let user = JSON.parse(localStorage.getItem("alumniUser")) || { name: "", groupKey: "" };

window.onload = () => {
    if(user.name) {
        document.getElementById('p-name').value = user.name;
        document.getElementById('p-inst').value = user.inst;
        document.getElementById('p-year').value = user.year;
        document.getElementById('p-city').value = user.city;
        listenRequests();
    }
};

function show(id, title, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    document.getElementById('page-title').innerText = title;
    el.classList.add('active-nav');
    if(id === 'friends') {
        loadUsers();
        document.getElementById('notif-dot').style.display = "none";
    }
}

function saveProfile() {
    const name = document.getElementById('p-name').value.trim();
    const inst = document.getElementById('p-inst').value.trim();
    const year = document.getElementById('p-year').value.trim();
    const city = document.getElementById('p-city').value.trim();
    const groupKey = `${inst}_${year}_${city}`.replace(/\s+/g, '').toUpperCase();

    user = { name, inst, year, city, groupKey };
    localStorage.setItem("alumniUser", JSON.stringify(user));
    db.ref('users/' + name).set(user);
    alert("Profile Updated!");
    location.reload();
}

// Post Message
function sendPost() {
    const msg = document.getElementById('msgInput').value;
    if(msg && user.groupKey) {
        db.ref('posts').push({ name: user.name, msg, groupKey: user.groupKey, time: new Date().toLocaleTimeString() });
        document.getElementById('msgInput').value = "";
    }
}

// Friend Request Logic
function sendRequest(targetName) {
    db.ref('requests/' + targetName + '/' + user.name).set({ from: user.name });
    alert("Request Sent to " + targetName);
}

function listenRequests() {
    db.ref('requests/' + user.name).on('value', snap => {
        const list = document.getElementById('request-list');
        list.innerHTML = "";
        if(snap.exists()) {
            document.getElementById('notif-dot').style.display = "block";
            snap.forEach(child => {
                const req = child.val();
                list.innerHTML += `
                    <div class="req-box">
                        <span><b>${req.from}</b> wants to connect</span>
                        <button onclick="acceptFriend('${req.from}')" style="background:green; color:white; border:none; padding:5px; border-radius:5px;">Accept</button>
                    </div>`;
            });
        } else {
            list.innerHTML = "No new requests";
        }
    });
}

function acceptFriend(friendName) {
    db.ref('friends/' + user.name + '/' + friendName).set(true);
    db.ref('friends/' + friendName + '/' + user.name).set(true);
    db.ref('requests/' + user.name + '/' + friendName).remove();
    alert("Accepted! You are now friends with " + friendName);
}

// Load Batchmates & Check Friendship
function loadUsers() {
    const list = document.getElementById('friends-list');
    db.ref('users').once('value', snap => {
        list.innerHTML = "";
        snap.forEach(child => {
            const u = child.val();
            if(u.groupKey === user.groupKey && u.name !== user.name) {
                db.ref('friends/' + user.name + '/' + u.name).once('value', fSnap => {
                    let actionBtn = fSnap.exists() ? 
                        `<span style="color:green;">✅ Friend</span>` : 
                        `<button class="btn btn-blue" style="width:auto; padding:5px;" onclick="sendRequest('${u.name}')">Add Friend</button>`;
                    
                    list.innerHTML += `<div class="card"><b>${u.name}</b> ${actionBtn}</div>`;
                });
            }
        });
    });
}

// Delete Post
function deletePost(id) {
    if(confirm("Delete this post?")) db.ref('posts/' + id).remove();
}

// Feed Listener
db.ref('posts').on('value', snap => {
    const cont = document.getElementById('post-container');
    cont.innerHTML = "";
    snap.forEach(c => {
        const p = c.val();
        if(p.groupKey === user.groupKey) {
            let del = p.name === user.name ? `<button class="btn-red" onclick="deletePost('${c.key}')">Delete</button>` : "";
            cont.innerHTML = `<div class="card">${del}<b>${p.name}</b><br><p>${p.msg}</p><small>${p.time}</small></div>` + cont.innerHTML;
        }
    });
});
