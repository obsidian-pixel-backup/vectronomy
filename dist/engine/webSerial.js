export class WebSerialBridge {
    constructor() {
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.isConnected = false;
        this.onLineReceived = null;
    }
    async connect(baudRate = 115200) {
        try {
            // Check if Web Serial is supported
            if (!('serial' in navigator)) {
                throw new Error('Web Serial API is not supported in this browser.');
            }
            const nav = navigator;
            this.port = await nav.serial.requestPort();
            await this.port.open({ baudRate });
            this.isConnected = true;
            this.setupStreams();
            console.log(`Connected to serial port at ${baudRate} baud.`);
            return true;
        }
        catch (err) {
            console.error('Failed to connect to serial port:', err);
            this.isConnected = false;
            return false;
        }
    }
    async disconnect() {
        if (!this.port)
            return;
        this.isConnected = false;
        if (this.reader) {
            try {
                await this.reader.cancel();
            }
            catch (e) { }
            this.reader.releaseLock();
        }
        if (this.writer) {
            try {
                await this.writer.close();
            }
            catch (e) { }
            this.writer.releaseLock();
        }
        try {
            await this.port.close();
        }
        catch (e) { }
        this.port = null;
        console.log('Disconnected from serial port.');
    }
    setOnLineReceived(callback) {
        this.onLineReceived = callback;
    }
    async setupStreams() {
        if (!this.port)
            return;
        // Use a TextEncoderStream to convert strings to Uint8Array
        const textEncoder = new TextEncoderStream();
        const writableStreamClosed = textEncoder.readable.pipeTo(this.port.writable);
        this.writer = textEncoder.writable.getWriter();
        // Use a TextDecoderStream to convert Uint8Array to strings
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
        this.reader = textDecoder.readable.getReader();
        try {
            let buffer = '';
            while (this.isConnected && this.reader) {
                const { value, done } = await this.reader.read();
                if (done)
                    break;
                if (value) {
                    buffer += value;
                    const lines = buffer.split('\n');
                    // Keep the last partial line in the buffer
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        const cleanLine = line.trim();
                        if (cleanLine && this.onLineReceived) {
                            this.onLineReceived(cleanLine);
                        }
                    }
                }
            }
        }
        catch (err) {
            console.error('Error reading from serial port:', err);
        }
        finally {
            if (this.reader)
                this.reader.releaseLock();
        }
    }
    async sendCommand(cmd) {
        if (!this.isConnected || !this.writer) {
            console.error('Cannot send command. Not connected.');
            return false;
        }
        try {
            await this.writer.write(cmd + '\n');
            return true;
        }
        catch (err) {
            console.error('Error writing to serial port:', err);
            return false;
        }
    }
    async jog(axis, distance, feedrate = 1000) {
        // GRBL Jog Command format: $J=G91 X10 F1000
        const cmd = `$J=G91 ${axis}${distance} F${feedrate}`;
        return this.sendCommand(cmd);
    }
}
//# sourceMappingURL=webSerial.js.map