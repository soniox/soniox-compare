import { useEffect, useState } from "react";
import { ALL_PROVIDERS_LIST } from "./lib/provider-features";
import { ComparisonProvider } from "@/contexts/comparison-context";
import { z } from "zod";

import { MainLayout } from "@/components/main-layout";
import { ControlPanel } from "@/components/sidebar/control-panel";
import { ProviderGrid } from "@/components/provider-grid";
import { ModelDataProvider } from "./contexts/model-data-context";
import { FeatureComparisonTable } from "@/components/feature-comparison-table";

const featureInfoSchema = z.object({
  state: z.enum(["SUPPORTED", "UNSUPPORTED", "PARTIAL"]),
  comment: z.string().optional(),
});

const providerFeaturesSchema = z.record(
  z.enum(ALL_PROVIDERS_LIST),
  z
    .object({
      name: z.string(),
      model: z.string(),
    })
    .catchall(z.union([z.boolean(), featureInfoSchema]))
);

export type FeatureInfo = z.infer<typeof featureInfoSchema>;

export type ProviderFeatures = z.infer<typeof providerFeaturesSchema>;

function App() {
  const [providerFeatures, setProviderFeatures] =
    useState<ProviderFeatures | null>(null);

  useEffect(() => {
    fetch(`/compare/api/providers-features`)
      .then((res) => res.json())
      .then((data) => {
        try {
          const validatedData = providerFeaturesSchema.parse(data);
          setProviderFeatures(validatedData);
        } catch (err) {
          console.error(
            "[Feature Fetch] Error parsing provider features (sync attempt):",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (err as any).errors || err // Zod errors often have an 'errors' property
          );
        }
      })
      .catch((fetchErr) => {
        console.error(
          "[Feature Fetch] Error fetching provider features:",
          fetchErr
        );
      });
  }, []);

  if (!providerFeatures) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <img src="/compare/ui/soniox.svg" alt="Soniox Logo" className="w-20" />
      </div>
    );
  }

  return (
    <ModelDataProvider>
      <ComparisonProvider
        providers={[...ALL_PROVIDERS_LIST]}
        providerFeatures={providerFeatures}
      >
        <AppCore providerFeatures={providerFeatures} />
      </ComparisonProvider>
    </ModelDataProvider>
  );
}

function AppCore({ providerFeatures }: { providerFeatures: ProviderFeatures }) {
  return (
    <MainLayout
      sidebarContent={<ControlPanel />}
      mainContent={<ProviderGrid />}
      featureTableContent={
        <FeatureComparisonTable providerFeatures={providerFeatures} />
      }
    />
  );
}

export default App;
