import { FooterControls } from "@/components/footer-controls";
import { HeaderControls } from "@/components/header-controls";
import { MainLayout } from "@/components/main-layout";
import { ProviderGrid } from "@/components/provider-grid";
import { SessionRecorder } from "@/components/session-recorder";
import { ConfigProvider } from "@/contexts/config-context";
import { TtsProvider } from "@/contexts/tts-context";

function App() {
  return (
    <ConfigProvider>
      <AppCore />
    </ConfigProvider>
  );
}

function AppCore() {
  return (
    <TtsProvider>
      <SessionRecorder>
        <MainLayout
          headerControlsContent={<HeaderControls />}
          footerContent={<FooterControls />}
          mainContent={<ProviderGrid />}
        />
      </SessionRecorder>
    </TtsProvider>
  );
}

export default App;
