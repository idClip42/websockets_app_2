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

const objMaker = (x, y, r, m, a, c) => Object.seal({
  x,
  y,
  radius: r,
  xSpeed: 0,
  ySpeed: 0,
  xAccel: 0,
  yAccel: a,
  drag: 0.5,
  mass: m,
  target: undefined,
  color: c,
});

const WIDTH = 800;
const HEIGHT = 600;
const players = {};
const ball = objMaker(
  WIDTH / 2,
  0,
  15,
  5,
  200,
  'orange');
const frameTime = 1000 / 60;

io.sockets.on('connection', (socket) => {
  console.log('connected');

  // When an answer is recieved from the client, it puts it in the answers array
  socket.on('update', (data) => {
    const obj = players[socket.id];
    if (!obj) return;
    obj.target = data;
  });

  // When the game is joined, puts user in a room and adds them to list
  socket.on('joinGame', () => {
    socket.join('room1');
    players[socket.id] = objMaker(
      WIDTH / 2,
      HEIGHT,
      30,
      1,
      0,
      'blue');
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.sockets.emit('delete', socket.id);
  });
});


console.log('Websocket server started');


const addBaskets = () => {
  // players["basket1"] = objMaker(x, y, r, m, a, c);
  let topLeftX = 30;
  const topLeftY = 200;
  const rad = 10;
  const width = 50;
  players.basket1 = objMaker(topLeftX, topLeftY, rad, 10, 0, 'gray');
  players.basket2 = objMaker(topLeftX, topLeftY + rad * 2, rad, 10, 0, 'gray');
  players.basket3 = objMaker(topLeftX + width, topLeftY, rad, 10, 0, 'gray');
  players.basket4 = objMaker(topLeftX + width, topLeftY + rad * 2, rad, 10, 0, 'gray');
  players.basket5 = objMaker(topLeftX, topLeftY + rad * 4, rad, 10, 0, 'gray');
  players.basket6 = objMaker(topLeftX + width, topLeftY + rad * 4, rad, 10, 0, 'gray');

  topLeftX = 720;

  players.basket11 = objMaker(topLeftX, topLeftY, rad, 10, 0, 'gray');
  players.basket12 = objMaker(topLeftX, topLeftY + rad * 2, rad, 10, 0, 'gray');
  players.basket13 = objMaker(topLeftX + width, topLeftY, rad, 10, 0, 'gray');
  players.basket14 = objMaker(topLeftX + width, topLeftY + rad * 2, rad, 10, 0, 'gray');
  players.basket15 = objMaker(topLeftX, topLeftY + rad * 4, rad, 10, 0, 'gray');
  players.basket16 = objMaker(topLeftX + width, topLeftY + rad * 4, rad, 10, 0, 'gray');
};
addBaskets();


const gameLoop = () => {
  doPhysics();
  const obj = {
    ball,
    players,
  };
  io.sockets.emit('update', obj);
};
setInterval(gameLoop, frameTime);


const doPhysics = () => {
  ballCollisions();
  applyPhysics(ball);

  const keys = Object.keys(players);
  for (let n = 0; n < keys.length; ++n) {
    applyPhysics(players[keys[n]]);
  }

  respawnBall();
};

const applyPhysics = (obj) => {
  if (obj.target) {
    // obj.xAccel = (obj.target.x - obj.x) * Math.abs(obj.target.x - obj.x);
    // obj.yAccel = (obj.target.y - obj.y) * Math.abs(obj.target.y - obj.y);
    obj.xSpeed = (obj.target.x - obj.x) * 10;
    obj.ySpeed = (obj.target.y - obj.y) * 10;
  }

  obj.xSpeed += obj.xAccel * frameTime / 1000;
  obj.xSpeed -= obj.xSpeed * obj.drag * frameTime / 1000;

  obj.ySpeed += obj.yAccel * frameTime / 1000;
  obj.ySpeed -= obj.ySpeed * obj.drag * frameTime / 1000;

  obj.x += obj.xSpeed * frameTime / 1000;
  obj.y += obj.ySpeed * frameTime / 1000;
};

const ballCollisions = () => {
  const keys = Object.keys(players);
  for (let n = 0; n < keys.length; ++n) {
    const p = players[keys[n]];
    if (checkCollision(ball, p) == true) {
      ball.xSpeed = (ball.xSpeed * ball.mass + p.xSpeed * p.mass) / ball.mass;
      ball.ySpeed = (ball.ySpeed * ball.mass + p.ySpeed * p.mass) / ball.mass;

      const pythag = Math.sqrt((ball.x - p.x) ** 2 + (ball.y - p.y) ** 2);
      ball.x = p.x + (ball.x - p.x) / pythag * (p.radius + ball.radius);
      ball.y = p.y + (ball.y - p.y) / pythag * (p.radius + ball.radius);
    }
  }
};

const respawnBall = () => {
  if (ball.y > HEIGHT) {
    ball.y = 0;
    ball.x = WIDTH / 2;
    ball.xSpeed = 0;
    ball.ySpeed = 0;
  }

  if ((ball.x < 0 && ball.xSpeed < 0) || (ball.x > WIDTH && ball.xSpeed > 0)) { ball.xSpeed *= -1; }
  if (ball.y < 0 && ball.ySpeed < 0) { ball.ySpeed *= -1; }
};


// / Checks collisions between two circles, with given points and radii
const checkCollision = (obj1, obj2) => {
  // Makes sure a and b exist
  if (!obj1 || !obj2) return false;

  // Filters out colliders too far from each other to simplify calculations
  const maxDist = Math.max(obj1.radius, obj2.radius) * 2;
  if (Math.abs(obj1.x - obj2.x) > maxDist) return false;
  if (Math.abs(obj1.y - obj2.y) > maxDist) return false;

  // Checks distance between centers with squared values
  const distSqr = obj2.x - obj1.x ** 2 + obj2.y - obj1.y ** 2;
  const radiiSum = obj1.radius + obj2.radius;
  if (distSqr < radiiSum ** 2) return true;
  return false;
};
