//Imports.
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

//Publicly hosted files are in the "public" folder.
app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

//Server init.
server.listen(3000, () => { console.log('listening on *:3000');});

//Returns a timestamp in "[HH:MM:SS (AM/PM)] format."
function getTimestamp()
{
    var t = new Date();
    
    h = t.getHours();
    ampm = h < 12 ? "AM" : "PM";
    h = h % 12;
    h = h ? h : 12;

    m = ("0" + t.getMinutes()).slice(-2);
    s = ("0" + t.getSeconds()).slice(-2);

    return "[" + h + ":" + m  + ":" + s + " " + ampm + "]";
}

//Function for logging to console with timetsamp.
function log(m)
{
    console.log(m + " " + getTimestamp());
}

//chatlog is stored as an array of 6-element arrays.
//Whenever a user's name or color is changed, that event is added to the
//chatlog, so that we can fetch their current name/color in the future.
var chatlog = [];
//CHATROOM is a boolean that is true if this is a status message.
NAME = 0; COLOR = 1; MESSAGE = 2; TIMESTAMP = 3; ID = 4; CHATROOM = 5;

var activeusers = []; //List of names

//Check if username exists.
function usernameExists(u)
{ return chatlog.some(user => user[NAME] == u); }

//Get chatlog object from socket.id.
function getFromSocket(id)
{
    //The reason we loop backwards is because we need to
    //access the latest instance of a match, in case of updated
    //username or color. (Name/color change status messages are included
    //in the chatlog, so even if the user hasn't said anything
    //since the change, it can still be detected.)
    for (chat of chatlog.slice().reverse())
    {
        if (chat[ID] == id)
            return [chat];
    }
    //If id doesn't exist in chatlog.
    return [];
}

//Broadcast message. Takes a 6-element array.
//Name, color, message, timestamp, socket ID,
//and a boolean indicating if this is a status message.
function broadcast(chat)
{
    chatlog.push(chat);
    //Limit to 200 messages.
    while (chatlog.length > 200)
        chatlog.shift();
    io.emit("chat", [chat]);
}

//Emit the update to active users.
function updateActive()
{
    colors = [];
    //We need to access the last matching chat to ensure we get any updated color.
    activeusers.forEach(x =>
    {colors.push(chatlog.filter((user => user[NAME] == x)).slice(-1)[0][COLOR]); });
    io.emit("active", activeusers, colors);
}

//Respond to initial connection.
io.on('connection', (socket) =>
{
    //Handle disconnections.
    socket.on("disconnect", () =>
    {
        //Get the username object representing this socket. If one is
        //found, broadcast its disconnection.
        var soc = getFromSocket(socket.id);
        if (soc.length > 0)
        {
            u = soc[0];
            activeusers = activeusers.filter(user => user != u[NAME]);
            broadcast([u[NAME], u[COLOR], u[NAME] + " has left the chatrrom.",
            getTimestamp(), soc[ID], true]);
            updateActive();
            log("Disconnected from user: " + soc[0][NAME]);
        }
        else
            log("Disconnected from a user who did not log in");
    
    });

    //Handle login requests.
    socket.on("login", (username, color) =>
    {
        function login(u)
        {
            log("Accepting login attempt from " + u);
            socket.emit("login", u);
            socket.emit("chat", chatlog);
            activeusers.push(u);
            broadcast([u, color, u + " has joined the chatrrom.",
            getTimestamp(), socket.id, true]);
            updateActive();
        };

        //Reject if the user is entering a username already in use.
        if (usernameExists(username))
        {
            socket.emit("reject", "ERROR: This username is already in use on this server.");
            log("Rejecting login attempt due to in-use username from " + username);
        }
        //Try to assign the user a default username if they don't enter one.
        else if (!username)
        {
            //Chose a random default name that's not already in use.
            defaultNames = ["Alpha", "Beta", "Delta", "Omicron", "Epsilon",
            "Phi", "Lambda", "Pi", "Psi", "Gamma"].filter(
            name => !usernameExists(name));

            if (defaultNames.length > 0)
                login(defaultNames[0]);
            else
            {
                socket.emit("reject", "ERROR - The server is out of default names to assign.");
                log("Rejecting login attempt due to being out of default usernames");
            }
        }
        else
            login(username);
    });

    //Respond to name-change attempt.
    socket.on("name", (n) =>
    {
        if (usernameExists(n))
            socket.emit("reject", "ERROR - This username has been used previously on the server.");
        else if (!n)
            socket.emit("reject", "ERROR - You must enter a non-empty username.");
        else
        {
            //Get the old username from the socket ID.
            soc = getFromSocket(socket.id)[0];

            socket.emit("name", n);
            activeusers = activeusers.filter(x => soc[NAME] != x);
            activeusers.push(n);
            broadcast([n, soc[COLOR], soc[NAME] + " has changed their nickname to " + n + ".", getTimestamp(), socket.id, true]);
            updateActive();
        }
    });

    //Respond to color change.
    socket.on("color", (c) =>
    {
        //Prepend # in case user didn't specify it.
        if (c.length < 7)
            c = "#" + c;

        if (!(/^#[0-9A-F]{6}$/i.test(c)))
            socket.emit("reject", "ERROR - You have not entered a valid color. Enter one in Hex code format.");
        else
        {
            socket.emit("color", c);
            soc = getFromSocket(socket.id)[0];
            broadcast([soc[NAME], c, soc[NAME] + " has changed their color from " + soc[COLOR] + " to " + c + ".",
            getTimestamp(), socket.id, true]);
            updateActive();
        }
    });

    //Respond to the user sending a chat.
    socket.on("chat", (msg) =>
    {
        //We have to get the last instance of a filtered match
        //in case they've updated their username or color.
        c = getFromSocket(socket.id)[0];
        broadcast([c[NAME], c[COLOR], msg, getTimestamp(), c[ID], false]);
    });
});