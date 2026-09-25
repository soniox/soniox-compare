import { ComparisonProvider } from "@/contexts/comparison-context";
import { MainLayout } from "@/components/main-layout";
import { FooterControls } from "@/components/footer-controls";
import { HeaderControls } from "@/components/header-controls";
import { ProviderGrid } from "@/components/provider-grid";
import { FeatureProvider, useFeatures } from "@/contexts/feature-context";

function App() {
  return (
    <FeatureProvider>
      <AppCore />
    </FeatureProvider>
  );
}

function AppCore() {
  const { providerFeatures, isLoading, error } = useFeatures();

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <img src="/soniox.svg" alt="Soniox Logo" className="w-20" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <p>Error loading features: {error.message}</p>
      </div>
    );
  }

  if (!providerFeatures) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <img src="/soniox.svg" alt="Soniox Logo" className="w-20" />
        <p>No features data available.</p>
      </div>
    );
  }

  return (
    <ComparisonProvider>
      <MainLayout
        mainContent={<ProviderGrid />}
        footerContent={<FooterControls />}
        headerControlsContent={<HeaderControls />}
      />
    </ComparisonProvider>
  );
}

export default App;
