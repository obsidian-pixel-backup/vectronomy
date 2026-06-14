/**
 * Phase 3: Hardware Interfaces & Automation
 * Web Serial API for direct GRBL/Ruida machine control
 */
export class MachineController {
  private port: SerialPort | null = null;

  async connect() {
    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 115200 });
      console.log('Connected to CNC/Laser machine via Web Serial');
    } catch (err) {
      console.error('Failed to connect to machine:', err);
    }
  }

  async sendGCode(gcode: string) {
    if (!this.port) return;
    const encoder = new TextEncoderStream();
    const writableStreamClosed = encoder.readable.pipeTo(this.port.writable);
    const writer = encoder.writable.getWriter();
    await writer.write(gcode + '\n');
    writer.releaseLock();
  }
}
