import { AddProviderButton } from "@/components/controls/add-provider-button";
import { LanguageSelect } from "@/components/controls/language-select";
import { SamplesButton } from "@/components/controls/samples-button";

export const HeaderControls = () => {
  return (
    <div className="flex items-center gap-2">
      <LanguageSelect className="w-auto max-w-[60vw] sm:max-w-[16rem]" />
      <SamplesButton />
      <AddProviderButton />
    </div>
  );
};
