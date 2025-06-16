// frontend/public/audio-processor.js

class AudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(options);

    this.inputSampleRate = options.processorOptions.inputSampleRate;
    this.targetSampleRate = options.processorOptions.targetSampleRate;
    this.buffer = [];
    this.totalInputSamples = 0;
    this.totalOutputSamples = 0;

    this.port.onmessage = (event) => {
      // The 'stop' command is sent from the main thread to flush any remaining audio.
      if (event.data.command === "stop") {
        this.flush();
      }
    };
  }

  // Resamples the audio buffer using simple linear interpolation.
  resample(inputBuffer) {
    const inputLength = inputBuffer.length;
    const outputLength = Math.floor(
      (inputLength * this.targetSampleRate) / this.inputSampleRate
    );
    if (outputLength === 0) {
      return new Float32Array(0);
    }
    const outputBuffer = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const t = (i * (inputLength - 1)) / (outputLength - 1);
      const index = Math.floor(t);
      const frac = t - index;
      const val1 = inputBuffer[index];
      const val2 = inputBuffer[index + 1];

      // If the second sample is undefined (i.e., we are at the end of the input buffer)
      // just use the first sample's value.
      if (val2 === undefined) {
        outputBuffer[i] = val1;
      } else {
        outputBuffer[i] = val1 + (val2 - val1) * frac; // Linear interpolation
      }
    }
    return outputBuffer;
  }

  // Converts a Float32Array to a 16-bit PCM Int16Array.
  floatTo16BitPCM(input) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  // Empties the internal buffer, processes, and sends any remaining audio data.
  flush() {
    if (this.buffer.length > 0) {
      const concatenatedBuffer = new Float32Array(this.buffer.length);
      let offset = 0;
      for (const buffer of this.buffer) {
        concatenatedBuffer.set(buffer, offset);
        offset += buffer.length;
      }
      const resampled = this.resample(concatenatedBuffer);
      if (resampled.length > 0) {
        const pcmData = this.floatTo16BitPCM(resampled);
        this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
      }
      this.buffer = []; // Clear buffer after flushing
    }
  }

  process(inputs, outputs, parameters) {
    // We only process the first channel of the first input.
    const inputChannel = inputs[0][0];

    if (inputChannel) {
      // If the sample rates match, we process directly without resampling.
      if (this.inputSampleRate === this.targetSampleRate) {
        const pcmData = this.floatTo16BitPCM(inputChannel);
        this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
      } else {
        // Otherwise, resample the audio.
        const resampled = this.resample(inputChannel);
        if (resampled.length > 0) {
          const pcmData = this.floatTo16BitPCM(resampled);
          this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
        }
      }
    }

    // Return true to keep the processor alive. It will be stopped by the main thread.
    return true;
  }
}

registerProcessor("audio-processor", AudioProcessor);
