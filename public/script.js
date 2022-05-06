//Socket connection
var socket = io();

//Access HTML elements
var messages = document.getElementById('messages');
var form = document.getElementById('form');
var input = document.getElementById('input');
var modal = document.getElementById('modal');
var act = document.getElementById("active");

//Global variable for user and login mesage.
var user = "";
var loginMessage = true;

//Function to print status message to the user only they see.
function addBoldMessage(m)
{
    var item = document.createElement("li");
    item.textContent = m;
    item.style.fontWeight = "bold";
    messages.appendChild(item);
}

//Respond to form submit.
modal.addEventListener("submit", function(e)
{
    e.preventDefault();
    socket.emit('login', username.value, color.value);
});

//Respond to failed login, or failed name/color change attempt.
socket.on("reject", (msg => {alert(msg);}));

//React to successful login.
socket.on("login", (u) =>
{
    user = u;
    modal.style.visibility = "hidden";
});

//Change in active users.
socket.on("active", (names, colors) =>
{
    //Ignore if the user has not logged in yet
    //(prevent text from being visible on login screen).
    if (!user)
        return;

    //Update active user HTML content.
    act.innerHTML = "";

    //Add "Active Users" heading.
    x = document.createElement("h2");
    x.textContent = "Active Users (" + names.length + ")";
    act.appendChild(x);

    //First, find the user; they are displayed first in the list.
    index = names.findIndex(x => x == user);
    n = "(You) " + names[index];
    c = colors[index];
    //Remove the user from the list, then move them to the front
    names.splice(index, 1);
    colors.splice(index, 1);
    names.unshift(n);
    colors.unshift(c);

    names.forEach((n, index) =>
    {
        x = document.createElement("li");
        x.textContent = n;
        //The user (moved to the front of the list) should be bolded.
        if (index == 0)
            x.style.fontWeight = "bold";
        x.style.color = colors[index];
        act.appendChild(x);
    })
});

//Respond to successful name change attempt.
socket.on("name", (n) =>
{
    input.value = "";
    user = n;
    addBoldMessage("You have successfully changed your nickname to " + n + ".");
});

//Respond to successful color change attempt.
socket.on("color", (c) => {
input.value = "";
addBoldMessage("You have successfully changed your color to " + c + ".")});

//Respond to a chat message being broadcast.
//Ignore if the user has not logged in yet.
socket.on('chat', (msg) => { if (!user) return;
msg.forEach(m =>
{
    //Construct a <li> element (with "spans" for the sake
    //of delimited stylings) to add to the chat log.
    var item = document.createElement('li');
    var a = document.createElement("span");
    var b = document.createElement("span");
    var c = document.createElement("span");

    NAME = 0; COLOR = 1; MESSAGE = 2; TIMESTAMP = 3; ID = 4; CHATROOM = 5;
    a.textContent = m[TIMESTAMP] + " ";
    b.textContent = m[NAME] + ": ";
    b.style.color = m[COLOR];
    c.textContent = m[MESSAGE];

    if (m[CHATROOM]) //status message, italicized
    {
        b.textContent = "";
        c.style.fontStyle = "italic";
        c.style.color = m[COLOR];
    }
    else if (m[NAME] == user) //message from user, bolded
    {
        a.style.fontWeight = "bold";
        b.style.fontWeight = "bold";
        c.style.fontWeight = "bold";
    }

    item.appendChild(a);
    item.appendChild(b);
    item.appendChild(c);
    messages.appendChild(item);

    //Scroll to bottom
    messages.parentElement.scrollTop = messages.parentElement.scrollHeight;
});

//Print a successful login message to the user after the first time this
//function runs (which is when the previous chat history is displayed).
if (loginMessage)
{
    addBoldMessage("You have successfully logged in with the username " + user + ".");
    loginMessage = false;
}});

//Respond to user submitting chat.
form.addEventListener('submit', function(e)
{
    e.preventDefault();
    var i = input.value;

    //User is asking to change their name
    if (i.startsWith("/nick "))
    {
        n = i.substring(i.indexOf(" ") + 1);
        socket.emit("name", n);
    }

    //User is asking to change their color
    else if (i.startsWith("/nickcolor ") || i.startsWith("/nickcolour "))
    {
        n = i.substring(i.indexOf(" ") + 1);
        socket.emit("color", n);
    }

    //None of the above, user is sending a chat
    else if (i)
    {
        input.value = "";
        socket.emit("chat", i);
    }
});