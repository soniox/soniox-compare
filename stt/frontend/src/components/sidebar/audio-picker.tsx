import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { useComparison } from "@/contexts/comparison-context";
import { useUrlSettings, type UrlSettings } from "@/hooks/use-url-settings";
import { Button } from "../ui/button";
import { ChevronRight, FileAudio, Upload } from "lucide-react";
import { useState, useRef } from "react";
import { ResponsiveTooltip } from "../ui/responsive-tooltip";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

// Recommended settings applied automatically when a sample file is selected.
type AudioFileDefaults = Partial<
  Pick<
    UrlSettings,
    | "languageHints"
    | "enableSpeakerDiarization"
    | "enableLanguageIdentification"
    | "enableEndpointDetection"
  >
>;

const PREDEFINED_AUDIO_FILES: {
  id: string;
  name: string;
  languages: string;
  url: string;
  defaults: AudioFileDefaults;
}[] = [
  {
    id: "business_call_aug.flac",
    name: "Business call",
    languages: "English & French",
    url: "https://soniox.com/media/examples/business_call_aug.flac",
    defaults: {
      languageHints: ["en", "fr"],
      enableSpeakerDiarization: true,
      enableLanguageIdentification: true,
    },
  },
  {
    id: "customer_support_en_aug.flac",
    name: "Customer support",
    languages: "English",
    url: "https://soniox.com/media/examples/customer_support_en_aug.flac",
    defaults: {
      languageHints: ["en"],
      enableSpeakerDiarization: true,
    },
  },
  {
    id: "feedback_session_aug.flac",
    name: "Feedback session",
    languages: "English, Italian, Korean",
    url: "https://soniox.com/media/examples/feedback_session_aug.flac",
    defaults: {
      languageHints: ["en", "it", "ko"],
      enableSpeakerDiarization: true,
      enableLanguageIdentification: true,
    },
  },
  {
    id: "medical_dictation.flac",
    name: "Medical dictation",
    languages: "English",
    url: "https://soniox.com/media/examples/medical_dictation.flac",
    defaults: {
      languageHints: ["en"],
      enableSpeakerDiarization: false,
      enableEndpointDetection: true,
    },
  },
  {
    id: "meeting_schedule_en_hi_aug.flac",
    name: "Meeting schedule",
    languages: "English, Hindi",
    url: "https://soniox.com/media/examples/meeting_schedule_en_hi_aug.flac",
    defaults: {
      languageHints: ["en", "hi"],
      enableSpeakerDiarization: true,
      enableLanguageIdentification: true,
    },
  },
];

const MAX_FILE_MB = 25;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

export const ChooseAudioFileDialog = ({ disabled }: { disabled?: boolean }) => {
  const { recordingState, setAudio, clearAudio } = useComparison();
  const { setSettings } = useUrlSettings();

  const isRecording = recordingState === "recording";
  const isStarting = recordingState === "starting";
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isFileDialogOpen, setIsFileDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const handleSelectPredefinedFile = async (
    url: string,
    name: string,
    defaults?: AudioFileDefaults
  ) => {
    setIsProcessingFile(true);
    clearAudio();
    setAudio(url, name);
    if (defaults) {
      // A sample's defaults are partial, so reset the rest first — otherwise a
      // flag switched on by the previously selected sample stays on.
      setSettings({
        languageHints: [],
        enableSpeakerDiarization: false,
        enableLanguageIdentification: false,
        enableEndpointDetection: false,
        ...defaults,
      });
    }
    setIsFileDialogOpen(false);
    setIsProcessingFile(false);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const processFile = (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setFileError(`File is too large (max ${MAX_FILE_MB} MB).`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFileError(null);
    setIsProcessingFile(true);
    const fileUrl = URL.createObjectURL(file);
    clearAudio();
    setAudio(fileUrl, file.name);
    setIsFileDialogOpen(false);
    setIsProcessingFile(false);
    // Reset file input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCustomFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    if (isProcessingFile) return;
    const file = event.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (event: React.DragEvent) => {
    // Prevent the browser from opening the file; required for `onDrop` to fire.
    event.preventDefault();
    if (!isProcessingFile) setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    // Ignore leave events bubbling up from children inside the zone.
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  return (
    <Dialog open={isFileDialogOpen} onOpenChange={setIsFileDialogOpen}>
      <TooltipProvider>
        <ResponsiveTooltip content={<p>Select audio file</p>}>
          <DialogTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className="shrink-0"
              disabled={
                isRecording || isStarting || isProcessingFile || disabled
              }
              aria-label="Select audio file"
            >
              <Upload className="w-4 h-4" />
            </Button>
          </DialogTrigger>
        </ResponsiveTooltip>
      </TooltipProvider>
      <DialogContent
        showCloseButton
        overlayClassName="bg-black/10 backdrop-blur-[2px]"
        className="flex max-h-[min(85vh,760px)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle className="text-lg font-semibold">
            Select audio source
          </DialogTitle>
          <DialogDescription>
            Pick a sample file or upload your own to compare providers.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
          <section>
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Upload your own
            </h3>
            <button
              type="button"
              onClick={triggerFileInput}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              disabled={isProcessingFile}
              className={cn(
                "group flex w-full cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:flex-col sm:justify-center sm:gap-2 sm:py-6 sm:text-center",
                isDragging
                  ? "border-soniox bg-soniox/10"
                  : "border-zinc-300 bg-zinc-50/60 hover:border-soniox hover:bg-soniox/5 dark:border-zinc-700 dark:bg-zinc-800/40 dark:hover:border-soniox"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-soniox/10 text-soniox transition-transform sm:h-11 sm:w-11",
                  isDragging ? "scale-110" : "group-hover:scale-110"
                )}
              >
                <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
              </span>
              <span className="flex min-w-0 flex-col sm:items-center">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  {isDragging ? (
                    "Drop your file here"
                  ) : (
                    <>
                      <span className="sm:hidden">Choose a file</span>
                      <span className="hidden sm:inline">
                        Choose a file or drag it here
                      </span>
                    </>
                  )}
                </span>
                <span className="text-xs text-zinc-400">
                  WAV, MP3, FLAC and more · up to 25MB
                </span>
              </span>
            </button>
            {fileError && (
              <p className="mt-2 px-1 text-xs font-medium text-red-600 dark:text-red-500">
                {fileError}
              </p>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleCustomFileChange}
              className="hidden"
              accept="audio/*"
            />
          </section>

          <section>
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Sample files
            </h3>
            <div className="flex flex-col gap-1">
              {PREDEFINED_AUDIO_FILES.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() =>
                    handleSelectPredefinedFile(
                      file.url,
                      file.name,
                      file.defaults
                    )
                  }
                  disabled={isProcessingFile}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                    "cursor-pointer hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800"
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-soniox/10 text-soniox">
                    <FileAudio className="h-4 w-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm leading-tight text-zinc-800 dark:text-zinc-100">
                      {file.name}
                    </span>
                    {file.languages && (
                      <span className="truncate text-xs leading-tight text-zinc-400">
                        {file.languages}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400" />
                </button>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
