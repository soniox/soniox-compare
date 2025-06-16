import React, { useState, useEffect } from "react";
import { ListChecks, Undo2, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "./ui/button";

interface MainLayoutProps {
  sidebarContent: React.ReactNode;
  mainContent: React.ReactNode;
  featureTableContent?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  sidebarContent,
  mainContent,
  featureTableContent,
}) => {
  const [activeView, setActiveView] = useState<"main" | "features">("main");

  return (
    <div className="w-full h-screen flex flex-row font-sans antialiased bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-200 overflow-hidden">
      <Sidebar>{sidebarContent}</Sidebar>

      {/* Main content area */}
      <main className="flex-grow relative h-screen">
        {/* Conditionally render the active view */}
        <div className="w-full h-full">
          {activeView === "main" ? mainContent : featureTableContent}
        </div>

        {/* The ViewSwitcher component handles the UI for changing views */}
        <div className="fixed bottom-6 right-6 flex flex-col items-center gap-3 z-50">
          {activeView === "features" && (
            <button
              onClick={() => setActiveView("main")}
              className={cn(
                "invisible p-3 cursor-pointer rounded-full bg-gray-400/50 text-white hover:bg-black/60 backdrop-blur-xs transition-all duration-200",
                activeView === "features" && "visible"
              )}
              aria-label="Switch to main view"
            >
              <Undo2 size={24} />
            </button>
          )}
          {activeView === "main" && (
            <button
              onClick={() => setActiveView("features")}
              className={cn(
                "invisible p-3 cursor-pointer rounded-full bg-gray-400/50 text-white hover:bg-black/60 backdrop-blur-xs transition-all duration-200",
                activeView === "main" && "visible"
              )}
              aria-label="Switch to features view"
            >
              <ListChecks size={24} />
            </button>
          )}
        </div>
      </main>
    </div>
  );
};

interface SidebarProps {
  children: React.ReactNode;
}

const Sidebar: React.FC<SidebarProps> = ({ children }) => {
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // This effect is used to prevent the sheet from animating when the window is resized and it automatically closes.
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        // Tailwind's default lg breakpoint
        setShouldAnimate(false);
        setIsSheetOpen(false);
        setTimeout(() => {
          setShouldAnimate(true);
        }, 100);
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize(); // Initial check
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      {/* Static Sidebar for larger screens */}
      <aside
        className={cn(
          "sticky top-0 h-screen w-72 flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900",
          "hidden lg:flex" // Always apply these for the static version
        )}
      >
        {children}
      </aside>

      {/* Hamburger menu and Sheet for smaller screens */}
      <div className="lg:hidden absolute top-3 left-0 z-20">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="translate-x-3"
              size="icon"
              aria-label="Clear transcripts"
            >
              <Menu className="w-4 h-4" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className={cn("w-72 p-0", !shouldAnimate && "!duration-0")}
            showCloseButton={false} // Assuming this prop exists as per your previous changes
          >
            {children}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};
