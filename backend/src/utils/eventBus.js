import EventEmitter from 'events';

// Event emitter global sederhana untuk broadcast log email ke SSE
const emailEventBus = new EventEmitter();
emailEventBus.setMaxListeners(0);

export default emailEventBus;
