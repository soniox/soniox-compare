export const createAudioMixer = () => {
  const context = new AudioContext();
  const destination = context.createMediaStreamDestination();
  const sources = new Map<MediaStream, MediaStreamAudioSourceNode>();

  // Chrome's MP4 muxer can drop the whole video while the audio track has no
  // data yet, so silence flows from the start.
  const silence = context.createConstantSource();
  silence.offset.value = 0;
  silence.connect(destination);
  silence.start();

  return {
    track: destination.stream.getAudioTracks()[0],

    /** Resolves to whether audio is flowing, which autoplay policy decides. */
    async start() {
      await Promise.race([
        context.resume(),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);
      return context.state === "running";
    },

    add(stream: MediaStream) {
      if (sources.has(stream) || stream.getAudioTracks().length === 0) return;
      const source = context.createMediaStreamSource(stream);
      source.connect(destination);
      sources.set(stream, source);
    },

    close() {
      sources.forEach((source) => source.disconnect());
      void context.close();
    },
  };
};
