const firebaseConfig = { 
    databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app/" 
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let user = JSON.parse(localStorage.getItem("alumniUser")) || { name: "", inst: "", year: "", city: "", groupKey: "" };

window.onload = () => {
    document.getElementById('p-name').value = user.name || "";
    document.getElementById('p-inst').value = user.inst || "";
    document.getElementById('p-year').value = user.year || "";
    document.getElementById('p-city').value = user.city || "";
};

function show(id, title, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    document.getElementById('page-title').innerText = title;
    el.classList.add('active-nav');
    if(id === 'friends') loadFriends();
}

function saveProfile() {
    const name = document.getElementById('p-name').value.trim();
    const inst = document.getElementById('p-inst').value.trim();
    const year = document.getElementById('p-year').value.trim();
    const city = document.getElementById('p-city').value.trim();

    if(!name || !inst || !year) {
        alert("Please enter Name, Institution, and Year!");
        return;
    }

    const groupKey = `${inst}_${year}_${city}`.replace(/\s+/g, '').toUpperCase();
    user = { name, inst, year, city, groupKey };
    localStorage.setItem("alumniUser", JSON.stringify(user));
    db.ref('users/' + name).set(user);
    
    alert("Profile Saved!");
    location.reload();
}

function sendPost() {
    const msg = document.getElementById('msgInput').value.trim();
    if(!user.name || !user.groupKey) {
        alert("Complete your profile first!");
        return;
    }
    if(msg) {
        db.ref('posts').push({
            name: user.name,
            msg: msg,
            groupKey: user.groupKey,
            time: new Date().toLocaleString()
        });
        document.getElementById('msgInput').value = "";
    }
}

function deletePost(postId) {
    if(confirm("Are you sure you want to delete this post?")) {
        db.ref('posts/' + postId).remove();
    }
}

function loadFriends() {
    const list = document.getElementById('friends-list');
    const info = document.getElementById('group-info');
    if(!user.groupKey) return;

    info.innerHTML = `Connected to: <b>${user.inst} (${user.year})</b>`;
    db.ref('users').on('value', snap => {
        list.innerHTML = "";
        snap.forEach(child => {
            const u = child.val();
            if(u.groupKey === user.groupKey && u.name !== user.name) {
                list.innerHTML += `
                    <div class="card">
                        <b>👤 ${u.name}</b><br>
                        <span class="group-badge">📍 ${u.city || 'No Location'}</span>
                    </div>`;
            }
        });
    });
}

db.ref('posts').on('value', snap => {
    const cont = document.getElementById('post-container');
    cont.innerHTML = "";
    snap.forEach(c => {
        const p = c.val();
        const postId = c.key;
        if(p.groupKey === user.groupKey) {
            let deleteBtn = "";
            if(p.name.trim() === user.name.trim()) {
                deleteBtn = `<button class="btn-delete" onclick="deletePost('${postId}')">Delete</button>`;
            }
            cont.innerHTML = `
                <div class="card">
                    ${deleteBtn}
                    <b style="color:#007bff;">${p.name}</b>
                    <p style="margin:8px 0; color:#333;">${p.msg}</p>
                    <span class="timestamp">${p.time}</span>
                </div>` + cont.innerHTML;
        }
    });
});
