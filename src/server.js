const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');

const port = process.env.PORT || process.env.NODE_PORT || 3000;

let index = fs.readFileSync(`${__dirname}/../client/index.html`);

const onRequest = (request, response) => {
  // Reloads web page on each request to preserve developer sanity
  index = fs.readFileSync(`${__dirname}/../client/index.html`);

  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.write(index);
  response.end();
};

const app = http.createServer(onRequest).listen(port);

console.log(`Listening on 127.0.0.1: ${port}`);

const io = socketio(app);

const objMaker = (x, y, r) =>{
  return Object.seal({
    x: x,
    y: y,
    radius: r,
    xSpeed: 0,
    ySpeed: 0,
    acceleration: -10,
  });
}

let players = {};
let ball = objMaker(0.5,0,15);

io.sockets.on('connection', (socket) => {
  console.log('connected');

  // When an answer is recieved from the client, it puts it in the answers array
  socket.on('update', (data) => {

  });

  // When the game is joined, puts user in a room and acts depending on current game state
  socket.on('joinGame', () => {
    socket.join('room1');
  });
});


console.log('Websocket server started');









const gameLoop = () => {
  //io.sockets.emit("update", {msg: "frame!"});
}
setInterval(gameLoop, 1000/60);































// / Checks collisions between two circles, with given points and radii
const checkCollision = (p1, r1, p2, r2) => {
  // Makes sure a and b exist
  if(!p1 || !r1 || !p2 || !r2) return;

  // Filters out colliders too far from each other to simplify calculations
  let maxDist = Math.max(r1, r2) * 2;
  if(Math.abs(p1.x - p2.x) > maxDist) return false;
  if(Math.abs(p1.y - p2.y) > maxDist) return false;

  // Checks distance between centers with squared values
  let distSqr = Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2);
  let radiiSum = r1 + r2;
  if(distSqr < Math.pow(radiiSum, 2)) return true;
  return false;
};
