// AudioWorkletProcessor for bit-depth + sample-rate reduction (left HORNS).
// Plain JS: AudioWorklet modules are loaded by URL via audioContext.audioWorklet.addModule()
// and run in a separate global scope that doesn't go through the app's TS build.

class BitcrusherProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "bitDepth", defaultValue: 16, minValue: 1, maxValue: 16 },
      { name: "sampleRateReduction", defaultValue: 1, minValue: 1, maxValue: 48 },
    ];
  }

  constructor() {
    super();
    this._holdValues = [0, 0];
    this._holdCounters = [0, 0];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const bitDepth = parameters.bitDepth;
    const srReduction = parameters.sampleRateReduction;

    for (let channel = 0; channel < output.length; channel++) {
      const inChannel = input[channel];
      const outChannel = output[channel];
      if (!inChannel) continue;

      for (let i = 0; i < outChannel.length; i++) {
        const depth = bitDepth.length > 1 ? bitDepth[i] : bitDepth[0];
        const reduction = Math.max(1, Math.round(srReduction.length > 1 ? srReduction[i] : srReduction[0]));

        if (this._holdCounters[channel] % reduction === 0) {
          const levels = Math.pow(2, depth);
          const quantized = Math.round(inChannel[i] * levels) / levels;
          this._holdValues[channel] = quantized;
        }
        this._holdCounters[channel]++;
        outChannel[i] = this._holdValues[channel];
      }
    }

    return true;
  }
}

registerProcessor("bitcrusher-processor", BitcrusherProcessor);
