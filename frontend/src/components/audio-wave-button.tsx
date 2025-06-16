import React, { useRef, useEffect, forwardRef } from "react";
import { type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { useComparison } from "@/contexts/comparison-context";

// --- Animation Customization Constants ---

// BASE VALUES: These control the overall animation characteristics.
const BASE_AMPLITUDE = 8; // The base height of the waves in pixels.
const BASE_SPEED = 0.01; // The base speed of the waves' horizontal movement.
const BASE_FREQUENCY = 0.02; // The base tightness (frequency) of the wave curves.

// SENSITIVITY: These control how much audio input affects the animation.
const AMPLITUDE_SENSITIVITY = 10; // How much overall volume affects wave height. Higher = more reactive.
const SPEED_SENSITIVITY = 0.04; // How much bass frequencies affect wave speed. Higher = more reactive.

// SMOOTHING: Reduces animation jerkiness. Value is 0 to 1. Higher = smoother.
const SMOOTHING_FACTOR = 0.95;

// WAVE DEFINITIONS: Configure individual waves here.
// Each wave's properties are calculated from the base values plus the offsets defined below.
const WAVE_DEFINITIONS = [
  {
    color: "rgba(0,0,0, 0.3)",
    timeOffset: 0, // Initial horizontal offset.
    amplitudeOffset: 5, // Pixels to add/subtract from BASE_AMPLITUDE.
    speedOffset: -0.005, // Value to add/subtract from BASE_SPEED.
    frequencyOffset: 0.001, // Value to add/subtract from BASE_FREQUENCY.
  },
  {
    color: "rgba(0,0,0, 0.15)",
    timeOffset: 2,
    amplitudeOffset: 0,
    speedOffset: 0,
    frequencyOffset: 0.002,
  },
  {
    color: "rgba(0,0,0, 0.05)",
    timeOffset: 4,
    amplitudeOffset: -5,
    speedOffset: 0.005,
    frequencyOffset: -0.001,
  },
];

// --- Component Props ---
export interface AudioWaveButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  enableAnimation?: boolean;
  children: React.ReactNode;
}

/**
 * A button that displays an animated, artistic audio waveform on its background
 * when recording is active. The animation is a fluid, multi-layered sine wave
 * whose amplitude and speed are driven by the user's audio input.
 */
export const AudioWaveButton = forwardRef<
  HTMLButtonElement,
  AudioWaveButtonProps
>(({ className, enableAnimation = true, children, ...props }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { analyserRef, recordingState } = useComparison();
  const animationFrameId = useRef<number>(0);

  const wavesRef = useRef(
    WAVE_DEFINITIONS.map((wave) => ({
      color: wave.color,
      time: wave.timeOffset,
      baseAmplitude: BASE_AMPLITUDE + wave.amplitudeOffset,
      baseSpeed: BASE_SPEED + wave.speedOffset,
      frequency: BASE_FREQUENCY + wave.frequencyOffset,
      amplitudeVariation: AMPLITUDE_SENSITIVITY,
      speedVariation: SPEED_SENSITIVITY,
    }))
  );

  const smoothedLoudnessRef = useRef(0);
  const smoothedBassRef = useRef(0);
  const isPlaying = recordingState === "recording";

  useEffect(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const renderWave = () => {
      animationFrameId.current = requestAnimationFrame(renderWave);
      analyser.getByteFrequencyData(dataArray);

      const totalLoudness = dataArray.reduce((sum, value) => sum + value, 0);
      const averageLoudness = totalLoudness / bufferLength;

      const bassSlice = dataArray.slice(0, Math.floor(bufferLength * 0.2));
      const totalBass = bassSlice.reduce((sum, value) => sum + value, 0);
      const averageBass = totalBass / bassSlice.length || 0;

      smoothedLoudnessRef.current =
        smoothedLoudnessRef.current * SMOOTHING_FACTOR +
        averageLoudness * (1 - SMOOTHING_FACTOR);
      smoothedBassRef.current =
        smoothedBassRef.current * SMOOTHING_FACTOR +
        averageBass * (1 - SMOOTHING_FACTOR);

      // --- Drawing Logic ---
      // Clear the canvas to make it transparent before drawing the new frame.
      context.clearRect(0, 0, canvas.width, canvas.height);
      const centerY = canvas.height / 2;

      wavesRef.current.forEach((wave) => {
        context.fillStyle = wave.color;
        context.beginPath();
        // Start drawing from the bottom-left corner to ensure it's filled to the bottom.
        context.moveTo(0, canvas.height);

        const loudnessFactor = smoothedLoudnessRef.current / 128.0;
        const bassFactor = smoothedBassRef.current / 128.0;
        const currentAmplitude =
          wave.baseAmplitude + wave.amplitudeVariation * loudnessFactor;
        const currentSpeed = wave.baseSpeed + wave.speedVariation * bassFactor;
        wave.time += currentSpeed;

        for (let x = 0; x <= canvas.width; x++) {
          const y =
            centerY +
            currentAmplitude * Math.sin(x * wave.frequency + wave.time);
          context.lineTo(x, y);
        }

        // Draw a line to the bottom-right corner.
        context.lineTo(canvas.width, canvas.height);
        // Close the path, which completes the bottom edge.
        context.closePath();
        context.fill();
      });
    };

    const resizeCanvas = () => {
      if (canvasRef.current && canvasRef.current.parentElement) {
        const parent = canvasRef.current.parentElement;
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };
    const resizeObserver = new ResizeObserver(resizeCanvas);
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }
    resizeCanvas();

    if (isPlaying) {
      renderWave();
    } else {
      // Also clear the canvas when not playing.
      context.clearRect(0, 0, canvas.width, canvas.height);
    }

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      resizeObserver.disconnect();
    };
  }, [isPlaying, analyserRef]);

  return (
    <Button
      className={cn(
        "relative overflow-hidden group transition-colors duration-300",
        // Apply dark theme styles. The button's bg is now the animation's bg.
        "bg-soniox text-white",
        !isPlaying && "hover:bg-gray-800",
        isPlaying && "hover:bg-red-500",
        className
      )}
      ref={ref}
      {...props}
    >
      {enableAnimation && (
        <canvas
          ref={canvasRef}
          className={cn(
            "absolute inset-0 w-full h-full transition-opacity duration-500",
            isPlaying ? "opacity-100" : "opacity-0"
          )}
        />
      )}
      <span className="relative z-10 transition-transform duration-200 group-hover:scale-105">
        {children}
      </span>
    </Button>
  );
});

AudioWaveButton.displayName = "AudioWaveButton";
