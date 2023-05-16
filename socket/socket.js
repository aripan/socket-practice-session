const { Server } = require("socket.io");

module.exports = (server) => {
  let allUsers = [];
  let usersOutsideOfAnArea = [];
  let allVisitors = [];
  let allUsersAtVisitorEntrance = [];

  const io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  const startListeners = (socket) => {
    const requestHeaders = socket.handshake.headers;

    const hasRequiredHeaders =
      "x-user-sub" in requestHeaders &&
      "x-user-name" in requestHeaders &&
      "x-user-email" in requestHeaders &&
      "x-user-type" in requestHeaders;

    if (hasRequiredHeaders) {
      socket.on("client-emit-user-joined", handleUserJoined(socket));
      socket.on(
        "client-emit-user-joined-an-area",
        handleUserJoinedAnArea(socket)
      );

      socket.on("disconnect", handleDisconnect(socket));
    } else {
      console.log("Required headers are missing. Disconnecting...");

      // Disconnect the socket
      socket.disconnect(true);
    }
  };

  io.on("connection", startListeners);
  // console.info("Socket.io server started");

  const handleUserJoined = (socket) => (data) => {
    if (data.type === "user") {
      const user = {
        ...data,
        socketId: socket.id,
      };
      addUserToUsersOutsideOfAnArea(user);
    }
    removeUserFromAllUsers(data?.uid);

    // emits an event to the client with the data
    sendMessages(
      "server-emit-user-joined",
      allUsers,
      allUsers.filter((user) => user.uid !== undefined)
    );

    // emits an event to the host client to receive the invitation
    allVisitors?.map((visitor) => {
      visitor.hostIds.includes(data?.uid) &&
        sendMessages(
          "server-emit-visitor-joined",
          usersOutsideOfAnArea.filter((user) => user.uid === data?.uid),
          visitor
        );
    });
  };

  const handleUserJoinedAnArea = (socket) => (data) => {
    const { localProfile, lastAreaId } = data;
    if (
      localProfile &&
      localProfile?.room &&
      !localProfile?.room.includes("undefined") &&
      !localProfile?.room.includes("visitor") &&
      lastAreaId
    ) {
      const joinedUser = {
        ...localProfile,
        userInThisArea: lastAreaId,
        socketId: socket.id,
      };
      addUserToAllUsers(joinedUser);
      updateUser(joinedUser);
      // updateUser(joinedUser, socket.id);
      removeUserFromUsersOutsideOfAnArea(localProfile.uid);

      // create a socket room for the user
      socket.join(joinedUser.room);

      // emits an event to the client with the data
      io.emit(
        "server-emit-user-joined-an-area",
        allUsers.filter((user) => user.uid !== undefined)
      );

      // emits an event to the host client to receive the invitation
      allVisitors?.map((visitor) => {
        visitor.hostIds.includes(localProfile?.uid) &&
          sendMessages(
            "server-emit-visitor-joined",
            allUsers.filter((user) => user.uid === localProfile?.uid),
            visitor
          );
      });
    }
  };

  const handleDisconnect = (socket) => () => {
    // console.log("��� user disconnected", socket.id);
    removeUserFromAllUsersBySocketId(socket.id);
    removeUserFromUsersOutsideOfAnAreaBySocketId(socket.id);
    removeVisitorFromAllVisitorsBySocketId(socket.id);
    sendMessages(
      "server-emit-user-left-or-logged-out",
      allUsers.filter((user) => user.socketId !== socket.id),
      allUsers.filter((user) => user.uid !== undefined)
    );
  };

  //! important methods
  const addUserToAllUsers = (joinedUser) => {
    if (!allUsers.some((user) => user.uid === joinedUser?.uid)) {
      allUsers.push(joinedUser);
    }
  };

  const addUserToUsersOutsideOfAnArea = (userData) => {
    if (!usersOutsideOfAnArea.some((user) => user.uid === userData?.uid)) {
      usersOutsideOfAnArea.push(userData);
    }
  };

  const updateUser = (newData) => {
    const index = allUsers.findIndex((user) => user.uid === newData?.uid);

    if (index > -1) {
      allUsers[index] = { ...allUsers[index], ...newData };
    } else {
      console.log("No matching object found to update");
    }
  };

  const removeUserFromAllUsers = (id) => {
    allUsers = allUsers.filter((user) => user.uid !== id);
  };
  const removeUserFromUsersOutsideOfAnArea = (id) => {
    usersOutsideOfAnArea = usersOutsideOfAnArea.filter(
      (user) => user.uid !== id
    );
  };

  const removeUserFromAllUsersBySocketId = (id) => {
    allUsers = allUsers.filter((user) => user.socketId !== id);
  };
  const removeUserFromUsersOutsideOfAnAreaBySocketId = (id) => {
    usersOutsideOfAnArea = usersOutsideOfAnArea.filter(
      (user) => user.socketId !== id
    );
  };
  const removeVisitorFromAllVisitorsBySocketId = (id) => {
    allVisitors = allVisitors.filter((visitor) => visitor.socketId !== id);
  };

  const sendMessages = (eventName, users, payloadInfo) => {
    // console.log(`🥍 Emitting event: ${eventName} to ${users}`);
    const emitFunction = (user) => {
      payloadInfo
        ? io.to(user.socketId).emit(eventName, payloadInfo)
        : io.to(user.socketId).emit(eventName);
    };

    Array.isArray(users) ? users.forEach(emitFunction) : emitFunction(users);
  };

  return io;
};
