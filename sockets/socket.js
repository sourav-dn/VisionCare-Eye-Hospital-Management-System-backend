/**
 * Socket.io event handlers for real-time queue management.
 *
 * Rooms convention:
 *   doctor-{doctorId}       — doctor's personal room (new tickets, status changes)
 *   receptionist            — receptionist room (queue updates)
 *   waiting-room            — public waiting display screen
 */
const initSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // ─── Doctor joins their personal room ──────────────────────────
    socket.on('join-doctor-room', (doctorId) => {
      socket.join(`doctor-${doctorId}`);
      console.log(`[Socket] Doctor ${doctorId} joined room doctor-${doctorId}`);
    });

    // ─── Receptionist joins global receptionist room ────────────────
    socket.on('join-receptionist', () => {
      socket.join('receptionist');
      console.log(`[Socket] Receptionist joined receptionist room`);
    });

    // ─── Waiting room display screen ────────────────────────────────
    socket.on('join-waiting-room', () => {
      socket.join('waiting-room');
      console.log(`[Socket] Waiting room display connected`);
    });

    // ─── Doctor marks they are busy/available ───────────────────────
    socket.on('toggle-availability', (data) => {
      // Broadcast to receptionist room so queue is updated
      io.to('receptionist').emit('doctor-availability-changed', data);
    });

    // ─── Client-side heartbeat acknowledgment ───────────────────────
    socket.on('ping', () => {
      socket.emit('pong');
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
};

module.exports = initSocket;
