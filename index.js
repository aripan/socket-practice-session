const express = require("express");
const http = require("http");
const dotenv = require("dotenv");
dotenv.config();
const cors = require("cors");
const serverSocket = require("./socket/socket");

const PORT = process.env.PORT || 4000;
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.options("/*", (_, res) => {
  res.sendStatus(200);
});

const server = http.createServer(app);

// start the socket
serverSocket(server);

server.listen(PORT, () =>
  console.log(`👉 Server has started on port ${PORT}`)
);
