import { FooterControls } from "@/components/footer-controls";
import { HeaderControls } from "@/components/header-controls";
import { MainLayout } from "@/components/main-layout";
import { ProviderGrid } from "@/components/provider-grid";
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
      <MainLayout
        headerControlsContent={<HeaderControls />}
        footerContent={<FooterControls />}
        mainContent={<ProviderGrid />}
      />
    </TtsProvider>
  );
}

export default App;
