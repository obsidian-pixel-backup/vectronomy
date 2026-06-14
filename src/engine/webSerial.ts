export class WebSerialBridge {
  private port: any = null;
  private reader: any = null;
  private writer: any = null;
  private _connected: boolean = false;

  private onLineReceived: ((line: string) => void) | null = null;

  constructor() {}

  public async connect(baudRate: number = 115200): Promise<boolean> {
    try {
      // Check if Web Serial is supported
      if (!('serial' in navigator)) {
        throw new Error('Web Serial API is not supported in this browser.');
      }

      const nav: any = navigator;
      this.port = await nav.serial.requestPort();
      await this.port.open({ baudRate });

      this._connected = true;
      this.setupStreams();
      
      console.log(`Connected to serial port at ${baudRate} baud.`);
      return true;
    } catch (err: any) {
      console.error('Failed to connect to serial port:', err);
      this._connected = false;
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.port) return;
    
    this._connected = false;

    if (this.reader) {
      try { await this.reader.cancel(); } catch (e) {}
      this.reader.releaseLock();
    }
    
    if (this.writer) {
      try { await this.writer.close(); } catch (e) {}
      this.writer.releaseLock();
    }
    
    try { await this.port.close(); } catch (e) {}
    
    this.port = null;
    console.log('Disconnected from serial port.');
  }

  public isConnected(): boolean { return this._connected; }

  public async sendCode(cmd: string): Promise<boolean> {
    return this.sendCommand(cmd);
  }

  public setOnLineReceived(callback: (line: string) => void) {
    this.onLineReceived = callback;
  }

  private async setupStreams() {
    if (!this.port) return;

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
      while (this._connected && this.reader) {
        const { value, done } = await this.reader.read();
        if (done) break;
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
    } catch (err) {
      console.error('Error reading from serial port:', err);
    } finally {
      if (this.reader) this.reader.releaseLock();
    }
  }

  public async sendCommand(cmd: string): Promise<boolean> {
    if (!this._connected || !this.writer) {
      console.error('Cannot send command. Not connected.');
      return false;
    }

    try {
      await this.writer.write(cmd + '\n');
      return true;
    } catch (err) {
      console.error('Error writing to serial port:', err);
      return false;
    }
  }

  public async jog(axis: 'X' | 'Y' | 'Z', distance: number, feedrate: number = 1000): Promise<boolean> {
    // GRBL Jog Command format: $J=G91 X10 F1000
    const cmd = `$J=G91 ${axis}${distance} F${feedrate}`;
    return this.sendCommand(cmd);
  }
}
