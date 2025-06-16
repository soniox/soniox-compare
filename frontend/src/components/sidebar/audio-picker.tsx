import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Label } from "../ui/label";
import { useComparison } from "@/contexts/comparison-context";
import { Button } from "../ui/button";
import { FileAudio, Upload } from "lucide-react";
import { useState, useRef } from "react";

const PREDEFINED_AUDIO_FILES: { id: string; name: string; url: string }[] = [
  {
    id: "coffee_shop.mp3",
    name: "Coffee shop",
    url: "https://soniox.com/media/examples/coffee_shop.mp3",
  },
  {
    id: "stt_medical.mp3",
    name: "Doctor-patient",
    url: "https://soniox.com/media/examples/stt_medical.mp3",
  },

  {
    id: "mt_zh_en_one_way.mp3",
    name: "Podcast",
    url: "https://soniox.com/media/examples/mt_zh_en_one_way.mp3",
  },
  {
    id: "mt_en_tr_two_way.mp3",
    name: "Trip to Turkey",
    url: "https://soniox.com/media/examples/mt_en_tr_two_way.mp3",
  },
];

export const ChooseAudioFileDialog = ({ disabled }: { disabled?: boolean }) => {
  const { recordingState, setAudio, clearAudio } = useComparison();

  const isRecording = recordingState === "recording";
  const isStarting = recordingState === "starting";
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isFileDialogOpen, setIsFileDialogOpen] = useState(false);

  const handleSelectPredefinedFile = async (url: string, name: string) => {
    console.log("Selected predefined file:", name, url);
    setIsProcessingFile(true);
    clearAudio();
    setAudio(url, name);
    setIsFileDialogOpen(false);
    setIsProcessingFile(false);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleCustomFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log("Selected custom file:", file.name);
      setIsProcessingFile(true);
      const fileUrl = URL.createObjectURL(file);
      clearAudio();
      setAudio(fileUrl, file.name);
      setIsFileDialogOpen(false);
      setIsProcessingFile(false);
      // TODO: Implement streaming logic or trigger it from context

      // Reset file input to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Dialog open={isFileDialogOpen} onOpenChange={setIsFileDialogOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="border-soniox text-soniox hover:border-black"
                disabled={
                  isRecording || isStarting || isProcessingFile || disabled
                }
                aria-label="Select audio file"
              >
                <Upload className="w-4 h-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Select audio file</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Audio Source</DialogTitle>
          <DialogDescription>
            Choose a pre-defined audio file or upload your own.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 w-full">
          <div className="space-y-2 w-full">
            <Label className="text-sm font-medium">
              Pre-defined Audio Files
            </Label>
            <div className="space-y-2">
              {PREDEFINED_AUDIO_FILES.map((file) => (
                <Button
                  key={file.id}
                  variant="ghost"
                  className="relative justify-start text-sm w-full h-10 bg-gray-100 hover:bg-gray-200"
                  onClick={() =>
                    handleSelectPredefinedFile(file.url, file.name)
                  }
                  disabled={isProcessingFile}
                >
                  <div className="absolute inset-0 flex items-center justify-start px-2">
                    <FileAudio className="w-4 h-4 mr-2 opacity-70" />
                    <span className="truncate">{file.name}</span>
                  </div>
                </Button>
              ))}
            </div>
          </div>
          <div className="pt-4 space-y-2">
            <Label className="text-sm font-medium">Upload Custom File</Label>
            <Button
              variant="outline"
              className="w-full mt-1 h-10"
              onClick={triggerFileInput}
              disabled={isProcessingFile}
            >
              <Upload className="w-4 h-4 mr-2 opacity-70" />
              Choose File
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleCustomFileChange}
              className="hidden"
              accept="audio/*"
            />
            <p className="text-xs text-gray-500 mt-1">
              Max file size: 25MB. Supported formats: WAV, MP3, FLAC, etc.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
